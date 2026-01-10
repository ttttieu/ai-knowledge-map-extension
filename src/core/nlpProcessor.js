/**
 * NLP Processor module for cleaning and processing AI-generated responses
 * Handles extraction of main points and expansion nodes for knowledge mapping
 */

/**
 * Identifies and extracts text sections: Introduction, Main Content, Expansion/Next Steps
 * Looks for common section markers in multiple languages
 * @param {string} text - The input text to search
 * @returns {Object} { introduction, mainContent, expansionContent }
 */
const extractSections = (text) => {
  if (!text || typeof text !== 'string') {
    return { introduction: '', mainContent: text, expansionContent: '' };
  }

  let introduction = '';
  let mainContent = text;
  let expansionContent = '';

  // Regex patterns for expansion/next steps markers (Vietnamese and English)
  const expansionPatterns = [
    /(?:^|\n)(Ngoài ra|Next steps?|Tiếp theo|You might|Further exploration|Additional resources?|See also|Related topics?|Consider also|Additionally|Moreover|Furthermore)[\s\S]*$/im,
    /(?:^|\n)(##\s+)(Expansion|Next Steps|Tiếp Theo|Further Reading)[\s\S]*$/im,
    /(?:^|\n)(?:---|\*\*\*|===)[\s\S]*$/m
  ];

  // Find expansion section
  let expansionIndex = -1;
  for (const pattern of expansionPatterns) {
    const match = text.match(pattern);
    if (match) {
      expansionIndex = text.indexOf(match[0]);
      break;
    }
  }

  // Split main content and expansion
  if (expansionIndex > -1) {
    mainContent = text.substring(0, expansionIndex).trim();
    expansionContent = text.substring(expansionIndex).trim();
  }

  // Extract introduction (first paragraph before first bullet point)
  const introPattern = /^([^-*•\n]+(?:\n[^-*•\n]+)*)/;
  const introMatch = mainContent.match(introPattern);
  if (introMatch) {
    introduction = introMatch[1].trim();
    // Remove introduction from main content
    mainContent = mainContent.substring(introMatch[0].length).trim();
  }

  return { introduction, mainContent, expansionContent };
};

/**
 * Cleans AI-generated text by removing extra whitespace and normalizing formatting
 * @param {string} rawText - The raw AI response text
 * @returns {string} Cleaned text
 */
const cleanText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  let cleaned = rawText;

  // Remove excessive whitespace and normalize line breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/\t/g, '  ');
  cleaned = cleaned.trim();

  // Remove markdown code block markers if present at start/end
  cleaned = cleaned.replace(/^```[\w]*\n?/, '');
  cleaned = cleaned.replace(/\n?```$/, '');

  // Normalize heading levels
  cleaned = cleaned.replace(/^#+\s+/gm, (match) => {
    const level = Math.min(match.length - 1, 3); // Cap at h3
    return '#'.repeat(level) + ' ';
  });

  // Clean up multiple spaces
  cleaned = cleaned.replace(/  +/g, ' ');

  return cleaned;
};

/**
 * Processes AI response using GPT-4o-mini for structured JSON output
 * Requires OPENAI_API_KEY in Chrome storage (local)
 * @param {string} text - The AI response text to process
 * @returns {Promise<Array>} Array of node objects with { title, content, type, status }
 */
const processWithGPT4 = async (text) => {
  try {
    // Get API key from Chrome local storage
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['OPENAI_API_KEY'], resolve);
    });

    const apiKey = result.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('OpenAI API key not found in chrome.storage.local');
      return [];
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract and structure the following text into nodes. Identify CORE nodes (main topics) and EXPANSION nodes (suggestions/future work). Return only a valid JSON array with objects containing: title (string, max 100 chars), content (string, max 1000 chars), type ("CORE" or "EXPANSION"), status ("completed" or "pending"). Be concise and accurate.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Unexpected API response format');
    }

    const content = data.choices[0].message.content;

    // Parse JSON response - extract array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('No JSON array found in API response');
      return [];
    }

    const nodes = JSON.parse(jsonMatch[0]);

    // Validate and normalize nodes
    return nodes.map((node) => ({
      title: String(node.title || 'Untitled').substring(0, 100),
      content: String(node.content || '').substring(0, 1000),
      type: ['CORE', 'EXPANSION'].includes(node.type) ? node.type : 'CORE',
      status: ['completed', 'pending'].includes(node.status) ? node.status : 'pending'
    }));
  } catch (error) {
    console.error('Error processing with GPT-4o-mini:', error);
    return [];
  }
};

/**
 * Main function: Processes AI response and structures it into nodes
 * Identifies Introduction, Main Content, and Expansion/Next Steps sections
 * Attempts to use GPT-4o-mini if API key is available, falls back to manual extraction
 * @param {string} rawText - The raw AI response
 * @returns {Promise<Array>} Array of node objects: { title, content, type: 'CORE'|'EXPANSION', status: 'completed'|'pending' }
 */
export const processAIResponse = async (rawText) => {
  try {
    if (!rawText || typeof rawText !== 'string') {
      console.error('Invalid input: rawText must be a non-empty string');
      return [];
    }

    // Step 1: Clean the text
    const cleanedText = cleanText(rawText);

    // Step 2: Extract sections (Introduction, Main Content, Expansion)
    const { introduction, mainContent, expansionContent } = extractSections(cleanedText);

    // Step 3: Try to process with GPT-4o-mini
    let nodes = [];
    try {
      nodes = await processWithGPT4(cleanedText);
    } catch (error) {
      console.warn('GPT processing failed, falling back to manual extraction:', error);
    }

    // Step 4: Fallback to manual extraction if GPT didn't return results
    if (nodes.length === 0) {
      nodes = extractManualNodes(mainContent, expansionContent);
    }

    // Step 5: Ensure all nodes have correct structure
    return nodes.map(node => ({
      title: node.title || 'Untitled',
      content: node.content || '',
      type: ['CORE', 'EXPANSION'].includes(node.type) ? node.type : 'CORE',
      status: ['completed', 'pending'].includes(node.status) ? node.status : 'pending'
    }));

  } catch (error) {
    console.error('Error processing AI response:', error);
    return [];
  }
};

/**
 * Fallback function to manually extract nodes without GPT
 * Parses main points and expansion items from text structure
 * @param {string} mainContent - The main content section
 * @param {string} expansionContent - The expansion section
 * @returns {Array} Array of node objects
 */
const extractManualNodes = (mainContent, expansionContent) => {
  const nodes = [];
  const bulletPattern = /^[\s]*[-*•]\s+(.+?)(?=\n|$)/gm;

  // Parse main content bullets as CORE nodes
  let match;
  while ((match = bulletPattern.exec(mainContent)) !== null) {
    if (match[1] && match[1].trim().length > 0) {
      const text = match[1].trim();
      nodes.push({
        title: text.substring(0, 100),
        content: text,
        type: 'CORE',
        status: 'completed'
      });
    }
  }

  // Parse expansion content bullets as EXPANSION nodes
  if (expansionContent) {
    const expansionPattern = /^[\s]*[-*•]\s+(.+?)(?=\n|$)/gm;
    while ((match = expansionPattern.exec(expansionContent)) !== null) {
      if (match[1] && match[1].trim().length > 0) {
        const text = match[1].trim();
        nodes.push({
          title: text.substring(0, 100),
          content: text,
          type: 'EXPANSION',
          status: 'pending'
        });
      }
    }
  }

  // If no bullet points found, create a single node from main content
  if (nodes.length === 0 && mainContent.trim().length > 0) {
    const title = mainContent.substring(0, 100).replace(/\n.*/s, '');
    nodes.push({
      title: title || 'Untitled',
      content: mainContent,
      type: 'CORE',
      status: 'completed'
    });
  }

  return nodes;
};
// Export helper functions for testing and direct use
export { extractSections, cleanText, extractManualNodes, processWithGPT4 };

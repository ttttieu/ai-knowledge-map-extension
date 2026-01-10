/**
 * Smart Parser for AI-Generated Content
 * Handles parsing of tables, lists, and text with high precision
 * Returns structured nodes optimized for knowledge map visualization
 */

/**
 * Clean text by removing UI noise (Copy buttons, SVGs, code language labels)
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned text
 */
const cleanText = (text) => {
  if (!text) return '';

  return text
    // Remove 'Copy' button text
    .replace(/\bcopy\b/gi, '')
    // Remove code language labels (python, javascript, etc.)
    .replace(/^(python|javascript|typescript|java|csharp|cpp|rust|go|ruby|php|swift|kotlin|scala|r|matlab|bash|shell|sql|html|css|xml|json|yaml|toml)\s*/gim, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
};

/**
 * Clean an element by removing unwanted nodes (SVGs, script tags, etc.)
 * @param {Element} element - Element to clean
 * @returns {Element} Cloned and cleaned element
 */
const cleanElement = (element) => {
  const clone = element.cloneNode(true);
  
  // Remove SVGs, scripts, styles, and button elements
  const unwanted = clone.querySelectorAll(
    'svg, script, style, button, [role="button"], .copy-button, [class*="copy"]'
  );
  unwanted.forEach(el => el.remove());
  
  return clone;
};

/**
 * Parse table data into nodes
 * Maps each row to a node with headers included for context
 * @param {Element} table - Table element
 * @param {number} startIndex - Starting index for node numbering
 * @returns {Array} Array of node objects
 */
const parseTable = (table, startIndex = 0) => {
  const nodes = [];
  const headers = [];
  let rowIndex = startIndex;

  try {
    // Extract headers
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr:first-child');
    if (headerRow) {
      const headerCells = headerRow.querySelectorAll('th, td');
      headerCells.forEach(cell => {
        headers.push(cleanText(cell.textContent));
      });
    }

    // Extract data rows
    const rows = table.querySelectorAll('tbody tr') || 
                 Array.from(table.querySelectorAll('tr')).slice(headers.length > 0 ? 1 : 0);

    rows.forEach((row, idx) => {
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) return;

      const rowData = [];
      cells.forEach((cell, cellIdx) => {
        const header = headers[cellIdx] || `Column ${cellIdx + 1}`;
        const value = cleanText(cell.textContent);
        rowData.push(`${header}: ${value}`);
      });

      const content = rowData.join(' | ');

      nodes.push({
        type: 'TABLE_ROW',
        title: `Table Row ${idx + 1}`,
        content: content,
        metadata: {
          sourceIndex: rowIndex,
          groupName: 'Table Data'
        }
      });

      rowIndex++;
    });

  } catch (error) {
    console.error('❌ Error parsing table:', error);
  }

  return nodes;
};

/**
 * Parse list items into individual nodes
 * Each <li> becomes an atomic node
 * @param {Element} list - List element (ul or ol)
 * @param {number} startIndex - Starting index for node numbering
 * @returns {Array} Array of node objects
 */
const parseList = (list, startIndex = 0) => {
  const nodes = [];
  let itemIndex = startIndex;

  try {
    const items = list.querySelectorAll('li');
    const isManyItems = items.length > 10;

    items.forEach((item, idx) => {
      const content = cleanText(item.textContent);

      if (content.trim().length === 0) return;

      nodes.push({
        type: isManyItems ? 'EXPANSION' : 'CORE',
        title: content.length > 60 ? content.substring(0, 57) + '...' : content,
        content: content,
        metadata: {
          sourceIndex: itemIndex,
          groupName: 'List Items'
        }
      });

      itemIndex++;
    });

  } catch (error) {
    console.error('❌ Error parsing list:', error);
  }

  return nodes;
};

/**
 * Parse plain text by splitting on double newlines
 * Creates 'Concept' nodes for paragraphs
 * @param {string} text - Text to parse
 * @param {number} startIndex - Starting index for node numbering
 * @returns {Array} Array of node objects
 */
const parseText = (text, startIndex = 0) => {
  const nodes = [];
  let conceptIndex = startIndex;

  try {
    // Split by double newlines or paragraph breaks
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => cleanText(p))
      .filter(p => p.length > 0);

    paragraphs.forEach((paragraph, idx) => {
      // Split long paragraphs by sentences for better granularity
      const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);

      if (sentences.length > 3) {
        // Multiple sentences: create sub-nodes
        sentences.forEach((sentence, sentIdx) => {
          const trimmedSentence = cleanText(sentence);
          if (trimmedSentence.length > 0) {
            nodes.push({
              type: 'EXPANSION',
              title: trimmedSentence.length > 60 ? trimmedSentence.substring(0, 57) + '...' : trimmedSentence,
              content: trimmedSentence,
              metadata: {
                sourceIndex: conceptIndex,
                groupName: 'Concepts'
              }
            });
            conceptIndex++;
          }
        });
      } else {
        // Few sentences: single node
        nodes.push({
          type: 'CORE',
          title: paragraph.length > 60 ? paragraph.substring(0, 57) + '...' : paragraph,
          content: paragraph,
          metadata: {
            sourceIndex: conceptIndex,
            groupName: 'Concepts'
          }
        });
        conceptIndex++;
      }
    });

  } catch (error) {
    console.error('❌ Error parsing text:', error);
  }

  return nodes;
};

/**
 * Parse code blocks into nodes
 * @param {Element} codeBlock - Code block element
 * @param {number} startIndex - Starting index for node numbering
 * @returns {Array} Array of node objects
 */
const parseCodeBlocks = (codeBlock, startIndex = 0) => {
  const nodes = [];

  try {
    const codeText = cleanText(codeBlock.textContent);

    if (codeText.length === 0) return nodes;

    // Extract language if present
    const preElement = codeBlock.tagName === 'PRE' ? codeBlock : codeBlock.closest('pre');
    const languageClass = preElement?.className.match(/language-(\w+)/)?.[1] || 'code';

    nodes.push({
      type: 'EXPANSION',
      title: `Code Block (${languageClass})`,
      content: codeText,
      metadata: {
        sourceIndex: startIndex,
        groupName: 'Code Snippets'
      }
    });

  } catch (error) {
    console.error('❌ Error parsing code block:', error);
  }

  return nodes;
};

/**
 * Main parser function
 * Analyzes element for tables, lists, and text
 * Returns array of structured nodes
 * @param {Element} element - DOM element containing content
 * @returns {Promise<Array>} Array of node objects
 */
export async function parseContent(element) {
  console.log('📊 Parsing content...');

  const nodes = [];
  let nodeIndex = 0;

  try {
    // Handle string input
    let targetElement = element;
    if (typeof element === 'string') {
      const temp = document.createElement('div');
      temp.innerHTML = element;
      targetElement = temp;
    }

    // Clean the element first
    const cleanedElement = cleanElement(targetElement);

    // Check for tables first (highest priority)
    const tables = cleanedElement.querySelectorAll('table');
    if (tables.length > 0) {
      console.log(`📋 Found ${tables.length} table(s)`);
      tables.forEach((table, idx) => {
        const tableNodes = parseTable(table, nodeIndex);
        nodes.push(...tableNodes);
        nodeIndex += tableNodes.length;
      });
    }

    // Check for lists (second priority)
    const lists = cleanedElement.querySelectorAll('ul, ol');
    if (lists.length > 0) {
      console.log(`📝 Found ${lists.length} list(s)`);
      lists.forEach((list, idx) => {
        const listNodes = parseList(list, nodeIndex);
        nodes.push(...listNodes);
        nodeIndex += listNodes.length;
      });
    }

    // Check for code blocks
    const codeBlocks = cleanedElement.querySelectorAll('pre, code[class*="language"]');
    if (codeBlocks.length > 0) {
      console.log(`💻 Found ${codeBlocks.length} code block(s)`);
      codeBlocks.forEach((codeBlock, idx) => {
        const codeNodes = parseCodeBlocks(codeBlock, nodeIndex);
        nodes.push(...codeNodes);
        nodeIndex += codeNodes.length;
      });
    }

    // Fallback: parse remaining text
    if (nodes.length === 0) {
      const text = cleanText(cleanedElement.textContent);
      if (text.length > 0) {
        console.log('📄 Parsing text content');
        const textNodes = parseText(text, nodeIndex);
        nodes.push(...textNodes);
      }
    }

    // Create root node if we have sub-nodes
    if (nodes.length > 0 && nodes.length < 20) {
      // For small number of nodes, promote first one to CORE
      if (nodes[0].type === 'EXPANSION') {
        nodes[0].type = 'CORE';
      }
    }

    console.log(`✅ Parsed ${nodes.length} nodes from content`);
    return nodes;

  } catch (error) {
    console.error('❌ Error in parseContent:', error);
    return [];
  }
}

/**
 * Parse content from raw text string (alternative to DOM element)
 * @param {string} text - Raw text content
 * @returns {Promise<Array>} Array of node objects
 */
export async function parseTextContent(text) {
  console.log('📊 Parsing text content...');

  try {
    const cleanedText = cleanText(text);
    const nodes = parseText(cleanedText, 0);
    console.log(`✅ Parsed ${nodes.length} nodes from text`);
    return nodes;
  } catch (error) {
    console.error('❌ Error in parseTextContent:', error);
    return [];
  }
}
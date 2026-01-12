/**
 * Knowledge Map Extension - Content Script
 * Self-contained script with all logic bundled (no ES module imports)
 * 
 * Supports: ChatGPT, Claude, Gemini, Grok
 * 
 * v4 Features:
 * - 1 response = 1 node (summary + suggestions)
 * - Option C: Prompt user to edit title
 * - Scroll to source message
 */

(function() {
  'use strict';

  // Prevent double initialization
  if (window.__knowledgeMapInitialized) {
    console.log('⚠️ Knowledge Map already initialized');
    return;
  }
  window.__knowledgeMapInitialized = true;

  console.log('🚀 Knowledge Map Extension loading...');

  // ============================================
  // ADAPTER CONFIGURATIONS
  // ============================================
  
  const ADAPTERS = {
    'chatgpt.com': {
      name: 'ChatGPT',
      messageRow: 'div[data-message-author-role="assistant"]',
      contentArea: '.markdown.prose',
      inputField: '#prompt-textarea',
      stopButton: 'button[aria-label*="Stop"]'
    },
    'chat.openai.com': {
      name: 'ChatGPT',
      messageRow: 'div[data-message-author-role="assistant"]',
      contentArea: '.markdown.prose',
      inputField: '#prompt-textarea',
      stopButton: 'button[aria-label*="Stop"]'
    },
    'claude.ai': {
      name: 'Claude',
      messageRow: '[data-testid="assistant-message"], div.font-claude-message',
      contentArea: '.prose, .font-claude-message',
      inputField: '[contenteditable="true"], textarea',
      stopButton: 'button[aria-label*="Stop"]'
    },
    'gemini.google.com': {
      name: 'Gemini',
      messageRow: '.model-response-text, message-content.model-response',
      contentArea: '.markdown, .model-response-text',
      inputField: '.ql-editor, [contenteditable="true"]',
      stopButton: 'button[aria-label*="Stop"]'
    },
    'grok.com': {
      name: 'Grok',
      messageRow: '[class*="assistant"], [class*="response"]',
      contentArea: '.markdown, [class*="content"]',
      inputField: 'textarea, [contenteditable="true"]',
      stopButton: 'button[aria-label*="Stop"]'
    },
    'x.com': {
      name: 'Grok',
      messageRow: '[class*="assistant"], [class*="response"]',
      contentArea: '.markdown, [class*="content"]',
      inputField: 'textarea, [contenteditable="true"]',
      stopButton: 'button[aria-label*="Stop"]'
    }
  };

  // ============================================
  // ADAPTER FUNCTIONS
  // ============================================

  function getCurrentAdapter() {
    const hostname = window.location.hostname;
    
    for (const [pattern, config] of Object.entries(ADAPTERS)) {
      if (hostname.includes(pattern) || hostname === pattern) {
        return {
          CONFIG: config,
          findLastResponse: () => findLastResponse(config),
          extractText: (el) => extractText(el, config),
          isGenerating: () => isGenerating(config)
        };
      }
    }
    
    return null;
  }

  function findLastResponse(config) {
    const selectors = config.messageRow.split(',').map(s => s.trim());
    
    for (const selector of selectors) {
      try {
        const responses = document.querySelectorAll(selector);
        if (responses.length > 0) {
          return responses[responses.length - 1];
        }
      } catch (e) {}
    }
    
    return null;
  }

  function extractText(element, config) {
    if (!element) return '';

    const contentSelectors = config.contentArea.split(',').map(s => s.trim());
    let target = element;
    
    for (const selector of contentSelectors) {
      try {
        const contentNode = element.querySelector(selector);
        if (contentNode) {
          target = contentNode;
          break;
        }
      } catch (e) {}
    }

    const clone = target.cloneNode(true);

    const noiseSelectors = [
      'button', '.sr-only', '.add-to-map-button',
      '[aria-label*="copy"]', '[aria-label*="Copy"]',
      'svg', '.copy-button'
    ];
    
    noiseSelectors.forEach(selector => {
      try {
        clone.querySelectorAll(selector).forEach(n => n.remove());
      } catch (e) {}
    });

    return clone.innerText.trim();
  }

  /**
   * Extract HTML content for better parsing
   */
  function extractHtml(element, config) {
    if (!element) return '';

    const contentSelectors = config.contentArea.split(',').map(s => s.trim());
    let target = element;
    
    for (const selector of contentSelectors) {
      try {
        const contentNode = element.querySelector(selector);
        if (contentNode) {
          target = contentNode;
          break;
        }
      } catch (e) {}
    }

    return target;
  }

  function isGenerating(config) {
    if (!config.stopButton) return false;
    
    try {
      const stopBtn = document.querySelector(config.stopButton);
      return !!(stopBtn && stopBtn.offsetWidth > 0 && stopBtn.offsetHeight > 0);
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // SMART PARSER - 1 node với summary + gợi mở
  // ============================================

  /**
   * Extract title from HTML headings (h1 > h2 > h3 > first line)
   */
  function extractTitleFromHtml(element) {
    if (!element) return 'Untitled Response';
    
    // Try h1 first, then h2, then h3
    const headingSelectors = ['h1', 'h2', 'h3', 'h4'];
    
    for (const selector of headingSelectors) {
      const heading = element.querySelector(selector);
      if (heading && heading.textContent.trim()) {
        return heading.textContent.trim().substring(0, 100);
      }
    }
    
    // Try bold text at start (common in AI responses)
    const firstStrong = element.querySelector('strong, b');
    if (firstStrong && firstStrong.textContent.trim()) {
      const text = firstStrong.textContent.trim();
      if (text.length > 10 && text.length < 150) {
        return text.substring(0, 100);
      }
    }
    
    // Fallback: first meaningful line from text
    const text = element.innerText || '';
    const lines = text.split('\n').filter(l => l.trim().length > 10);
    if (lines.length > 0) {
      const firstLine = lines[0].trim()
        .replace(/^#+\s*/, '')
        .replace(/\*\*/g, '');
      return firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine;
    }
    
    return 'Untitled Response';
  }

  /**
   * Extract summary (first 3-5 meaningful lines, excluding title)
   */
  function extractSummary(text, title) {
    const lines = text.split('\n').filter(l => l.trim().length > 5);
    const summaryLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip if this is the title
      if (trimmed === title || trimmed.includes(title)) continue;
      
      // Skip headings
      if (/^#{1,4}\s/.test(trimmed)) continue;
      
      // Clean up line
      const cleaned = trimmed
        .replace(/^\*\*([^*]+)\*\*:?\s*/, '$1: ')
        .replace(/^[-*•]\s*/, '• ');
      
      if (cleaned.length > 10) {
        summaryLines.push(cleaned);
      }
      
      // Stop after 5 lines or ~350 chars
      if (summaryLines.length >= 5 || summaryLines.join('\n').length > 350) {
        break;
      }
    }
    
    return summaryLines.join('\n').substring(0, 400);
  }

  /**
   * Extract suggestions from HTML - find last <ol> or <ul> with <li> items
   * ChatGPT pattern: <p>Nếu bạn muốn...</p> <ul><li>...</li><li>...</li></ul>
   */
  function extractSuggestionsFromHtml(element) {
    if (!element) return '';
    
    // Find all <ol> and <ul> elements
    const lists = element.querySelectorAll('ol, ul');
    
    if (lists.length === 0) {
      // Fallback to text-based detection
      return extractSuggestionsFromText(element.innerText || '');
    }
    
    // Get the LAST list (usually suggestions are at the end)
    const lastList = lists[lists.length - 1];
    const listItems = lastList.querySelectorAll('li');
    
    if (listItems.length < 2) {
      // Not enough items, try second-to-last list
      if (lists.length > 1) {
        const secondLastList = lists[lists.length - 2];
        const items2 = secondLastList.querySelectorAll('li');
        if (items2.length >= 2) {
          return extractListItems(items2);
        }
      }
      // Still not enough, fallback to text
      return extractSuggestionsFromText(element.innerText || '');
    }
    
    return extractListItems(listItems);
  }
  
  /**
   * Extract text from list items
   */
  function extractListItems(listItems) {
    const suggestions = [];
    
    // Max 10 items
    const items = Array.from(listItems).slice(0, 10);
    
    for (const li of items) {
      // Get text, clean up
      let text = li.innerText || li.textContent || '';
      text = text.trim();
      
      if (text.length > 5) {
        // Remove leading numbers/bullets that might be in text
        text = text
          .replace(/^\d+[\.\)]\s*/, '')
          .replace(/^[-•*]\s*/, '')
          .trim();
        
        suggestions.push('→ ' + text);
      }
    }
    
    return suggestions.join('\n').substring(0, 800);
  }
  
  /**
   * Fallback: Extract suggestions from text using consecutive pattern detection
   */
  function extractSuggestionsFromText(text) {
    const lines = text.split('\n').filter(l => l.trim());
    
    // Get last 25 lines
    const bottomLines = lines.slice(-25);
    
    // Detect pattern type for each line
    function getPatternType(line) {
      const trimmed = line.trim();
      
      // Numbered: 1. 2. 3. or 1) 2) 3)
      if (/^\d+[\.\)]\s/.test(trimmed)) {
        return 'numbered';
      }
      
      // Common bullet characters
      if (/^[-•*]\s/.test(trimmed)) {
        return 'bullet';
      }
      
      // Emoji bullets (🔹, ✅, ➡️, etc.)
      const emojiMatch = trimmed.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[✓✔→➡►▶●○■□▪▫])\s*/u);
      if (emojiMatch) {
        return 'emoji';
      }
      
      return null;
    }
    
    // Find consecutive groups with same pattern
    const groups = [];
    let currentGroup = [];
    let currentPattern = null;
    
    for (let i = 0; i < bottomLines.length; i++) {
      const line = bottomLines[i];
      const pattern = getPatternType(line);
      
      if (pattern) {
        if (currentGroup.length === 0 || pattern === currentPattern) {
          currentGroup.push(line);
          currentPattern = pattern;
        } else {
          // Different pattern, save current group if valid
          if (currentGroup.length >= 2) {
            groups.push([...currentGroup]);
          }
          currentGroup = [line];
          currentPattern = pattern;
        }
      } else {
        // Non-pattern line
        if (currentGroup.length >= 2) {
          groups.push([...currentGroup]);
        }
        currentGroup = [];
        currentPattern = null;
      }
    }
    
    // Don't forget last group
    if (currentGroup.length >= 2) {
      groups.push([...currentGroup]);
    }
    
    // Find the best group (prefer longer, and prefer the last one)
    let bestGroup = [];
    for (const group of groups) {
      if (group.length >= bestGroup.length) {
        bestGroup = group;
      }
    }
    
    // If no good group found, return empty
    if (bestGroup.length < 2) {
      return '';
    }
    
    // Format the suggestions
    const suggestions = bestGroup.slice(0, 10).map(line => {
      const cleaned = line.trim()
        .replace(/^\d+[\.\)]\s*/, '')
        .replace(/^[-•*]\s*/, '')
        .replace(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[✓✔→➡►▶●○■□▪▫])\s*/u, '');
      return '→ ' + cleaned;
    });
    
    return suggestions.join('\n').substring(0, 600);
  }

  /**
   * Parse content into a single node with title, summary, suggestions
   */
  function parseContent(text, htmlElement) {
    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return [];
    }

    // Extract title from HTML (better accuracy)
    const title = extractTitleFromHtml(htmlElement);
    
    // Extract summary (excluding title)
    const summary = extractSummary(text, title);
    
    // Extract suggestions from HTML (find <ol>/<ul> with <li>)
    const suggestions = extractSuggestionsFromHtml(htmlElement);

    console.log(`📊 Parsed: "${title.substring(0, 50)}..."`);
    console.log(`📊 Suggestions found: ${suggestions ? 'Yes' : 'No'}`);
    
    return [{
      type: 'CORE',
      title: title,
      summary: summary,
      suggestions: suggestions,
      fullContent: text.substring(0, 2000)
    }];
  }

  // ============================================
  // SCROLL TO MESSAGE
  // ============================================

  function scrollToMessage(messageIndex) {
    const adapter = getCurrentAdapter();
    if (!adapter) return false;
    
    const allResponses = document.querySelectorAll(adapter.CONFIG.messageRow);
    
    if (messageIndex >= 0 && messageIndex < allResponses.length) {
      const targetMessage = allResponses[messageIndex];
      
      targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      const originalBg = targetMessage.style.backgroundColor;
      targetMessage.style.backgroundColor = '#fef08a';
      targetMessage.style.transition = 'background-color 0.3s';
      
      setTimeout(() => {
        targetMessage.style.backgroundColor = originalBg || '';
      }, 2000);
      
      console.log(`✅ Scrolled to message #${messageIndex}`);
      return true;
    }
    
    return false;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'SCROLL_TO_MESSAGE') {
      const { messageIndex, expectedUrl } = message;
      
      const currentUrl = window.location.href.split('#')[0];
      
      if (expectedUrl && !currentUrl.includes(expectedUrl.split('#')[0])) {
        sendResponse({ success: false, reason: 'Different conversation' });
        return;
      }
      
      const success = scrollToMessage(messageIndex);
      sendResponse({ success });
    }
    return true;
  });

  // ============================================
  // BUTTON STATE MANAGEMENT
  // ============================================

  function disableButton(button) {
    button.disabled = true;
    button.style.opacity = '0.6';
    button.style.cursor = 'not-allowed';
    button.style.backgroundColor = '#9ca3af';
    button.innerHTML = '⟳ Generating...';
  }

  function enableButton(button) {
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
    button.style.backgroundColor = '#3b82f6';
    button.innerHTML = '📍 Add to Map';
  }

  function setButtonParsing(button) {
    button.disabled = true;
    button.innerHTML = '⏳ Parsing...';
    button.style.backgroundColor = '#f59e0b';
  }

  function setButtonSuccess(button, projectName) {
    button.innerHTML = `✅ Added to "${projectName}"!`;
    button.style.backgroundColor = '#10b981';
    button.disabled = true;
  }

  // ============================================
  // PROJECT CHECK
  // ============================================

  async function checkCurrentProject() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['km_currentProjectId', 'km_projects'], (result) => {
        const projectId = result.km_currentProjectId;
        const projects = result.km_projects || {};
        
        const hasProject = projectId && projects[projectId];
        
        resolve({
          hasProject: !!hasProject,
          projectId: hasProject ? projectId : null,
          projectName: hasProject ? projects[projectId].name : null
        });
      });
    });
  }

  // ============================================
  // ADD TO MAP HANDLER (Option C: Edit Title)
  // ============================================

  async function handleAddToMap(button, element) {
    const adapter = getCurrentAdapter();
    
    if (!adapter) {
      alert('❌ Could not detect AI platform');
      return;
    }

    if (adapter.isGenerating()) {
      alert('⏳ Please wait for the AI to finish generating');
      return;
    }

    const projectCheck = await checkCurrentProject();
    
    if (!projectCheck.hasProject) {
      alert('⚠️ No project selected!\n\nPlease open the Side Panel and create or select a project first.\n\nClick the extension icon in your toolbar to open the Side Panel.');
      return;
    }

    setButtonParsing(button);

    try {
      // Extract text content
      const rawContent = adapter.extractText(element);
      
      // Get HTML element for better title extraction
      const htmlElement = extractHtml(element, adapter.CONFIG);

      if (!rawContent || rawContent.trim().length === 0) {
        alert('⚠️ No content found to add to map');
        enableButton(button);
        return;
      }

      console.log('📝 Extracted content length:', rawContent.length);

      // Parse into node (pass HTML element for title extraction)
      const nodes = parseContent(rawContent, htmlElement);

      if (!nodes || nodes.length === 0) {
        alert('⚠️ Could not parse content');
        enableButton(button);
        return;
      }

      const node = nodes[0];
      
      // Option C: Prompt user to edit title
      const suggestedTitle = node.title;
      const userTitle = prompt(
        '📝 Edit node title (or press OK to keep):\n\n' +
        'Summary preview: ' + (node.summary || '').substring(0, 80) + '...',
        suggestedTitle
      );
      
      if (userTitle === null) {
        enableButton(button);
        return;
      }
      
      node.title = userTitle.trim() || suggestedTitle;

      // Get message index for scroll-to
      const allResponses = document.querySelectorAll(adapter.CONFIG.messageRow);
      const messageIndex = Array.from(allResponses).indexOf(element);
      
      const conversationUrl = window.location.href.split('#')[0];

      const response = await chrome.runtime.sendMessage({
        action: 'ADD_NODES_TO_MAP',
        nodes: [node],
        sourceUrl: conversationUrl,
        sourcePlatform: adapter.CONFIG.name,
        timestamp: new Date().toISOString(),
        messageIndex: messageIndex >= 0 ? messageIndex : 0
      });

      if (response && response.success) {
        setButtonSuccess(button, projectCheck.projectName);
        console.log(`✅ Node added to "${projectCheck.projectName}"`);
        
        setTimeout(() => enableButton(button), 2000);
      } else {
        const errorMsg = response?.error || 'Unknown error';
        console.error('❌ Failed:', errorMsg);
        alert(`Failed to add to map: ${errorMsg}`);
        enableButton(button);
      }

    } catch (error) {
      console.error('❌ Error:', error);
      alert('Failed to process. Please try again.');
      enableButton(button);
    }
  }

  // ============================================
  // BUTTON INJECTION
  // ============================================

  function injectButton() {
    const adapter = getCurrentAdapter();
    
    if (!adapter) return;

    try {
      const lastResponse = adapter.findLastResponse();
      
      if (!lastResponse) return;

      if (lastResponse.querySelector('.add-to-map-button')) return;

      const button = document.createElement('button');
      button.className = 'add-to-map-button';
      button.innerHTML = '📍 Add to Map';
      button.title = 'Add this response to your knowledge map';
      button.style.cssText = `
        padding: 8px 16px;
        margin: 8px;
        background-color: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 10000;
      `;

      if (adapter.isGenerating()) {
        disableButton(button);
        observeGenerationCompletion(button, adapter);
      }

      button.addEventListener('mouseenter', () => {
        if (!button.disabled) {
          button.style.backgroundColor = '#2563eb';
          button.style.transform = 'translateY(-1px)';
          button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        }
      });

      button.addEventListener('mouseleave', () => {
        if (!button.disabled) {
          button.style.backgroundColor = '#3b82f6';
          button.style.transform = 'translateY(0)';
          button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
      });

      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleAddToMap(button, lastResponse);
      });

      lastResponse.appendChild(button);
      console.log(`✅ Button injected for ${adapter.CONFIG.name}`);

    } catch (error) {
      console.error('❌ Error injecting button:', error);
    }
  }

  function observeGenerationCompletion(button, adapter) {
    const checkInterval = setInterval(() => {
      if (!adapter.isGenerating()) {
        enableButton(button);
        clearInterval(checkInterval);
        console.log('✅ Generation complete');
      }
    }, 500);

    setTimeout(() => clearInterval(checkInterval), 120000);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function initialize() {
    console.log('🚀 Knowledge Map Extension initializing...');

    document.body.setAttribute('data-km-hostname', window.location.hostname);

    const adapter = getCurrentAdapter();
    if (!adapter) {
      console.log('⚠️ Not a supported AI platform');
      return;
    }

    console.log(`✅ Detected platform: ${adapter.CONFIG.name}`);

    injectButton();

    setInterval(injectButton, 2000);

    const observer = new MutationObserver(() => {
      injectButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('✅ Knowledge Map Extension ready!');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();

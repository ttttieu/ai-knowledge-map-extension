/**
 * Knowledge Map Extension - Content Script
 * Self-contained script with all logic bundled (no ES module imports)
 * 
 * Supports: ChatGPT, Claude, Gemini, Grok
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

  /**
   * Get current adapter based on hostname
   */
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

  /**
   * Find the last AI response element
   */
  function findLastResponse(config) {
    const selectors = config.messageRow.split(',').map(s => s.trim());
    
    for (const selector of selectors) {
      try {
        const responses = document.querySelectorAll(selector);
        if (responses.length > 0) {
          return responses[responses.length - 1];
        }
      } catch (e) {
        // Invalid selector, try next
      }
    }
    
    return null;
  }

  /**
   * Extract clean text from element
   */
  function extractText(element, config) {
    if (!element) return '';

    // Try to find content area first
    const contentSelectors = config.contentArea.split(',').map(s => s.trim());
    let target = element;
    
    for (const selector of contentSelectors) {
      try {
        const contentNode = element.querySelector(selector);
        if (contentNode) {
          target = contentNode;
          break;
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }

    // Clone to avoid modifying original
    const clone = target.cloneNode(true);

    // Remove noise elements
    const noiseSelectors = [
      'button',
      '.sr-only',
      '.add-to-map-button',
      '[aria-label*="copy"]',
      '[aria-label*="Copy"]',
      'svg',
      '.copy-button'
    ];
    
    noiseSelectors.forEach(selector => {
      try {
        clone.querySelectorAll(selector).forEach(n => n.remove());
      } catch (e) {}
    });

    return clone.innerText.trim();
  }

  /**
   * Check if AI is currently generating
   */
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
  // SMART PARSER
  // ============================================

  /**
   * Parse content into structured nodes
   */
  function parseContent(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const nodes = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    // Detect headers and main points
    let currentSection = null;
    let contentBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;

      // Detect headers (# style or **bold** style or numbered)
      const isHeader = /^#+\s/.test(line) || 
                       /^\*\*[^*]+\*\*:?\s*$/.test(line) ||
                       /^\d+\.\s+\*\*/.test(line) ||
                       /^#{1,3}\s/.test(line);
      
      // Detect list items
      const isListItem = /^[-*•]\s/.test(line) || /^\d+\.\s/.test(line);

      if (isHeader) {
        // Save previous section
        if (currentSection && contentBuffer.length > 0) {
          nodes.push({
            type: nodes.length === 0 ? 'CORE' : 'EXPANSION',
            title: currentSection,
            content: contentBuffer.join('\n').trim()
          });
          contentBuffer = [];
        }
        
        // Start new section
        currentSection = line
          .replace(/^#+\s*/, '')
          .replace(/^\*\*|\*\*$/g, '')
          .replace(/^\d+\.\s*/, '')
          .replace(/:$/, '')
          .trim();
          
      } else if (isListItem && !currentSection) {
        // Standalone list item becomes a node
        const itemText = line
          .replace(/^[-*•]\s*/, '')
          .replace(/^\d+\.\s*/, '')
          .trim();
        
        if (itemText.length > 10) {
          nodes.push({
            type: 'EXPANSION',
            title: itemText.substring(0, 60) + (itemText.length > 60 ? '...' : ''),
            content: itemText
          });
        }
      } else {
        // Regular content
        contentBuffer.push(line);
      }
    }

    // Don't forget last section
    if (currentSection && contentBuffer.length > 0) {
      nodes.push({
        type: nodes.length === 0 ? 'CORE' : 'EXPANSION',
        title: currentSection,
        content: contentBuffer.join('\n').trim()
      });
    }

    // If no structured content found, create a single CORE node
    if (nodes.length === 0 && text.trim().length > 0) {
      const firstSentence = text.split(/[.!?]/)[0].trim();
      nodes.push({
        type: 'CORE',
        title: firstSentence.substring(0, 80) + (firstSentence.length > 80 ? '...' : ''),
        content: text.trim().substring(0, 500)
      });
    }

    console.log(`📊 Parsed ${nodes.length} nodes`);
    return nodes;
  }

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
  // ADD TO MAP HANDLER
  // ============================================

  async function handleAddToMap(button, element) {
    const adapter = getCurrentAdapter();
    
    if (!adapter) {
      alert('❌ Could not detect AI platform');
      return;
    }

    // Check if still generating
    if (adapter.isGenerating()) {
      alert('⏳ Please wait for the AI to finish generating');
      return;
    }

    // Check for selected project
    const projectCheck = await checkCurrentProject();
    
    if (!projectCheck.hasProject) {
      alert('⚠️ No project selected!\n\nPlease open the Side Panel and create or select a project first.\n\nClick the extension icon in your toolbar to open the Side Panel.');
      return;
    }

    // Set parsing state
    setButtonParsing(button);

    try {
      // Extract text
      const rawContent = adapter.extractText(element);

      if (!rawContent || rawContent.trim().length === 0) {
        alert('⚠️ No content found to add to map');
        enableButton(button);
        return;
      }

      console.log('📝 Extracted content length:', rawContent.length);

      // Parse into nodes
      const nodes = parseContent(rawContent);

      if (!nodes || nodes.length === 0) {
        alert('⚠️ Could not parse content into nodes');
        enableButton(button);
        return;
      }

      console.log(`✅ Parsed ${nodes.length} nodes`);

      // Send to background
      const response = await chrome.runtime.sendMessage({
        action: 'ADD_NODES_TO_MAP',
        nodes: nodes,
        sourceUrl: window.location.href,
        sourcePlatform: adapter.CONFIG.name,
        timestamp: new Date().toISOString()
      });

      if (response && response.success) {
        setButtonSuccess(button, projectCheck.projectName);
        console.log(`✅ ${nodes.length} nodes added to "${projectCheck.projectName}"`);
        
        // Reset after 2 seconds
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
    
    if (!adapter) {
      return;
    }

    try {
      const lastResponse = adapter.findLastResponse();
      
      if (!lastResponse) {
        return;
      }

      // Check if button already exists
      if (lastResponse.querySelector('.add-to-map-button')) {
        return;
      }

      // Create button
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

      // Check if generating
      if (adapter.isGenerating()) {
        disableButton(button);
        observeGenerationCompletion(button, adapter);
      }

      // Hover effects
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

      // Click handler
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleAddToMap(button, lastResponse);
      });

      // Append to response
      lastResponse.appendChild(button);
      console.log(`✅ Button injected for ${adapter.CONFIG.name}`);

    } catch (error) {
      console.error('❌ Error injecting button:', error);
    }
  }

  /**
   * Watch for generation completion
   */
  function observeGenerationCompletion(button, adapter) {
    const checkInterval = setInterval(() => {
      if (!adapter.isGenerating()) {
        enableButton(button);
        clearInterval(checkInterval);
        console.log('✅ Generation complete');
      }
    }, 500);

    // Stop checking after 2 minutes
    setTimeout(() => clearInterval(checkInterval), 120000);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function initialize() {
    console.log('🚀 Knowledge Map Extension initializing...');

    // Set hostname attribute
    document.body.setAttribute('data-km-hostname', window.location.hostname);

    // Check if supported platform
    const adapter = getCurrentAdapter();
    if (!adapter) {
      console.log('⚠️ Not a supported AI platform');
      return;
    }

    console.log(`✅ Detected platform: ${adapter.CONFIG.name}`);

    // Inject button immediately
    injectButton();

    // Set up periodic injection (for new messages)
    setInterval(injectButton, 2000);

    // Also observe DOM changes
    const observer = new MutationObserver(() => {
      injectButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('✅ Knowledge Map Extension ready!');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();

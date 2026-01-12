/**
 * Adapter Factory - Central Hub for Platform Detection & UI Injection
 * ES Module that imports and orchestrates standardized adapter modules
 */

import * as chatgptAdapter from './chatgptAdapter.js';
import * as claudeAdapter from './claudeAdapter.js';
import * as geminiAdapter from './geminiAdapter.js';
import * as grokAdapter from './grokAdapter.js';

/**
 * ADAPTERS map: hostname patterns to adapter modules
 * Each adapter exports CONFIG (with name, messageRow, inputField, stopButton, contentArea)
 * and functions (findLastResponse, extractText, autoFillPrompt, isGenerating)
 */
const ADAPTERS = {
  'chatgpt.com': chatgptAdapter,
  'claude.ai': claudeAdapter,
  'gemini.google.com': geminiAdapter,
  'grok.com': grokAdapter
};

/**
 * Detects the current AI platform and returns the matching adapter module
 * @returns {Object|null} Adapter module object or null if not recognized
 */
const getCurrentAdapter = () => {
  const hostname = window.location.hostname;
  
  for (const [hostPattern, adapter] of Object.entries(ADAPTERS)) {
    if (hostname.includes(hostPattern)) {
      console.log(`✅ Adapter detected: ${adapter.CONFIG.name}`);
      return adapter;
    }
  }
  
  console.warn(`⚠️ Unknown platform for hostname: ${hostname}`);
  return null;
};

/**
 * Sets up a stream state observer for a specific message element
 * Monitors for the disappearance of the 'Stop' button to detect streaming completion
 * @param {Element} addButton - The 'Add to Map' button element
 * @param {Object} adapter - The adapter module
 */
const observeStreamingState = (addButton, adapter) => {
  const streamObserver = new MutationObserver(() => {
    // Check if AI is still generating
    if (!adapter.isGenerating()) {
      // Streaming finished, enable button
      enableAddButton(addButton);
      console.log(`✅ ${adapter.CONFIG.name}: Streaming completed, button enabled`);
      streamObserver.disconnect();
    }
  });

  // Start observing the document for DOM changes
  streamObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'display', 'hidden', 'aria-hidden']
  });

  console.log(`📡 Streaming observer set up for ${adapter.CONFIG.name}`);
};

/**
 * Disables the 'Add to Map' button and shows loading state
 * @param {Element} addButton - The button element to disable
 */
const disableAddButton = (addButton) => {
  addButton.disabled = true;
  addButton.style.opacity = '0.6';
  addButton.style.cursor = 'not-allowed';
  addButton.style.backgroundColor = '#9ca3af';
  addButton.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⟳</span> Generating...';
  addButton.setAttribute('title', 'Waiting for AI to finish...');
};

/**
 * Enables the 'Add to Map' button and restores normal state
 * @param {Element} addButton - The button element to enable
 */
const enableAddButton = (addButton) => {
  addButton.disabled = false;
  addButton.style.opacity = '1';
  addButton.style.cursor = 'pointer';
  addButton.style.backgroundColor = '#3b82f6';
  addButton.innerHTML = '📍 Add to Map';
  addButton.setAttribute('title', 'Add this response to your knowledge map');
};

/**
 * Injects an 'Add to Map' button to the last AI response message
 * Uses the current adapter to find the message and handle interactions
 */
const injectAddButton = () => {
  const adapter = getCurrentAdapter();
  
  if (!adapter) {
    console.error('❌ Adapter not detected. Cannot inject Add to Map button.');
    return;
  }
  
  try {
    // Use adapter function to find the last response element
    const messageElement = adapter.findLastResponse();
    
    if (!messageElement) {
      console.warn(`⚠️ No message elements found for platform: ${adapter.CONFIG.name}`);
      return;
    }
    
    // Check if button already exists to avoid duplicates
    if (messageElement.querySelector('.add-to-map-button')) {
      return;
    }
    
    // Create the custom button
    const addButton = document.createElement('button');
    addButton.className = 'add-to-map-button';
    addButton.innerHTML = '📍 Add to Map';
    addButton.setAttribute('title', 'Add this response to your knowledge map');
    addButton.style.cssText = `
      padding: 8px 16px;
      margin-top: 8px;
      background-color: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s, opacity 0.2s;
      display: inline-block;
    `;
    
    // Check if AI is currently generating
    const isGenerating = adapter.isGenerating();
    if (isGenerating) {
      disableAddButton(addButton);
      observeStreamingState(addButton, adapter);
    }
    
    // Add hover effects
    addButton.addEventListener('mouseenter', () => {
      if (!addButton.disabled) {
        addButton.style.backgroundColor = '#2563eb';
      }
    });
    
    addButton.addEventListener('mouseleave', () => {
      if (!addButton.disabled) {
        addButton.style.backgroundColor = '#3b82f6';
      }
    });
    
    // Add click handler to extract content and send to background
    addButton.addEventListener('click', async () => {
      // Verify streaming state hasn't resumed
      if (adapter.isGenerating()) {
        alert('⏳ Please wait for the AI to finish generating before adding to map.');
        return;
      }
      
      // Use adapter function to extract clean text
      const messageContent = adapter.extractText(messageElement);
      
      if (!messageContent || messageContent.trim().length === 0) {
        alert('⚠️ No content found to add to map.');
        return;
      }
      
      try {
        // Send message to background service worker
        const response = await chrome.runtime.sendMessage({
          action: 'addToMap',
          platform: adapter.CONFIG.name.toLowerCase(),
          platformName: adapter.CONFIG.name,
          content: messageContent,
          projectId: null,
          timestamp: new Date().toISOString()
        });
        
        if (response && response.success) {
          // Show success state
          addButton.innerHTML = '✅ Added to Map';
          addButton.disabled = true;
          addButton.style.backgroundColor = '#10b981';
          
          // Reset button after 2 seconds
          setTimeout(() => {
            enableAddButton(addButton);
          }, 2000);
          
          console.log(`✅ Response added to knowledge map: ${response.nodeIds?.length || 0} nodes created`);
        } else {
          const errorMsg = response?.error || 'Unknown error';
          console.error(`❌ Failed to add to map: ${errorMsg}`);
          alert(`Failed to add to map: ${errorMsg}`);
        }
      } catch (error) {
        console.error('❌ Error sending message to background:', error);
        alert('Failed to communicate with extension background. Please try again.');
      }
    });
    
    // Append button to the message element
    messageElement.appendChild(addButton);
    console.log(`✅ Add to Map button injected for ${adapter.CONFIG.name}${isGenerating ? ' (streaming disabled)' : ''}`);
    
    // Add spinner style if not already present
    if (!document.getElementById('knowledge-map-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'knowledge-map-spinner-style';
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
  } catch (error) {
    console.error('❌ Error injecting Add to Map button:', error);
  }
};

/**
 * Set up a MutationObserver to inject button when new messages appear
 * Ensures the button is added to each new AI response in real-time
 */
const observeForNewMessages = () => {
  const adapter = getCurrentAdapter();
  
  if (!adapter) {
    console.warn('⚠️ Adapter not detected. Cannot set up message observer.');
    return;
  }
  
  let debounceTimer;
  
  const observer = new MutationObserver(() => {
    // Debounce rapid DOM changes
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      injectAddButton();
    }, 300);
  });
  
  // Start observing the document for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log(`🔍 Message observer started for ${adapter.CONFIG.name}`);
};

/**
 * Listen for messages from the background service worker
 * Handles autoFillInput action by calling adapter.autoFillPrompt()
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'autoFillInput') {
    const adapter = getCurrentAdapter();
    
    if (!adapter) {
      console.error('❌ Adapter not found for autoFillInput');
      sendResponse({ success: false, error: 'Adapter not found' });
      return;
    }
    
    try {
      const success = adapter.autoFillPrompt(request.text);
      
      if (success) {
        console.log(`✅ ${adapter.CONFIG.name}: Input field auto-filled`);
        sendResponse({ success: true });
      } else {
        console.warn(`⚠️ ${adapter.CONFIG.name}: Failed to auto-fill input`);
        sendResponse({ success: false, error: 'Could not find input field' });
      }
    } catch (error) {
      console.error('❌ Error auto-filling input:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
});

/**
 * Initialize the adapter factory when DOM is ready
 * Injects button on initial page load and sets up message observer
 */
const initializeAdapter = () => {
  const adapter = getCurrentAdapter();
  
  if (!adapter) {
    console.warn('⚠️ Adapter not detected on initialization.');
    return;
  }
  
  console.log(`🚀 Initializing adapter for ${adapter.CONFIG.name}...`);
  
  // Inject button immediately
  injectAddButton();
  
  // Set up observer for new messages
  observeForNewMessages();
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAdapter);
} else {
  // DOM is already loaded
  initializeAdapter();
}

// Export functions for use in other modules
export {
  ADAPTERS,
  getCurrentAdapter,
  injectAddButton,
  observeForNewMessages,
  enableAddButton,
  disableAddButton
};

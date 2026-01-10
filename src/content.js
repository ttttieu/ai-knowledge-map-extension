/**
 * Content Script - Knowledge Map Extension Main Orchestrator
 * Manages button injection, content parsing, and communication with background worker
 */

import { getCurrentAdapter } from './adapters/adapterFactory.js';
import { parseContent } from './utils/smartParser.js';

/**
 * Set hostname attribute on body for CSS targeting
 */
const setupHostnameAttribute = () => {
  document.body.setAttribute('hostname', window.location.hostname);
  console.log(`🌐 Hostname set: ${window.location.hostname}`);
};

/**
 * Inject Add to Map buttons for all AI responses
 * Runs periodically to catch newly added messages
 */
const injectButtons = () => {
  const adapter = getCurrentAdapter();
  
  if (!adapter) {
    return;
  }

  try {
    // Find the last AI response using the adapter
    const lastResponse = adapter.findLastResponse();
    
    if (!lastResponse) {
      return;
    }

    // Check if button already exists on this element
    if (lastResponse.querySelector('.add-to-map-button')) {
      return;
    }

    // Create the Add to Map button
    const button = document.createElement('button');
    button.className = 'add-to-map-button';
    button.innerHTML = '📍 Add to Map';
    button.setAttribute('title', 'Add this response to your knowledge map');
    button.style.cssText = `
      padding: 8px 16px;
      margin-top: 8px;
      margin-right: 8px;
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
    if (adapter.isGenerating()) {
      disableButton(button);
      observeGenerationCompletion(button, adapter);
    }

    // Add hover effects
    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        button.style.backgroundColor = '#2563eb';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.disabled) {
        button.style.backgroundColor = '#3b82f6';
      }
    });

    // Add click handler
    button.addEventListener('click', () => handleAddToMap(button, lastResponse));

    // Append button to the message element
    lastResponse.appendChild(button);
    console.log(`✅ Add to Map button injected for ${adapter.CONFIG.name}`);

  } catch (error) {
    console.error('❌ Error injecting buttons:', error);
  }
};

/**
 * Disable button and show loading state
 */
const disableButton = (button) => {
  button.disabled = true;
  button.style.opacity = '0.6';
  button.style.cursor = 'not-allowed';
  button.style.backgroundColor = '#9ca3af';
  button.innerHTML = '<span style="display: inline-block; animation: spin 1s linear infinite;">⟳</span> Generating...';
};

/**
 * Enable button and show normal state
 */
const enableButton = (button) => {
  button.disabled = false;
  button.style.opacity = '1';
  button.style.cursor = 'pointer';
  button.style.backgroundColor = '#3b82f6';
  button.innerHTML = '📍 Add to Map';
};

/**
 * Observe for generation completion and re-enable button
 */
const observeGenerationCompletion = (button, adapter) => {
  const observer = new MutationObserver(() => {
    if (!adapter.isGenerating()) {
      enableButton(button);
      observer.disconnect();
      console.log(`✅ Generation complete, button enabled`);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'display', 'hidden', 'aria-hidden']
  });
};

/**
 * Check if a project is currently selected
 * @returns {Promise<{hasProject: boolean, projectId: string|null}>}
 */
const checkCurrentProject = async () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['km_currentProjectId', 'km_projects'], (result) => {
      const projectId = result.km_currentProjectId;
      const projects = result.km_projects || {};
      
      // Check if project exists
      const hasProject = projectId && projects[projectId];
      
      resolve({
        hasProject: !!hasProject,
        projectId: hasProject ? projectId : null,
        projectName: hasProject ? projects[projectId].name : null
      });
    });
  });
};

/**
 * Handle Add to Map button click
 * Parse content, send to background worker
 */
const handleAddToMap = async (button, element) => {
  const adapter = getCurrentAdapter();
  
  if (!adapter) {
    alert('❌ Could not detect platform');
    return;
  }

  // Check if still generating
  if (adapter.isGenerating()) {
    alert('⏳ Please wait for the AI to finish generating');
    return;
  }

  // Check if a project is selected
  const projectCheck = await checkCurrentProject();
  
  if (!projectCheck.hasProject) {
    alert('⚠️ No project selected!\n\nPlease open the Side Panel and create or select a project first.\n\nClick the extension icon in your toolbar to open the Side Panel.');
    return;
  }

  // Change button state to parsing
  button.disabled = true;
  button.innerHTML = '⏳ Parsing...';
  button.style.backgroundColor = '#f59e0b';

  try {
    // Extract clean text from the element
    const rawContent = adapter.extractText(element);

    if (!rawContent || rawContent.trim().length === 0) {
      alert('⚠️ No content found to add to map');
      enableButton(button);
      return;
    }

    // Parse content into structured nodes
    console.log('📊 Parsing content...');
    const nodes = await parseContent(rawContent);

    if (!nodes || nodes.length === 0) {
      alert('⚠️ Could not parse content into nodes');
      enableButton(button);
      return;
    }

    console.log(`✅ Parsed ${nodes.length} nodes from content`);

    // Send to background service worker
    const response = await chrome.runtime.sendMessage({
      action: 'ADD_NODES_TO_MAP',
      nodes: nodes,
      sourceUrl: window.location.href,
      sourcePlatform: adapter.CONFIG.name,
      timestamp: new Date().toISOString()
    });

    if (response && response.success) {
      // Show success state
      button.innerHTML = `✅ Added to "${projectCheck.projectName}"!`;
      button.style.backgroundColor = '#10b981';
      button.disabled = true;

      console.log(`✅ ${nodes.length} nodes added to project "${projectCheck.projectName}"`);

      // Reset button after 2 seconds
      setTimeout(() => {
        enableButton(button);
      }, 2000);
    } else {
      const errorMsg = response?.error || 'Unknown error';
      console.error(`❌ Failed to add to map: ${errorMsg}`);
      alert(`Failed to add to map: ${errorMsg}`);
      enableButton(button);
    }

  } catch (error) {
    console.error('❌ Error processing Add to Map:', error);
    alert('Failed to process. Please try again.');
    enableButton(button);
  }
};

/**
 * Initialize the extension
 */
const initialize = () => {
  console.log('🚀 Knowledge Map Extension initializing...');

  // Set hostname attribute for CSS targeting
  setupHostnameAttribute();

  // Inject buttons initially
  injectButtons();

  // Set up periodic button injection (every 2 seconds)
  setInterval(injectButtons, 2000);

  // Add spinner CSS animation if not present
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

  console.log('✅ Knowledge Map Extension fully initialized');
};

/**
 * Start when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
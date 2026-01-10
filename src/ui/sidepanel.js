/**
 * Sidepanel Logic - Vanilla JavaScript with Cytoscape.js
 * Manages knowledge map visualization, project selection, and node editing
 */

import { applyAutoLayout } from './layoutUtils.js';

let cyInstance = null;
let currentProjectId = null;
let currentProjects = [];

/**
 * Initialize Cytoscape instance with styling
 */
const initCytoscape = () => {
  cyInstance = cytoscape({
    container: document.getElementById('cy'),
    style: [
      {
        selector: 'node[type = "CORE"]',
        style: {
          'background-color': '#3498db',
          'shape': 'circle',
          'width': 60,
          'height': 60,
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 12,
          'color': '#fff',
          'border-width': 2,
          'border-color': '#2980b9'
        }
      },
      {
        selector: 'node[type = "EXPANSION"]',
        style: {
          'background-color': '#f1c40f',
          'shape': 'rectangle',
          'width': 50,
          'height': 40,
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 11,
          'color': '#000',
          'border-width': 1,
          'border-color': '#d4af37'
        }
      },
      {
        selector: 'edge',
        style: {
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'width': 2,
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 3,
          'border-color': '#e74c3c'
        }
      }
    ],
    layout: {
      name: 'breadthfirst',
      directed: true,
      spacingFactor: 1.5,
      animate: true
    }
  });

  // Add click listener for EXPANSION nodes (auto-fill content script)
  cyInstance.on('tap', 'node[type = "EXPANSION"]', function(evt) {
    const node = evt.target;
    const nodeData = node.data();
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'autoFillInput',
          nodeId: nodeData.id,
          nodeLabel: nodeData.label,
          nodeContent: nodeData.content || ''
        }).catch(() => {
          console.warn('⚠️  Content script not available on this tab');
        });
      }
    });
  });

  // Add double-click listener for node editing
  cyInstance.on('dblclick', 'node', function(evt) {
    const node = evt.target;
    handleNodeEdit(node);
  });

  console.log('✅ Cytoscape instance initialized');
};

/**
 * Clear all elements from the map
 */
const clearMap = () => {
  if (cyInstance) {
    cyInstance.elements().remove();
    console.log('🗑️  Map cleared');
  }
};

/**
 * Update the map: clear and render fresh nodes
 * @param {Array} nodes - Array of node objects from database
 */
const updateMap = (nodes) => {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance not initialized');
    return;
  }

  if (!nodes || nodes.length === 0) {
    console.warn('⚠️  No nodes to render');
    clearMap();
    return;
  }

  clearMap();

  const elements = [];

  // Create node elements
  nodes.forEach(node => {
    elements.push({
      data: {
        id: node.id.toString(),
        label: node.label || 'Untitled',
        type: node.type || 'CORE',
        content: node.content || ''
      }
    });

    // Create edges from parent relationships
    if (node.parentId) {
      elements.push({
        data: {
          id: `${node.parentId}-${node.id}`,
          source: node.parentId.toString(),
          target: node.id.toString()
        }
      });
    }
  });

  cyInstance.add(elements);

  // Apply layout
  applyAutoLayout(cyInstance);

  console.log(`✅ Rendered ${nodes.length} nodes in knowledge map`);
};

/**
 * Load nodes from database via background service worker
 * @param {number} projectId - The project ID to load
 */
const renderGraph = async (projectId) => {
  try {
    console.log(`📡 Fetching nodes for project ${projectId}...`);
    
    const response = await chrome.runtime.sendMessage({
      action: 'getNodesByProject',
      projectId: projectId
    });

    if (response && response.success && response.nodes) {
      console.log(`✅ Loaded ${response.nodes.length} nodes from database`);
      updateMap(response.nodes);
    } else {
      console.warn('⚠️ No nodes found for project or request failed');
      clearMap();
    }
  } catch (error) {
    console.error('❌ Error loading nodes from database:', error);
    clearMap();
  }
};

/**
 * Legacy alias for renderGraph - kept for backward compatibility
 */
const loadNodesFromDatabase = renderGraph;

/**
 * Load projects from database and populate project selector dropdown
 */
const loadProjects = async () => {
  try {
    console.log('📡 Fetching projects from database...');
    
    // Use Dexie directly from database module
    const response = await chrome.runtime.sendMessage({
      action: 'getAllProjects'
    });

    if (response && response.success && response.projects) {
      currentProjects = response.projects;
      console.log(`✅ Loaded ${response.projects.length} projects`);
      populateProjectSelector();
    } else {
      console.warn('⚠️  No projects found or request failed');
      currentProjects = [];
    }
  } catch (error) {
    console.error('❌ Error loading projects:', error);
  }
};

/**
 * Populate the project selector dropdown
 */
const populateProjectSelector = () => {
  const selector = document.getElementById('projectSelect');
  if (!selector) {
    console.warn('⚠️  Project selector element not found');
    return;
  }

  // Clear existing options except the placeholder
  selector.innerHTML = '<option value="">-- Select a Project --</option>';

  // Add project options
  if (currentProjects && currentProjects.length > 0) {
    currentProjects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name || `Project ${project.id}`;
      
      // Mark as selected if it's the current project
      if (project.id === currentProjectId) {
        option.selected = true;
      }
      
      selector.appendChild(option);
    });
  }

  console.log(`✅ Project selector populated with ${currentProjects.length} projects`);
};

/**
 * Load current project ID from Chrome storage
 */
const loadCurrentProjectId = async () => {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['currentProjectId'], resolve);
    });

    currentProjectId = result.currentProjectId;
    
    if (currentProjectId) {
      console.log(`✅ Current project ID: ${currentProjectId}`);
      await renderGraph(currentProjectId);
    } else {
      console.warn('⚠️ No current project selected');
      clearMap();
    }
  } catch (error) {
    console.error('❌ Error loading current project ID:', error);
  }
};

/**
 * Handle project selection change
 */
const handleProjectChange = async (event) => {
  const projectId = parseInt(event.target.value);
  
  if (!projectId) {
    console.warn('⚠️  Invalid project selected');
    clearMap();
    return;
  }

  currentProjectId = projectId;
  
  // Save to storage
  await chrome.storage.local.set({ currentProjectId: projectId });
  console.log(`✅ Project changed to: ${projectId}`);
  
  // Load nodes for selected project
  await renderGraph(projectId);
};

/**
 * Handle node double-click for editing
 * @param {Object} node - Cytoscape node object
 */
const handleNodeEdit = (node) => {
  const nodeId = node.id();
  const nodeLabel = node.data('label');
  const nodeContent = node.data('content');

  // Create HTML modal for editing
  const modal = document.createElement('div');
  modal.id = 'nodeEditModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;

  modalContent.innerHTML = `
    <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px;">Edit Node</h2>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500;">Title:</label>
      <input type="text" id="nodeEditTitle" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;" />
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500;">Content:</label>
      <textarea id="nodeEditContent" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; min-height: 120px; font-family: monospace; resize: vertical;"></textarea>
    </div>
    
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="nodeEditCancel" style="padding: 8px 16px; background-color: #e0e0e0; color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">Cancel</button>
      <button id="nodeEditSave" style="padding: 8px 16px; background-color: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">Save</button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Populate fields
  const titleInput = document.getElementById('nodeEditTitle');
  const contentInput = document.getElementById('nodeEditContent');
  
  titleInput.value = nodeLabel;
  contentInput.value = nodeContent;
  
  // Focus on title input
  titleInput.focus();
  titleInput.select();

  // Cancel button
  document.getElementById('nodeEditCancel').addEventListener('click', () => {
    modal.remove();
  });

  // Save button
  document.getElementById('nodeEditSave').addEventListener('click', async () => {
    const newLabel = titleInput.value.trim();
    const newContent = contentInput.value.trim();

    if (!newLabel) {
      alert('⚠️ Node title cannot be empty');
      return;
    }

    // Update node in Cytoscape UI
    node.data('label', newLabel);
    node.data('content', newContent);

    // Save to database
    await saveNodeChanges(nodeId, newLabel, newContent);
    
    modal.remove();
  });

  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
};

/**
 * Save node changes to database via background service worker
 * @param {string} nodeId - Node ID
 * @param {string} label - New label
 * @param {string} content - New content
 */
const saveNodeChanges = async (nodeId, label, content) => {
  try {
    console.log(`💾 Saving node changes: ${nodeId}`);
    
    // Send update message to background worker
    const response = await chrome.runtime.sendMessage({
      action: 'updateNode',
      nodeId: parseInt(nodeId),
      updates: {
        label: label,
        content: content
      }
    });

    if (response && response.success) {
      console.log(`✅ Node ${nodeId} updated: "${label}"`);
    } else {
      console.warn('⚠️ Node update may have failed:', response?.error);
      alert('Warning: Node update may have failed.');
    }
    
  } catch (error) {
    console.error('❌ Error saving node changes:', error);
    alert('Failed to save changes. Please try again.');
  }
};

/**
 * Handle rearrange button click
 */
const handleRearrangeClick = () => {
  if (!cyInstance) {
    console.warn('⚠️  Cytoscape instance not initialized');
    return;
  }

  console.log('🔄 Rearranging layout...');
  applyAutoLayout(cyInstance);
};

/**
 * Handle export button click
 */
const handleExportClick = async () => {
  if (!cyInstance) {
    console.warn('⚠️  Cytoscape instance not initialized');
    return;
  }

  try {
    const data = cyInstance.json();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knowledge-map-${currentProjectId}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    console.log('✅ Map exported successfully');
  } catch (error) {
    console.error('❌ Error exporting map:', error);
  }
};

/**
 * Handle REFRESH_MAP message from background service worker
 * Reloads the current project's nodes
 */
const handleRefreshMap = async (message) => {
  console.log('🔄 Refresh map requested:', message);
  
  const projectId = message.projectId || currentProjectId;
  
  if (projectId) {
    await renderGraph(projectId);
  } else {
    console.warn('⚠️ No project ID available for refresh');
  }
};

/**
 * Listen for messages from background service worker
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received in sidepanel:', message.action);

  switch (message.action) {
    case 'refreshMap':
    case 'REFRESH_MAP':
      handleRefreshMap(message);
      sendResponse({ success: true });
      break;

    default:
      console.log('⚠️  Unknown action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * Initialize the sidepanel when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Sidepanel DOM loaded, initializing...');
  
  // Initialize Cytoscape
  initCytoscape();
  
  // Load projects and populate selector
  await loadProjects();
  
  // Set up project selector listener
  const projectSelector = document.getElementById('projectSelect');
  if (projectSelector) {
    projectSelector.addEventListener('change', handleProjectChange);
  }
  
  // Set up rearrange button listener
  const rearrangeBtn = document.getElementById('reLayout');
  if (rearrangeBtn) {
    rearrangeBtn.addEventListener('click', handleRearrangeClick);
  }
  
  // Set up export button listener
  const exportBtn = document.getElementById('exportJson');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExportClick);
  }
  
  // Load current project and render map
  await loadCurrentProjectId();
  
  console.log('✅ Sidepanel fully initialized');
});

// Export functions for use in other scripts
window.sidepanelAPI = {
  initCytoscape,
  clearMap,
  updateMap,
  renderGraph,
  loadNodesFromDatabase,
  loadCurrentProjectId,
  loadProjects,
  populateProjectSelector,
  handleRefreshMap,
  handleNodeEdit,
  handleRearrangeClick,
  getCytoscapeInstance: () => cyInstance,
  getCurrentProjectId: () => currentProjectId,
  getCurrentProjects: () => currentProjects
};

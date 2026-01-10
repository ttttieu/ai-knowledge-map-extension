/**
 * Knowledge Map Side Panel - Full Featured
 * 
 * Features:
 * 1. Multi-Project Management (CRUD)
 * 2. Force-directed Auto Layout
 * 3. Cytoscape.js Visualization
 * 4. Export to Markdown & Mermaid (Notion)
 * 5. Persistent Storage
 */

// ============================================
// Storage Keys
// ============================================
const STORAGE = {
  PROJECTS: 'km_projects',
  CURRENT_PROJECT_ID: 'km_currentProjectId'
};

// ============================================
// State Management
// ============================================
const state = {
  projects: {},           // { projectId: { id, name, nodes, createdAt } }
  currentProjectId: null,
  cy: null,
  selectedNodeId: null,
  layoutInstance: null
};

// ============================================
// DOM Utilities
// ============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const el = {
  projectSelect: null,
  currentProjectName: null,
  nodeCount: null,
  notification: null,
  cy: null,
  emptyState: null,
  emptyTitle: null,
  emptyText: null,
  detailPanel: null,
  newProjectModal: null,
  newProjectName: null
};

// ============================================
// Utility Functions
// ============================================

function generateId() {
  return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateNodeId() {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '...' : text;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'success') {
  el.notification.textContent = message;
  el.notification.className = `notification notification-${type}`;
  el.notification.classList.remove('hidden');
  
  setTimeout(() => {
    el.notification.classList.add('hidden');
  }, 3000);
}

function updateNodeCount() {
  const project = getCurrentProject();
  const count = project ? project.nodes.length : 0;
  el.nodeCount.textContent = `${count} node${count !== 1 ? 's' : ''}`;
}

function getCurrentProject() {
  return state.currentProjectId ? state.projects[state.currentProjectId] : null;
}

// ============================================
// Storage Operations
// ============================================

async function loadFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE.PROJECTS, STORAGE.CURRENT_PROJECT_ID], (result) => {
      state.projects = result[STORAGE.PROJECTS] || {};
      state.currentProjectId = result[STORAGE.CURRENT_PROJECT_ID] || null;
      
      console.log(`📂 Loaded ${Object.keys(state.projects).length} projects`);
      resolve();
    });
  });
}

async function saveToStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [STORAGE.PROJECTS]: state.projects,
      [STORAGE.CURRENT_PROJECT_ID]: state.currentProjectId
    }, () => {
      console.log('💾 Saved to storage');
      resolve();
    });
  });
}

async function saveCurrentProjectId() {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [STORAGE.CURRENT_PROJECT_ID]: state.currentProjectId
    }, resolve);
  });
}

// ============================================
// Project Management
// ============================================

function populateProjectDropdown() {
  el.projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
  
  const projectList = Object.values(state.projects)
    .sort((a, b) => b.createdAt - a.createdAt);
  
  projectList.forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    if (project.id === state.currentProjectId) {
      option.selected = true;
    }
    el.projectSelect.appendChild(option);
  });
}

function updateProjectDisplay() {
  const project = getCurrentProject();
  
  if (project) {
    el.currentProjectName.textContent = project.name;
    el.emptyTitle.textContent = 'Your Knowledge Map is Empty';
    el.emptyText.textContent = 'Visit ChatGPT, Claude, Gemini, or Grok and click "Add to Map" on any AI response.';
  } else {
    el.currentProjectName.textContent = 'No Project Selected';
    el.emptyTitle.textContent = 'Welcome to Knowledge Map';
    el.emptyText.textContent = 'Create a new project or select an existing one to start building your knowledge map.';
  }
  
  updateNodeCount();
  toggleEmptyState();
}

async function createProject(name) {
  const id = generateId();
  const project = {
    id,
    name: name.trim() || `Project ${Object.keys(state.projects).length + 1}`,
    nodes: [],
    createdAt: Date.now()
  };
  
  state.projects[id] = project;
  state.currentProjectId = id;
  
  await saveToStorage();
  populateProjectDropdown();
  updateProjectDisplay();
  clearCytoscapeNodes();
  
  showNotification(`✅ Project "${project.name}" created`);
  console.log(`📁 Created project: ${project.name}`);
  
  return project;
}

async function deleteProject(projectId) {
  const project = state.projects[projectId];
  if (!project) return;
  
  if (!confirm(`Are you sure you want to delete "${project.name}"?\nThis will remove all ${project.nodes.length} nodes.`)) {
    return;
  }
  
  delete state.projects[projectId];
  
  // Select another project or null
  const remainingIds = Object.keys(state.projects);
  state.currentProjectId = remainingIds.length > 0 ? remainingIds[0] : null;
  
  await saveToStorage();
  populateProjectDropdown();
  updateProjectDisplay();
  renderCurrentProject();
  
  showNotification(`🗑️ Project "${project.name}" deleted`);
}

async function switchProject(projectId) {
  if (!projectId) {
    state.currentProjectId = null;
    await saveCurrentProjectId();
    updateProjectDisplay();
    clearCytoscapeNodes();
    return;
  }
  
  state.currentProjectId = projectId;
  await saveCurrentProjectId();
  updateProjectDisplay();
  renderCurrentProject();
  
  console.log(`📂 Switched to project: ${state.projects[projectId]?.name}`);
}

// ============================================
// Node Management
// ============================================

async function addNodesToProject(nodesData, sourceInfo = {}) {
  const project = getCurrentProject();
  if (!project) {
    showNotification('⚠️ Please select a project first', 'warning');
    return;
  }
  
  console.log(`📥 Adding ${nodesData.length} nodes to project "${project.name}"`);
  
  const newNodes = nodesData.map(nodeData => ({
    id: generateNodeId(),
    title: nodeData.title || 'Untitled',
    content: nodeData.content || '',
    type: nodeData.type || 'CORE',
    platform: sourceInfo.sourcePlatform || '',
    sourceUrl: sourceInfo.sourceUrl || '',
    timestamp: sourceInfo.timestamp || new Date().toISOString(),
    createdAt: Date.now()
  }));
  
  // Add to project
  project.nodes.push(...newNodes);
  
  // Save and render
  await saveToStorage();
  renderNodes(newNodes, true);
  updateNodeCount();
  
  // Apply force layout
  if (window.AutoLayout) {
    setTimeout(() => {
      window.AutoLayout.applyForceLayout(state.cy, {}, () => {
        console.log('✅ Force layout applied after adding nodes');
      });
    }, 100);
  }
  
  showNotification(`✅ Added ${newNodes.length} node(s)`);
}

async function deleteNode(nodeId) {
  const project = getCurrentProject();
  if (!project) return;
  
  const nodeIndex = project.nodes.findIndex(n => n.id === nodeId);
  if (nodeIndex === -1) return;
  
  // Remove from project
  project.nodes.splice(nodeIndex, 1);
  
  // Remove from Cytoscape
  const cyNode = state.cy.getElementById(nodeId);
  if (cyNode) {
    cyNode.remove();
  }
  
  await saveToStorage();
  updateNodeCount();
  hideDetailPanel();
  toggleEmptyState();
  
  showNotification('🗑️ Node deleted');
}

async function clearAllNodes() {
  const project = getCurrentProject();
  if (!project || project.nodes.length === 0) {
    showNotification('No nodes to clear', 'info');
    return;
  }
  
  if (!confirm(`Clear all ${project.nodes.length} nodes from "${project.name}"?`)) {
    return;
  }
  
  project.nodes = [];
  await saveToStorage();
  clearCytoscapeNodes();
  updateNodeCount();
  hideDetailPanel();
  
  showNotification('🗑️ All nodes cleared');
}

// ============================================
// Cytoscape Visualization
// ============================================

function initCytoscape() {
  state.cy = cytoscape({
    container: el.cy,
    
    style: [
      {
        selector: 'node',
        style: {
          'shape': 'round-rectangle',
          'width': 260,
          'height': 100,
          'background-color': '#ffffff',
          'border-width': 3,
          'border-color': '#3b82f6',
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '230px',
          'font-size': '12px',
          'font-weight': '500',
          'color': '#1f2937',
          'padding': '10px'
        }
      },
      {
        selector: 'node[type = "CORE"]',
        style: {
          'border-color': '#3b82f6',
          'background-color': '#eff6ff'
        }
      },
      {
        selector: 'node[type = "EXPANSION"]',
        style: {
          'border-color': '#f59e0b',
          'background-color': '#fffbeb'
        }
      },
      {
        selector: 'node[type = "TABLE_ROW"]',
        style: {
          'border-color': '#10b981',
          'background-color': '#ecfdf5'
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#ef4444'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#94a3b8',
          'target-arrow-color': '#94a3b8',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      }
    ],
    
    layout: { name: 'preset' },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    minZoom: 0.2,
    maxZoom: 3
  });
  
  // Event: Node tap
  state.cy.on('tap', 'node', (evt) => {
    const node = evt.target;
    state.selectedNodeId = node.id();
    showDetailPanel(node.data());
  });
  
  // Event: Background tap
  state.cy.on('tap', (evt) => {
    if (evt.target === state.cy) {
      hideDetailPanel();
    }
  });
  
  console.log('✅ Cytoscape initialized');
}

function clearCytoscapeNodes() {
  if (state.cy) {
    state.cy.elements().remove();
  }
  toggleEmptyState();
}

function renderNodes(nodes, append = false) {
  if (!state.cy) return;
  
  if (!append) {
    state.cy.elements().remove();
  }
  
  const containerWidth = state.cy.width() || 800;
  const containerHeight = state.cy.height() || 600;
  
  nodes.forEach((node, idx) => {
    // Random initial position for force layout
    const x = containerWidth / 2 + (Math.random() - 0.5) * 400;
    const y = containerHeight / 2 + (Math.random() - 0.5) * 400;
    
    state.cy.add({
      group: 'nodes',
      data: {
        id: node.id,
        label: truncate(node.title, 50),
        title: node.title,
        content: node.content,
        type: node.type,
        platform: node.platform,
        sourceUrl: node.sourceUrl,
        timestamp: node.timestamp
      },
      position: { x, y }
    });
  });
  
  toggleEmptyState();
}

function renderCurrentProject() {
  const project = getCurrentProject();
  
  if (!project || project.nodes.length === 0) {
    clearCytoscapeNodes();
    return;
  }
  
  renderNodes(project.nodes, false);
  
  // Apply force layout
  if (window.AutoLayout) {
    setTimeout(() => {
      window.AutoLayout.applyForceLayout(state.cy);
    }, 100);
  }
}

function toggleEmptyState() {
  const project = getCurrentProject();
  const hasNodes = project && project.nodes.length > 0;
  
  if (hasNodes) {
    el.emptyState.classList.add('hidden');
    el.cy.style.opacity = '1';
  } else {
    el.emptyState.classList.remove('hidden');
    el.cy.style.opacity = '0.3';
  }
}

// ============================================
// Detail Panel
// ============================================

function showDetailPanel(nodeData) {
  $('#detailTitle').textContent = nodeData.title || 'Node Details';
  $('#detailType').textContent = nodeData.type || 'NODE';
  $('#detailType').className = `type-badge type-${(nodeData.type || 'core').toLowerCase()}`;
  $('#detailText').textContent = nodeData.content || 'No content';
  
  const platformBadge = $('#detailPlatform');
  if (nodeData.platform) {
    platformBadge.textContent = nodeData.platform;
    platformBadge.classList.remove('hidden');
  } else {
    platformBadge.classList.add('hidden');
  }
  
  const sourceLink = $('#detailSource');
  if (nodeData.sourceUrl) {
    sourceLink.href = nodeData.sourceUrl;
    sourceLink.classList.remove('hidden');
  } else {
    sourceLink.classList.add('hidden');
  }
  
  el.detailPanel.classList.remove('hidden');
}

function hideDetailPanel() {
  el.detailPanel.classList.add('hidden');
  state.selectedNodeId = null;
}

// ============================================
// Export Functions
// ============================================

function exportToMarkdown() {
  const project = getCurrentProject();
  if (!project || project.nodes.length === 0) {
    showNotification('No nodes to export', 'warning');
    return;
  }
  
  let md = `# ${project.name}\n\n`;
  md += `_Exported: ${new Date().toLocaleString()}_\n\n`;
  md += '---\n\n';
  
  const groups = {
    CORE: project.nodes.filter(n => n.type === 'CORE'),
    EXPANSION: project.nodes.filter(n => n.type === 'EXPANSION'),
    TABLE_ROW: project.nodes.filter(n => n.type === 'TABLE_ROW'),
    OTHER: project.nodes.filter(n => !['CORE', 'EXPANSION', 'TABLE_ROW'].includes(n.type))
  };
  
  if (groups.CORE.length > 0) {
    md += '## 🎯 Core Concepts\n\n';
    groups.CORE.forEach((node, i) => {
      md += `### ${i + 1}. ${node.title}\n\n`;
      md += `${node.content}\n\n`;
      if (node.platform) md += `> Source: ${node.platform}\n\n`;
    });
  }
  
  if (groups.EXPANSION.length > 0) {
    md += '## 📚 Expansion Points\n\n';
    groups.EXPANSION.forEach((node, i) => {
      md += `### ${i + 1}. ${node.title}\n\n`;
      md += `${node.content}\n\n`;
    });
  }
  
  if (groups.TABLE_ROW.length > 0) {
    md += '## 📊 Table Data\n\n';
    groups.TABLE_ROW.forEach((node) => {
      md += `**${node.title}**\n\n${node.content}\n\n`;
    });
  }
  
  if (groups.OTHER.length > 0) {
    md += '## 📝 Other Notes\n\n';
    groups.OTHER.forEach((node) => {
      md += `- **${node.title}**: ${node.content}\n`;
    });
  }
  
  md += '\n---\n\n_Generated by Knowledge Map Extension_';
  
  // Download
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().split('T')[0]}.md`;
  link.click();
  URL.revokeObjectURL(url);
  
  showNotification('📄 Exported to Markdown');
}

/**
 * Export to Mermaid format for Notion
 */
function exportToMermaid() {
  const project = getCurrentProject();
  if (!project || project.nodes.length === 0) {
    showNotification('No nodes to export', 'warning');
    return;
  }
  
  // Sanitize text for Mermaid
  const sanitize = (text) => {
    if (!text) return '';
    return text
      .replace(/[\[\]{}()#<>]/g, '') // Remove special chars
      .replace(/"/g, "'")            // Replace quotes
      .replace(/\n/g, ' ')           // Remove newlines
      .replace(/\s+/g, ' ')          // Collapse whitespace
      .trim();
  };
  
  // Start building Mermaid diagram
  let mermaid = '```mermaid\ngraph TD\n\n';
  
  // Root node (Project name)
  const rootId = 'ROOT';
  const projectName = sanitize(project.name);
  mermaid += `    ${rootId}["🗺️ <b>${projectName}</b>"]\n\n`;
  
  // Sort nodes by creation time
  const sortedNodes = [...project.nodes].sort((a, b) => a.createdAt - b.createdAt);
  
  // Add nodes and create sequential links
  let prevNodeId = rootId;
  
  sortedNodes.forEach((node, index) => {
    const nodeId = `N${index + 1}`;
    const title = sanitize(truncate(node.title, 40));
    const content = sanitize(truncate(node.content, 100));
    
    // Node with title and content
    const nodeLabel = content 
      ? `${nodeId}["<b>${title}</b><br/>${content}"]`
      : `${nodeId}["<b>${title}</b>"]`;
    
    mermaid += `    ${nodeLabel}\n`;
    
    // Link from previous node
    mermaid += `    ${prevNodeId} --> ${nodeId}\n`;
    
    prevNodeId = nodeId;
  });
  
  // Add styling based on node types
  mermaid += '\n    %% Styling\n';
  
  sortedNodes.forEach((node, index) => {
    const nodeId = `N${index + 1}`;
    let style = '';
    
    switch (node.type) {
      case 'CORE':
        style = 'fill:#dbeafe,stroke:#3b82f6,stroke-width:2px';
        break;
      case 'EXPANSION':
        style = 'fill:#fef3c7,stroke:#f59e0b,stroke-width:2px';
        break;
      case 'TABLE_ROW':
        style = 'fill:#d1fae5,stroke:#10b981,stroke-width:2px';
        break;
      default:
        style = 'fill:#f3f4f6,stroke:#6b7280,stroke-width:2px';
    }
    
    mermaid += `    style ${nodeId} ${style}\n`;
  });
  
  // Root styling
  mermaid += `    style ${rootId} fill:#fef3c7,stroke:#d97706,stroke-width:3px\n`;
  
  mermaid += '```';
  
  // Copy to clipboard
  navigator.clipboard.writeText(mermaid).then(() => {
    showNotification('📤 Copied! Paste into Notion');
    console.log('📤 Mermaid exported to clipboard');
  }).catch((err) => {
    console.error('Failed to copy:', err);
    // Fallback: show in alert
    alert('Copy this Mermaid code:\n\n' + mermaid);
  });
}

// ============================================
// Modal Management
// ============================================

function showNewProjectModal() {
  el.newProjectModal.classList.remove('hidden');
  el.newProjectName.value = '';
  el.newProjectName.focus();
}

function hideNewProjectModal() {
  el.newProjectModal.classList.add('hidden');
  el.newProjectName.value = '';
}

async function confirmNewProject() {
  const name = el.newProjectName.value.trim();
  if (!name) {
    showNotification('Please enter a project name', 'warning');
    return;
  }
  
  hideNewProjectModal();
  await createProject(name);
}

// ============================================
// Message Listener
// ============================================

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Side Panel received:', message.action);
    
    switch (message.action) {
      case 'ADD_NODES_TO_MAP':
        addNodesToProject(message.nodes, {
          sourceUrl: message.sourceUrl,
          sourcePlatform: message.sourcePlatform,
          timestamp: message.timestamp
        });
        sendResponse({ success: true });
        break;
        
      case 'refreshMap':
      case 'REFRESH_MAP':
        renderCurrentProject();
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true;
  });
  
  console.log('✅ Message listener ready');
}

// ============================================
// Event Handlers
// ============================================

function setupEventHandlers() {
  // Project dropdown
  el.projectSelect.addEventListener('change', (e) => {
    switchProject(e.target.value || null);
  });
  
  // New Project button
  $('#btnNewProject').addEventListener('click', showNewProjectModal);
  
  // Delete Project button
  $('#btnDeleteProject').addEventListener('click', () => {
    if (state.currentProjectId) {
      deleteProject(state.currentProjectId);
    } else {
      showNotification('No project selected', 'warning');
    }
  });
  
  // Layout buttons
  $('#btnForceLayout').addEventListener('click', () => {
    if (window.AutoLayout && state.cy.nodes().length > 0) {
      window.AutoLayout.applyForceLayout(state.cy, {}, () => {
        showNotification('🔄 Layout applied');
      });
    }
  });
  
  $('#btnHierarchical').addEventListener('click', () => {
    if (window.AutoLayout && state.cy.nodes().length > 0) {
      window.AutoLayout.applyHierarchicalLayout(state.cy);
      showNotification('📊 Grid layout applied');
    }
  });
  
  $('#btnRadial').addEventListener('click', () => {
    if (window.AutoLayout && state.cy.nodes().length > 0) {
      window.AutoLayout.applyRadialLayout(state.cy);
      showNotification('🎯 Radial layout applied');
    }
  });
  
  // Export buttons
  $('#btnExportMd').addEventListener('click', exportToMarkdown);
  $('#btnExportMermaid').addEventListener('click', exportToMermaid);
  
  // Clear nodes
  $('#btnClearNodes').addEventListener('click', clearAllNodes);
  
  // Detail panel
  $('#btnCloseDetail').addEventListener('click', hideDetailPanel);
  $('#btnDeleteNode').addEventListener('click', () => {
    if (state.selectedNodeId) {
      deleteNode(state.selectedNodeId);
    }
  });
  
  // New Project Modal
  $('#btnCancelProject').addEventListener('click', hideNewProjectModal);
  $('#btnConfirmProject').addEventListener('click', confirmNewProject);
  
  el.newProjectName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmNewProject();
    }
  });
  
  // Modal backdrop click
  el.newProjectModal.querySelector('.modal-backdrop').addEventListener('click', hideNewProjectModal);
  
  console.log('✅ Event handlers ready');
}

// ============================================
// Initialization
// ============================================

async function init() {
  console.log('🚀 Initializing Knowledge Map Side Panel...');
  
  // Cache DOM elements
  el.projectSelect = $('#projectSelect');
  el.currentProjectName = $('#currentProjectName');
  el.nodeCount = $('#nodeCount');
  el.notification = $('#notification');
  el.cy = $('#cy');
  el.emptyState = $('#emptyState');
  el.emptyTitle = $('#emptyTitle');
  el.emptyText = $('#emptyText');
  el.detailPanel = $('#detailPanel');
  el.newProjectModal = $('#newProjectModal');
  el.newProjectName = $('#newProjectName');
  
  // Initialize Cytoscape
  initCytoscape();
  
  // Load data from storage
  await loadFromStorage();
  
  // Populate UI
  populateProjectDropdown();
  updateProjectDisplay();
  
  // Render current project
  if (state.currentProjectId && state.projects[state.currentProjectId]) {
    renderCurrentProject();
  }
  
  // Setup handlers
  setupEventHandlers();
  setupMessageListener();
  
  console.log('✅ Side Panel initialized');
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

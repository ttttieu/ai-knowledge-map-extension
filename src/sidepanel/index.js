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
          'width': 340,
          'height': 130,
          'background-color': '#ffffff',
          'border-width': 3,
          'border-color': '#3b82f6',
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '300px',
          'font-size': '30px',
          'font-weight': '500',
          'color': '#1f2937',
          'padding': '12px'
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
  
  const containerWidth = state.cy.width() || 1200;
  const containerHeight = state.cy.height() || 800;
  
  // Grid layout for initial positions - 3 columns
  const nodesPerRow = 3;
  const spacingX = Math.max(400, containerWidth / (nodesPerRow + 1));
  const spacingY = 250;
  
  nodes.forEach((node, idx) => {
    const col = idx % nodesPerRow;
    const row = Math.floor(idx / nodesPerRow);
    const x = spacingX * (col + 1);
    const y = spacingY * (row + 1);
    
    state.cy.add({
      group: 'nodes',
      data: {
        id: node.id,
        label: truncate(node.title, 60),
        title: node.title,
        summary: node.summary || '',
        suggestions: node.suggestions || '',
        content: node.content || node.summary || '',
        type: node.type,
        platform: node.platform,
        sourceUrl: node.sourceUrl,
        messageIndex: node.messageIndex ?? -1,
        timestamp: node.timestamp,
        createdAt: node.createdAt || 0
      },
      position: { x, y }
    });
  });
  
  toggleEmptyState();
  
  if (nodes.length > 0) {
    state.cy.fit(undefined, 50);
  }
}

function renderCurrentProject() {
  const project = getCurrentProject();
  
  if (!project || project.nodes.length === 0) {
    clearCytoscapeNodes();
    return;
  }
  
  renderNodes(project.nodes, false);
  
  // Apply hierarchical layout by default (more organized)
  if (window.AutoLayout) {
    setTimeout(() => {
      window.AutoLayout.applyHierarchicalLayout(state.cy);
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
  // Header title
  $('#detailTitle').textContent = 'Node Details';
  
  // Type badge
  $('#detailType').textContent = nodeData.type || 'NODE';
  $('#detailType').className = `type-badge type-${(nodeData.type || 'core').toLowerCase()}`;
  
  // Platform badge
  const platformBadge = $('#detailPlatform');
  if (nodeData.platform) {
    platformBadge.textContent = nodeData.platform;
    platformBadge.classList.remove('hidden');
  } else {
    platformBadge.classList.add('hidden');
  }
  
  // Timestamp
  const timestampEl = $('#detailTimestamp');
  if (timestampEl && nodeData.timestamp) {
    const date = new Date(nodeData.timestamp);
    timestampEl.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    timestampEl.classList.remove('hidden');
  } else if (timestampEl) {
    timestampEl.classList.add('hidden');
  }
  
  // Node Title (editable)
  $('#detailNodeTitle').textContent = nodeData.title || 'Untitled';
  
  // Summary
  const summaryText = nodeData.summary || nodeData.content || 'No summary available';
  $('#detailSummary').textContent = summaryText;
  
  // Suggestions
  const suggestionsSection = $('#suggestionsSection');
  const suggestionsText = $('#detailSuggestions');
  if (nodeData.suggestions && nodeData.suggestions.trim()) {
    suggestionsText.textContent = nodeData.suggestions;
    suggestionsSection.classList.remove('hidden');
  } else {
    suggestionsSection.classList.add('hidden');
  }
  
  // Scroll to Source button
  const scrollBtn = $('#btnScrollToSource');
  const sourceLink = $('#detailSource');
  
  if (nodeData.sourceUrl && nodeData.messageIndex !== undefined && nodeData.messageIndex >= 0) {
    scrollBtn.dataset.sourceUrl = nodeData.sourceUrl;
    scrollBtn.dataset.messageIndex = nodeData.messageIndex;
    scrollBtn.classList.remove('hidden');
    
    sourceLink.href = nodeData.sourceUrl;
    sourceLink.classList.remove('hidden');
  } else if (nodeData.sourceUrl) {
    scrollBtn.classList.add('hidden');
    sourceLink.href = nodeData.sourceUrl;
    sourceLink.classList.remove('hidden');
  } else {
    scrollBtn.classList.add('hidden');
    sourceLink.classList.add('hidden');
  }
  
  // Related nodes
  displayRelatedNodes(nodeData);
  
  // Highlight related nodes on map
  highlightRelatedNodes(state.selectedNodeId);
  
  el.detailPanel.classList.remove('hidden');
}

/**
 * Edit node title
 */
async function editNodeTitle() {
  const project = getCurrentProject();
  if (!project || !state.selectedNodeId) return;
  
  const node = project.nodes.find(n => n.id === state.selectedNodeId);
  if (!node) return;
  
  const newTitle = prompt('📝 Edit node title:', node.title);
  if (newTitle === null) return;
  
  node.title = newTitle.trim() || node.title;
  
  await saveToStorage();
  
  // Update display
  $('#detailNodeTitle').textContent = node.title;
  
  // Update Cytoscape node
  const cyNode = state.cy.getElementById(state.selectedNodeId);
  if (cyNode) {
    cyNode.data('title', node.title);
    cyNode.data('label', truncate(node.title, 60));
  }
  
  showNotification('✅ Title updated');
}

/**
 * Edit node summary
 */
async function editNodeSummary() {
  const project = getCurrentProject();
  if (!project || !state.selectedNodeId) return;
  
  const node = project.nodes.find(n => n.id === state.selectedNodeId);
  if (!node) return;
  
  const currentSummary = node.summary || node.content || '';
  const newSummary = prompt('📝 Edit summary:', currentSummary);
  if (newSummary === null) return;
  
  node.summary = newSummary.trim();
  
  await saveToStorage();
  
  // Update display
  $('#detailSummary').textContent = node.summary;
  
  // Update Cytoscape node data
  const cyNode = state.cy.getElementById(state.selectedNodeId);
  if (cyNode) {
    cyNode.data('summary', node.summary);
  }
  
  showNotification('✅ Summary updated');
}

/**
 * Handle scroll to source button click
 */
async function handleScrollToSource() {
  const btn = $('#btnScrollToSource');
  const sourceUrl = btn.dataset.sourceUrl;
  const messageIndex = parseInt(btn.dataset.messageIndex, 10);
  
  if (!sourceUrl || isNaN(messageIndex)) {
    showNotification('Cannot locate source', 'warning');
    return;
  }
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      window.open(sourceUrl, '_blank');
      return;
    }
    
    const tabUrl = tab.url?.split('#')[0] || '';
    const targetUrl = sourceUrl.split('#')[0];
    
    if (tabUrl.includes(targetUrl) || targetUrl.includes(tabUrl)) {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'SCROLL_TO_MESSAGE',
        messageIndex: messageIndex,
        expectedUrl: targetUrl
      });
      
      if (response?.success) {
        showNotification('📍 Scrolled to message', 'success');
      } else {
        window.open(sourceUrl, '_blank');
      }
    } else {
      window.open(sourceUrl, '_blank');
      showNotification('Opening conversation...', 'info');
    }
  } catch (error) {
    console.error('Scroll to source error:', error);
    window.open(sourceUrl, '_blank');
  }
}

/**
 * Display related nodes (previous nodes in same conversation)
 * Shows nodes that came BEFORE the current one to help with thought flow
 */
function displayRelatedNodes(nodeData) {
  const relatedContainer = $('#relatedNodes');
  if (!relatedContainer) return;
  
  relatedContainer.innerHTML = '';
  
  const project = getCurrentProject();
  if (!project) return;
  
  // Get the full node from project (has all data including createdAt)
  const currentFullNode = project.nodes.find(n => n.id === state.selectedNodeId);
  if (!currentFullNode) return;
  
  // Get current node's position indicators
  const currentMessageIndex = currentFullNode.messageIndex ?? nodeData.messageIndex ?? -1;
  const currentCreatedAt = currentFullNode.createdAt || 0;
  
  // Find nodes from same conversation that came BEFORE this one
  const previousNodes = project.nodes.filter(node => {
    // Skip current node
    if (node.id === state.selectedNodeId) return false;
    
    // Must be same conversation (same URL)
    if (!currentFullNode.sourceUrl || !node.sourceUrl) return false;
    const url1 = currentFullNode.sourceUrl.split('#')[0];
    const url2 = node.sourceUrl.split('#')[0];
    if (url1 !== url2) return false;
    
    // Check if this node came BEFORE current node
    const nodeMessageIndex = node.messageIndex ?? -1;
    const nodeCreatedAt = node.createdAt || 0;
    
    // Compare by messageIndex first (more accurate)
    if (currentMessageIndex >= 0 && nodeMessageIndex >= 0) {
      return nodeMessageIndex < currentMessageIndex;
    }
    
    // Fallback to createdAt
    if (currentCreatedAt > 0 && nodeCreatedAt > 0) {
      return nodeCreatedAt < currentCreatedAt;
    }
    
    return false;
  });
  
  if (previousNodes.length === 0) return;
  
  // Sort by messageIndex or createdAt (most recent first = closest to current)
  previousNodes.sort((a, b) => {
    const aIndex = a.messageIndex ?? -1;
    const bIndex = b.messageIndex ?? -1;
    if (aIndex >= 0 && bIndex >= 0) {
      return bIndex - aIndex; // Descending (closest to current first)
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  
  relatedContainer.innerHTML = `<h4>📎 Previous in Conversation</h4>`;
  
  const list = document.createElement('div');
  list.className = 'related-list';
  
  // Show up to 5 previous nodes (closest to current)
  previousNodes.slice(0, 5).forEach(node => {
    const item = document.createElement('div');
    item.className = `related-item type-${node.type?.toLowerCase() || 'core'}`;
    item.innerHTML = `
      <span class="related-type">${node.type || 'NODE'}</span>
      <span class="related-title">${truncate(node.title, 35)}</span>
    `;
    item.addEventListener('click', () => {
      const cyNode = state.cy.getElementById(node.id);
      if (cyNode) {
        state.cy.animate({
          center: { eles: cyNode },
          zoom: 1.2
        }, { duration: 300 });
        state.selectedNodeId = node.id;
        showDetailPanel(cyNode.data());
      }
    });
    list.appendChild(item);
  });
  
  relatedContainer.appendChild(list);
}

/**
 * Highlight related nodes on the map
 */
function highlightRelatedNodes(nodeId) {
  if (!state.cy) return;
  
  state.cy.nodes().removeClass('highlighted related');
  
  const selectedNode = state.cy.getElementById(nodeId);
  if (selectedNode && selectedNode.length > 0) {
    selectedNode.addClass('highlighted');
    
    const sourceUrl = selectedNode.data('sourceUrl');
    if (sourceUrl) {
      const baseUrl = sourceUrl.split('#')[0];
      state.cy.nodes().forEach(node => {
        if (node.id() !== nodeId) {
          const nodeUrl = node.data('sourceUrl')?.split('#')[0];
          if (nodeUrl === baseUrl) {
            node.addClass('related');
          }
        }
      });
    }
  }
}

function unhighlightAllNodes() {
  if (state.cy) {
    state.cy.nodes().removeClass('highlighted related');
  }
}

function hideDetailPanel() {
  el.detailPanel.classList.add('hidden');
  state.selectedNodeId = null;
  unhighlightAllNodes();
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
        // Nodes already saved by background.js
        // Just reload from storage and refresh display
        loadFromStorage().then(() => {
          renderCurrentProject();
          updateNodeCount();
          showNotification(`✅ Node added`);
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
  $('#btnScrollToSource').addEventListener('click', handleScrollToSource);
  $('#btnEditTitle').addEventListener('click', editNodeTitle);
  $('#btnEditSummary').addEventListener('click', editNodeSummary);
  
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

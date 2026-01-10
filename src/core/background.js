/**
 * Knowledge Map Extension - Service Worker (background.js)
 * Manifest V3 - Central Message Orchestrator
 * 
 * Responsibilities:
 * - Handle messages from content scripts
 * - Orchestrate NLP processing
 * - Manage database operations
 * - Sync with side panel UI
 * - Maintain node linking logic
 */

import { addNode, getNodesByProject, updateNodeStatus, deleteNode, KnowledgeMapDB } from './database.js';
import { processAIResponse } from './nlpProcessor.js';

/**
 * In-memory state to track last added node per project
 * Used for maintaining node linking (edges)
 */
const projectNodeState = new Map();

/**
 * Get the last CORE node ID for a project
 * @param {number} projectId
 * @returns {number|null}
 */
const getLastCoreNodeId = (projectId) => {
  const state = projectNodeState.get(projectId);
  return state ? state.lastCoreNodeId : null;
};

/**
 * Update the last CORE node ID for a project
 * @param {number} projectId
 * @param {number} nodeId
 */
const setLastCoreNodeId = (projectId, nodeId) => {
  if (!projectNodeState.has(projectId)) {
    projectNodeState.set(projectId, {});
  }
  projectNodeState.get(projectId).lastCoreNodeId = nodeId;
};

/**
 * Initialize the service worker
 * Configure side panel behavior and set up message listeners
 */
const initializeServiceWorker = async () => {
  try {
    // Configure side panel to open on action click
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    console.log('✅ Service Worker initialized - Side Panel configured');
  } catch (error) {
    console.error('❌ Failed to initialize side panel:', error);
  }
};

/**
 * Process AI response and save nodes to database
 * Orchestrates NLP processing, database operations, and UI sync
 * @param {Object} message - Message from content script
 * @param {Function} sendResponse - Response callback
 */
const handleAddToMap = async (message, sendResponse) => {
  const { content, platform, platformName, projectId } = message;

  try {
    console.log(`📝 Processing response from ${platformName || 'AI'}...`);

    // Validate required fields
    if (!content || !projectId) {
      throw new Error('Content and projectId are required');
    }

    // Process the text via nlpProcessor
    const nodes = await processAIResponse(content);

    if (!nodes || nodes.length === 0) {
      throw new Error('NLP processing returned no nodes');
    }

    console.log(`✅ NLP Processing complete: ${nodes.length} nodes extracted`);

    // Get last CORE node for linking
    const lastCoreNodeId = getLastCoreNodeId(projectId);

    // Save nodes to database and track CORE nodes for linking
    const savedNodeIds = [];
    let newCoreNodeId = lastCoreNodeId;

    for (const nodeData of nodes) {
      try {
        // Add parent context if this is an EXPANSION node and we have a parent
        if (nodeData.type === 'EXPANSION' && newCoreNodeId) {
          nodeData.parentId = newCoreNodeId;
        }

        // Create the node record
        const nodeId = await addNode({
          projectId: projectId,
          label: nodeData.title,
          content: nodeData.content,
          type: nodeData.type || 'CORE',
          status: nodeData.status || 'pending',
          platform: platform
        });

        savedNodeIds.push(nodeId);

        // Track CORE nodes for linking
        if (nodeData.type === 'CORE') {
          newCoreNodeId = nodeId;
        }

        console.log(`✅ Node saved: ${nodeData.title} (ID: ${nodeId})`);
      } catch (error) {
        console.error(`❌ Failed to save node "${nodeData.title}":`, error);
      }
    }

    // Update state with new CORE node
    if (newCoreNodeId !== lastCoreNodeId) {
      setLastCoreNodeId(projectId, newCoreNodeId);
    }

    // Notify side panel to refresh the map
    await notifySidePanel({
      action: 'refreshMap',
      projectId: projectId,
      nodesAdded: savedNodeIds.length
    });

    sendResponse({
      success: true,
      message: `Successfully added ${savedNodeIds.length} nodes to knowledge map`,
      nodeIds: savedNodeIds
    });

    console.log(`🎉 Response processing complete! Added ${savedNodeIds.length} nodes.`);
  } catch (error) {
    console.error('❌ Error in handleAddToMap:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to process AI response'
    });
  }
};

/**
 * Get current active project ID from storage
 * @returns {Promise<number|null>}
 */
const getCurrentProjectId = async () => {
  try {
    const result = await chrome.storage.local.get(['currentProjectId']);
    return result.currentProjectId || null;
  } catch (error) {
    console.error('❌ Failed to get current project ID:', error);
    return null;
  }
};

/**
 * Notify side panel to refresh
 * Sends a message to the side panel to trigger UI update
 * @param {Object} message
 */
const notifySidePanel = async (message) => {
  try {
    // Send message to the side panel via chrome.runtime
    // The side panel will receive this via chrome.runtime.onMessage
    chrome.runtime.sendMessage(message).catch(() => {
      // Silently handle if side panel isn't listening yet
    });
    console.log('📢 Side panel notified:', message.action);
  } catch (error) {
    console.warn('⚠️  Warning: Could not notify side panel:', error);
    // Don't throw - this is non-critical
  }
};

/**
 * Handle getting nodes by project
 * @param {Object} message
 * @param {Function} sendResponse
 */
const handleGetNodesByProject = async (message, sendResponse) => {
  try {
    const { projectId } = message;

    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const nodes = await getNodesByProject(projectId);

    sendResponse({
      success: true,
      nodes: nodes
    });
  } catch (error) {
    console.error('❌ Error getting nodes:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
};

/**
 * Handle updating a node status
 * @param {Object} message
 * @param {Function} sendResponse
 */
const handleUpdateNodeStatus = async (message, sendResponse) => {
  try {
    const { nodeId, status } = message;

    if (!nodeId || !status) {
      throw new Error('Node ID and status are required');
    }

    await updateNodeStatus(nodeId, status);

    sendResponse({
      success: true,
      message: 'Node status updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating node status:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
};

/**
 * Handle deleting a node
 * @param {Object} message
 * @param {Function} sendResponse
 */
const handleDeleteNode = async (message, sendResponse) => {
  try {
    const { nodeId } = message;

    if (!nodeId) {
      throw new Error('Node ID is required');
    }

    await deleteNode(nodeId);

    sendResponse({
      success: true,
      message: 'Node deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting node:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
};

/**
 * Storage keys for multi-project system
 */
const STORAGE_KEYS = {
  PROJECTS: 'km_projects',
  CURRENT_PROJECT_ID: 'km_currentProjectId'
};

/**
 * Handle ADD_NODES_TO_MAP action - save to current project and relay to side panel
 * @param {Object} message - Message from content script
 * @param {Function} sendResponse - Response callback
 */
const handleAddNodesToMap = async (message, sendResponse) => {
  const { nodes, sourceUrl, sourcePlatform, timestamp } = message;

  try {
    console.log(`📝 Processing ${nodes?.length || 0} nodes...`);

    // Validate required fields
    if (!nodes || nodes.length === 0) {
      throw new Error('No nodes provided');
    }

    // Get current project from storage
    const storageResult = await chrome.storage.local.get([
      STORAGE_KEYS.PROJECTS, 
      STORAGE_KEYS.CURRENT_PROJECT_ID
    ]);
    
    const projects = storageResult[STORAGE_KEYS.PROJECTS] || {};
    const currentProjectId = storageResult[STORAGE_KEYS.CURRENT_PROJECT_ID];

    // Check if project exists
    if (!currentProjectId || !projects[currentProjectId]) {
      throw new Error('No project selected. Please create or select a project in the Side Panel.');
    }

    const project = projects[currentProjectId];
    
    // Create node objects for the project
    const newNodes = nodes.map((node, idx) => ({
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: node.title || 'Untitled',
      content: node.content || '',
      type: node.type || 'CORE',
      platform: sourcePlatform || '',
      sourceUrl: sourceUrl || '',
      timestamp: timestamp || new Date().toISOString(),
      createdAt: Date.now(),
      metadata: node.metadata || {}
    }));

    // Add nodes to project
    project.nodes = project.nodes || [];
    project.nodes.push(...newNodes);

    // Save updated projects to storage
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.PROJECTS]: projects
    });

    console.log(`💾 Saved ${newNodes.length} nodes to project "${project.name}"`);

    // Try to relay message to side panel (may not be open)
    try {
      await chrome.runtime.sendMessage({
        action: 'ADD_NODES_TO_MAP',
        nodes: nodes,
        sourceUrl: sourceUrl,
        sourcePlatform: sourcePlatform,
        timestamp: timestamp,
        projectId: currentProjectId
      });
    } catch (e) {
      // Side panel might not be listening yet, nodes are already in storage
      console.log('📦 Nodes saved to storage (side panel may not be open)');
    }

    sendResponse({
      success: true,
      message: `${nodes.length} nodes added to "${project.name}"`,
      nodeCount: nodes.length,
      projectName: project.name
    });

    console.log(`✅ ${nodes.length} nodes added to project "${project.name}"`);
  } catch (error) {
    console.error('❌ Error in handleAddNodesToMap:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to add nodes to map'
    });
  }
};

/**
 * Main message handler
 * Routes incoming messages to appropriate handlers
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message.action);

  // Route message to appropriate handler
  switch (message.action) {
    case 'ADD_NODES_TO_MAP':
      handleAddNodesToMap(message, sendResponse);
      return true; // Keep channel open for async response

    case 'addToMap':
      handleAddToMap(message, sendResponse);
      return true; // Keep channel open for async response

    case 'getNodesByProject':
      handleGetNodesByProject(message, sendResponse);
      return true;

    case 'updateNodeStatus':
      handleUpdateNodeStatus(message, sendResponse);
      return true;

    case 'deleteNode':
      handleDeleteNode(message, sendResponse);
      return true;

    default:
      console.warn('⚠️  Unknown action:', message.action);
      sendResponse({
        success: false,
        error: `Unknown action: ${message.action}`
      });
      return false;
  }
});

/**
 * Initialize service worker on install/startup
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('🚀 Service Worker installed/updated:', details.reason);
  await initializeServiceWorker();
});

// Initialize on service worker startup
initializeServiceWorker().catch(console.error);

console.log('✅ Knowledge Map Extension Service Worker loaded');

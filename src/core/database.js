/**
 * Database module for Knowledge Map Extension
 * Uses Dexie.js for IndexedDB management
 * Stores projects and nodes for knowledge mapping
 */

import Dexie from '../assets/dexie.min.js';

// Initialize Dexie database
const KnowledgeMapDB = new Dexie('KnowledgeMapDB');

// Define database schema
KnowledgeMapDB.version(1).stores({
  projects: '++id, name',
  nodes: '++id, projectId, type, status'
});

/**
 * Node object structure:
 * {
 *   id?: number (auto-generated)
 *   projectId: number
 *   label: string
 *   content: string
 *   type: 'CORE' | 'EXPANSION'
 *   status: 'completed' | 'pending'
 *   parentId?: number
 *   createdAt: string (ISO 8601)
 *   updatedAt: string (ISO 8601)
 * }
 */

/**
 * Adds a new node to a project
 * @param {Object} node - { projectId, label, content, type, status, parentId, ... }
 * @returns {Promise<number>} The ID of the created node
 */
export const addNode = async (node) => {
  try {
    if (!node.projectId) {
      throw new Error('projectId is required');
    }
    if (!node.label || !node.content) {
      throw new Error('label and content are required');
    }

    const newNode = {
      ...node,
      type: node.type || 'CORE',
      status: node.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const id = await KnowledgeMapDB.nodes.add(newNode);
    console.log(`Node created with ID: ${id}`);
    return id;
  } catch (error) {
    console.error('Error adding node:', error);
    throw error;
  }
};

/**
 * Retrieves a node by ID
 * @param {number} nodeId - The node ID
 * @returns {Promise<Object>} The node object
 */
const getNode = async (nodeId) => {
  try {
    const node = await KnowledgeMapDB.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    return node;
  } catch (error) {
    console.error('Error retrieving node:', error);
    throw error;
  }
};

/**
 * Retrieves all nodes for a specific project
 * @param {number} projectId - The project ID
 * @returns {Promise<Array>} Array of node objects
 */
export const getNodesByProject = async (projectId) => {
  try {
    const nodes = await KnowledgeMapDB.nodes
      .where('projectId')
      .equals(projectId)
      .toArray();
    return nodes;
  } catch (error) {
    console.error('Error retrieving nodes by project:', error);
    throw error;
  }
};



/**
 * Updates a node's status
 * @param {number} nodeId - The node ID
 * @param {string} status - 'completed' or 'pending'
 * @returns {Promise<number>} The number of updated records
 */
export const updateNodeStatus = async (nodeId, status) => {
  try {
    if (!['completed', 'pending'].includes(status)) {
      throw new Error('Status must be "completed" or "pending"');
    }

    const updated = await KnowledgeMapDB.nodes.update(nodeId, {
      status,
      updatedAt: new Date().toISOString()
    });
    console.log(`Node ${nodeId} status updated to "${status}"`);
    return updated;
  } catch (error) {
    console.error('Error updating node status:', error);
    throw error;
  }
};

/**
 * Deletes a node by ID
 * @param {number} nodeId - The node ID
 * @returns {Promise<void>}
 */
export const deleteNode = async (nodeId) => {
  try {
    await KnowledgeMapDB.nodes.delete(nodeId);
    console.log(`Node ${nodeId} deleted`);
  } catch (error) {
    console.error('Error deleting node:', error);
    throw error;
  }
};

/**
 * Exports all data (projects and nodes) as a JSON file
 * Downloads the file to the user's computer
 * @returns {Promise<void>}
 */
async function exportAllData() {
  try {
    // Retrieve all projects and nodes
    const projects = await KnowledgeMapDB.projects.toArray();
    const nodes = await KnowledgeMapDB.nodes.toArray();

    // Create export object
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projects,
      nodes
    };

    // Convert to JSON string with formatting
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knowledge-map-export-${Date.now()}.json`;
    document.body.appendChild(link);

    // Trigger download
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Data exported successfully');
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

/**
 * Imports data from a JSON file
 * @param {File} file - The JSON file to import
 * @returns {Promise<Object>} { success, projectsImported, nodesImported, errors }
 */
async function importData(file) {
  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    if (!importData.projects || !importData.nodes) {
      throw new Error('Invalid import file format');
    }

    let projectsImported = 0;
    let nodesImported = 0;
    const errors = [];

    // Import projects
    for (const project of importData.projects) {
      try {
        const { id, ...projectData } = project;
        await KnowledgeMapDB.projects.add(projectData);
        projectsImported++;
      } catch (error) {
        errors.push(`Failed to import project: ${error.message}`);
      }
    }

    // Import nodes
    for (const node of importData.nodes) {
      try {
        const { id, ...nodeData } = node;
        await KnowledgeMapDB.nodes.add(nodeData);
        nodesImported++;
      } catch (error) {
        errors.push(`Failed to import node: ${error.message}`);
      }
    }

    return {
      success: true,
      projectsImported,
      nodesImported,
      errors
    };
  } catch (error) {
    console.error('Error importing data:', error);
    return {
      success: false,
      projectsImported: 0,
      nodesImported: 0,
      errors: [error.message]
    };
  }
}

/**
 * Clears all data from the database
 * WARNING: This is irreversible!
 * @returns {Promise<void>}
 */
async function clearAllData() {
  try {
    await KnowledgeMapDB.projects.clear();
    await KnowledgeMapDB.nodes.clear();
    console.log('All data cleared from database');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

/**
 * Gets database statistics
 * @returns {Promise<Object>} { projectCount, nodeCount, coreNodes, expansionNodes, completedNodes, pendingNodes }
 */
async function getDatabaseStats() {
  try {
    const projectCount = await KnowledgeMapDB.projects.count();
    const nodeCount = await KnowledgeMapDB.nodes.count();
    const coreNodes = await KnowledgeMapDB.nodes.where('type').equals('CORE').count();
    const expansionNodes = await KnowledgeMapDB.nodes.where('type').equals('EXPANSION').count();
    const completedNodes = await KnowledgeMapDB.nodes.where('status').equals('completed').count();
    const pendingNodes = await KnowledgeMapDB.nodes.where('status').equals('pending').count();

    return {
      projectCount,
      nodeCount,
      coreNodes,
      expansionNodes,
      completedNodes,
      pendingNodes
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    throw error;
  }
}

// Export database instance for direct access if needed
export { KnowledgeMapDB };

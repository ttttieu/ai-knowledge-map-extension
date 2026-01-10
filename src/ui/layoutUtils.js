/**
 * Layout Utility for Cytoscape.js
 * Automatically positions nodes in hierarchical and radial layouts
 * Optimized for knowledge maps with CORE nodes at center and EXPANSION nodes radiating outward
 */

/**
 * Apply automatic hierarchical layout to Cytoscape instance
 * Uses breadthfirst layout to place CORE nodes at top and EXPANSION nodes below
 * @param {Object} cyInstance - Cytoscape instance
 * @param {Object} options - Optional configuration
 * @returns {Object} Layout instance
 */
export const applyAutoLayout = (cyInstance, options = {}) => {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance is required');
    return null;
  }

  try {
    // Get all nodes to separate CORE and EXPANSION nodes
    const nodes = cyInstance.nodes().stdFilter(n => !n.isParent());
    const coreNodes = nodes.filter(n => n.data('type') === 'CORE');
    const expansionNodes = nodes.filter(n => n.data('type') === 'EXPANSION');

    // Apply breadthfirst layout (hierarchical, CORE nodes at top)
    const layout = cyInstance.layout({
      name: 'breadthfirst',
      directed: true,
      roots: coreNodes, // CORE nodes as root level
      animate: true,
      animationDuration: 500,
      avoidOverlap: true,
      spacingFactor: 1.5,
      condense: false,
      grid: false,
      maximal: false
    });

    // Run the layout
    layout.run();

    console.log(`✅ Auto-layout applied: ${coreNodes.length} CORE nodes, ${expansionNodes.length} EXPANSION nodes`);
    return layout;

  } catch (error) {
    console.error('❌ Error applying auto-layout:', error);
    return null;
  }
};

/**
 * Apply cose (Compound Spring Embedder) layout for more organic appearance
 * Better for complex knowledge maps with multiple hierarchies
 * @param {Object} cyInstance - Cytoscape instance
 * @param {Object} options - Optional configuration
 * @returns {Object} Layout instance
 */
export const applyCoseLayout = (cyInstance, options = {}) => {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance is required');
    return null;
  }

  try {
    const layout = cyInstance.layout({
      name: 'cose',
      animate: true,
      animationDuration: 500,
      avoidOverlap: true,
      nodeSpacing: 5,
      nodeDimensionsIncludeLabels: true,
      directed: false,
      // Increase repulsion to spread nodes further apart
      nodeRepulsion: 4500,
      edgeElasticity: 0.5,
      nestingFactor: 1.2,
      gravity: 200,
      numIter: 50,
      initialTemp: 200,
      coolingFactor: 0.95,
      minTemp: 1.0
    });

    layout.run();

    console.log(`✅ COSE layout applied`);
    return layout;

  } catch (error) {
    console.error('❌ Error applying COSE layout:', error);
    return null;
  }
};

/**
 * Apply radial layout with CORE nodes at center
 * EXPANSION nodes arranged in a circle around CORE nodes
 * @param {Object} cyInstance - Cytoscape instance
 * @param {Object} options - Optional configuration
 * @returns {Object} Layout instance
 */
export const applyRadialLayout = (cyInstance, options = {}) => {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance is required');
    return null;
  }

  try {
    const nodes = cyInstance.nodes().stdFilter(n => !n.isParent());
    const coreNodes = nodes.filter(n => n.data('type') === 'CORE');

    const layout = cyInstance.layout({
      name: 'concentric',
      animate: true,
      animationDuration: 500,
      avoidOverlap: true,
      concentric: (node) => {
        // CORE nodes get highest concentric level (center)
        return node.data('type') === 'CORE' ? 100 : 50;
      },
      levelWidth: (levels) => 200,
      minNodeSpacing: 10
    });

    layout.run();

    console.log(`✅ Radial layout applied`);
    return layout;

  } catch (error) {
    console.error('❌ Error applying radial layout:', error);
    return null;
  }
};

/**
 * Apply hierarchical grid layout
 * Arranges nodes in a grid with clear hierarchical structure
 * @param {Object} cyInstance - Cytoscape instance
 * @returns {Object} Layout instance
 */
export const applyGridLayout = (cyInstance) => {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance is required');
    return null;
  }

  try {
    const layout = cyInstance.layout({
      name: 'grid',
      animate: true,
      animationDuration: 500,
      avoidOverlap: true,
      condense: false,
      rows: undefined,
      cols: undefined
    });

    layout.run();

    console.log(`✅ Grid layout applied`);
    return layout;

  } catch (error) {
    console.error('❌ Error applying grid layout:', error);
    return null;
  }
};

/**
 * Fit the view to show all nodes with proper zoom/pan
 * @param {Object} cyInstance - Cytoscape instance
 * @param {Object} options - Optional configuration
 */
export const fitViewToNodes = (cyInstance, options = {}) => {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance is required');
    return;
  }

  try {
    const { padding = 50, duration = 500, maxZoom = 2 } = options;

    cyInstance.fit(undefined, padding);
    
    // Zoom limit to prevent over-zooming
    if (cyInstance.zoom() > maxZoom) {
      cyInstance.zoom(maxZoom);
    }

    console.log(`✅ View fitted to nodes`);
  } catch (error) {
    console.error('❌ Error fitting view:', error);
  }
};

/**
 * Reset layout to default (center and fit all nodes)
 * @param {Object} cyInstance - Cytoscape instance
 */
export const resetLayout = (cyInstance) => {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance is required');
    return;
  }

  try {
    cyInstance.reset();
    fitViewToNodes(cyInstance);
    console.log(`✅ Layout reset to default`);
  } catch (error) {
    console.error('❌ Error resetting layout:', error);
  }
};

// Export default object with all functions
export default {
  applyAutoLayout,
  applyCoseLayout,
  applyRadialLayout,
  applyGridLayout,
  fitViewToNodes,
  resetLayout
};

/**
 * Layout Utilities for Cytoscape.js
 * Handles graph layout algorithms with smooth animations
 */

/**
 * Applies an automatic breadthfirst layout to the Cytoscape instance
 * Positions CORE nodes at the root/top and EXPANSION nodes branch downward
 * Includes smooth animation for visual transition
 * @param {Object} cyInstance - The Cytoscape instance
 */
export function applyAutoLayout(cyInstance) {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance not provided');
    return;
  }

  try {
    // Configure breadthfirst layout with CORE nodes as roots
    const layout = cyInstance.layout({
      name: 'breadthfirst',
      directed: true,
      spacingFactor: 1.5,
      roots: cyInstance.nodes().filter(node => node.data('type') === 'CORE'),
      animate: true,
      animationDuration: 500,
      animationEasing: 'ease-in-out-cubic',
      fit: true,
      padding: 50
    });

    // Run the layout
    layout.run();

    console.log('✅ Auto layout applied with breadthfirst (CORE roots)');
  } catch (error) {
    console.error('❌ Error applying auto layout:', error);
  }
}

/**
 * Applies a spring embedder (cose) layout for organic arrangement
 * Useful for visualizing complex interconnected graphs
 * @param {Object} cyInstance - The Cytoscape instance
 */
export function applyCoseLayout(cyInstance) {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance not provided');
    return;
  }

  try {
    const layout = cyInstance.layout({
      name: 'cose',
      animate: true,
      animationDuration: 500,
      animationEasing: 'ease-in-out-cubic',
      nodeSpacing: 50,
      edgeElasticity: 100,
      fit: true,
      padding: 50
    });

    layout.run();
    console.log('✅ Cose layout applied');
  } catch (error) {
    console.error('❌ Error applying cose layout:', error);
  }
}

/**
 * Applies a radial layout with CORE nodes at the center
 * EXPANSION nodes arranged in concentric circles
 * @param {Object} cyInstance - The Cytoscape instance
 */
export function applyRadialLayout(cyInstance) {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance not provided');
    return;
  }

  try {
    const layout = cyInstance.layout({
      name: 'concentric',
      concentric: node => node.data('type') === 'CORE' ? 100 : 50,
      levelWidth: () => 100,
      animate: true,
      animationDuration: 500,
      animationEasing: 'ease-in-out-cubic',
      fit: true,
      padding: 50
    });

    layout.run();
    console.log('✅ Radial layout applied');
  } catch (error) {
    console.error('❌ Error applying radial layout:', error);
  }
}

/**
 * Applies a grid layout for orderly arrangement
 * @param {Object} cyInstance - The Cytoscape instance
 */
export function applyGridLayout(cyInstance) {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance not provided');
    return;
  }

  try {
    const layout = cyInstance.layout({
      name: 'grid',
      avoidOverlap: true,
      animate: true,
      animationDuration: 500,
      animationEasing: 'ease-in-out-cubic',
      fit: true,
      padding: 50
    });

    layout.run();
    console.log('✅ Grid layout applied');
  } catch (error) {
    console.error('❌ Error applying grid layout:', error);
  }
}

/**
 * Fits the viewport to show all nodes with optimal zoom
 * @param {Object} cyInstance - The Cytoscape instance
 */
export function fitViewToNodes(cyInstance) {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance not provided');
    return;
  }

  try {
    cyInstance.fit(cyInstance.nodes(), 50);
    console.log('✅ View fitted to nodes');
  } catch (error) {
    console.error('❌ Error fitting view:', error);
  }
}

/**
 * Resets the layout to default view
 * @param {Object} cyInstance - The Cytoscape instance
 */
export function resetLayout(cyInstance) {
  if (!cyInstance) {
    console.error('❌ Cytoscape instance not provided');
    return;
  }

  try {
    cyInstance.reset();
    console.log('✅ Layout reset to default');
  } catch (error) {
    console.error('❌ Error resetting layout:', error);
  }
}

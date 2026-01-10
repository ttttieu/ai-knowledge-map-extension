/**
 * Auto Layout - Force-Directed Algorithm
 * Thuật toán lực đẩy để các node tự động bung ra đẹp mắt
 * Phù hợp cho Mind Map / Knowledge Map
 */

// ============================================
// Constants
// ============================================
const CONFIG = {
  // Lực đẩy giữa các node (càng lớn càng đẩy xa)
  REPULSION_STRENGTH: 8000,
  
  // Lực hút của các edge (giữ các node liên kết gần nhau)
  ATTRACTION_STRENGTH: 0.05,
  
  // Khoảng cách lý tưởng giữa các node
  IDEAL_DISTANCE: 250,
  
  // Hệ số ma sát (giảm tốc độ di chuyển)
  DAMPING: 0.85,
  
  // Ngưỡng dừng (khi năng lượng < ngưỡng thì dừng)
  MIN_ENERGY: 0.1,
  
  // Số lần lặp tối đa
  MAX_ITERATIONS: 300,
  
  // Kích thước node
  NODE_WIDTH: 260,
  NODE_HEIGHT: 120,
  
  // Padding từ mép canvas
  PADDING: 100,
  
  // Center gravity (kéo về tâm)
  CENTER_GRAVITY: 0.01
};

// ============================================
// Vector Utilities
// ============================================
const Vector = {
  create: (x = 0, y = 0) => ({ x, y }),
  
  add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
  
  subtract: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
  
  multiply: (v, scalar) => ({ x: v.x * scalar, y: v.y * scalar }),
  
  divide: (v, scalar) => scalar !== 0 ? { x: v.x / scalar, y: v.y / scalar } : v,
  
  magnitude: (v) => Math.sqrt(v.x * v.x + v.y * v.y),
  
  normalize: (v) => {
    const mag = Vector.magnitude(v);
    return mag > 0 ? Vector.divide(v, mag) : { x: 0, y: 0 };
  },
  
  distance: (v1, v2) => Vector.magnitude(Vector.subtract(v1, v2)),
  
  limit: (v, max) => {
    const mag = Vector.magnitude(v);
    return mag > max ? Vector.multiply(Vector.normalize(v), max) : v;
  }
};

// ============================================
// Force-Directed Layout Class
// ============================================
class ForceDirectedLayout {
  constructor(cyInstance, options = {}) {
    this.cy = cyInstance;
    this.options = { ...CONFIG, ...options };
    this.nodes = [];
    this.edges = [];
    this.running = false;
  }

  /**
   * Initialize node physics data
   */
  initializeNodes() {
    const nodes = this.cy.nodes();
    const containerWidth = this.cy.width() || 800;
    const containerHeight = this.cy.height() || 600;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    this.nodes = nodes.map((node, index) => {
      const currentPos = node.position();
      
      // Nếu node chưa có vị trí, đặt ngẫu nhiên xung quanh tâm
      let x = currentPos.x || centerX + (Math.random() - 0.5) * 400;
      let y = currentPos.y || centerY + (Math.random() - 0.5) * 400;

      // CORE nodes bắt đầu gần tâm hơn
      if (node.data('type') === 'CORE') {
        x = centerX + (Math.random() - 0.5) * 200;
        y = centerY + (Math.random() - 0.5) * 200;
      }

      return {
        id: node.id(),
        node: node,
        type: node.data('type') || 'CORE',
        position: Vector.create(x, y),
        velocity: Vector.create(0, 0),
        force: Vector.create(0, 0),
        mass: node.data('type') === 'CORE' ? 2 : 1 // CORE nodes nặng hơn
      };
    });

    // Get edges
    this.edges = this.cy.edges().map(edge => ({
      source: edge.source().id(),
      target: edge.target().id()
    }));
  }

  /**
   * Calculate repulsion force between all node pairs
   * Lực đẩy Coulomb: F = k * (q1 * q2) / r^2
   */
  calculateRepulsion() {
    const { REPULSION_STRENGTH, IDEAL_DISTANCE } = this.options;

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];

        const delta = Vector.subtract(nodeA.position, nodeB.position);
        let distance = Vector.magnitude(delta);
        
        // Tránh chia cho 0
        distance = Math.max(distance, 1);

        // Lực đẩy giảm theo bình phương khoảng cách
        const forceMagnitude = REPULSION_STRENGTH / (distance * distance);
        
        // Hướng lực
        const forceDirection = Vector.normalize(delta);
        const force = Vector.multiply(forceDirection, forceMagnitude);

        // Áp dụng lực (Newton's 3rd law - lực đẩy đối xứng)
        nodeA.force = Vector.add(nodeA.force, force);
        nodeB.force = Vector.subtract(nodeB.force, force);
      }
    }
  }

  /**
   * Calculate attraction force along edges
   * Lực hút Hooke: F = -k * (x - x0)
   */
  calculateAttraction() {
    const { ATTRACTION_STRENGTH, IDEAL_DISTANCE } = this.options;

    for (const edge of this.edges) {
      const sourceNode = this.nodes.find(n => n.id === edge.source);
      const targetNode = this.nodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) continue;

      const delta = Vector.subtract(targetNode.position, sourceNode.position);
      const distance = Vector.magnitude(delta);

      // Lực hút tỉ lệ với độ lệch khỏi khoảng cách lý tưởng
      const displacement = distance - IDEAL_DISTANCE;
      const forceMagnitude = ATTRACTION_STRENGTH * displacement;

      const forceDirection = Vector.normalize(delta);
      const force = Vector.multiply(forceDirection, forceMagnitude);

      // Áp dụng lực hút
      sourceNode.force = Vector.add(sourceNode.force, force);
      targetNode.force = Vector.subtract(targetNode.force, force);
    }
  }

  /**
   * Calculate center gravity
   * Kéo các node về tâm để tránh drift
   */
  calculateCenterGravity() {
    const { CENTER_GRAVITY } = this.options;
    const containerWidth = this.cy.width() || 800;
    const containerHeight = this.cy.height() || 600;
    const center = Vector.create(containerWidth / 2, containerHeight / 2);

    for (const node of this.nodes) {
      const delta = Vector.subtract(center, node.position);
      const force = Vector.multiply(delta, CENTER_GRAVITY);
      node.force = Vector.add(node.force, force);
    }
  }

  /**
   * Update node positions based on forces
   */
  updatePositions() {
    const { DAMPING, PADDING } = this.options;
    const containerWidth = this.cy.width() || 800;
    const containerHeight = this.cy.height() || 600;

    let totalEnergy = 0;

    for (const node of this.nodes) {
      // Tính gia tốc: a = F / m
      const acceleration = Vector.divide(node.force, node.mass);

      // Cập nhật vận tốc: v = v + a
      node.velocity = Vector.add(node.velocity, acceleration);

      // Áp dụng ma sát
      node.velocity = Vector.multiply(node.velocity, DAMPING);

      // Giới hạn vận tốc tối đa
      node.velocity = Vector.limit(node.velocity, 50);

      // Cập nhật vị trí: x = x + v
      node.position = Vector.add(node.position, node.velocity);

      // Giới hạn trong bounds
      node.position.x = Math.max(PADDING, Math.min(containerWidth - PADDING, node.position.x));
      node.position.y = Math.max(PADDING, Math.min(containerHeight - PADDING, node.position.y));

      // Reset lực
      node.force = Vector.create(0, 0);

      // Tính tổng năng lượng động học
      totalEnergy += Vector.magnitude(node.velocity);
    }

    return totalEnergy;
  }

  /**
   * Apply positions to Cytoscape nodes
   */
  applyPositions(animate = false) {
    for (const nodeData of this.nodes) {
      if (animate) {
        nodeData.node.animate({
          position: { x: nodeData.position.x, y: nodeData.position.y },
          duration: 50,
          easing: 'ease-out'
        });
      } else {
        nodeData.node.position({
          x: nodeData.position.x,
          y: nodeData.position.y
        });
      }
    }
  }

  /**
   * Run one iteration of the simulation
   */
  step() {
    // Reset forces
    for (const node of this.nodes) {
      node.force = Vector.create(0, 0);
    }

    // Calculate all forces
    this.calculateRepulsion();
    this.calculateAttraction();
    this.calculateCenterGravity();

    // Update positions and get energy
    return this.updatePositions();
  }

  /**
   * Run the full simulation
   */
  run(callback) {
    if (this.nodes.length === 0) {
      this.initializeNodes();
    }

    if (this.nodes.length === 0) {
      if (callback) callback();
      return;
    }

    const { MAX_ITERATIONS, MIN_ENERGY } = this.options;
    let iteration = 0;
    this.running = true;

    const simulate = () => {
      if (!this.running) {
        if (callback) callback();
        return;
      }

      const energy = this.step();
      this.applyPositions(false);

      iteration++;

      // Điều kiện dừng
      if (iteration >= MAX_ITERATIONS || energy < MIN_ENERGY) {
        this.running = false;
        this.applyPositions(true); // Animate cuối cùng
        this.cy.fit(undefined, 50);
        console.log(`✅ Force-directed layout completed in ${iteration} iterations`);
        if (callback) callback();
        return;
      }

      // Tiếp tục simulation
      requestAnimationFrame(simulate);
    };

    // Start simulation
    requestAnimationFrame(simulate);
  }

  /**
   * Stop the simulation
   */
  stop() {
    this.running = false;
  }

  /**
   * Reset and re-run
   */
  restart(callback) {
    this.stop();
    this.nodes = [];
    this.edges = [];
    this.initializeNodes();
    this.run(callback);
  }
}

// ============================================
// Quick Layout Functions
// ============================================

/**
 * Apply force-directed layout to Cytoscape instance
 * @param {Object} cy - Cytoscape instance
 * @param {Object} options - Layout options
 * @param {Function} callback - Callback when done
 */
function applyForceLayout(cy, options = {}, callback) {
  if (!cy || cy.nodes().length === 0) {
    console.warn('⚠️ No nodes to layout');
    if (callback) callback();
    return null;
  }

  const layout = new ForceDirectedLayout(cy, options);
  layout.run(callback);
  return layout;
}

/**
 * Apply hierarchical layout (CORE nodes on top)
 * Fallback layout khi force-directed không phù hợp
 */
function applyHierarchicalLayout(cy, options = {}) {
  if (!cy || cy.nodes().length === 0) return;

  const {
    nodeWidth = 280,
    nodeHeight = 140,
    horizontalSpacing = 320,
    verticalSpacing = 200,
    nodesPerRow = 3
  } = options;

  const nodes = cy.nodes();
  const coreNodes = nodes.filter(n => n.data('type') === 'CORE');
  const otherNodes = nodes.filter(n => n.data('type') !== 'CORE');

  let index = 0;

  // Position CORE nodes first row
  coreNodes.forEach((node) => {
    const col = index % nodesPerRow;
    const row = Math.floor(index / nodesPerRow);
    node.position({
      x: col * horizontalSpacing + horizontalSpacing / 2,
      y: row * verticalSpacing + verticalSpacing / 2
    });
    index++;
  });

  // Position other nodes below
  const startRow = Math.ceil(coreNodes.length / nodesPerRow);
  index = 0;

  otherNodes.forEach((node) => {
    const col = index % nodesPerRow;
    const row = Math.floor(index / nodesPerRow) + startRow;
    node.position({
      x: col * horizontalSpacing + horizontalSpacing / 2,
      y: row * verticalSpacing + verticalSpacing / 2
    });
    index++;
  });

  cy.fit(undefined, 50);
}

/**
 * Apply radial layout (CORE at center, others around)
 */
function applyRadialLayout(cy, options = {}) {
  if (!cy || cy.nodes().length === 0) return;

  const containerWidth = cy.width() || 800;
  const containerHeight = cy.height() || 600;
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  const { radius = 300 } = options;

  const nodes = cy.nodes();
  const coreNodes = nodes.filter(n => n.data('type') === 'CORE');
  const otherNodes = nodes.filter(n => n.data('type') !== 'CORE');

  // CORE nodes at center
  const coreRadius = coreNodes.length > 1 ? 80 : 0;
  coreNodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(coreNodes.length, 1);
    node.position({
      x: centerX + coreRadius * Math.cos(angle),
      y: centerY + coreRadius * Math.sin(angle)
    });
  });

  // Other nodes in outer ring
  otherNodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(otherNodes.length, 1) - Math.PI / 2;
    node.position({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    });
  });

  cy.fit(undefined, 50);
}

// ============================================
// Export
// ============================================
window.AutoLayout = {
  ForceDirectedLayout,
  applyForceLayout,
  applyHierarchicalLayout,
  applyRadialLayout,
  Vector,
  CONFIG
};

console.log('✅ AutoLayout module loaded');

// 2D BVH (Bounding Volume Hierarchy) for spatial acceleration of SDF raymarching
// Implicit binary heap layout: left = 2i+1, right = 2i+2
// Leaf detection: nodeIdx >= numInternalNodes

export const MAX_BVH_NODES = 256

export interface AABB2D {
  cx: number  // center X (world)
  cy: number  // center Y (world)
  hw: number  // half-width (world)
  hh: number  // half-height (world)
}

export interface BVHData {
  nodes: Float32Array   // MAX_BVH_NODES * 4 floats, each vec4(minX, minY, maxX, maxY)
  objectOrder: number[] // maps leaf index -> original element index (-1 for padding)
  numInternalNodes: number
  numLeaves: number
}

function nextPow2(n: number): number {
  if (n <= 1) return 1
  return 1 << (32 - Math.clz32(n - 1))
}

export function buildBVH2D(aabbs: AABB2D[]): BVHData {
  const n = aabbs.length
  const nodes = new Float32Array(MAX_BVH_NODES * 4)

  // Initialize all nodes as degenerate (min > max -> always pruned)
  for (let i = 0; i < MAX_BVH_NODES * 4; i += 4) {
    nodes[i] = 1e10
    nodes[i + 1] = 1e10
    nodes[i + 2] = -1e10
    nodes[i + 3] = -1e10
  }

  if (n === 0) {
    return { nodes, objectOrder: [], numInternalNodes: 0, numLeaves: 0 }
  }

  const numLeaves = nextPow2(n)
  const numInternalNodes = numLeaves - 1
  const totalNodes = numLeaves + numInternalNodes

  // Sortable items with original indices
  const items: (AABB2D & { origIdx: number })[] = aabbs.map((a, i) => ({ ...a, origIdx: i }))
  const objectOrder: number[] = new Array(numLeaves).fill(-1)

  // Recursive top-down build with median split on longest axis
  function build(nodeIdx: number, leafStart: number, leafEnd: number) {
    if (nodeIdx >= totalNodes || nodeIdx >= MAX_BVH_NODES) return

    const leafCount = leafEnd - leafStart

    if (leafCount === 1) {
      // Leaf node
      if (leafStart < n) {
        const item = items[leafStart]
        objectOrder[leafStart] = item.origIdx
        const ni = nodeIdx * 4
        nodes[ni] = item.cx - item.hw
        nodes[ni + 1] = item.cy - item.hh
        nodes[ni + 2] = item.cx + item.hw
        nodes[ni + 3] = item.cy + item.hh
      }
      // Padding leaves stay degenerate
      return
    }

    // Sort real items in [leafStart, min(leafEnd, n)) by longest axis
    const realEnd = Math.min(leafEnd, n)
    if (leafStart < realEnd) {
      let aMinX = Infinity, aMinY = Infinity, aMaxX = -Infinity, aMaxY = -Infinity
      for (let i = leafStart; i < realEnd; i++) {
        aMinX = Math.min(aMinX, items[i].cx - items[i].hw)
        aMinY = Math.min(aMinY, items[i].cy - items[i].hh)
        aMaxX = Math.max(aMaxX, items[i].cx + items[i].hw)
        aMaxY = Math.max(aMaxY, items[i].cy + items[i].hh)
      }

      const sortByX = (aMaxX - aMinX) >= (aMaxY - aMinY)
      const sub = items.slice(leafStart, realEnd)
      sub.sort((a, b) => sortByX ? a.cx - b.cx : a.cy - b.cy)
      for (let i = 0; i < sub.length; i++) items[leafStart + i] = sub[i]
    }

    const mid = leafStart + (leafCount >> 1)
    const left = nodeIdx * 2 + 1
    const right = nodeIdx * 2 + 2

    build(left, leafStart, mid)
    build(right, mid, leafEnd)

    // Internal node AABB = union of children
    if (left < MAX_BVH_NODES && right < MAX_BVH_NODES) {
      const ni = nodeIdx * 4
      nodes[ni] = Math.min(nodes[left * 4], nodes[right * 4])
      nodes[ni + 1] = Math.min(nodes[left * 4 + 1], nodes[right * 4 + 1])
      nodes[ni + 2] = Math.max(nodes[left * 4 + 2], nodes[right * 4 + 2])
      nodes[ni + 3] = Math.max(nodes[left * 4 + 3], nodes[right * 4 + 3])
    }
  }

  build(0, 0, numLeaves)

  return { nodes, objectOrder, numInternalNodes, numLeaves }
}

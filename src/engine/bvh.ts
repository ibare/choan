// 3D BVH (Bounding Volume Hierarchy) for spatial acceleration of SDF raymarching
// Implicit binary heap layout: left = 2i+1, right = 2i+2
// Leaf detection: nodeIdx >= numInternalNodes

export const MAX_BVH_NODES = 256
const STRIDE = 6 // floats per node: minX, minY, minZ, maxX, maxY, maxZ

export interface AABB3D {
  cx: number  // center X (world)
  cy: number  // center Y (world)
  cz: number  // center Z (world)
  hw: number  // half-width (world)
  hh: number  // half-height (world)
  hd: number  // half-depth (world)
}

export interface BVHData {
  nodes: Float32Array   // MAX_BVH_NODES * 6 floats, each (minX, minY, minZ, maxX, maxY, maxZ)
  objectOrder: number[] // maps leaf index -> original element index (-1 for padding)
  numInternalNodes: number
  numLeaves: number
}

function nextPow2(n: number): number {
  if (n <= 1) return 1
  return 1 << (32 - Math.clz32(n - 1))
}

export function buildBVH3D(aabbs: AABB3D[]): BVHData {
  const n = aabbs.length
  const nodes = new Float32Array(MAX_BVH_NODES * STRIDE)

  // Initialize all nodes as degenerate (min > max -> always pruned)
  for (let i = 0; i < MAX_BVH_NODES * STRIDE; i += STRIDE) {
    nodes[i] = 1e10; nodes[i + 1] = 1e10; nodes[i + 2] = 1e10
    nodes[i + 3] = -1e10; nodes[i + 4] = -1e10; nodes[i + 5] = -1e10
  }

  if (n === 0) {
    return { nodes, objectOrder: [], numInternalNodes: 0, numLeaves: 0 }
  }

  const numLeaves = nextPow2(n)
  const numInternalNodes = numLeaves - 1
  const totalNodes = numLeaves + numInternalNodes

  const items: (AABB3D & { origIdx: number })[] = aabbs.map((a, i) => ({ ...a, origIdx: i }))
  const objectOrder: number[] = new Array(numLeaves).fill(-1)

  function build(nodeIdx: number, leafStart: number, leafEnd: number) {
    if (nodeIdx >= totalNodes || nodeIdx >= MAX_BVH_NODES) return

    const leafCount = leafEnd - leafStart

    if (leafCount === 1) {
      if (leafStart < n) {
        const item = items[leafStart]
        objectOrder[leafStart] = item.origIdx
        const ni = nodeIdx * STRIDE
        nodes[ni] = item.cx - item.hw
        nodes[ni + 1] = item.cy - item.hh
        nodes[ni + 2] = item.cz - item.hd
        nodes[ni + 3] = item.cx + item.hw
        nodes[ni + 4] = item.cy + item.hh
        nodes[ni + 5] = item.cz + item.hd
      }
      return
    }

    // Sort real items by longest axis (X, Y, or Z)
    const realEnd = Math.min(leafEnd, n)
    if (leafStart < realEnd) {
      let aMinX = Infinity, aMinY = Infinity, aMinZ = Infinity
      let aMaxX = -Infinity, aMaxY = -Infinity, aMaxZ = -Infinity
      for (let i = leafStart; i < realEnd; i++) {
        aMinX = Math.min(aMinX, items[i].cx - items[i].hw)
        aMinY = Math.min(aMinY, items[i].cy - items[i].hh)
        aMinZ = Math.min(aMinZ, items[i].cz - items[i].hd)
        aMaxX = Math.max(aMaxX, items[i].cx + items[i].hw)
        aMaxY = Math.max(aMaxY, items[i].cy + items[i].hh)
        aMaxZ = Math.max(aMaxZ, items[i].cz + items[i].hd)
      }

      const extX = aMaxX - aMinX
      const extY = aMaxY - aMinY
      const extZ = aMaxZ - aMinZ
      const sub = items.slice(leafStart, realEnd)
      if (extZ >= extX && extZ >= extY) {
        sub.sort((a, b) => a.cz - b.cz)
      } else if (extX >= extY) {
        sub.sort((a, b) => a.cx - b.cx)
      } else {
        sub.sort((a, b) => a.cy - b.cy)
      }
      for (let i = 0; i < sub.length; i++) items[leafStart + i] = sub[i]
    }

    const mid = leafStart + (leafCount >> 1)
    const left = nodeIdx * 2 + 1
    const right = nodeIdx * 2 + 2

    build(left, leafStart, mid)
    build(right, mid, leafEnd)

    // Internal node AABB = union of children
    if (left < MAX_BVH_NODES && right < MAX_BVH_NODES) {
      const ni = nodeIdx * STRIDE
      const li = left * STRIDE
      const ri = right * STRIDE
      nodes[ni] = Math.min(nodes[li], nodes[ri])
      nodes[ni + 1] = Math.min(nodes[li + 1], nodes[ri + 1])
      nodes[ni + 2] = Math.min(nodes[li + 2], nodes[ri + 2])
      nodes[ni + 3] = Math.max(nodes[li + 3], nodes[ri + 3])
      nodes[ni + 4] = Math.max(nodes[li + 4], nodes[ri + 4])
      nodes[ni + 5] = Math.max(nodes[li + 5], nodes[ri + 5])
    }
  }

  build(0, 0, numLeaves)

  return { nodes, objectOrder, numInternalNodes, numLeaves }
}

// Backward-compatible alias
export type AABB2D = AABB3D
export const buildBVH2D = buildBVH3D

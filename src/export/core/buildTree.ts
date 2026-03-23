import type { ChoanElement } from '../../store/useChoanStore'

export interface ElementNode {
  el: ChoanElement
  children: ElementNode[]
  depth: number
}

/**
 * Converts a flat ChoanElement array into a parent-child tree.
 * Root nodes are elements without a parentId.
 * Children are ordered by z-index within each parent.
 */
export function buildTree(elements: ChoanElement[]): ElementNode[] {
  const nodeMap = new Map<string, ElementNode>()
  for (const el of elements) {
    nodeMap.set(el.id, { el, children: [], depth: 0 })
  }

  const roots: ElementNode[] = []
  for (const el of elements) {
    const node = nodeMap.get(el.id)!
    if (el.parentId && nodeMap.has(el.parentId)) {
      nodeMap.get(el.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by z (visual stacking order)
  function sortAndSetDepth(node: ElementNode, depth: number) {
    node.depth = depth
    node.children.sort((a, b) => a.el.z - b.el.z)
    for (const child of node.children) {
      sortAndSetDepth(child, depth + 1)
    }
  }
  roots.sort((a, b) => a.el.z - b.el.z)
  for (const root of roots) {
    sortAndSetDepth(root, 0)
  }

  return roots
}

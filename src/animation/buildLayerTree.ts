// Pure utility — builds a hierarchy-ordered list with depth for indentation.

import type { ChoanElement } from '../store/useChoanStore'

export function buildLayerTree(elements: ChoanElement[]): Array<{ el: ChoanElement; depth: number }> {
  const result: Array<{ el: ChoanElement; depth: number }> = []
  const childMap = new Map<string, ChoanElement[]>()
  for (const el of elements) {
    const key = el.parentId ?? '__root__'
    if (!childMap.has(key)) childMap.set(key, [])
    childMap.get(key)!.push(el)
  }
  function walk(parentKey: string, depth: number) {
    for (const child of childMap.get(parentKey) ?? []) {
      result.push({ el: child, depth })
      walk(child.id, depth + 1)
    }
  }
  walk('__root__', 0)
  return result
}

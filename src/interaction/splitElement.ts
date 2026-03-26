import { useChoanStore } from '../store/useChoanStore'
import { nanoid } from '../utils/nanoid'
import type { ChoanElement } from '../store/useChoanStore'

export function splitElement(
  count: number,
  elementId: string,
  direction: 'horizontal' | 'vertical',
): void {
  if (count <= 1) return

  const store = useChoanStore.getState()
  const el = store.elements.find((e) => e.id === elementId)
  if (!el) return

  const parent = el.parentId ? store.elements.find((e) => e.id === el.parentId) : null
  const isAutoLayout = parent && parent.layoutDirection !== 'free' && parent.layoutDirection !== undefined
  const gap = isAutoLayout ? 0 : 8

  const isH = direction === 'horizontal'
  const sliceSize = (isH ? el.width : el.height) / count
  const totalSize = sliceSize * count + gap * (count - 1)
  const startPos = (isH ? el.x : el.y) - (totalSize - (isH ? el.width : el.height)) / 2

  const allElements = store.elements
  function collectDescendants(parentId: string): ChoanElement[] {
    const direct = allElements.filter((e) => e.parentId === parentId)
    const result: ChoanElement[] = []
    for (const child of direct) {
      result.push(child)
      result.push(...collectDescendants(child.id))
    }
    return result
  }
  const descendants = collectDescendants(elementId)

  const newIds: string[] = []
  for (let i = 0; i < count; i++) {
    const id = nanoid()
    newIds.push(id)
    store.addElement({ ...el, id, x: el.x, y: el.y, width: el.width, height: el.height, label: `${el.label} ${i + 1}`, parentId: el.parentId })

    const idMap = new Map<string, string>()
    idMap.set(elementId, id)
    for (const desc of descendants) idMap.set(desc.id, nanoid())
    for (const desc of descendants) {
      store.addElement({ ...desc, id: idMap.get(desc.id)!, parentId: idMap.get(desc.parentId!)! })
    }
  }

  for (let i = descendants.length - 1; i >= 0; i--) store.removeElement(descendants[i].id)
  store.removeElement(elementId)
  store.setSelectedIds([])

  requestAnimationFrame(() => {
    const s = useChoanStore.getState()
    for (let i = 0; i < newIds.length; i++) {
      s.updateElement(newIds[i], isH
        ? { x: startPos + (sliceSize + gap) * i, width: sliceSize }
        : { y: startPos + (sliceSize + gap) * i, height: sliceSize },
      )
      if (el.layoutDirection && el.layoutDirection !== 'free') s.runLayout(newIds[i])
    }
    if (isAutoLayout && el.parentId) s.runLayout(el.parentId)
  })
}

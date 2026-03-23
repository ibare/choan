// Keyboard shortcuts hook — resolves hotkey bindings to actions.

import { useEffect, useRef, useCallback, type MutableRefObject } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { nanoid } from '../canvas/nanoid'
import type { ChoanElement } from '../store/useChoanStore'
import type { OrbitControls } from '../engine/controls'
import { resolveHotkey } from './hotkeyRegistry'

export type ActionHandler = () => void

export interface SplitMode {
  active: boolean
  count: number       // 1 = cancel, 2+ = split into N
  elementId: string
  direction: 'horizontal' | 'vertical'
}

export function useKeyboardHandlers(
  colorPickerOpenRef: MutableRefObject<boolean>,
  colorPickerHoverRef: MutableRefObject<number>,
  splitModeRef: MutableRefObject<SplitMode>,
  controlsRef?: MutableRefObject<OrbitControls | null>,
  customActions?: Record<string, ActionHandler>,
): void {
  const { removeElement, setTool } = useChoanStore()
  const copiedRef = useRef<ChoanElement[]>([])
  const customActionsRef = useRef(customActions)
  customActionsRef.current = customActions

  const executeSplit = useCallback(() => {
    const { count, elementId, direction } = splitModeRef.current
    splitModeRef.current = { active: false, count: 2, elementId: '', direction: 'horizontal' }
    if (controlsRef?.current) controlsRef.current.wheelEnabled = true

    if (count <= 1) return // 1 = cancel

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

    // Collect entire descendant subtree (recursive)
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

    // Create at original position/size first (for spring animation)
    const newIds: string[] = []
    for (let i = 0; i < count; i++) {
      const id = nanoid()
      newIds.push(id)
      store.addElement({ ...el, id, x: el.x, y: el.y, width: el.width, height: el.height, label: `${el.label} ${i + 1}`, parentId: el.parentId })

      // Duplicate entire subtree — map old IDs to new IDs for parent references
      const idMap = new Map<string, string>()
      idMap.set(elementId, id)
      for (const desc of descendants) {
        const newDescId = nanoid()
        idMap.set(desc.id, newDescId)
      }
      for (const desc of descendants) {
        store.addElement({ ...desc, id: idMap.get(desc.id)!, parentId: idMap.get(desc.parentId!)! })
      }
    }

    // Remove original descendants (deepest first) then container
    for (let i = descendants.length - 1; i >= 0; i--) store.removeElement(descendants[i].id)
    store.removeElement(elementId)
    store.setSelectedIds([])

    // Next frame: update to final positions → spring animation + re-layout children
    // applyLayout is now recursive, so runLayout propagates to all descendants
    requestAnimationFrame(() => {
      const s = useChoanStore.getState()
      for (let i = 0; i < newIds.length; i++) {
        s.updateElement(newIds[i], isH
          ? { x: startPos + (sliceSize + gap) * i, width: sliceSize }
          : { y: startPos + (sliceSize + gap) * i, height: sliceSize },
        )
        if (el.layoutDirection && el.layoutDirection !== 'free') {
          s.runLayout(newIds[i])
        }
      }
      if (isAutoLayout && el.parentId) {
        s.runLayout(el.parentId)
      }
    })
  }, [])

  const builtinActions = useCallback((): Record<string, ActionHandler> => ({
    'escape': () => {
      if (splitModeRef.current.active) {
        splitModeRef.current = { active: false, count: 2, elementId: '', direction: 'horizontal' }
        if (controlsRef?.current) controlsRef.current.wheelEnabled = true
        return
      }
      colorPickerOpenRef.current = false
      colorPickerHoverRef.current = -1
    },
    'delete': () => {
      if (splitModeRef.current.active) return
      const { selectedIds } = useChoanStore.getState()
      for (const id of selectedIds) removeElement(id)
    },
    'copy': () => {
      const { selectedIds, elements } = useChoanStore.getState()
      if (selectedIds.length === 0) return
      const rootId = selectedIds[0]
      // Collect root + all descendants recursively
      const collected: ChoanElement[] = []
      function collect(parentId: string) {
        for (const el of elements) {
          if (el.id === parentId || el.parentId === parentId) {
            if (!collected.some((c) => c.id === el.id)) {
              collected.push(el)
              collect(el.id)
            }
          }
        }
      }
      collect(rootId)
      copiedRef.current = collected
    },
    'paste': () => {
      const sources = copiedRef.current
      if (sources.length === 0) return
      const store = useChoanStore.getState()
      const root = sources[0]

      // Create ID mapping (old → new)
      const idMap = new Map<string, string>()
      for (const el of sources) idMap.set(el.id, nanoid())

      const rootId = idMap.get(root.id)!
      const parentStillExists = root.parentId && store.elements.some((e) => e.id === root.parentId)

      for (const el of sources) {
        const newId = idMap.get(el.id)!
        const isRoot = el.id === root.id
        let newParentId: string | undefined
        if (isRoot) {
          newParentId = parentStillExists ? root.parentId : undefined
        } else {
          newParentId = el.parentId ? idMap.get(el.parentId) : undefined
        }
        store.addElement({
          ...el,
          id: newId,
          x: isRoot ? el.x + 20 : el.x,
          y: isRoot ? el.y + 20 : el.y,
          parentId: newParentId,
        })
      }

      if (parentStillExists && root.parentId) store.runLayout(root.parentId)
      // Re-layout all pasted containers so children are positioned correctly
      for (const el of sources) {
        if (el.layoutDirection && el.layoutDirection !== 'free') {
          store.runLayout(idMap.get(el.id)!)
        }
      }
      store.selectElement(rootId)
    },
    'tool:select': () => setTool('select'),
    'tool:rectangle': () => setTool('rectangle'),

    // Split mode
    'split:enter': () => {
      const { selectedIds } = useChoanStore.getState()
      if (selectedIds.length !== 1) return
      splitModeRef.current = { active: true, count: 2, elementId: selectedIds[0], direction: 'horizontal' }
      if (controlsRef?.current) controlsRef.current.wheelEnabled = false
    },
    'split:toggle-dir': () => {
      if (!splitModeRef.current.active) return
      splitModeRef.current = { ...splitModeRef.current, direction: splitModeRef.current.direction === 'horizontal' ? 'vertical' : 'horizontal' }
    },
    'split:confirm': () => {
      if (!splitModeRef.current.active) return
      executeSplit()
    },
  }), [removeElement, setTool, colorPickerOpenRef, colorPickerHoverRef, executeSplit])

  useEffect(() => {
    // Wheel to adjust split count
    const onWheel = (e: WheelEvent) => {
      if (!splitModeRef.current.active) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? 1 : -1
      splitModeRef.current = {
        ...splitModeRef.current,
        count: Math.max(0, splitModeRef.current.count + delta),
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const binding = resolveHotkey(e)
      if (!binding) return

      const custom = customActionsRef.current?.[binding.action]
      if (custom) { e.preventDefault(); custom(); return }

      const handler = builtinActions()[binding.action]
      if (handler) { e.preventDefault(); handler() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [builtinActions])
}

// Keyboard shortcuts hook — resolves hotkey bindings to actions.

import { useEffect, useRef, useCallback, type MutableRefObject } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { nanoid } from '../canvas/nanoid'
import type { ChoanElement } from '../store/useChoanStore'
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
  customActions?: Record<string, ActionHandler>,
): void {
  const { removeElement, setTool } = useChoanStore()
  const copiedRef = useRef<ChoanElement | null>(null)
  const customActionsRef = useRef(customActions)
  customActionsRef.current = customActions

  const executeSplit = useCallback(() => {
    const { count, elementId, direction } = splitModeRef.current
    splitModeRef.current = { active: false, count: 2, elementId: '', direction: 'horizontal' }

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

    // Collect children (for container duplication)
    const children = store.elements.filter((e) => e.parentId === elementId)

    // Create at original position/size first (for spring animation)
    const newIds: string[] = []
    for (let i = 0; i < count; i++) {
      const id = nanoid()
      newIds.push(id)
      store.addElement({ ...el, id, x: el.x, y: el.y, width: el.width, height: el.height, label: el.label, parentId: el.parentId })

      // Duplicate children into each new container
      for (const child of children) {
        const childId = nanoid()
        store.addElement({ ...child, id: childId, parentId: id })
      }
    }

    // Remove original children then container
    for (const child of children) store.removeElement(child.id)
    store.removeElement(elementId)
    store.setSelectedIds([])

    // Next frame: update to final positions → spring animation + re-layout children
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
    })
  }, [])

  const builtinActions = useCallback((): Record<string, ActionHandler> => ({
    'escape': () => {
      if (splitModeRef.current.active) {
        splitModeRef.current = { active: false, count: 2, elementId: '', direction: 'horizontal' }
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
      if (selectedIds.length > 0) copiedRef.current = elements.find((el) => el.id === selectedIds[0]) ?? null
    },
    'paste': () => {
      const src = copiedRef.current
      if (!src) return
      const id = nanoid()
      const { addElement, selectElement, runLayout, elements: curEls } = useChoanStore.getState()
      const parentStillExists = src.parentId && curEls.some((e) => e.id === src.parentId)
      addElement({ ...src, id, x: src.x + 20, y: src.y + 20, parentId: parentStillExists ? src.parentId : undefined })
      if (parentStillExists && src.parentId) runLayout(src.parentId)
      selectElement(id)
    },
    'tool:select': () => setTool('select'),
    'tool:rectangle': () => setTool('rectangle'),

    // Split mode
    'split:enter': () => {
      const { selectedIds } = useChoanStore.getState()
      if (selectedIds.length !== 1) return
      splitModeRef.current = { active: true, count: 2, elementId: selectedIds[0], direction: 'horizontal' }
    },
    'split:toggle-dir': () => {
      if (!splitModeRef.current.active) return
      splitModeRef.current = { ...splitModeRef.current, direction: splitModeRef.current.direction === 'horizontal' ? 'vertical' : 'horizontal' }
    },
    'split:confirm': () => {
      if (!splitModeRef.current.active) return
      executeSplit()
    },
    'split:1': () => { if (splitModeRef.current.active) splitModeRef.current = { ...splitModeRef.current, count: 1 } },
    'split:2': () => { if (splitModeRef.current.active) splitModeRef.current = { ...splitModeRef.current, count: 2 } },
    'split:3': () => { if (splitModeRef.current.active) splitModeRef.current = { ...splitModeRef.current, count: 3 } },
    'split:4': () => { if (splitModeRef.current.active) splitModeRef.current = { ...splitModeRef.current, count: 4 } },
    'split:5': () => { if (splitModeRef.current.active) splitModeRef.current = { ...splitModeRef.current, count: 5 } },
    'split:6': () => { if (splitModeRef.current.active) splitModeRef.current = { ...splitModeRef.current, count: 6 } },
    'split:7': () => { if (splitModeRef.current.active) splitModeRef.current = { ...splitModeRef.current, count: 7 } },
    'split:8': () => { if (splitModeRef.current.active) splitModeRef.current = { ...splitModeRef.current, count: 8 } },
    'split:9': () => { if (splitModeRef.current.active) splitModeRef.current = { ...splitModeRef.current, count: 9 } },
  }), [removeElement, setTool, colorPickerOpenRef, colorPickerHoverRef, executeSplit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const binding = resolveHotkey(e)
      if (!binding) return

      const custom = customActionsRef.current?.[binding.action]
      if (custom) { custom(); return }

      const handler = builtinActions()[binding.action]
      if (handler) handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [builtinActions])
}

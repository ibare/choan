// Keyboard shortcuts hook — resolves hotkey bindings to actions.

import { useEffect, useRef, useCallback, type MutableRefObject } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { nanoid } from '../utils/nanoid'
import type { ChoanElement } from '../store/useChoanStore'
import type { OrbitControls } from '../engine/controls'
import { resolveHotkey } from './hotkeyRegistry'
import { useDirectorStore } from '../store/useDirectorStore'
import { splitElement } from './splitElement'
import { frameSelectionToOrigin } from './frameSelection'
import { undo, redo, pushSnapshot } from '../store/history'

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
  const { removeElement, setTool, setPendingSkin, setPendingFrame } = useChoanStore()
  const copiedRef = useRef<ChoanElement[]>([])
  const customActionsRef = useRef(customActions)
  customActionsRef.current = customActions

  const executeSplit = useCallback(() => {
    const { count, elementId, direction } = splitModeRef.current
    splitModeRef.current = { active: false, count: 2, elementId: '', direction: 'horizontal' }
    if (controlsRef?.current) controlsRef.current.wheelEnabled = true
    splitElement(count, elementId, direction)
  }, [])

  const builtinActions = useCallback((): Record<string, ActionHandler> => ({
    'undo': () => undo(),
    'redo': () => redo(),
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
      if (selectedIds.length === 0) return
      for (const id of selectedIds) removeElement(id)
      pushSnapshot()
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
      pushSnapshot()
    },
    'frame-selection': () => {
      if (!controlsRef?.current) return
      if (useDirectorStore.getState().directorMode) return
      frameSelectionToOrigin(controlsRef.current)
    },
    'tool:select': () => { setTool('select'); setPendingSkin(null); setPendingFrame(null) },
    'tool:rectangle': () => { setTool('rectangle'); setPendingSkin(null); setPendingFrame(null) },
    'frame:browser': () => { setTool('rectangle'); setPendingSkin(null); setPendingFrame('browser') },
    'frame:mobile': () => { setTool('rectangle'); setPendingSkin(null); setPendingFrame('mobile') },

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
  }), [removeElement, setTool, setPendingSkin, setPendingFrame, colorPickerOpenRef, colorPickerHoverRef, executeSplit])

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

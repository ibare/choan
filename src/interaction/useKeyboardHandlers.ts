// Keyboard shortcuts hook — resolves hotkey bindings to actions.

import { useEffect, useRef, useCallback, type MutableRefObject } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { nanoid } from '../canvas/nanoid'
import type { ChoanElement } from '../store/useChoanStore'
import { resolveHotkey } from './hotkeyRegistry'

export type ActionHandler = () => void

export function useKeyboardHandlers(
  colorPickerOpenRef: MutableRefObject<boolean>,
  colorPickerHoverRef: MutableRefObject<number>,
  customActions?: Record<string, ActionHandler>,
): void {
  const { removeElement, setTool } = useChoanStore()
  const copiedRef = useRef<ChoanElement | null>(null)
  const customActionsRef = useRef(customActions)
  customActionsRef.current = customActions

  const builtinActions = useCallback((): Record<string, ActionHandler> => ({
    'escape': () => {
      colorPickerOpenRef.current = false
      colorPickerHoverRef.current = -1
    },
    'delete': () => {
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
  }), [removeElement, setTool, colorPickerOpenRef, colorPickerHoverRef])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const binding = resolveHotkey(e)
      if (!binding) return

      // Check custom actions first, then builtins
      const custom = customActionsRef.current?.[binding.action]
      if (custom) { custom(); return }

      const handler = builtinActions()[binding.action]
      if (handler) handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [builtinActions])
}

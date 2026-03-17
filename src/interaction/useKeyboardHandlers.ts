// Keyboard shortcuts hook — owns copy/paste clipboard state.

import { useEffect, useRef, type MutableRefObject } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { nanoid } from '../canvas/nanoid'
import type { ChoanElement } from '../store/useChoanStore'

export function useKeyboardHandlers(
  colorPickerOpenRef: MutableRefObject<boolean>,
  colorPickerHoverRef: MutableRefObject<number>,
): void {
  const { removeElement, setTool } = useChoanStore()
  const copiedRef = useRef<ChoanElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape') {
        colorPickerOpenRef.current = false
        colorPickerHoverRef.current = -1
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedIds: sIds } = useChoanStore.getState()
        for (const id of sIds) removeElement(id)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const { selectedIds: sIds, elements } = useChoanStore.getState()
        if (sIds.length > 0) copiedRef.current = elements.find((el) => el.id === sIds[0]) ?? null
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const src = copiedRef.current
        if (src) {
          const id = nanoid()
          const { addElement, selectElement, reparentElement, runLayout, elements: curEls } = useChoanStore.getState()
          const parentStillExists = src.parentId && curEls.some((e) => e.id === src.parentId)
          addElement({ ...src, id, x: src.x + 20, y: src.y + 20, parentId: parentStillExists ? src.parentId : undefined })
          if (parentStillExists && src.parentId) runLayout(src.parentId)
          selectElement(id)
        }
      } else if (!e.ctrlKey && !e.metaKey) {
        if (e.key === 'v' || e.key === 'V') setTool('select')
        else if (e.key === 'r' || e.key === 'R') setTool('rectangle')
        else if (e.key === 'c' || e.key === 'C') setTool('circle')
        else if (e.key === 'l' || e.key === 'L') setTool('line')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeElement, setTool, colorPickerOpenRef, colorPickerHoverRef])
}

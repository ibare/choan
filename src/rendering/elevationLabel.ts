// Elevation label DOM updater — called from the animation loop each frame.
// Lives in rendering/ to preserve dependency direction (rendering → canvas is not allowed).

import { TARGET_DRAG_MAX_TILT_DEG } from '../constants'

/** Update the elevation-angle label DOM element directly (no extra rAF). */
export function updateElevationLabel(
  el: HTMLSpanElement | null,
  data: { deg: number; screenX: number; screenY: number } | null,
): void {
  if (!el) return
  if (!data) {
    el.style.display = 'none'
    return
  }
  const { deg, screenX, screenY } = data
  const dpr = window.devicePixelRatio || 1
  const cssX = screenX / dpr
  const cssY = screenY / dpr
  const blocked = deg > TARGET_DRAG_MAX_TILT_DEG
  el.style.display = ''
  el.style.left = `${cssX + 16}px`
  el.style.top = `${cssY - 8}px`
  el.style.color = blocked ? '#dc2626' : '#1a1a1a'
  el.textContent = `${deg.toFixed(1)}°`
}

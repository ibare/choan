// Overlay draw commands — pure function, no store imports.
//
// Builds all overlay draw calls for a single frame: selection outlines,
// snap guide lines, distance measurements, and the WebGL color picker.

import type { OverlayRenderer } from '../engine/overlay'
import type { ChoanElement } from '../store/useChoanStore'
import type { SnapLine, DistanceMeasure } from '../canvas/snapUtils'
import type { RenderSettings } from '../store/useRenderSettings'
import { COLOR_FAMILIES } from '../canvas/materials'
import {
  SELECTION_COLOR, SNAP_COLOR, DISTANCE_COLOR,
  COLOR_PICKER_RING_BASE, COLOR_PICKER_RING_STEP, COLOR_PICKER_DISC_RADIUS,
  HANDLE_SIZE_PX, DISTANCE_TICK_PX,
} from '../constants'
import { FRUSTUM } from '../engine/scene'
import { pixelToWorld } from '../coords/coordinateSystem'

export function drawOverlay(
  ov: OverlayRenderer,
  selectedIds: string[],
  elements: ChoanElement[],
  snapLines: SnapLine[],
  distMeasures: (DistanceMeasure | null)[],
  colorPickerOpen: boolean,
  colorPickerHover: number,
  canvasSize: { w: number; h: number },
  zoomScale: number,
  rs: RenderSettings,
): void {
  const { w, h } = canvasSize
  const aspect = w / h
  const zs = zoomScale
  const p2w = (px: number, py: number): [number, number] => pixelToWorld(px, py, w, h)

  // Selection outlines + corner handles
  for (const selId of selectedIds) {
    const el = elements.find((e) => e.id === selId)
    if (!el) continue
    ov.setZ(el.z * rs.extrudeDepth + rs.extrudeDepth / 2)
    const tl = p2w(el.x, el.y), tr = p2w(el.x + el.width, el.y)
    const br = p2w(el.x + el.width, el.y + el.height), bl = p2w(el.x, el.y + el.height)
    ov.drawLines(new Float32Array([...tl, ...tr, ...tr, ...br, ...br, ...bl, ...bl, ...tl]), SELECTION_COLOR)
    const hWorld = HANDLE_SIZE_PX * (2 * FRUSTUM) / h * zs
    const handles = new Float32Array([...tl, ...tr, ...br, ...bl])
    ov.drawQuads(handles, hWorld, SELECTION_COLOR)
    ov.drawQuads(handles, hWorld * 0.6, [1, 1, 1, 1])
    ov.setZ(0)
  }

  // Snap guide lines
  if (snapLines.length > 0) {
    ov.drawLines(
      new Float32Array(snapLines.flatMap((s) => [...p2w(s.x1, s.y1), ...p2w(s.x2, s.y2)])),
      SNAP_COLOR,
    )
  }

  // Distance measurement lines + tick marks
  const dVerts: number[] = []
  for (const m of distMeasures) {
    if (!m) continue
    const a = p2w(m.x1, m.y1), b = p2w(m.x2, m.y2)
    dVerts.push(...a, ...b)
    const tick = DISTANCE_TICK_PX * (2 * FRUSTUM) / h * zs
    if (Math.abs(m.y1 - m.y2) < 1) {
      dVerts.push(a[0], a[1] - tick, a[0], a[1] + tick, b[0], b[1] - tick, b[0], b[1] + tick)
    } else {
      const tickX = DISTANCE_TICK_PX * (2 * FRUSTUM * aspect) / w * zs
      dVerts.push(a[0] - tickX, a[1], a[0] + tickX, a[1], b[0] - tickX, b[1], b[0] + tickX, b[1])
    }
  }
  if (dVerts.length > 0) ov.drawLines(new Float32Array(dVerts), DISTANCE_COLOR)

  // WebGL color picker (single selection only)
  if (colorPickerOpen && selectedIds.length === 1) {
    const pickEl = elements.find((e) => e.id === selectedIds[0])
    if (pickEl) {
      ov.setZ(pickEl.z * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.01)
      const ax = pickEl.x + pickEl.width, ay = pickEl.y
      const pxToW = (2 * FRUSTUM) / h * zs
      const discR = COLOR_PICKER_DISC_RADIUS * pxToW
      const borderR = discR * 1.22
      for (let fi = 0; fi < COLOR_FAMILIES.length; fi++) {
        for (let si = 0; si < COLOR_FAMILIES[fi].shades.length; si++) {
          const angle = (fi / COLOR_FAMILIES.length) * Math.PI * 2 - Math.PI / 2
          const ring = (COLOR_PICKER_RING_BASE + si * COLOR_PICKER_RING_STEP) * zs
          const [wx, wy] = p2w(ax + Math.cos(angle) * ring, ay + Math.sin(angle) * ring)
          const hex = COLOR_FAMILIES[fi].shades[si]
          const idx = fi * 5 + si
          const isHovered = idx === colorPickerHover, isActive = pickEl.color === hex
          ov.drawDisc(wx, wy, isHovered ? borderR * 1.3 : isActive ? borderR * 1.2 : borderR, isActive ? [0.36, 0.31, 0.81, 1] : [1, 1, 1, 0.9])
          ov.drawDisc(wx, wy, isHovered ? discR * 1.3 : discR, [((hex >> 16) & 0xFF) / 255, ((hex >> 8) & 0xFF) / 255, (hex & 0xFF) / 255, 1])
        }
      }
      ov.setZ(0)
    }
  }
}

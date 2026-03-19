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

export interface SplitOverlay {
  active: boolean
  count: number
  elementId: string
  direction: 'horizontal' | 'vertical'
}

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
  splitOverlay?: SplitOverlay,
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

    // Layout resize handles between children (row/column containers)
    const dir = el.layoutDirection
    if (dir === 'row' || dir === 'column') {
      const children = elements.filter((e) => e.parentId === el.id)
      const HANDLE_COLOR: [number, number, number, number] = [0.36, 0.31, 0.81, 0.7]
      for (let ci = 0; ci < children.length - 1; ci++) {
        const child = children[ci]
        if (dir === 'row') {
          const hx = child.x + child.width
          const midY = child.y + child.height / 2
          const handle = p2w(hx, midY)
          ov.drawQuads(new Float32Array(handle), hWorld * 1.2, HANDLE_COLOR)
          ov.drawQuads(new Float32Array(handle), hWorld * 0.7, [1, 1, 1, 0.9])
        } else {
          const hy = child.y + child.height
          const midX = child.x + child.width / 2
          const handle = p2w(midX, hy)
          ov.drawQuads(new Float32Array(handle), hWorld * 1.2, HANDLE_COLOR)
          ov.drawQuads(new Float32Array(handle), hWorld * 0.7, [1, 1, 1, 0.9])
        }
      }
    }
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

  // WebGL color picker (single selection only) — rendered in screen space
  if (colorPickerOpen && selectedIds.length === 1) {
    const pickEl = elements.find((e) => e.id === selectedIds[0])
    if (pickEl) {
      // Project anchor (top-right corner) to screen pixel
      const [anchorWx, anchorWy] = p2w(pickEl.x + pickEl.width, pickEl.y)
      const anchorZ = pickEl.z * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.01
      const anchor = ov.projectToScreen(anchorWx, anchorWy, anchorZ)

      const dpr = window.devicePixelRatio || 1
      const discR = COLOR_PICKER_DISC_RADIUS * dpr
      const borderR = discR * 1.22
      for (let fi = 0; fi < COLOR_FAMILIES.length; fi++) {
        for (let si = 0; si < COLOR_FAMILIES[fi].shades.length; si++) {
          const angle = (fi / COLOR_FAMILIES.length) * Math.PI * 2 - Math.PI / 2
          const ring = (COLOR_PICKER_RING_BASE + si * COLOR_PICKER_RING_STEP) * dpr
          const sx = anchor.px + Math.cos(angle) * ring
          const sy = anchor.py - Math.sin(angle) * ring
          const hex = COLOR_FAMILIES[fi].shades[si]
          const idx = fi * 5 + si
          const isHovered = idx === colorPickerHover, isActive = pickEl.color === hex
          ov.drawDiscScreen(sx, sy, isHovered ? borderR * 1.3 : isActive ? borderR * 1.2 : borderR, isActive ? [0.36, 0.31, 0.81, 1] : [1, 1, 1, 0.9])
          ov.drawDiscScreen(sx, sy, isHovered ? discR * 1.3 : discR, [((hex >> 16) & 0xFF) / 255, ((hex >> 8) & 0xFF) / 255, (hex & 0xFF) / 255, 1])
        }
      }
    }
  }

  // Split mode guide lines
  if (splitOverlay?.active && splitOverlay.count > 1) {
    const splitEl = elements.find((e) => e.id === splitOverlay.elementId)
    if (splitEl) {
      const SPLIT_COLOR: [number, number, number, number] = [0.9, 0.2, 0.2, 0.85]
      ov.setZ(splitEl.z * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.02)
      const verts: number[] = []
      const isH = splitOverlay.direction !== 'vertical'
      for (let i = 1; i < splitOverlay.count; i++) {
        if (isH) {
          const xPx = splitEl.x + (splitEl.width / splitOverlay.count) * i
          const top = p2w(xPx, splitEl.y)
          const bot = p2w(xPx, splitEl.y + splitEl.height)
          verts.push(...top, ...bot)
        } else {
          const yPx = splitEl.y + (splitEl.height / splitOverlay.count) * i
          const left = p2w(splitEl.x, yPx)
          const right = p2w(splitEl.x + splitEl.width, yPx)
          verts.push(...left, ...right)
        }
      }
      if (verts.length > 0) ov.drawLines(new Float32Array(verts), SPLIT_COLOR)
      ov.setZ(0)
    }
  }
}

// Overlay draw commands — pure function, no store imports.
//
// Builds all overlay draw calls for a single frame: selection outlines,
// snap guide lines, distance measurements, and the WebGL color picker.

import type { OverlayRenderer } from '../engine/overlay'
import type { ChoanElement } from '../store/useChoanStore'
import type { SnapLine, DistanceMeasure } from '../utils/snapUtils'
import type { RenderSettings } from '../store/useRenderSettings'
import {
  SELECTION_COLOR, SNAP_COLOR, DISTANCE_COLOR,
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
  colorWheelTex?: { texture: WebGLTexture; size: number; ringCount: number; getCellCenter: (fi: number, si: number) => { x: number; y: number } },
): void {
  const { w, h } = canvasSize
  const aspect = w / h
  const zs = zoomScale
  const p2w = (px: number, py: number): [number, number] => pixelToWorld(px, py)

  // Selection outlines + handles (corner discs + mid-edge capsules)
  const isSingleSelect = selectedIds.length === 1
  for (const selId of selectedIds) {
    const el = elements.find((e) => e.id === selId)
    if (!el) continue
    ov.setZ(el.z * rs.extrudeDepth + rs.extrudeDepth / 2)
    const tl = p2w(el.x, el.y), tr = p2w(el.x + el.width, el.y)
    const br = p2w(el.x + el.width, el.y + el.height), bl = p2w(el.x, el.y + el.height)

    // Shared units
    const dpr = window.devicePixelRatio || 1
    const elZ = el.z * rs.extrudeDepth + rs.extrudeDepth / 2
    const uy = (2 * FRUSTUM) / h * zs              // world units per screen pixel (Y)
    const ux = (2 * FRUSTUM * aspect) / w * zs     // world units per screen pixel (X)
    const hlx = 1.5 * ux  // line half-width in world (X)
    const hly = 1.5 * uy  // line half-width in world (Y)

    // Thick selection outline (world-space — rotates correctly with camera)
    ov.drawWorldRect((tl[0] + tr[0]) / 2, (tl[1] + tr[1]) / 2, Math.abs(tr[0] - tl[0]) / 2 + hlx, hly, SELECTION_COLOR)
    ov.drawWorldRect((tr[0] + br[0]) / 2, (tr[1] + br[1]) / 2, hlx, Math.abs(tr[1] - br[1]) / 2 + hly, SELECTION_COLOR)
    ov.drawWorldRect((br[0] + bl[0]) / 2, (br[1] + bl[1]) / 2, Math.abs(br[0] - bl[0]) / 2 + hlx, hly, SELECTION_COLOR)
    ov.drawWorldRect((bl[0] + tl[0]) / 2, (bl[1] + tl[1]) / 2, hlx, Math.abs(bl[1] - tl[1]) / 2 + hly, SELECTION_COLOR)

    // Project corners to screen (for handles only)
    const sn = (v: number) => Math.round(v)
    const sTlx = sn(ov.projectToScreen(tl[0], tl[1], elZ).px), sTly = sn(ov.projectToScreen(tl[0], tl[1], elZ).py)
    const sTrx = sn(ov.projectToScreen(tr[0], tr[1], elZ).px), sTry = sn(ov.projectToScreen(tr[0], tr[1], elZ).py)
    const sBrx = sn(ov.projectToScreen(br[0], br[1], elZ).px), sBry = sn(ov.projectToScreen(br[0], br[1], elZ).py)
    const sBlx = sn(ov.projectToScreen(bl[0], bl[1], elZ).px), sBly = sn(ov.projectToScreen(bl[0], bl[1], elZ).py)

    // Handles only for single selection (no resize on multi-select)
    if (isSingleSelect) {
      // Corner handles — screen-space squares
      const cornerR = Math.round(6 * dpr)
      const cornerStroke = Math.round(2 * dpr)
      const cornerInnerR = cornerR - cornerStroke
      for (const [sx, sy] of [[sTlx, sTly], [sTrx, sTry], [sBrx, sBry], [sBlx, sBly]]) {
        ov.drawRectScreen(sx, sy, 2 * cornerR, 2 * cornerR, SELECTION_COLOR)
        ov.drawRectScreen(sx, sy, 2 * cornerInnerR, 2 * cornerInnerR, [1, 1, 1, 1])
      }

      // Mid-edge capsule handles — fully screen-space
      const capL = Math.round(17 * dpr)
      const capW = Math.round(5 * dpr)
      const capStroke = Math.round(2 * dpr)
      const capInnerW = capW - capStroke
      const capInnerL = capL - capStroke
      const capBodyHL = capL - capW
      const capInnerBodyHL = capInnerL - capInnerW

      const drawCapsule = (wx: number, wy: number, horizontal: boolean) => {
        const sc = ov.projectToScreen(wx, wy, elZ)
        const cx = Math.round(sc.px), cy = Math.round(sc.py)
        if (horizontal) {
          ov.drawRectScreen(cx, cy, 2 * capBodyHL, 2 * capW, SELECTION_COLOR)
          ov.drawDiscScreen(cx - capBodyHL, cy, capW, SELECTION_COLOR)
          ov.drawDiscScreen(cx + capBodyHL, cy, capW, SELECTION_COLOR)
          ov.drawRectScreen(cx, cy, 2 * capInnerBodyHL, 2 * capInnerW, [1, 1, 1, 1])
          ov.drawDiscScreen(cx - capInnerBodyHL, cy, capInnerW, [1, 1, 1, 1])
          ov.drawDiscScreen(cx + capInnerBodyHL, cy, capInnerW, [1, 1, 1, 1])
        } else {
          ov.drawRectScreen(cx, cy, 2 * capW, 2 * capBodyHL, SELECTION_COLOR)
          ov.drawDiscScreen(cx, cy - capBodyHL, capW, SELECTION_COLOR)
          ov.drawDiscScreen(cx, cy + capBodyHL, capW, SELECTION_COLOR)
          ov.drawRectScreen(cx, cy, 2 * capInnerW, 2 * capInnerBodyHL, [1, 1, 1, 1])
          ov.drawDiscScreen(cx, cy - capInnerBodyHL, capInnerW, [1, 1, 1, 1])
          ov.drawDiscScreen(cx, cy + capInnerBodyHL, capInnerW, [1, 1, 1, 1])
        }
      }

      const edgeW = Math.abs(sTrx - sTlx)
      const edgeH = Math.abs(sBly - sTly)
      const minEdge = capL * 2 + Math.round(6 * dpr) * 2

      if (edgeW > minEdge) {
        const tmW = p2w(el.x + el.width / 2, el.y)
        const bmW = p2w(el.x + el.width / 2, el.y + el.height)
        drawCapsule(tmW[0], tmW[1], true)
        drawCapsule(bmW[0], bmW[1], true)
      }
      if (edgeH > minEdge) {
        const rmW = p2w(el.x + el.width, el.y + el.height / 2)
        const lmW = p2w(el.x, el.y + el.height / 2)
        drawCapsule(rmW[0], rmW[1], false)
        drawCapsule(lmW[0], lmW[1], false)
      }
    }

    // Layout resize handles + sizing indicators (row/column containers)
    const hWorld = HANDLE_SIZE_PX * (2 * FRUSTUM) / h * zs
    const dir = el.layoutDirection
    if (dir === 'row' || dir === 'column') {
      const children = elements.filter((e) => e.parentId === el.id)
      const HANDLE_COLOR: [number, number, number, number] = [0.36, 0.31, 0.81, 0.7]
      const FILL_COLOR: [number, number, number, number] = [0.36, 0.31, 0.81, 0.85]
      const PIN_COLOR: [number, number, number, number] = [0.9, 0.3, 0.3, 0.85]

      // Resize handles between children
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

      // Sizing mode indicators (TR corner of each child)
      for (const child of children) {
        const sizing = child.layoutSizing ?? 'equal'
        if (sizing === 'equal') continue // no indicator for default
        const indicator = p2w(child.x + child.width - 12 * zs, child.y + 12 * zs)
        const iSize = hWorld * 2.5
        if (sizing === 'fill') {
          ov.drawQuads(new Float32Array(indicator), iSize, FILL_COLOR)
          // Inner diamond shape (arrows-out hint)
          ov.drawQuads(new Float32Array(indicator), iSize * 0.4, [1, 1, 1, 0.9])
        } else {
          // fixed-px or fixed-ratio
          ov.drawQuads(new Float32Array(indicator), iSize, PIN_COLOR)
          ov.drawQuads(new Float32Array(indicator), iSize * 0.4, [1, 1, 1, 0.9])
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

  // WebGL color picker — color wheel texture, rendered in screen space
  if (colorPickerOpen && selectedIds.length === 1 && colorWheelTex) {
    const pickEl = elements.find((e) => e.id === selectedIds[0])
    if (pickEl) {
      const [anchorWx, anchorWy] = p2w(pickEl.x + pickEl.width, pickEl.y)
      const anchorZ = pickEl.z * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.01
      const anchor = ov.projectToScreen(anchorWx, anchorWy, anchorZ)

      const dpr = window.devicePixelRatio || 1
      const wheelSizePx = colorWheelTex.size * dpr * 0.9
      ov.drawTexturedScreen(anchor.px, anchor.py, wheelSizePx, colorWheelTex.texture)

      // Highlight active/hovered swatch
      if (colorPickerHover >= 0 || pickEl.color != null) {
        const shadeCount = colorWheelTex.ringCount
        const highlightIdx = colorPickerHover >= 0 ? colorPickerHover : -1

        // Hover highlight
        if (highlightIdx >= 0) {
          const fi = Math.floor(highlightIdx / shadeCount)
          const si = highlightIdx % shadeCount
          const cell = colorWheelTex.getCellCenter(fi, si)
          const cx = anchor.px + (cell.x - 0.5) * wheelSizePx
          const cy = anchor.py + (cell.y - 0.5) * wheelSizePx
          ov.drawDiscScreen(cx, cy, 8 * dpr, [1, 1, 1, 0.8])
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

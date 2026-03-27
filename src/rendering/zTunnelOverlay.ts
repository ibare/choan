// Z-axis tunnel guide overlay — visual depth guide for Director mode.
// Shows guide lines extending in Z from element corners + cross-section at current Z.

import type { OverlayRenderer } from '../engine/overlay'
import type { ChoanElement } from '../store/useChoanStore'
import { pixelToWorld } from '../coords/coordinateSystem'

export type TunnelHover = { side: 'z-minus' | 'z-plus' } | null

const TUNNEL_LINE_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.3]
const TUNNEL_FILL_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.08]
const TUNNEL_HOVER_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.18]
const ARROW_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.7]
const SECTION_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.5]
const ROTATION_RING_COLOR: [number, number, number, number] = [1.0, 0.6, 0.2, 0.6]
const ROTATION_HANDLE_COLOR: [number, number, number, number] = [1.0, 0.6, 0.2, 0.9]
const TUNNEL_Z_RANGE = 20
const RING_SEGMENTS = 32

// ── 2D point-in-triangle helper (screen space) ──
function ptInTri(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
): boolean {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2)
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3)
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

/** Check whether the camera angle permits Z-tunnel display. */
export function canShowZTunnel(phi: number, theta: number): boolean {
  return Math.abs(phi - Math.PI / 2) > Math.PI / 6 || Math.abs(theta) > Math.PI / 6
}

/** Compute shared tunnel geometry for an element. */
function tunnelGeometry(element: ChoanElement, canvasW: number, canvasH: number, extrudeDepth: number) {
  const corners = [
    pixelToWorld(element.x, element.y, canvasW, canvasH),
    pixelToWorld(element.x + element.width, element.y, canvasW, canvasH),
    pixelToWorld(element.x + element.width, element.y + element.height, canvasW, canvasH),
    pixelToWorld(element.x, element.y + element.height, canvasW, canvasH),
  ]
  const elZ = element.z * extrudeDepth
  const elZMid = elZ + extrudeDepth / 2
  return { corners, elZ, elZMid, zMin: elZ - TUNNEL_Z_RANGE, zMax: elZ + TUNNEL_Z_RANGE }
}

/** Draw Z-axis tunnel guide lines and cross-section for a selected element. */
export function drawZTunnelOverlay(
  ov: OverlayRenderer,
  element: ChoanElement,
  canvasW: number,
  canvasH: number,
  extrudeDepth: number,
  hover: TunnelHover,
): void {
  const { corners, elZ, elZMid, zMin, zMax } = tunnelGeometry(element, canvasW, canvasH, extrudeDepth)

  // 4 Z-axis guide lines from corners
  const lineVerts: number[] = []
  for (const [wx, wy] of corners) {
    lineVerts.push(wx, wy, zMin, wx, wy, zMax)
  }
  ov.drawLines3D(new Float32Array(lineVerts), TUNNEL_LINE_COLOR)

  // 4 filled tunnel faces — split into Z- and Z+ halves for hover highlight
  for (let i = 0; i < 4; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % 4]
    // Z- half
    const zMinColor = hover?.side === 'z-minus' ? TUNNEL_HOVER_COLOR : TUNNEL_FILL_COLOR
    ov.drawTriangles3D(new Float32Array([
      a[0], a[1], zMin, b[0], b[1], zMin, b[0], b[1], elZMid,
      a[0], a[1], zMin, b[0], b[1], elZMid, a[0], a[1], elZMid,
    ]), zMinColor)
    // Z+ half
    const zPlusColor = hover?.side === 'z-plus' ? TUNNEL_HOVER_COLOR : TUNNEL_FILL_COLOR
    ov.drawTriangles3D(new Float32Array([
      a[0], a[1], elZMid, b[0], b[1], elZMid, b[0], b[1], zMax,
      a[0], a[1], elZMid, b[0], b[1], zMax, a[0], a[1], zMax,
    ]), zPlusColor)
  }

  // Cross-section wireframe at current Z position
  const sectionVerts = new Float32Array([
    corners[0][0], corners[0][1], elZMid, corners[1][0], corners[1][1], elZMid,
    corners[1][0], corners[1][1], elZMid, corners[2][0], corners[2][1], elZMid,
    corners[2][0], corners[2][1], elZMid, corners[3][0], corners[3][1], elZMid,
    corners[3][0], corners[3][1], elZMid, corners[0][0], corners[0][1], elZMid,
  ])
  ov.drawLines3D(sectionVerts, SECTION_COLOR)

  // Arrow on hovered side
  if (hover) {
    const cx = (corners[0][0] + corners[2][0]) / 2
    const cy = (corners[0][1] + corners[2][1]) / 2
    // Arrow size proportional to element
    const hw = Math.abs(corners[1][0] - corners[0][0]) / 2
    const hh = Math.abs(corners[2][1] - corners[1][1]) / 2
    const arrowLen = Math.min(hw, hh) * 0.8
    const arrowW = arrowLen * 0.4
    const headLen = arrowLen * 0.45
    const headW = arrowLen * 0.6

    const dir = hover.side === 'z-plus' ? 1 : -1
    const arrowZ = elZMid + dir * arrowLen * 1.5
    const tipZ = arrowZ + dir * arrowLen
    const headBaseZ = tipZ - dir * headLen

    // Shaft (thin rectangle along Z)
    ov.drawTriangles3D(new Float32Array([
      cx - arrowW / 2, cy, arrowZ, cx + arrowW / 2, cy, arrowZ, cx + arrowW / 2, cy, headBaseZ,
      cx - arrowW / 2, cy, arrowZ, cx + arrowW / 2, cy, headBaseZ, cx - arrowW / 2, cy, headBaseZ,
    ]), ARROW_COLOR)
    // Arrowhead (triangle)
    ov.drawTriangles3D(new Float32Array([
      cx - headW, cy, headBaseZ, cx + headW, cy, headBaseZ, cx, cy, tipZ,
    ]), ARROW_COLOR)
  }
}

/** Hit-test tunnel faces. Returns which side (z-minus / z-plus) the cursor is over. */
export function hitTestTunnelFace(
  canvasPx: number,
  canvasPy: number,
  ov: OverlayRenderer,
  element: ChoanElement,
  canvasW: number,
  canvasH: number,
  extrudeDepth: number,
): TunnelHover {
  const { corners, elZMid, zMin, zMax } = tunnelGeometry(element, canvasW, canvasH, extrudeDepth)

  for (let i = 0; i < 4; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % 4]

    // Z- half quad (4 screen-projected corners)
    const p0 = ov.projectToScreen(a[0], a[1], zMin)
    const p1 = ov.projectToScreen(b[0], b[1], zMin)
    const p2 = ov.projectToScreen(b[0], b[1], elZMid)
    const p3 = ov.projectToScreen(a[0], a[1], elZMid)
    if (
      ptInTri(canvasPx, canvasPy, p0.px, p0.py, p1.px, p1.py, p2.px, p2.py) ||
      ptInTri(canvasPx, canvasPy, p0.px, p0.py, p2.px, p2.py, p3.px, p3.py)
    ) return { side: 'z-minus' }

    // Z+ half quad
    const q0 = ov.projectToScreen(a[0], a[1], elZMid)
    const q1 = ov.projectToScreen(b[0], b[1], elZMid)
    const q2 = ov.projectToScreen(b[0], b[1], zMax)
    const q3 = ov.projectToScreen(a[0], a[1], zMax)
    if (
      ptInTri(canvasPx, canvasPy, q0.px, q0.py, q1.px, q1.py, q2.px, q2.py) ||
      ptInTri(canvasPx, canvasPy, q0.px, q0.py, q2.px, q2.py, q3.px, q3.py)
    ) return { side: 'z-plus' }
  }
  return null
}

/** Draw a rotation ring around the element center (Z-axis rotation). */
export function drawRotationRing(
  ov: OverlayRenderer,
  element: ChoanElement,
  canvasW: number,
  canvasH: number,
  extrudeDepth: number,
  dpr: number,
): void {
  const cx = pixelToWorld(element.x + element.width / 2, element.y + element.height / 2, canvasW, canvasH)
  const hw = pixelToWorld(element.x + element.width, element.y, canvasW, canvasH)
  const hh = pixelToWorld(element.x, element.y + element.height, canvasW, canvasH)

  // Ring radius = 0.7 × element diagonal (in world space)
  const diagW = Math.abs(hw[0] - cx[0])
  const diagH = Math.abs(hh[1] - cx[1])
  const ringRadius = Math.sqrt(diagW * diagW + diagH * diagH) * 0.7

  const elZ = element.z * extrudeDepth + extrudeDepth / 2

  // Build ring as line segments
  const verts: number[] = []
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a0 = (i / RING_SEGMENTS) * Math.PI * 2
    const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2
    verts.push(
      cx[0] + Math.cos(a0) * ringRadius, cx[1] + Math.sin(a0) * ringRadius, elZ,
      cx[0] + Math.cos(a1) * ringRadius, cx[1] + Math.sin(a1) * ringRadius, elZ,
    )
  }
  ov.drawLines3D(new Float32Array(verts), ROTATION_RING_COLOR)

  // Handle marker at current rotation angle
  const rot = element.rotationY ?? 0
  const handleScreen = ov.projectToScreen(cx[0] + Math.cos(rot) * ringRadius, cx[1] + Math.sin(rot) * ringRadius, elZ)
  ov.drawDiscScreen(handleScreen.px, handleScreen.py, Math.round(6 * dpr), ROTATION_HANDLE_COLOR)
}

/** Hit-test the rotation ring in screen space. Returns true if near the ring. */
export function hitTestRotationRing(
  canvasPx: number,
  canvasPy: number,
  ov: OverlayRenderer,
  element: ChoanElement,
  canvasW: number,
  canvasH: number,
  extrudeDepth: number,
  tolerancePx: number,
): boolean {
  const cx = pixelToWorld(element.x + element.width / 2, element.y + element.height / 2, canvasW, canvasH)
  const hw = pixelToWorld(element.x + element.width, element.y, canvasW, canvasH)
  const hh = pixelToWorld(element.x, element.y + element.height, canvasW, canvasH)
  const diagW = Math.abs(hw[0] - cx[0])
  const diagH = Math.abs(hh[1] - cx[1])
  const ringRadius = Math.sqrt(diagW * diagW + diagH * diagH) * 0.7
  const elZ = element.z * extrudeDepth + extrudeDepth / 2

  // Sample ring at multiple points, check screen-space distance
  const center = ov.projectToScreen(cx[0], cx[1], elZ)
  const dx = canvasPx - center.px
  const dy = canvasPy - center.py

  // Check a few ring sample points for more accurate hit test
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2
    const pt = ov.projectToScreen(cx[0] + Math.cos(angle) * ringRadius, cx[1] + Math.sin(angle) * ringRadius, elZ)
    const ddx = canvasPx - pt.px
    const ddy = canvasPy - pt.py
    if (ddx * ddx + ddy * ddy < tolerancePx * tolerancePx) return true
  }
  return false
}

// Z-axis tunnel guide overlay — visual depth guide for Director mode.
// Shows guide lines extending in Z from element corners + cross-section at current Z.

import type { OverlayRenderer } from '../engine/overlay'
import type { ChoanElement } from '../store/useChoanStore'
import { pixelToWorld } from '../coords/coordinateSystem'

// ── Axis hover type (generalized for XYZ) ──
export type AxisHover = { axis: 'x' | 'y' | 'z'; side: 'neg' | 'pos' } | null
/** @deprecated Use AxisHover */
export type TunnelHover = AxisHover

// Z-axis tunnel colors (existing element tunnel)
const TUNNEL_LINE_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.3]
const TUNNEL_FILL_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.08]
const TUNNEL_HOVER_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.18]
const ARROW_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.7]
const SECTION_COLOR: [number, number, number, number] = [0.3, 0.6, 1.0, 0.5]

// Axis-specific colors for camera XYZ tunnels
type AxisColorSet = { line: [number,number,number,number]; fill: [number,number,number,number]; hover: [number,number,number,number]; arrow: [number,number,number,number]; section: [number,number,number,number] }
const AXIS_STYLE: Record<'x'|'y'|'z', AxisColorSet> = {
  x: { line: [0.9,0.3,0.3,0.3], fill: [0.9,0.3,0.3,0.08], hover: [0.9,0.3,0.3,0.18], arrow: [0.9,0.3,0.3,0.7], section: [0.9,0.3,0.3,0.5] },
  y: { line: [0.3,0.8,0.3,0.3], fill: [0.3,0.8,0.3,0.08], hover: [0.3,0.8,0.3,0.18], arrow: [0.3,0.8,0.3,0.7], section: [0.3,0.8,0.3,0.5] },
  z: { line: [0.3,0.6,1.0,0.3], fill: [0.3,0.6,1.0,0.08], hover: [0.3,0.6,1.0,0.18], arrow: [0.3,0.6,1.0,0.7], section: [0.3,0.6,1.0,0.5] },
}
const CAM_TUNNEL_HALF = 0.6   // camera cross-section half-size (world)
const CAM_TUNNEL_RANGE = 4    // camera tunnel extent each direction
const AXIS_IDX = { x: 0, y: 1, z: 2 } as const
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
    const zMinColor = (hover?.axis === 'z' && hover.side === 'neg') ? TUNNEL_HOVER_COLOR : TUNNEL_FILL_COLOR
    ov.drawTriangles3D(new Float32Array([
      a[0], a[1], zMin, b[0], b[1], zMin, b[0], b[1], elZMid,
      a[0], a[1], zMin, b[0], b[1], elZMid, a[0], a[1], elZMid,
    ]), zMinColor)
    // Z+ half
    const zPlusColor = (hover?.axis === 'z' && hover.side === 'pos') ? TUNNEL_HOVER_COLOR : TUNNEL_FILL_COLOR
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

    const dir = hover.side === 'pos' ? 1 : -1
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
    ) return { axis: 'z', side: 'neg' }

    // Z+ half quad
    const q0 = ov.projectToScreen(a[0], a[1], elZMid)
    const q1 = ov.projectToScreen(b[0], b[1], elZMid)
    const q2 = ov.projectToScreen(b[0], b[1], zMax)
    const q3 = ov.projectToScreen(a[0], a[1], zMax)
    if (
      ptInTri(canvasPx, canvasPy, q0.px, q0.py, q1.px, q1.py, q2.px, q2.py) ||
      ptInTri(canvasPx, canvasPy, q0.px, q0.py, q2.px, q2.py, q3.px, q3.py)
    ) return { axis: 'z', side: 'pos' }
  }
  return null
}

// ── Camera XYZ axis move handles ──────────────────────────────────────────────
// Same visual language as the element Z-tunnel but generalized for any axis.

/** Cross-section corners for a given axis around a 3D center point. */
function camAxisCrossSection(c: [number, number, number], axis: 'x' | 'y' | 'z'): [number, number, number][] {
  const s = CAM_TUNNEL_HALF
  switch (axis) {
    case 'z': return [[c[0]-s,c[1]-s,c[2]], [c[0]+s,c[1]-s,c[2]], [c[0]+s,c[1]+s,c[2]], [c[0]-s,c[1]+s,c[2]]]
    case 'x': return [[c[0],c[1]-s,c[2]-s], [c[0],c[1]+s,c[2]-s], [c[0],c[1]+s,c[2]+s], [c[0],c[1]-s,c[2]+s]]
    case 'y': return [[c[0]-s,c[1],c[2]-s], [c[0]+s,c[1],c[2]-s], [c[0]+s,c[1],c[2]+s], [c[0]-s,c[1],c[2]+s]]
  }
}

/** Draw a single axis tunnel: guide lines + faces + section wireframe + arrow. */
function drawSingleAxisTunnel(
  ov: OverlayRenderer,
  corners: [number, number, number][],
  axis: 'x' | 'y' | 'z',
  center: number,
  range: number,
  hover: AxisHover,
  style: AxisColorSet,
): void {
  const ai = AXIS_IDX[axis]
  const lo = center - range
  const hi = center + range

  // Guide lines
  const lv: number[] = []
  for (const c of corners) {
    const p0 = [c[0], c[1], c[2]]; p0[ai] = lo
    const p1 = [c[0], c[1], c[2]]; p1[ai] = hi
    lv.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2])
  }
  ov.drawLines3D(new Float32Array(lv), style.line)

  // Tunnel faces
  const isNeg = hover?.axis === axis && hover.side === 'neg'
  const isPos = hover?.axis === axis && hover.side === 'pos'
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4]
    const aLo = [a[0],a[1],a[2]]; aLo[ai] = lo
    const bLo = [b[0],b[1],b[2]]; bLo[ai] = lo
    const aMid = [a[0],a[1],a[2]]; aMid[ai] = center
    const bMid = [b[0],b[1],b[2]]; bMid[ai] = center
    const aHi = [a[0],a[1],a[2]]; aHi[ai] = hi
    const bHi = [b[0],b[1],b[2]]; bHi[ai] = hi
    ov.drawTriangles3D(new Float32Array([...aLo,...bLo,...bMid, ...aLo,...bMid,...aMid]), isNeg ? style.hover : style.fill)
    ov.drawTriangles3D(new Float32Array([...aMid,...bMid,...bHi, ...aMid,...bHi,...aHi]), isPos ? style.hover : style.fill)
  }

  // Section wireframe
  const sv: number[] = []
  for (let i = 0; i < 4; i++) {
    const a = [corners[i][0], corners[i][1], corners[i][2]]; a[ai] = center
    const b = [corners[(i+1)%4][0], corners[(i+1)%4][1], corners[(i+1)%4][2]]; b[ai] = center
    sv.push(a[0],a[1],a[2], b[0],b[1],b[2])
  }
  ov.drawLines3D(new Float32Array(sv), style.section)

  // Arrow on hovered side
  if (hover?.axis === axis) {
    let cx = 0, cy = 0, cz = 0
    for (const c of corners) { cx += c[0]; cy += c[1]; cz += c[2] }
    cx /= 4; cy /= 4; cz /= 4
    const aLen = CAM_TUNNEL_HALF * 2.0
    const aW = aLen * 0.4, hLen = aLen * 0.45, hW = aLen * 0.6
    const d = hover.side === 'pos' ? 1 : -1
    const shaftZ = center + d * aLen * 1.5
    const tipZ = shaftZ + d * aLen
    const headBase = tipZ - d * hLen
    const pi = (ai + 1) % 3
    const s0 = [cx,cy,cz]; s0[ai] = shaftZ; s0[pi] -= aW/2
    const s1 = [cx,cy,cz]; s1[ai] = shaftZ; s1[pi] += aW/2
    const s2 = [cx,cy,cz]; s2[ai] = headBase; s2[pi] += aW/2
    const s3 = [cx,cy,cz]; s3[ai] = headBase; s3[pi] -= aW/2
    ov.drawTriangles3D(new Float32Array([...s0,...s1,...s2, ...s0,...s2,...s3]), style.arrow)
    const h0 = [cx,cy,cz]; h0[ai] = headBase; h0[pi] -= hW
    const h1 = [cx,cy,cz]; h1[ai] = headBase; h1[pi] += hW
    const h2 = [cx,cy,cz]; h2[ai] = tipZ
    ov.drawTriangles3D(new Float32Array([...h0,...h1,...h2]), style.arrow)
  }
}

/** Hit-test a single axis tunnel. */
function hitTestSingleAxisTunnel(
  cpx: number, cpy: number, ov: OverlayRenderer,
  corners: [number, number, number][], axis: 'x'|'y'|'z',
  center: number, range: number,
): AxisHover {
  const ai = AXIS_IDX[axis]
  const lo = center - range, hi = center + range
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i+1)%4]
    const aLo = [a[0],a[1],a[2]]; aLo[ai] = lo
    const bLo = [b[0],b[1],b[2]]; bLo[ai] = lo
    const aMid = [a[0],a[1],a[2]]; aMid[ai] = center
    const bMid = [b[0],b[1],b[2]]; bMid[ai] = center
    const p0 = ov.projectToScreen(aLo[0],aLo[1],aLo[2])
    const p1 = ov.projectToScreen(bLo[0],bLo[1],bLo[2])
    const p2 = ov.projectToScreen(bMid[0],bMid[1],bMid[2])
    const p3 = ov.projectToScreen(aMid[0],aMid[1],aMid[2])
    if (ptInTri(cpx,cpy,p0.px,p0.py,p1.px,p1.py,p2.px,p2.py) ||
        ptInTri(cpx,cpy,p0.px,p0.py,p2.px,p2.py,p3.px,p3.py)) return { axis, side: 'neg' }
    const aHi = [a[0],a[1],a[2]]; aHi[ai] = hi
    const bHi = [b[0],b[1],b[2]]; bHi[ai] = hi
    const q0 = ov.projectToScreen(aMid[0],aMid[1],aMid[2])
    const q1 = ov.projectToScreen(bMid[0],bMid[1],bMid[2])
    const q2 = ov.projectToScreen(bHi[0],bHi[1],bHi[2])
    const q3 = ov.projectToScreen(aHi[0],aHi[1],aHi[2])
    if (ptInTri(cpx,cpy,q0.px,q0.py,q1.px,q1.py,q2.px,q2.py) ||
        ptInTri(cpx,cpy,q0.px,q0.py,q2.px,q2.py,q3.px,q3.py)) return { axis, side: 'pos' }
  }
  return null
}

/** Draw XYZ axis move handles for the director camera. */
export function drawCameraAxisHandles(
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  activeAxes: ('x' | 'y' | 'z')[],
  hover: AxisHover,
): void {
  for (const axis of activeAxes) {
    const corners = camAxisCrossSection(cameraPos, axis)
    drawSingleAxisTunnel(ov, corners, axis, cameraPos[AXIS_IDX[axis]], CAM_TUNNEL_RANGE, hover, AXIS_STYLE[axis])
  }
}

/** Hit-test camera XYZ axis handles. */
export function hitTestCameraAxisHandle(
  canvasPx: number, canvasPy: number,
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  activeAxes: ('x' | 'y' | 'z')[],
): AxisHover {
  for (const axis of activeAxes) {
    const corners = camAxisCrossSection(cameraPos, axis)
    const r = hitTestSingleAxisTunnel(canvasPx, canvasPy, ov, corners, axis, cameraPos[AXIS_IDX[axis]], CAM_TUNNEL_RANGE)
    if (r) return r
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

// ── Ground grid ──

const GRID_COLOR: [number, number, number, number] = [0.0, 0.0, 0.0, 0.06]
const GRID_AXIS_X_COLOR: [number, number, number, number] = [0.8, 0.2, 0.2, 0.2]
const GRID_AXIS_Y_COLOR: [number, number, number, number] = [0.2, 0.6, 0.2, 0.2]
const GRID_AXIS_Z_COLOR: [number, number, number, number] = [0.2, 0.4, 0.9, 0.2]
const GRID_STEP = 2    // world units between lines
const GRID_EXTENT = 40 // half-size of grid in world units

/** Draw a ground-plane grid at Z=0 for spatial orientation. */
export function drawGroundGrid(ov: OverlayRenderer): void {
  const verts: number[] = []
  const n = Math.floor(GRID_EXTENT / GRID_STEP)

  // Lines parallel to Y axis (varying X)
  for (let i = -n; i <= n; i++) {
    if (i === 0) continue // skip axis — drawn separately
    const x = i * GRID_STEP
    verts.push(x, -GRID_EXTENT, 0, x, GRID_EXTENT, 0)
  }
  // Lines parallel to X axis (varying Y)
  for (let i = -n; i <= n; i++) {
    if (i === 0) continue
    const y = i * GRID_STEP
    verts.push(-GRID_EXTENT, y, 0, GRID_EXTENT, y, 0)
  }

  if (verts.length > 0) ov.drawLines3D(new Float32Array(verts), GRID_COLOR)

  // X axis (red)
  ov.drawLines3D(new Float32Array([-GRID_EXTENT, 0, 0, GRID_EXTENT, 0, 0]), GRID_AXIS_X_COLOR)
  // Y axis (green)
  ov.drawLines3D(new Float32Array([0, -GRID_EXTENT, 0, 0, GRID_EXTENT, 0]), GRID_AXIS_Y_COLOR)

  // ── XZ plane grid (vertical wall at Y=0) — shows Z depth ──
  const wallVerts: number[] = []
  // Lines parallel to Z axis (varying X)
  for (let i = -n; i <= n; i++) {
    if (i === 0) continue
    const x = i * GRID_STEP
    wallVerts.push(x, 0, -GRID_EXTENT, x, 0, GRID_EXTENT)
  }
  // Lines parallel to X axis (varying Z)
  for (let i = -n; i <= n; i++) {
    if (i === 0) continue
    const z = i * GRID_STEP
    wallVerts.push(-GRID_EXTENT, 0, z, GRID_EXTENT, 0, z)
  }
  if (wallVerts.length > 0) ov.drawLines3D(new Float32Array(wallVerts), GRID_COLOR)

  // Z axis (blue)
  ov.drawLines3D(new Float32Array([0, 0, -GRID_EXTENT, 0, 0, GRID_EXTENT]), GRID_AXIS_Z_COLOR)
}

const FOOTPRINT_CELL_COLOR: [number, number, number, number] = [0.4, 0.7, 1.0, 0.1]
const SPOTLIGHT_DARK_COLOR: [number, number, number, number] = [0.0, 0.0, 0.0, 0.55]

// Point-in-convex-quad test (2D, using cross product signs)
function ptInQuad2D(
  px: number, py: number,
  q: [number, number][],
): boolean {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i]
    const [bx, by] = q[(i + 1) % 4]
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
    if (cross > 0) { if (sign < 0) return false; sign = 1 }
    else if (cross < 0) { if (sign > 0) return false; sign = -1 }
  }
  return true
}

/** Compute frustum Z=0 intersection quad from camera params. Returns null if invalid. */
function frustumQuad(
  camPos: [number, number, number],
  camTarget: [number, number, number],
  fov: number,
  aspect: number,
): [number, number][] | null {
  const fx = camTarget[0] - camPos[0]
  const fy = camTarget[1] - camPos[1]
  const fz = camTarget[2] - camPos[2]
  const fl = Math.sqrt(fx * fx + fy * fy + fz * fz)
  if (fl < 1e-6) return null
  const fwd: [number, number, number] = [fx / fl, fy / fl, fz / fl]

  let rx = -fwd[2], rz = fwd[0]
  const rl = Math.sqrt(rx * rx + rz * rz)
  if (rl < 1e-6) return null
  rx /= rl; rz /= rl
  const ry = 0

  const ux = ry * fwd[2] - rz * fwd[1]
  const uy = rz * fwd[0] - rx * fwd[2]
  const uz = rx * fwd[1] - ry * fwd[0]

  const fovScale = Math.tan(fov * Math.PI / 360)
  const hits: [number, number][] = []
  for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const) {
    const dz = fwd[2] + sx * fovScale * aspect * rz + sy * fovScale * uz
    if (Math.abs(dz) < 1e-6) return null
    const t = -camPos[2] / dz
    if (t < 0) return null
    const dx = fwd[0] + sx * fovScale * aspect * rx + sy * fovScale * ux
    const dy = fwd[1] + sx * fovScale * aspect * ry + sy * fovScale * uy
    hits.push([camPos[0] + dx * t, camPos[1] + dy * t])
  }
  return hits.length === 4 ? hits : null
}

/** Draw the director camera's frustum as filled grid cells on the Z=0 plane. */
export function drawCameraFootprint(
  ov: OverlayRenderer,
  camPos: [number, number, number],
  camTarget: [number, number, number],
  fov: number,
  aspect: number,
  spotlight = false,
): void {
  const hits = frustumQuad(camPos, camTarget, fov, aspect)
  if (!hits) return

  // Bounding box (clamp to grid extent)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [hx, hy] of hits) {
    minX = Math.min(minX, hx); minY = Math.min(minY, hy)
    maxX = Math.max(maxX, hx); maxY = Math.max(maxY, hy)
  }

  const cellStep = GRID_STEP

  if (spotlight) {
    // Draw dark cells on the ENTIRE grid, skip cells inside frustum
    const darkVerts: number[] = []
    const gStart = -GRID_EXTENT
    const gEnd = GRID_EXTENT
    for (let cx = gStart; cx < gEnd; cx += cellStep) {
      for (let cy = gStart; cy < gEnd; cy += cellStep) {
        const mx = cx + cellStep / 2
        const my = cy + cellStep / 2
        if (!ptInQuad2D(mx, my, hits)) {
          const x0 = cx, y0 = cy, x1 = cx + cellStep, y1 = cy + cellStep
          darkVerts.push(
            x0, y0, 0, x1, y0, 0, x1, y1, 0,
            x0, y0, 0, x1, y1, 0, x0, y1, 0,
          )
        }
      }
    }
    if (darkVerts.length > 0) {
      ov.drawTriangles3D(new Float32Array(darkVerts), SPOTLIGHT_DARK_COLOR)
    }
  } else {
    // Normal mode: fill cells inside frustum with light blue
    const clampMinX = Math.max(minX, -GRID_EXTENT)
    const clampMinY = Math.max(minY, -GRID_EXTENT)
    const clampMaxX = Math.min(maxX, GRID_EXTENT)
    const clampMaxY = Math.min(maxY, GRID_EXTENT)
    const startX = Math.floor(clampMinX / cellStep) * cellStep
    const startY = Math.floor(clampMinY / cellStep) * cellStep
    const cellVerts: number[] = []

    for (let cx = startX; cx < clampMaxX; cx += cellStep) {
      for (let cy = startY; cy < clampMaxY; cy += cellStep) {
        const mx = cx + cellStep / 2
        const my = cy + cellStep / 2
        if (ptInQuad2D(mx, my, hits)) {
          const x0 = cx, y0 = cy, x1 = cx + cellStep, y1 = cy + cellStep
          cellVerts.push(
            x0, y0, 0, x1, y0, 0, x1, y1, 0,
            x0, y0, 0, x1, y1, 0, x0, y1, 0,
          )
        }
      }
    }
    if (cellVerts.length > 0) {
      ov.drawTriangles3D(new Float32Array(cellVerts), FOOTPRINT_CELL_COLOR)
    }
  }
}

// Camera path overlay — draws the Catmull-Rom spline path, keyframe markers,
// FOV frustums, and target lines on the main canvas in Director mode.
// Also draws the new rail UX (director camera object + rails + target marker).

import type { OverlayRenderer } from '../engine/overlay'
import type { CameraViewKeyframe, DirectorRails } from '../animation/directorTypes'
import { RAIL_MIN_STUB, truckCircularParams, boomCircularParams, pointOnTruckCircle, pointOnBoomCircle } from '../animation/directorTypes'
import type { DirectorCameraState } from '../animation/directorCameraEvaluator'
import { sampleCatmullRomPath3D } from '../engine/catmullRom'

// Colors — high contrast for visibility
const PATH_COLOR: [number, number, number, number] = [0.2, 0.6, 1.0, 0.85]
const KF_COLOR: [number, number, number, number] = [0.2, 0.6, 1.0, 1.0]
const KF_SELECTED_COLOR: [number, number, number, number] = [1.0, 0.85, 0.1, 1.0]
const TARGET_LINE_COLOR: [number, number, number, number] = [1.0, 0.5, 0.1, 0.7]
const FRUSTUM_COLOR: [number, number, number, number] = [0.2, 0.6, 1.0, 0.5]
const CURRENT_POS_COLOR: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0]

// Rail UX colors
const RAIL_STUB_COLOR:   [number, number, number, number] = [0.9, 0.2, 0.2, 0.9]  // red — locked
const RAIL_ACTIVE_COLOR: [number, number, number, number] = [0.2, 0.5, 1.0, 1.0]  // blue — active
const TARGET_MARKER_COLOR:    [number, number, number, number] = [1.0, 0.7, 0.2, 1.0] // amber (free)
const TARGET_ATTACHED_COLOR:  [number, number, number, number] = [0.2, 0.9, 0.4, 1.0] // green (attached)
const HANDLE_COLOR: [number, number, number, number] = [1.0, 1.0, 1.0, 0.9]        // white handle

const TARGET_CROSS_LEN = 0.4  // world units for target cross arms
const SPHERE_SEGMENTS  = 36   // line segments for sphere circle

// Slider handle colors per axis (matching 3D convention: X=red, Y=green, Z=blue)
const SLIDER_RING_X: [number, number, number, number] = [0.9, 0.3, 0.3, 1.0]
const SLIDER_RING_Y: [number, number, number, number] = [0.3, 0.8, 0.3, 1.0]
const SLIDER_RING_Z: [number, number, number, number] = [0.2, 0.5, 1.0, 1.0]
const SLIDER_FILL:   [number, number, number, number] = [1.0, 1.0, 1.0, 1.0]
const SLIDER_OFFSET = 2.4  // world units offset from camera along each axis
const FRUSTUM_DEPTH = 8  // world units forward from camera position

export function drawCameraPathOverlay(
  ov: OverlayRenderer,
  keyframes: CameraViewKeyframe[],
  currentState: DirectorCameraState | null,
  selectedKeyframeId: string | null,
  tension: number,
  dpr: number,
): void {
  if (keyframes.length < 1) return

  // ── Spline path (only with 2+ keyframes) ──
  if (keyframes.length >= 2) {
    const positions = keyframes.map((k) => k.position)
    const pathVertices = sampleCatmullRomPath3D(positions, 20, tension)
    if (pathVertices.length >= 6) {
      ov.drawLines3D(pathVertices, PATH_COLOR)
    }
  }

  // ── Keyframe markers + target lines + frustums ──
  for (const kf of keyframes) {
    const isSelected = kf.id === selectedKeyframeId
    const pos = kf.position
    const tgt = kf.target

    // Target line: position → target
    const targetLineVerts = new Float32Array([
      pos[0], pos[1], pos[2],
      tgt[0], tgt[1], tgt[2],
    ])
    ov.drawLines3D(targetLineVerts, TARGET_LINE_COLOR)

    // FOV frustum wireframe
    drawFrustum(ov, pos, tgt, kf.fov)

    // Keyframe disc marker (screen space)
    const screen = ov.projectToScreen(pos[0], pos[1], pos[2])
    if (isSelected) {
      ov.drawDiscScreen(screen.px, screen.py, 12 * dpr, KF_SELECTED_COLOR)
    }
    ov.drawDiscScreen(screen.px, screen.py, 8 * dpr, KF_COLOR)
  }

  // ── Current position on path ──
  if (currentState) {
    const screen = ov.projectToScreen(
      currentState.position[0], currentState.position[1], currentState.position[2],
    )
    ov.drawDiscScreen(screen.px, screen.py, 6 * dpr, CURRENT_POS_COLOR)
  }
}

// ── Rail UX — director camera setup rendering ────────────────────────────────

/**
 * Draws the director camera object (frustum icon + rails + target marker).
 * Called every frame in director mode while NOT playing.
 */
export function drawDirectorCameraSetup(
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  rails: DirectorRails,
  railWorldAnchor: [number, number, number],
  isSelected: boolean,
  isTargetAttached: boolean,
  fov: number,
  dpr: number,
): void {
  // Target marker (always visible in director mode)
  drawTargetMarker(ov, targetPos, isTargetAttached, dpr)

  // Camera frustum icon (reuses drawFrustum helper below)
  drawFrustum(ov, cameraPos, targetPos, fov)

  // Rails (only when camera is selected)
  if (isSelected) {
    drawRailAxes(ov, cameraPos, targetPos, rails, railWorldAnchor, dpr)
  }
}

function drawTargetMarker(
  ov: OverlayRenderer,
  pos: [number, number, number],
  isAttached: boolean,
  dpr: number,
): void {
  const [x, y, z] = pos
  const color = isAttached ? TARGET_ATTACHED_COLOR : TARGET_MARKER_COLOR
  const h = TARGET_CROSS_LEN
  // 3-axis cross in world space
  const verts = new Float32Array([
    x - h, y, z,  x + h, y, z,
    x, y - h, z,  x, y + h, z,
    x, y, z - h,  x, y, z + h,
  ])
  ov.drawLines3D(verts, color)
  // Screen-space disc at center
  const s = ov.projectToScreen(x, y, z)
  ov.drawDiscScreen(s.px, s.py, isAttached ? 10 * dpr : 6 * dpr, color)
}

const RAIL_OFFSET = 4.5  // push rail handles beyond the axis tunnel range (CAM_TUNNEL_RANGE=4)

function drawRailAxes(
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  rails: DirectorRails,
  railWorldAnchor: [number, number, number],
  dpr: number,
): void {
  // Helper: draw one sided rail segment.
  // If EITHER side of the axis is extended, both sides anchor in world space.
  function drawOneSide(
    axisIdx: number,  // 0=x, 1=y, 2=z
    sign: number,     // +1 or -1
    extent: number,
    axisAnchored: boolean,  // true if either neg or pos of this axis is extended
  ): void {
    const isExtended = extent > RAIL_MIN_STUB + 0.001
    // Anchor: use world anchor if the axis has any extension, otherwise camera pos
    const anchorVal = axisAnchored ? railWorldAnchor[axisIdx] : cameraPos[axisIdx]
    const dx = axisIdx === 0 ? sign : 0
    const dy = axisIdx === 1 ? sign : 0
    const dz = axisIdx === 2 ? sign : 0
    const baseX = (axisIdx === 0 ? anchorVal : cameraPos[0]) + dx * RAIL_OFFSET
    const baseY = (axisIdx === 1 ? anchorVal : cameraPos[1]) + dy * RAIL_OFFSET
    const baseZ = (axisIdx === 2 ? anchorVal : cameraPos[2]) + dz * RAIL_OFFSET
    const stub = RAIL_MIN_STUB
    const stubEndX = baseX + dx * stub
    const stubEndY = baseY + dy * stub
    const stubEndZ = baseZ + dz * stub

    // Connecting line: camera → rail base (fills the gap when anchored)
    if (axisAnchored) {
      ov.drawLines3D(new Float32Array([
        cameraPos[0], cameraPos[1], cameraPos[2],
        baseX, baseY, baseZ,
      ]), RAIL_ACTIVE_COLOR)
    }

    // Red stub (always present)
    ov.drawLines3D(new Float32Array([baseX, baseY, baseZ, stubEndX, stubEndY, stubEndZ]), RAIL_STUB_COLOR)

    if (isExtended) {
      // Blue extension beyond the stub
      const tipX = baseX + dx * extent
      const tipY = baseY + dy * extent
      const tipZ = baseZ + dz * extent
      ov.drawLines3D(new Float32Array([stubEndX, stubEndY, stubEndZ, tipX, tipY, tipZ]), RAIL_ACTIVE_COLOR)
      // White handle at tip
      const s = ov.projectToScreen(tipX, tipY, tipZ)
      ov.drawDiscScreen(s.px, s.py, 10 * dpr, HANDLE_COLOR)
    } else {
      // Red handle at stub tip
      const s = ov.projectToScreen(stubEndX, stubEndY, stubEndZ)
      ov.drawDiscScreen(s.px, s.py, 10 * dpr, RAIL_STUB_COLOR)
    }
  }

  // Per-axis "anchored" flag: true if either neg or pos is extended
  const truckAnchored = rails.truck.neg > RAIL_MIN_STUB + 0.001 || rails.truck.pos > RAIL_MIN_STUB + 0.001
  const boomAnchored  = rails.boom.neg  > RAIL_MIN_STUB + 0.001 || rails.boom.pos  > RAIL_MIN_STUB + 0.001
  const dollyAnchored = rails.dolly.neg > RAIL_MIN_STUB + 0.001 || rails.dolly.pos > RAIL_MIN_STUB + 0.001

  // Truck (X axis=0) — linear or circular
  if (rails.truckMode === 'circular') {
    drawCircularRail(ov, cameraPos, railWorldAnchor, 'truck', rails.truck, dpr)
  } else {
    drawOneSide(0,  1, rails.truck.pos, truckAnchored)
    drawOneSide(0, -1, rails.truck.neg, truckAnchored)
  }
  // Boom (Y axis=1) — linear or circular
  if (rails.boomMode === 'circular') {
    drawCircularRail(ov, cameraPos, railWorldAnchor, 'boom', rails.boom, dpr)
  } else {
    drawOneSide(1,  1, rails.boom.pos, boomAnchored)
    drawOneSide(1, -1, rails.boom.neg, boomAnchored)
  }
  // Dolly (Z axis=2) — always linear
  drawOneSide(2,  1, rails.dolly.pos, dollyAnchored)
  drawOneSide(2, -1, rails.dolly.neg, dollyAnchored)

  // Sphere rail — horizontal circle (XZ plane) around target
  drawSphereRail(ov, cameraPos, targetPos, rails.sphere, dpr)

  // ── Slider handles on extended rails (camera position on the rail) ──
  // These replace the axis tunnels for extended axes.
  drawRailSliderHandles(ov, cameraPos, rails, dpr)
}

/** Compute the sign (+1 or -1) for the slider offset: toward the more-extended side. */
function sliderSign(ext: { neg: number; pos: number }): number {
  return ext.pos >= ext.neg ? 1 : -1
}

/** Compute the 3D position of a slider handle for a given axis. */
export function getSliderHandlePos(
  cameraPos: [number, number, number],
  axisIdx: number,
  ext: { neg: number; pos: number },
): [number, number, number] {
  const pos: [number, number, number] = [...cameraPos]
  pos[axisIdx] += SLIDER_OFFSET * sliderSign(ext)
  return pos
}

function drawRailSliderHandles(
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  rails: DirectorRails,
  dpr: number,
): void {
  const stub = RAIL_MIN_STUB + 0.001
  const rings = [SLIDER_RING_X, SLIDER_RING_Y, SLIDER_RING_Z]
  const exts = [rails.truck, rails.boom, rails.dolly]

  function drawSlider(axisIdx: number): void {
    const pos = getSliderHandlePos(cameraPos, axisIdx, exts[axisIdx])
    const s = ov.projectToScreen(pos[0], pos[1], pos[2])
    ov.drawDiscScreen(s.px, s.py, 12 * dpr, rings[axisIdx])
    ov.drawDiscScreen(s.px, s.py, 8 * dpr, SLIDER_FILL)
  }

  if (rails.truck.neg > stub || rails.truck.pos > stub) drawSlider(0)
  if (rails.boom.neg  > stub || rails.boom.pos  > stub) drawSlider(1)
  if (rails.dolly.neg > stub || rails.dolly.pos > stub) drawSlider(2)
}

const ARC_SEGMENTS = 48  // line segments per arc side

function drawCircularRail(
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  railWorldAnchor: [number, number, number],
  axis: 'truck' | 'boom',
  ext: { neg: number; pos: number },
  dpr: number,
): void {
  const isExtended = ext.neg > RAIL_MIN_STUB + 0.001 || ext.pos > RAIL_MIN_STUB + 0.001

  if (axis === 'truck') {
    // Horizontal orbit in XZ plane
    const { center, radius, angle: camAngle } = truckCircularParams(cameraPos)
    if (radius < 0.01) return
    const anchorAngle = isExtended
      ? Math.atan2(railWorldAnchor[0], railWorldAnchor[2])
      : camAngle
    const negAngle = ext.neg / radius  // arc length → angle
    const posAngle = ext.pos / radius

    // Draw neg arc (stub + extension)
    drawArcSide(ov, center, radius, anchorAngle, -1, negAngle, dpr,
      (a) => pointOnTruckCircle(center, radius, a))

    // Draw pos arc
    drawArcSide(ov, center, radius, anchorAngle, +1, posAngle, dpr,
      (a) => pointOnTruckCircle(center, radius, a))

  } else {
    // Vertical orbit in camera heading plane
    const { radius, elevAngle: camElev, hAngle } = boomCircularParams(cameraPos)
    if (radius < 0.01) return
    const anchorElev = isExtended
      ? boomCircularParams(railWorldAnchor).elevAngle
      : camElev
    const negAngle = ext.neg / radius
    const posAngle = ext.pos / radius

    drawArcSide(ov, [0, 0, 0], radius, anchorElev, -1, negAngle, dpr,
      (a) => pointOnBoomCircle(radius, a, hAngle))

    drawArcSide(ov, [0, 0, 0], radius, anchorElev, +1, posAngle, dpr,
      (a) => pointOnBoomCircle(radius, a, hAngle))
  }
}

/** Draw one side (neg or pos) of a circular rail arc. */
function drawArcSide(
  ov: OverlayRenderer,
  _center: [number, number, number],
  _radius: number,
  baseAngle: number,
  sign: number,    // -1 for neg, +1 for pos
  totalAngle: number,
  dpr: number,
  pointFn: (angle: number) => [number, number, number],
): void {
  const isExtended = totalAngle > RAIL_MIN_STUB / Math.max(_radius, 0.01) + 0.001
  const stubAngle = RAIL_MIN_STUB / Math.max(_radius, 0.01)

  // Red stub arc
  const stubSegs = Math.max(4, Math.round(ARC_SEGMENTS * stubAngle / (Math.PI * 2)))
  const stubVerts: number[] = []
  for (let i = 0; i < stubSegs; i++) {
    const a0 = baseAngle + sign * (i / stubSegs) * stubAngle
    const a1 = baseAngle + sign * ((i + 1) / stubSegs) * stubAngle
    const p0 = pointFn(a0), p1 = pointFn(a1)
    stubVerts.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2])
  }
  ov.drawLines3D(new Float32Array(stubVerts), RAIL_STUB_COLOR)

  if (isExtended) {
    // Blue extension arc
    const extSegs = Math.max(4, Math.round(ARC_SEGMENTS * totalAngle / (Math.PI * 2)))
    const extVerts: number[] = []
    for (let i = 0; i < extSegs; i++) {
      const t0 = stubAngle + (i / extSegs) * (totalAngle - stubAngle)
      const t1 = stubAngle + ((i + 1) / extSegs) * (totalAngle - stubAngle)
      const a0 = baseAngle + sign * t0
      const a1 = baseAngle + sign * t1
      const p0 = pointFn(a0), p1 = pointFn(a1)
      extVerts.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2])
    }
    ov.drawLines3D(new Float32Array(extVerts), RAIL_ACTIVE_COLOR)
    // White handle at tip
    const tipPt = pointFn(baseAngle + sign * totalAngle)
    const s = ov.projectToScreen(tipPt[0], tipPt[1], tipPt[2])
    ov.drawDiscScreen(s.px, s.py, 10 * dpr, HANDLE_COLOR)
  } else {
    // Red handle at stub tip
    const stubTip = pointFn(baseAngle + sign * stubAngle)
    const s = ov.projectToScreen(stubTip[0], stubTip[1], stubTip[2])
    ov.drawDiscScreen(s.px, s.py, 10 * dpr, RAIL_STUB_COLOR)
  }
}

function drawSphereRail(
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  radius: number,
  dpr: number,
): void {
  const [tx, ty, tz] = targetPos
  const isActive = radius > RAIL_MIN_STUB + 0.001
  const color = isActive ? RAIL_ACTIVE_COLOR : RAIL_STUB_COLOR

  // Draw horizontal circle at target's Y height
  const verts: number[] = []
  for (let i = 0; i < SPHERE_SEGMENTS; i++) {
    const a0 = (i / SPHERE_SEGMENTS) * Math.PI * 2
    const a1 = ((i + 1) / SPHERE_SEGMENTS) * Math.PI * 2
    verts.push(
      tx + Math.cos(a0) * radius, ty, tz + Math.sin(a0) * radius,
      tx + Math.cos(a1) * radius, ty, tz + Math.sin(a1) * radius,
    )
  }
  ov.drawLines3D(new Float32Array(verts), color)

  // Handle: point on the circle closest to the camera (in XZ projection)
  const dx = cameraPos[0] - tx
  const dz = cameraPos[2] - tz
  const dist = Math.sqrt(dx * dx + dz * dz)
  if (dist > 0.001) {
    const hx = tx + (dx / dist) * radius
    const hz = tz + (dz / dist) * radius
    const s = ov.projectToScreen(hx, ty, hz)
    ov.drawDiscScreen(s.px, s.py, 8 * dpr, isActive ? HANDLE_COLOR : RAIL_STUB_COLOR)
  }
}

// ── Frustum wireframe helper (shared by keyframe rendering + rail UX) ────────

function drawFrustum(
  ov: OverlayRenderer,
  pos: [number, number, number],
  target: [number, number, number],
  fov: number,
) {
  // Compute camera basis vectors
  let fx = target[0] - pos[0]
  let fy = target[1] - pos[1]
  let fz = target[2] - pos[2]
  const fl = Math.sqrt(fx * fx + fy * fy + fz * fz)
  if (fl < 0.001) return
  fx /= fl; fy /= fl; fz /= fl

  // Right = forward × up (assuming up = [0,1,0])
  let rx = fy * 0 - fz * 1
  let ry = fz * 0 - fx * 0
  let rz = fx * 1 - fy * 0
  const rl = Math.sqrt(rx * rx + ry * ry + rz * rz)
  if (rl < 0.001) return
  rx /= rl; ry /= rl; rz /= rl

  // Up = right × forward
  const ux = ry * fz - rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy - ry * fx

  const halfAngle = (fov * Math.PI / 180) / 2
  const tanHalf = Math.tan(halfAngle)
  const hw = FRUSTUM_DEPTH * tanHalf
  const hh = hw * 0.5625  // 16:9 aspect

  // Near plane center
  const cx = pos[0] + fx * FRUSTUM_DEPTH
  const cy = pos[1] + fy * FRUSTUM_DEPTH
  const cz = pos[2] + fz * FRUSTUM_DEPTH

  // Four corners of near plane
  const corners: [number, number, number][] = [
    [cx - rx * hw + ux * hh, cy - ry * hw + uy * hh, cz - rz * hw + uz * hh],  // top-left
    [cx + rx * hw + ux * hh, cy + ry * hw + uy * hh, cz + rz * hw + uz * hh],  // top-right
    [cx + rx * hw - ux * hh, cy + ry * hw - uy * hh, cz + rz * hw - uz * hh],  // bottom-right
    [cx - rx * hw - ux * hh, cy - ry * hw - uy * hh, cz - rz * hw - uz * hh],  // bottom-left
  ]

  // Lines from position to each corner + edges of near plane
  const verts: number[] = []

  // Rays from camera to corners
  for (const c of corners) {
    verts.push(pos[0], pos[1], pos[2], c[0], c[1], c[2])
  }

  // Near plane rectangle
  for (let i = 0; i < 4; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % 4]
    verts.push(a[0], a[1], a[2], b[0], b[1], b[2])
  }

  ov.drawLines3D(new Float32Array(verts), FRUSTUM_COLOR)
}

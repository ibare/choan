// Camera path overlay — draws the Catmull-Rom spline path, keyframe markers,
// FOV frustums, and target lines on the main canvas in Director mode.
// Also draws the new rail UX (director camera object + rails + target marker).

import type { OverlayRenderer } from '../engine/overlay'
import type { CameraMark, CameraViewKeyframe, DirectorRails, AxisMark, AxisMarkChannel } from '../animation/directorTypes'
import { evaluateCameraMarks } from '../animation/cameraMarkEvaluator'
import { evaluateSingleChannel } from '../animation/cameraMarkEvaluator'
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

// ── Camera mark visualization — path-following cylinder pipe ─────────────────

const PIPE_BODY_COLOR:  [number, number, number, number] = [0.2, 0.75, 0.3, 0.25]
const PIPE_EDGE_COLOR:  [number, number, number, number] = [0.2, 0.75, 0.3, 0.6]
const PIPE_HATCH_COLOR: [number, number, number, number] = [0.2, 0.75, 0.3, 0.35]
const PIPE_RADIUS = 0.3
const PIPE_CROSS_SEGMENTS = 10  // cross-section circle resolution
const PIPE_PATH_SAMPLES = 40   // samples along the path for smooth curves
const PIPE_RING_INTERVAL = 4   // draw a hatch ring every N path samples

/**
 * Build a cross-section circle perpendicular to a tangent direction.
 * Returns PIPE_CROSS_SEGMENTS+1 points forming the circle ring.
 */
function buildCrossSection(
  center: [number, number, number],
  tangent: [number, number, number],
  radius: number,
  seg: number,
): [number, number, number][] {
  // Find an arbitrary perpendicular vector
  const [tx, ty, tz] = tangent
  let ux: number, uy: number, uz: number
  if (Math.abs(ty) < 0.9) {
    // cross(tangent, [0,1,0])
    ux = tz; uy = 0; uz = -tx
  } else {
    // cross(tangent, [1,0,0])
    ux = 0; uy = -tz; uz = ty
  }
  const ul = Math.sqrt(ux * ux + uy * uy + uz * uz)
  if (ul < 1e-6) return []
  ux /= ul; uy /= ul; uz /= ul
  // v = tangent × u
  const vx = ty * uz - tz * uy
  const vy = tz * ux - tx * uz
  const vz = tx * uy - ty * ux

  const points: [number, number, number][] = []
  for (let i = 0; i <= seg; i++) {
    const angle = (i / seg) * Math.PI * 2
    const c = Math.cos(angle) * radius
    const s = Math.sin(angle) * radius
    points.push([
      center[0] + ux * c + vx * s,
      center[1] + uy * c + vy * s,
      center[2] + uz * c + vz * s,
    ])
  }
  return points
}

/**
 * Build a rectangular box (cuboid) mesh between two 3D points with square cross-section.
 * Returns Float32Array of triangle vertices (12 triangles = 36 vertices = 108 floats).
 */
function buildBoxMesh(
  start: [number, number, number],
  end: [number, number, number],
  halfSize: number,
): Float32Array {
  // Direction vector
  let dx = end[0] - start[0]
  let dy = end[1] - start[1]
  let dz = end[2] - start[2]
  const dl = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (dl < 1e-6) return new Float32Array(0)
  dx /= dl; dy /= dl; dz /= dl

  // Perpendicular vectors u, v
  let ux: number, uy: number, uz: number
  if (Math.abs(dy) < 0.9) {
    ux = dz; uy = 0; uz = -dx
  } else {
    ux = 0; uy = -dz; uz = dy
  }
  const ul = Math.sqrt(ux * ux + uy * uy + uz * uz)
  if (ul < 1e-6) return new Float32Array(0)
  ux /= ul; uy /= ul; uz /= ul
  const vx = dy * uz - dz * uy
  const vy = dz * ux - dx * uz
  const vz = dx * uy - dy * ux

  const s = halfSize
  // 8 corners: 4 at start face, 4 at end face
  // Order: (-u-v), (+u-v), (+u+v), (-u+v)
  const corners: [number, number, number][] = []
  for (const c of [start, end]) {
    corners.push(
      [c[0] - ux * s - vx * s, c[1] - uy * s - vy * s, c[2] - uz * s - vz * s],
      [c[0] + ux * s - vx * s, c[1] + uy * s - vy * s, c[2] + uz * s - vz * s],
      [c[0] + ux * s + vx * s, c[1] + uy * s + vy * s, c[2] + uz * s + vz * s],
      [c[0] - ux * s + vx * s, c[1] - uy * s + vy * s, c[2] - uz * s + vz * s],
    )
  }
  // s0-s3 = start face, e0-e3 = end face
  const [s0, s1, s2, s3, e0, e1, e2, e3] = corners

  // 6 faces × 2 triangles each (CCW winding when viewed from outside)
  const faces: [number, number, number][][] = [
    [s0, s1, e1, s0, e1, e0], // bottom (-v)
    [s2, s3, e3, s2, e3, e2], // top (+v)
    [s0, s3, e3, s0, e3, e0], // left (-u)
    [s1, s2, e2, s1, e2, e1], // right (+u)
    [s0, s3, s2, s0, s2, s1], // start cap
    [e0, e1, e2, e0, e2, e3], // end cap
  ]

  const out = new Float32Array(108) // 12 triangles × 3 verts × 3 floats
  let idx = 0
  for (const face of faces) {
    for (const v of face) {
      out[idx++] = v[0]; out[idx++] = v[1]; out[idx++] = v[2]
    }
  }
  return out
}

/**
 * Draw a tube mesh along a 3D path (array of points).
 * Generates cross-section circles at each path point, connects them with triangles.
 */
function drawTubeAlongPath(
  ov: OverlayRenderer,
  path: [number, number, number][],
) {
  if (path.length < 2) return
  const seg = PIPE_CROSS_SEGMENTS
  const r = PIPE_RADIUS

  // Build cross-sections for each path point
  const sections: [number, number, number][][] = []
  for (let i = 0; i < path.length; i++) {
    // Compute tangent
    let tx: number, ty: number, tz: number
    if (i === 0) {
      tx = path[1][0] - path[0][0]; ty = path[1][1] - path[0][1]; tz = path[1][2] - path[0][2]
    } else if (i === path.length - 1) {
      tx = path[i][0] - path[i - 1][0]; ty = path[i][1] - path[i - 1][1]; tz = path[i][2] - path[i - 1][2]
    } else {
      tx = path[i + 1][0] - path[i - 1][0]; ty = path[i + 1][1] - path[i - 1][1]; tz = path[i + 1][2] - path[i - 1][2]
    }
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz)
    if (tl < 1e-6) continue
    tx /= tl; ty /= tl; tz /= tl

    const cs = buildCrossSection(path[i], [tx, ty, tz], r, seg)
    if (cs.length > 0) sections.push(cs)
  }

  if (sections.length < 2) return

  // Body triangles
  const tris: number[] = []
  for (let si = 0; si < sections.length - 1; si++) {
    const ringA = sections[si]
    const ringB = sections[si + 1]
    for (let j = 0; j < seg; j++) {
      const a0 = ringA[j], a1 = ringA[j + 1]
      const b0 = ringB[j], b1 = ringB[j + 1]
      tris.push(a0[0], a0[1], a0[2], b0[0], b0[1], b0[2], a1[0], a1[1], a1[2])
      tris.push(a1[0], a1[1], a1[2], b0[0], b0[1], b0[2], b1[0], b1[1], b1[2])
    }
  }
  ov.drawTriangles3D(new Float32Array(tris), PIPE_BODY_COLOR)

  // End cap discs
  const capTris: number[] = []
  const firstCenter = path[0]
  const lastCenter = path[path.length - 1]
  const firstRing = sections[0]
  const lastRing = sections[sections.length - 1]
  for (let j = 0; j < seg; j++) {
    capTris.push(firstCenter[0], firstCenter[1], firstCenter[2], firstRing[j + 1][0], firstRing[j + 1][1], firstRing[j + 1][2], firstRing[j][0], firstRing[j][1], firstRing[j][2])
    capTris.push(lastCenter[0], lastCenter[1], lastCenter[2], lastRing[j][0], lastRing[j][1], lastRing[j][2], lastRing[j + 1][0], lastRing[j + 1][1], lastRing[j + 1][2])
  }
  ov.drawTriangles3D(new Float32Array(capTris), PIPE_BODY_COLOR)

  // Edge rings at ends + periodic hatch rings
  for (let si = 0; si < sections.length; si++) {
    const isEnd = si === 0 || si === sections.length - 1
    const isHatch = si % PIPE_RING_INTERVAL === 0
    if (!isEnd && !isHatch) continue
    const ring = sections[si]
    const color = isEnd ? PIPE_EDGE_COLOR : PIPE_HATCH_COLOR
    const verts: number[] = []
    for (let j = 0; j < seg; j++) {
      verts.push(ring[j][0], ring[j][1], ring[j][2], ring[j + 1][0], ring[j + 1][1], ring[j + 1][2])
    }
    ov.drawLines3D(new Float32Array(verts), color)
  }
}

/**
 * Sample the camera path between marks, respecting rail geometry.
 * Uses evaluateCameraMarks to get positions along the actual interpolation path.
 */
function sampleMarkPath(
  marks: CameraMark[],
  rails: DirectorRails,
  samples: number,
): [number, number, number][] {
  const firstTime = marks[0].time
  const lastTime = marks[marks.length - 1].time
  if (lastTime <= firstTime) return [marks[0].position]

  const path: [number, number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const t = firstTime + (i / samples) * (lastTime - firstTime)
    const state = evaluateCameraMarks(marks, t, rails)
    if (state) path.push([...state.position])
  }
  return path
}

/**
 * Draws the camera mark range as a 3D cylinder pipe following the actual path.
 * Works for both linear and circular rails.
 */
export function drawCameraMarks(
  ov: OverlayRenderer,
  marks: CameraMark[],
  rails: DirectorRails,
  railWorldAnchor: [number, number, number],
  cameraPos: [number, number, number],
): void {
  if (marks.length < 2) return
  const path = sampleMarkPath(marks, rails, PIPE_PATH_SAMPLES)
  if (path.length < 2) return
  drawTubeAlongPath(ov, path)
}

// ── Rail UX — director camera setup rendering ────────────────────────────────

/**
 * Draws the director camera object (frustum icon + rails + target marker).
 * Called every frame in director mode while NOT playing.
 */
export interface RailTimeLabel {
  anchorX: number  // screen px — handle position
  anchorY: number
  timeMs: number   // raw time in ms — used for sequence numbering
  text: string
  color: string
  /** Screen-space rail direction (normalized) — used to compute perpendicular offset for label. */
  railDirX: number
  railDirY: number
}

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
  activeRailAxis?: AxisMarkChannel | null,
): RailTimeLabel[] {
  // Target marker (always visible in director mode)
  drawTargetMarker(ov, targetPos, isTargetAttached, dpr)

  // Camera frustum icon (reuses drawFrustum helper below)
  drawFrustum(ov, cameraPos, targetPos, fov)

  // Rails (only when camera is selected)
  if (isSelected) {
    return drawRailAxes(ov, cameraPos, targetPos, rails, railWorldAnchor, dpr, activeRailAxis ?? null)
  }
  return []
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

// Per-axis rail cube colors: active (selected) vs inactive
const RAIL_CUBE_COLORS: Record<AxisMarkChannel, {
  color:       [number, number, number, number]
  colorActive: [number, number, number, number]
}> = {
  truck: { color: [0.9, 0.3, 0.3, 0.15], colorActive: [0.9, 0.3, 0.3, 0.4] },
  boom:  { color: [0.3, 0.8, 0.3, 0.15], colorActive: [0.3, 0.8, 0.3, 0.4] },
  dolly: { color: [0.2, 0.5, 1.0, 0.15], colorActive: [0.2, 0.5, 1.0, 0.4] },
}

const RAIL_OFFSET = 4.5  // push rail handles beyond the axis tunnel range (CAM_TUNNEL_RANGE=4)
const AXIS_HEX: Record<AxisMarkChannel, string> = { truck: '#e05555', boom: '#55c055', dolly: '#5588dd' }

/** Collect a time label for a rail endpoint. Shared by drawOneSide and drawArcSide. */
function collectRailTimeLabel(
  labels: RailTimeLabel[],
  ov: OverlayRenderer,
  tipScreen: { px: number; py: number },
  baseScreen: { px: number; py: number },
  channel: AxisMarkChannel,
  sign: number,
  rails: DirectorRails,
  dpr: number,
  axisAnchored: boolean,
): void {
  const ext = rails[channel]
  if (!axisAnchored || ext.startTime === ext.endTime) return

  let rdx = tipScreen.px - baseScreen.px
  let rdy = tipScreen.py - baseScreen.py
  const rdl = Math.sqrt(rdx * rdx + rdy * rdy)
  if (rdl > 0.01) { rdx /= rdl; rdy /= rdl } else { rdx = 0; rdy = -1 }

  const timeVal = sign > 0 ? ext.endTime : ext.startTime
  labels.push({
    anchorX: tipScreen.px / dpr,
    anchorY: tipScreen.py / dpr,
    timeMs: timeVal,
    text: `${(timeVal / 1000).toFixed(1)}s`,
    color: AXIS_HEX[channel],
    railDirX: rdx,
    railDirY: rdy,
  })
}

function drawRailAxes(
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  rails: DirectorRails,
  railWorldAnchor: [number, number, number],
  dpr: number,
  activeRailAxis: AxisMarkChannel | null,
): RailTimeLabel[] {
  const labels: RailTimeLabel[] = []
  // Map axis index to channel for active comparison
  const AXIS_TO_CHANNEL: AxisMarkChannel[] = ['truck', 'boom', 'dolly']

  // Helper: draw one sided rail segment.
  // If EITHER side of the axis is extended, both sides anchor in world space.
  function drawOneSide(
    axisIdx: number,  // 0=x, 1=y, 2=z
    sign: number,     // +1 or -1
    extent: number,
    axisAnchored: boolean,  // true if either neg or pos of this axis is extended
  ): void {
    const channel = AXIS_TO_CHANNEL[axisIdx]
    const isActive = activeRailAxis === channel
    const colors = RAIL_CUBE_COLORS[channel]
    const railColor = isActive ? colors.colorActive : colors.color
    // Anchor: use world anchor if the axis has any extension, otherwise camera pos
    const anchorVal = axisAnchored ? railWorldAnchor[axisIdx] : cameraPos[axisIdx]
    const dx = axisIdx === 0 ? sign : 0
    const dy = axisIdx === 1 ? sign : 0
    const dz = axisIdx === 2 ? sign : 0
    const baseX = (axisIdx === 0 ? anchorVal : cameraPos[0]) + dx * RAIL_OFFSET
    const baseY = (axisIdx === 1 ? anchorVal : cameraPos[1]) + dy * RAIL_OFFSET
    const baseZ = (axisIdx === 2 ? anchorVal : cameraPos[2]) + dz * RAIL_OFFSET

    // Tip: full extent from base
    const tipX = baseX + dx * extent
    const tipY = baseY + dy * extent
    const tipZ = baseZ + dz * extent

    // Single continuous rail cube: when anchored, start from camera to fill the gap
    const startPt: [number, number, number] = axisAnchored
      ? [cameraPos[0], cameraPos[1], cameraPos[2]]
      : [baseX, baseY, baseZ]
    const railMesh = buildBoxMesh(startPt, [tipX, tipY, tipZ], PIPE_RADIUS)
    if (railMesh.length > 0) ov.drawTriangles3D(railMesh, railColor)

    // Handle at tip
    const isExtended = extent > RAIL_MIN_STUB + 0.001
    const s = ov.projectToScreen(tipX, tipY, tipZ)
    ov.drawDiscScreen(s.px, s.py, 10 * dpr, isExtended ? HANDLE_COLOR : railColor)

    // Collect time label
    collectRailTimeLabel(labels, ov, s, ov.projectToScreen(baseX, baseY, baseZ), channel, sign, rails, dpr, axisAnchored)
  }

  // Per-axis "anchored" flag: true if either neg or pos is extended
  const truckAnchored = rails.truck.neg > RAIL_MIN_STUB + 0.001 || rails.truck.pos > RAIL_MIN_STUB + 0.001
  const boomAnchored  = rails.boom.neg  > RAIL_MIN_STUB + 0.001 || rails.boom.pos  > RAIL_MIN_STUB + 0.001
  const dollyAnchored = rails.dolly.neg > RAIL_MIN_STUB + 0.001 || rails.dolly.pos > RAIL_MIN_STUB + 0.001

  // Truck (X axis=0) — linear or circular
  if (rails.truckMode === 'circular') {
    drawCircularRail(ov, cameraPos, railWorldAnchor, 'truck', rails.truck, dpr, activeRailAxis, labels, rails)
  } else {
    drawOneSide(0,  1, rails.truck.pos, truckAnchored)
    drawOneSide(0, -1, rails.truck.neg, truckAnchored)
  }
  // Boom (Y axis=1) — linear or circular
  if (rails.boomMode === 'circular') {
    drawCircularRail(ov, cameraPos, railWorldAnchor, 'boom', rails.boom, dpr, activeRailAxis, labels, rails)
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
  return labels
}

/** Compute the sign (+1 or -1) for the slider offset: toward the more-extended side. */
function sliderSign(ext: { neg: number; pos: number }): number {
  return ext.pos >= ext.neg ? 1 : -1
}

/** Compute the 3D position of a slider handle for a given axis, following circular arcs. */
export function getSliderHandlePos(
  cameraPos: [number, number, number],
  axisIdx: number,
  ext: { neg: number; pos: number },
  rails?: DirectorRails,
): [number, number, number] {
  const offset = SLIDER_OFFSET * sliderSign(ext)

  // Circular truck (X axis): offset along the arc in XZ plane
  if (axisIdx === 0 && rails?.truckMode === 'circular') {
    const params = truckCircularParams(cameraPos)
    if (params.radius > 0.01) {
      const angleOffset = offset / params.radius
      const pt = pointOnTruckCircle(params.center, params.radius, params.angle + angleOffset)
      return [pt[0], cameraPos[1], pt[2]]
    }
  }

  // Circular boom (Y axis): offset along the vertical arc
  if (axisIdx === 1 && rails?.boomMode === 'circular') {
    const params = boomCircularParams(cameraPos)
    if (params.radius > 0.01) {
      const elevOffset = offset / params.radius
      return pointOnBoomCircle(params.radius, params.elevAngle + elevOffset, params.hAngle)
    }
  }

  // Linear (default): straight offset along axis
  const pos: [number, number, number] = [...cameraPos]
  pos[axisIdx] += offset
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
    const pos = getSliderHandlePos(cameraPos, axisIdx, exts[axisIdx], rails)
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
  activeRailAxis: AxisMarkChannel | null,
  labels: RailTimeLabel[],
  rails: DirectorRails,
): void {
  const isExtended = ext.neg > RAIL_MIN_STUB + 0.001 || ext.pos > RAIL_MIN_STUB + 0.001
  const isActive = activeRailAxis === axis

  if (axis === 'truck') {
    const { center, radius, angle: camAngle } = truckCircularParams(cameraPos)
    if (radius < 0.01) return
    const anchorAngle = isExtended
      ? Math.atan2(railWorldAnchor[0], railWorldAnchor[2])
      : camAngle
    const negAngle = ext.neg / radius
    const posAngle = ext.pos / radius

    drawArcSide(ov, center, radius, anchorAngle, -1, negAngle, dpr,
      (a) => pointOnTruckCircle(center, radius, a), axis, isActive, labels, rails, isExtended)

    drawArcSide(ov, center, radius, anchorAngle, +1, posAngle, dpr,
      (a) => pointOnTruckCircle(center, radius, a), axis, isActive, labels, rails, isExtended)

  } else {
    const { radius, elevAngle: camElev, hAngle } = boomCircularParams(cameraPos)
    if (radius < 0.01) return
    const anchorElev = isExtended
      ? boomCircularParams(railWorldAnchor).elevAngle
      : camElev
    const negAngle = ext.neg / radius
    const posAngle = ext.pos / radius

    drawArcSide(ov, [0, 0, 0], radius, anchorElev, -1, negAngle, dpr,
      (a) => pointOnBoomCircle(radius, a, hAngle), axis, isActive, labels, rails, isExtended)

    drawArcSide(ov, [0, 0, 0], radius, anchorElev, +1, posAngle, dpr,
      (a) => pointOnBoomCircle(radius, a, hAngle), axis, isActive, labels, rails, isExtended)
  }
}

/** Draw one side (neg or pos) of a circular rail arc as tube mesh. */
function drawArcSide(
  ov: OverlayRenderer,
  _center: [number, number, number],
  _radius: number,
  baseAngle: number,
  sign: number,    // -1 for neg, +1 for pos
  totalAngle: number,
  dpr: number,
  pointFn: (angle: number) => [number, number, number],
  channel: AxisMarkChannel,
  isActive: boolean,
  labels: RailTimeLabel[],
  rails: DirectorRails,
  axisAnchored: boolean,
): void {
  const isExtended = totalAngle > RAIL_MIN_STUB / Math.max(_radius, 0.01) + 0.001
  const colors = RAIL_CUBE_COLORS[channel]
  const railColor = isActive ? colors.colorActive : colors.color

  // Single continuous arc as tube
  const segs = Math.max(4, Math.round(ARC_SEGMENTS * totalAngle / (Math.PI * 2)))
  const path: [number, number, number][] = []
  for (let i = 0; i <= segs; i++) {
    const a = baseAngle + sign * (i / segs) * totalAngle
    path.push(pointFn(a))
  }
  if (path.length >= 2) {
    drawTubeAlongPathColored(ov, path, railColor, railColor)
  }

  // Handle at tip
  const tipPt = pointFn(baseAngle + sign * totalAngle)
  const s = ov.projectToScreen(tipPt[0], tipPt[1], tipPt[2])
  ov.drawDiscScreen(s.px, s.py, 10 * dpr, isExtended ? HANDLE_COLOR : railColor)

  // Collect time label
  const basePt = pointFn(baseAngle)
  collectRailTimeLabel(labels, ov, s, ov.projectToScreen(basePt[0], basePt[1], basePt[2]), channel, sign, rails, dpr, axisAnchored)
}

function drawSphereRail(
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  radius: number,
  dpr: number,
): void {
  const [tx, ty, tz] = targetPos
  const isExtended = radius > RAIL_MIN_STUB + 0.001
  // Sphere rail uses a neutral blue-ish color (not axis-specific)
  const bodyColor: [number, number, number, number] = isExtended
    ? [0.2, 0.5, 1.0, 0.15]
    : [0.9, 0.2, 0.2, 0.2]

  // Draw horizontal circle at target's Y height as tube
  const path: [number, number, number][] = []
  for (let i = 0; i <= SPHERE_SEGMENTS; i++) {
    const a = (i / SPHERE_SEGMENTS) * Math.PI * 2
    path.push([tx + Math.cos(a) * radius, ty, tz + Math.sin(a) * radius])
  }
  if (path.length >= 2) {
    drawTubeAlongPathColored(ov, path, bodyColor, bodyColor)
  }

  // Handle: point on the circle closest to the camera (in XZ projection)
  const dx = cameraPos[0] - tx
  const dz = cameraPos[2] - tz
  const dist = Math.sqrt(dx * dx + dz * dz)
  if (dist > 0.001) {
    const hx = tx + (dx / dist) * radius
    const hz = tz + (dz / dist) * radius
    const s = ov.projectToScreen(hx, ty, hz)
    ov.drawDiscScreen(s.px, s.py, 8 * dpr, isExtended ? HANDLE_COLOR : RAIL_STUB_COLOR)
  }
}

// ── Frustum wireframe helper (shared by keyframe rendering + rail UX) ────────

function drawFrustum(
  ov: OverlayRenderer,
  pos: [number, number, number],
  target: [number, number, number],
  fov: number,
  color?: [number, number, number, number],
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

  ov.drawLines3D(new Float32Array(verts), color ?? FRUSTUM_COLOR)
}

// ── Per-axis mark pipe rendering ────────────────────────────────────────────

const AXIS_PIPE_COLORS: Record<AxisMarkChannel, {
  body: [number, number, number, number]
  edge: [number, number, number, number]
}> = {
  truck: { body: [0.9, 0.3, 0.3, 0.2], edge: [0.9, 0.3, 0.3, 0.6] },
  boom:  { body: [0.3, 0.8, 0.3, 0.2], edge: [0.3, 0.8, 0.3, 0.6] },
  dolly: { body: [0.2, 0.5, 1.0, 0.2], edge: [0.2, 0.5, 1.0, 0.6] },
}

const AXIS_PIPE_SAMPLES = 30

/**
 * Sample a per-axis path: positions along one axis, other axes held at basePos.
 */
function sampleAxisPath(
  marks: AxisMark[],
  channel: AxisMarkChannel,
  basePos: [number, number, number],
  rails: DirectorRails,
  samples: number,
): [number, number, number][] {
  if (marks.length < 2) return []
  const firstTime = marks[0].time
  const lastTime = marks[marks.length - 1].time
  if (lastTime <= firstTime) return []

  const path: [number, number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const t = firstTime + (i / samples) * (lastTime - firstTime)
    const val = evaluateSingleChannel(marks, t)
    if (val === null) continue

    const pos: [number, number, number] = [...basePos]

    if (channel === 'truck' && rails.truckMode === 'circular') {
      const params = truckCircularParams(basePos)
      if (params.radius > 0.01) {
        const angle = params.angle + val / params.radius
        const pt = pointOnTruckCircle(params.center, params.radius, angle)
        pos[0] = pt[0]; pos[2] = pt[2]
      } else {
        pos[0] += val
      }
    } else if (channel === 'boom' && rails.boomMode === 'circular') {
      const params = boomCircularParams(basePos)
      if (params.radius > 0.01) {
        const elev = params.elevAngle + val / params.radius
        const pt = pointOnBoomCircle(params.radius, elev, params.hAngle)
        pos[0] = pt[0]; pos[1] = pt[1]; pos[2] = pt[2]
      } else {
        pos[1] += val
      }
    } else {
      const idx = channel === 'truck' ? 0 : channel === 'boom' ? 1 : 2
      pos[idx] += val
    }

    path.push(pos)
  }
  return path
}

/**
 * Draws per-axis mark pipes — one colored pipe per axis that has 2+ marks.
 * @param anchor - railWorldAnchor (used for the mark's own axis offset)
 * @param cameraPos - current camera position (used for non-mark axes so pipes follow the camera)
 */
export function drawAxisMarkPipes(
  ov: OverlayRenderer,
  axisMarks: Record<AxisMarkChannel, AxisMark[]>,
  anchor: [number, number, number],
  rails: DirectorRails,
  cameraPos?: [number, number, number],
): void {
  const cam = cameraPos ?? anchor
  const channels: AxisMarkChannel[] = ['truck', 'boom', 'dolly']
  for (const ch of channels) {
    const marks = axisMarks[ch]
    if (marks.length < 2) continue
    // Mix: mark axis uses anchor, other axes use camera pos
    const idx = ch === 'truck' ? 0 : ch === 'boom' ? 1 : 2
    const mixedBase: [number, number, number] = [...cam]
    mixedBase[idx] = anchor[idx]
    const path = sampleAxisPath(marks, ch, mixedBase, rails, AXIS_PIPE_SAMPLES)
    if (path.length < 2) continue

    const colors = AXIS_PIPE_COLORS[ch]
    drawTubeAlongPathColored(ov, path, colors.body, colors.edge)
  }
}

/**
 * Draw a tube mesh along a 3D path with custom body/edge colors.
 */
function drawTubeAlongPathColored(
  ov: OverlayRenderer,
  path: [number, number, number][],
  bodyColor: [number, number, number, number],
  edgeColor: [number, number, number, number],
) {
  if (path.length < 2) return
  const seg = PIPE_CROSS_SEGMENTS
  const r = PIPE_RADIUS

  const sections: [number, number, number][][] = []
  for (let i = 0; i < path.length; i++) {
    let tx: number, ty: number, tz: number
    if (i === 0) {
      tx = path[1][0] - path[0][0]; ty = path[1][1] - path[0][1]; tz = path[1][2] - path[0][2]
    } else if (i === path.length - 1) {
      tx = path[i][0] - path[i - 1][0]; ty = path[i][1] - path[i - 1][1]; tz = path[i][2] - path[i - 1][2]
    } else {
      tx = path[i + 1][0] - path[i - 1][0]; ty = path[i + 1][1] - path[i - 1][1]; tz = path[i + 1][2] - path[i - 1][2]
    }
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz)
    if (tl < 1e-6) continue
    tx /= tl; ty /= tl; tz /= tl

    const cs = buildCrossSection(path[i], [tx, ty, tz], r, seg)
    if (cs.length > 0) sections.push(cs)
  }

  if (sections.length < 2) return

  // Body triangles
  const tris: number[] = []
  for (let si = 0; si < sections.length - 1; si++) {
    const ringA = sections[si]
    const ringB = sections[si + 1]
    for (let j = 0; j < seg; j++) {
      const a0 = ringA[j], a1 = ringA[j + 1]
      const b0 = ringB[j], b1 = ringB[j + 1]
      tris.push(a0[0], a0[1], a0[2], b0[0], b0[1], b0[2], a1[0], a1[1], a1[2])
      tris.push(a1[0], a1[1], a1[2], b0[0], b0[1], b0[2], b1[0], b1[1], b1[2])
    }
  }
  ov.drawTriangles3D(new Float32Array(tris), bodyColor)

  // End cap discs
  const capTris: number[] = []
  const firstCenter = path[0]
  const lastCenter = path[path.length - 1]
  const firstRing = sections[0]
  const lastRing = sections[sections.length - 1]
  for (let j = 0; j < seg; j++) {
    capTris.push(firstCenter[0], firstCenter[1], firstCenter[2], firstRing[j + 1][0], firstRing[j + 1][1], firstRing[j + 1][2], firstRing[j][0], firstRing[j][1], firstRing[j][2])
    capTris.push(lastCenter[0], lastCenter[1], lastCenter[2], lastRing[j][0], lastRing[j][1], lastRing[j][2], lastRing[j + 1][0], lastRing[j + 1][1], lastRing[j + 1][2])
  }
  ov.drawTriangles3D(new Float32Array(capTris), bodyColor)

  // Edge rings at ends
  for (const ring of [sections[0], sections[sections.length - 1]]) {
    const verts: number[] = []
    for (let j = 0; j < seg; j++) {
      verts.push(ring[j][0], ring[j][1], ring[j][2], ring[j + 1][0], ring[j + 1][1], ring[j + 1][2])
    }
    ov.drawLines3D(new Float32Array(verts), edgeColor)
  }
}

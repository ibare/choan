// Camera path overlay — draws the Catmull-Rom spline path, keyframe markers,
// FOV frustums, and target lines on the main canvas in Director mode.
// Also draws the new rail UX (director camera object + rails + target marker).

import type { OverlayRenderer } from '../engine/overlay'
import type { CameraViewKeyframe, DirectorRails } from '../animation/directorTypes'
import { RAIL_MIN_STUB } from '../animation/directorTypes'
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
const TARGET_MARKER_COLOR: [number, number, number, number] = [1.0, 0.7, 0.2, 1.0] // amber
const HANDLE_COLOR: [number, number, number, number] = [1.0, 1.0, 1.0, 0.9]        // white handle

const TARGET_CROSS_LEN = 0.4  // world units for target cross arms
const SPHERE_SEGMENTS  = 36   // line segments for sphere circle

const FRUSTUM_DEPTH = 4  // world units forward from camera position

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
  isSelected: boolean,
  fov: number,
  dpr: number,
): void {
  // Target marker (always visible in director mode)
  drawTargetMarker(ov, targetPos, dpr)

  // Camera frustum icon (reuses drawFrustum helper below)
  drawFrustum(ov, cameraPos, targetPos, fov)

  // Rails (only when camera is selected)
  if (isSelected) {
    drawRailAxes(ov, cameraPos, targetPos, rails, dpr)
  }
}

function drawTargetMarker(
  ov: OverlayRenderer,
  pos: [number, number, number],
  dpr: number,
): void {
  const [x, y, z] = pos
  const h = TARGET_CROSS_LEN
  // 3-axis cross in world space
  const verts = new Float32Array([
    x - h, y, z,  x + h, y, z,  // X arm
    x, y - h, z,  x, y + h, z,  // Y arm
    x, y, z - h,  x, y, z + h,  // Z arm
  ])
  ov.drawLines3D(verts, TARGET_MARKER_COLOR)
  // Screen-space disc at center
  const s = ov.projectToScreen(x, y, z)
  ov.drawDiscScreen(s.px, s.py, 6 * dpr, TARGET_MARKER_COLOR)
}

const RAIL_OFFSET = 4.5  // push rail handles beyond the axis tunnel range (CAM_TUNNEL_RANGE=4)

function drawRailAxes(
  ov: OverlayRenderer,
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  rails: DirectorRails,
  dpr: number,
): void {
  const [cx, cy, cz] = cameraPos

  // Helper: draw one sided rail segment offset beyond axis tunnels
  function drawOneSide(
    dx: number, dy: number, dz: number,
    extent: number,
  ): void {
    // Start at the offset point (beyond axis tunnel)
    const baseX = cx + dx * RAIL_OFFSET
    const baseY = cy + dy * RAIL_OFFSET
    const baseZ = cz + dz * RAIL_OFFSET
    const stub = RAIL_MIN_STUB
    const stubEndX = baseX + dx * stub
    const stubEndY = baseY + dy * stub
    const stubEndZ = baseZ + dz * stub

    // Red stub (always present)
    ov.drawLines3D(new Float32Array([baseX, baseY, baseZ, stubEndX, stubEndY, stubEndZ]), RAIL_STUB_COLOR)

    if (extent > stub + 0.001) {
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

  // Truck (X axis)
  drawOneSide( 1, 0, 0, rails.truck.pos)
  drawOneSide(-1, 0, 0, rails.truck.neg)
  // Boom (Y axis)
  drawOneSide(0,  1, 0, rails.boom.pos)
  drawOneSide(0, -1, 0, rails.boom.neg)
  // Dolly (Z axis)
  drawOneSide(0, 0,  1, rails.dolly.pos)
  drawOneSide(0, 0, -1, rails.dolly.neg)

  // Sphere rail — horizontal circle (XZ plane) around target
  drawSphereRail(ov, cameraPos, targetPos, rails.sphere, dpr)
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

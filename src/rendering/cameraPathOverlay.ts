// Camera path overlay — draws the Catmull-Rom spline path, keyframe markers,
// FOV frustums, and target lines on the main canvas in Director mode.

import type { OverlayRenderer } from '../engine/overlay'
import type { CameraViewKeyframe } from '../animation/directorTypes'
import type { DirectorCameraState } from '../animation/directorCameraEvaluator'
import { sampleCatmullRomPath3D } from '../engine/catmullRom'

// Colors — high contrast for visibility
const PATH_COLOR: [number, number, number, number] = [0.2, 0.6, 1.0, 0.85]
const KF_COLOR: [number, number, number, number] = [0.2, 0.6, 1.0, 1.0]
const KF_SELECTED_COLOR: [number, number, number, number] = [1.0, 0.85, 0.1, 1.0]
const TARGET_LINE_COLOR: [number, number, number, number] = [1.0, 0.5, 0.1, 0.7]
const FRUSTUM_COLOR: [number, number, number, number] = [0.2, 0.6, 1.0, 0.5]
const CURRENT_POS_COLOR: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0]

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

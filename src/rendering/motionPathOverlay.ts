// Motion Path overlay — visualizes the currently edited clip's motionPath
// on top of the 3D scene in sketch mode. Draws the path curve plus endpoint
// or center markers so the user can see the geometry they are editing.
//
// Coordinate convention mirrors animationEvaluator.collectBundleOverrides:
//   - x/y are in pixel (REF_W × REF_H) space
//   - z is a layer index in element.z units, converted to world with extrudeDepth
// For originMode === 'relative' the path samples are added to the element's
// current position; for 'absolute' they replace it entirely. This matches how
// the evaluator merges motionPath into the per-frame patch.

import type { OverlayRenderer } from '../engine/overlay'
import type { ChoanElement } from '../store/useChoanStore'
import type { ElementMotionPath, LinePath, OrbitPath, Vec3 } from '../animation/motionPathTypes'
import { evaluateMotionPath } from '../animation/motionPathEvaluator'
import { pixelToWorld } from '../coords/coordinateSystem'

// High-contrast palette so the path stands out against both the scene
// and the existing Director overlays (camera path is blue, z tunnel is
// blue/green — magenta keeps motion path visually distinct).
const PATH_COLOR:        [number, number, number, number] = [1.0, 0.4,  0.9, 0.9]
const ENDPOINT_COLOR:    [number, number, number, number] = [1.0, 0.95, 0.2, 1.0]
const CENTER_COLOR:      [number, number, number, number] = [1.0, 1.0,  1.0, 1.0]

const ORBIT_SAMPLES = 96  // segments along the orbit curve

/**
 * Draw the given motion path in the world so the user can see the clip's
 * trajectory while editing. Called once per frame from useAnimateLoop.
 */
export function drawMotionPathOverlay(
  ov: OverlayRenderer,
  motionPath: ElementMotionPath,
  element: ChoanElement,
  extrudeDepth: number,
  dpr: number,
): void {
  const toWorld = buildToWorld(motionPath, element, extrudeDepth)

  if (motionPath.type === 'line') {
    drawLineOverlay(ov, motionPath, toWorld, dpr)
    return
  }
  drawOrbitOverlay(ov, motionPath, toWorld, dpr)
}

// ── Coordinate conversion ────────────────────────────────────────────────────

type ToWorld = (local: Vec3) => [number, number, number]

/**
 * Build a function that converts a path-local sample into world coordinates.
 * The returned closure captures the chosen origin mode so each call-site
 * stays a single function call.
 */
function buildToWorld(
  motionPath: ElementMotionPath,
  element: ChoanElement,
  extrudeDepth: number,
): ToWorld {
  // Element center in world space — also the z offset we use for the
  // "relative" origin mode so paths sit at the element's mid-thickness.
  const halfDepth = extrudeDepth / 2

  if (motionPath.originMode === 'absolute') {
    return (local) => {
      const [wx, wy] = pixelToWorld(local[0], local[1])
      return [wx, wy, local[2] * extrudeDepth + halfDepth]
    }
  }

  const elCenterPx = element.x + element.width / 2
  const elCenterPy = element.y + element.height / 2
  const elWz = element.z * extrudeDepth + halfDepth

  return (local) => {
    const [wx, wy] = pixelToWorld(elCenterPx + local[0], elCenterPy + local[1])
    return [wx, wy, elWz + local[2] * extrudeDepth]
  }
}

// ── Line path ────────────────────────────────────────────────────────────────

function drawLineOverlay(
  ov: OverlayRenderer,
  path: LinePath,
  toWorld: ToWorld,
  dpr: number,
): void {
  const a = toWorld(path.p0)
  const b = toWorld(path.p1)
  ov.drawLines3D(new Float32Array([
    a[0], a[1], a[2],
    b[0], b[1], b[2],
  ]), PATH_COLOR, 2)

  const sa = ov.projectToScreen(a[0], a[1], a[2])
  const sb = ov.projectToScreen(b[0], b[1], b[2])
  ov.drawDiscScreen(sa.px, sa.py, 6 * dpr, ENDPOINT_COLOR)
  ov.drawDiscScreen(sb.px, sb.py, 6 * dpr, ENDPOINT_COLOR)
}

// ── Orbit path ───────────────────────────────────────────────────────────────

function drawOrbitOverlay(
  ov: OverlayRenderer,
  path: OrbitPath,
  toWorld: ToWorld,
  dpr: number,
): void {
  // Strip time-domain effects — we want the raw spatial curve regardless of
  // easing / loop / reverse, which only affect *when* the element is at
  // each point, not the curve itself.
  const samplePath: OrbitPath = {
    ...path,
    easing: 'linear',
    loop: false,
    reverse: false,
    duration: undefined,
  }

  // LINES buffer: ORBIT_SAMPLES segments = 2 × 3 floats per segment.
  const verts = new Float32Array(ORBIT_SAMPLES * 6)
  let prev = toWorld(evaluateMotionPath(samplePath, 0, 1000))
  for (let i = 0; i < ORBIT_SAMPLES; i++) {
    const t = ((i + 1) / ORBIT_SAMPLES) * 1000
    const next = toWorld(evaluateMotionPath(samplePath, t, 1000))
    const off = i * 6
    verts[off    ] = prev[0]; verts[off + 1] = prev[1]; verts[off + 2] = prev[2]
    verts[off + 3] = next[0]; verts[off + 4] = next[1]; verts[off + 5] = next[2]
    prev = next
  }
  ov.drawLines3D(verts, PATH_COLOR, 2)

  // Center marker — uses the path's own center, not the element center,
  // so the user can see exactly where the orbit is anchored.
  const center = toWorld(path.center)
  const sc = ov.projectToScreen(center[0], center[1], center[2])
  ov.drawDiscScreen(sc.px, sc.py, 5 * dpr, CENTER_COLOR)
}

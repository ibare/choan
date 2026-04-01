// Camera mark evaluator — rail-following interpolation between marks.
// Pure function, no React/Zustand imports.

import type { CameraMark, DirectorRails, AxisMark, AxisMarkChannel } from './directorTypes'
import { truckCircularParams, boomCircularParams, pointOnTruckCircle, pointOnBoomCircle } from './directorTypes'
import type { DirectorCameraState } from './directorCameraEvaluator'
import { resolveEasing } from './easing'

// 35mm full-frame sensor: width = 36mm
const SENSOR_W = 36

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function mmToFov(mm: number): number {
  return 2 * Math.atan(SENSOR_W / (2 * mm)) * (180 / Math.PI)
}

/**
 * Interpolate a single axis between two marks, respecting rail mode.
 * For circular rails, interpolates the angle and reconstructs the 3D position.
 * For linear rails, interpolates the position component directly.
 */
function interpolateAxis(
  posA: [number, number, number],
  posB: [number, number, number],
  t: number,
  axis: 'truck' | 'boom' | 'dolly',
  rails: DirectorRails,
): [number, number, number] {
  if (axis === 'truck' && rails.truckMode === 'circular') {
    const paramsA = truckCircularParams(posA)
    const paramsB = truckCircularParams(posB)
    if (paramsA.radius < 0.01 || paramsB.radius < 0.01) {
      return [lerp(posA[0], posB[0], t), lerp(posA[1], posB[1], t), lerp(posA[2], posB[2], t)]
    }
    const angle = lerp(paramsA.angle, paramsB.angle, t)
    const radius = lerp(paramsA.radius, paramsB.radius, t)
    const y = lerp(posA[1], posB[1], t)
    const center: [number, number, number] = [0, y, 0]
    return pointOnTruckCircle(center, radius, angle)
  }

  if (axis === 'boom' && rails.boomMode === 'circular') {
    const paramsA = boomCircularParams(posA)
    const paramsB = boomCircularParams(posB)
    if (paramsA.radius < 0.01 || paramsB.radius < 0.01) {
      return [lerp(posA[0], posB[0], t), lerp(posA[1], posB[1], t), lerp(posA[2], posB[2], t)]
    }
    const elevAngle = lerp(paramsA.elevAngle, paramsB.elevAngle, t)
    const radius = lerp(paramsA.radius, paramsB.radius, t)
    const hAngle = lerp(paramsA.hAngle, paramsB.hAngle, t)
    return pointOnBoomCircle(radius, elevAngle, hAngle)
  }

  // Linear or dolly — lerp position components directly
  return [lerp(posA[0], posB[0], t), lerp(posA[1], posB[1], t), lerp(posA[2], posB[2], t)]
}

/**
 * Evaluate camera state from CameraMarks at a given absolute time.
 * Interpolates per-axis along rail geometry (linear lerp or arc interpolation).
 * Returns null if no marks exist.
 */
export function evaluateCameraMarks(
  marks: CameraMark[],
  time: number,
  rails: DirectorRails,
): DirectorCameraState | null {
  if (marks.length === 0) return null

  if (marks.length === 1) {
    const m = marks[0]
    return { position: [...m.position], target: [...m.target], fov: mmToFov(m.focalLengthMm) }
  }

  // Before first mark
  if (time <= marks[0].time) {
    const m = marks[0]
    return { position: [...m.position], target: [...m.target], fov: mmToFov(m.focalLengthMm) }
  }

  // After last mark
  const last = marks[marks.length - 1]
  if (time >= last.time) {
    return { position: [...last.position], target: [...last.target], fov: mmToFov(last.focalLengthMm) }
  }

  // Find bracketing segment
  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i]
    const b = marks[i + 1]
    if (time >= a.time && time <= b.time) {
      const segDur = b.time - a.time
      if (segDur <= 0) {
        return { position: [...b.position], target: [...b.target], fov: mmToFov(b.focalLengthMm) }
      }

      let t = (time - a.time) / segDur

      // Apply easing (from mark A to next)
      if (a.easing) {
        const easingFn = resolveEasing(a.easing)
        t = easingFn(t)
      }

      // Determine which circular mode affects interpolation
      // For truck circular: interpolate angle in XZ plane
      // For boom circular: interpolate elevation angle
      // For both circular: apply truck first, then boom adjustment
      let position: [number, number, number]

      const hasTruckCircular = rails.truckMode === 'circular'
      const hasBoomCircular = rails.boomMode === 'circular'

      if (hasTruckCircular && !hasBoomCircular) {
        position = interpolateAxis(a.position, b.position, t, 'truck', rails)
      } else if (!hasTruckCircular && hasBoomCircular) {
        position = interpolateAxis(a.position, b.position, t, 'boom', rails)
      } else if (hasTruckCircular && hasBoomCircular) {
        // Both circular: truck handles XZ angle, boom handles elevation
        // Apply truck first for XZ, then adjust Y via boom
        const truckPos = interpolateAxis(a.position, b.position, t, 'truck', rails)
        const boomPos = interpolateAxis(a.position, b.position, t, 'boom', rails)
        position = [truckPos[0], boomPos[1], truckPos[2]]
      } else {
        // All linear — simple per-component lerp
        position = [
          lerp(a.position[0], b.position[0], t),
          lerp(a.position[1], b.position[1], t),
          lerp(a.position[2], b.position[2], t),
        ]
      }

      // Target: always linear lerp
      const target: [number, number, number] = [
        lerp(a.target[0], b.target[0], t),
        lerp(a.target[1], b.target[1], t),
        lerp(a.target[2], b.target[2], t),
      ]

      const fov = mmToFov(lerp(a.focalLengthMm, b.focalLengthMm, t))

      return { position, target, fov }
    }
  }

  return { position: [...last.position], target: [...last.target], fov: mmToFov(last.focalLengthMm) }
}

// ── Per-axis mark evaluation ────────────────────────────────────────────────

/** Evaluate a single axis channel at a given time. Returns interpolated offset value, or null if no marks. */
export function evaluateSingleChannel(marks: AxisMark[], time: number): number | null {
  if (marks.length === 0) return null
  if (marks.length === 1) return marks[0].value
  if (time <= marks[0].time) return marks[0].value
  const last = marks[marks.length - 1]
  if (time >= last.time) return last.value

  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i], b = marks[i + 1]
    if (time >= a.time && time <= b.time) {
      const segDur = b.time - a.time
      if (segDur <= 0) return b.value
      let t = (time - a.time) / segDur
      if (a.easing) t = resolveEasing(a.easing)(t)
      return lerp(a.value, b.value, t)
    }
  }
  return last.value
}

/**
 * Evaluate per-axis marks at a given time.
 * Composes camera position as basePos + per-axis offsets.
 * Returns null if no axis has any marks.
 */
export function evaluateAxisMarks(
  axisMarks: Record<AxisMarkChannel, AxisMark[]>,
  time: number,
  basePos: [number, number, number],
  baseTarget: [number, number, number],
  baseFocalMm: number,
  rails: DirectorRails,
): DirectorCameraState | null {
  const truckVal = evaluateSingleChannel(axisMarks.truck, time)
  const boomVal  = evaluateSingleChannel(axisMarks.boom, time)
  const dollyVal = evaluateSingleChannel(axisMarks.dolly, time)

  if (truckVal === null && boomVal === null && dollyVal === null) return null

  // Linear composition: base + offset per axis
  const position: [number, number, number] = [
    basePos[0] + (truckVal ?? 0),
    basePos[1] + (boomVal ?? 0),
    basePos[2] + (dollyVal ?? 0),
  ]

  // Circular rail overrides: convert arc-length offset to 3D position
  if (rails.truckMode === 'circular' && truckVal !== null) {
    const params = truckCircularParams(basePos)
    if (params.radius > 0.01) {
      const angle = params.angle + truckVal / params.radius
      const pt = pointOnTruckCircle(params.center, params.radius, angle)
      position[0] = pt[0]
      position[2] = pt[2]
    }
  }
  if (rails.boomMode === 'circular' && boomVal !== null) {
    const params = boomCircularParams(basePos)
    if (params.radius > 0.01) {
      const elev = params.elevAngle + boomVal / params.radius
      const pt = pointOnBoomCircle(params.radius, elev, params.hAngle)
      position[0] = pt[0]; position[1] = pt[1]; position[2] = pt[2]
    }
  }

  return {
    position,
    target: [...baseTarget],
    fov: mmToFov(baseFocalMm),
  }
}

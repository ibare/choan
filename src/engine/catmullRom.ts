// Catmull-Rom spline interpolation — smooth curves through control points.
// Pure math, no React/Zustand dependencies.

/**
 * Evaluate a single scalar Catmull-Rom spline segment.
 * Given four control points p0..p3 and parameter t ∈ [0,1],
 * returns the interpolated value that passes through p1 (at t=0) and p2 (at t=1).
 *
 * @param tension — 0.0 = sharp, 0.5 = standard, 1.0 = very smooth
 */
export function catmullRomPoint(
  p0: number, p1: number, p2: number, p3: number,
  t: number,
  tension = 0.5,
): number {
  const t2 = t * t
  const t3 = t2 * t
  const s = (1 - tension) / 2

  return (
    (2 * p1) +
    (-p0 + p2) * s * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * s * t3
  )
}

/** Evaluate Catmull-Rom for a 3D point (xyz independently). */
export function catmullRomVec3(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  t: number,
  tension = 0.5,
): [number, number, number] {
  return [
    catmullRomPoint(p0[0], p1[0], p2[0], p3[0], t, tension),
    catmullRomPoint(p0[1], p1[1], p2[1], p3[1], t, tension),
    catmullRomPoint(p0[2], p1[2], p2[2], p3[2], t, tension),
  ]
}

/**
 * Sample a full Catmull-Rom path as line segment pairs for GL_LINES rendering.
 * Returns Float32Array of [x0,y0,z0, x1,y1,z1, x1,y1,z1, x2,y2,z2, ...].
 *
 * @param points — ordered control points (minimum 2)
 * @param samplesPerSegment — samples between each pair of control points
 * @param tension — spline tension
 */
export function sampleCatmullRomPath3D(
  points: [number, number, number][],
  samplesPerSegment = 16,
  tension = 0.5,
): Float32Array {
  if (points.length < 2) return new Float32Array(0)

  const segments = points.length - 1
  const lineVertices: number[] = []

  let prevPoint: [number, number, number] | null = null

  for (let i = 0; i < segments; i++) {
    // Build 4-point window, clamping at boundaries
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const steps = i === segments - 1 ? samplesPerSegment : samplesPerSegment
    for (let s = 0; s <= steps; s++) {
      if (i > 0 && s === 0) continue  // skip duplicate at segment join
      const t = s / samplesPerSegment
      const pt = catmullRomVec3(p0, p1, p2, p3, t, tension)

      if (prevPoint) {
        // Line segment: prev → current
        lineVertices.push(prevPoint[0], prevPoint[1], prevPoint[2])
        lineVertices.push(pt[0], pt[1], pt[2])
      }
      prevPoint = pt
    }
  }

  return new Float32Array(lineVertices)
}

/**
 * Evaluate a Catmull-Rom spline at an arbitrary time given time-stamped keyframes.
 * Each keyframe must have a `.time` property. Uses the accessor to extract the value.
 *
 * @returns interpolated value at the given time
 */
export function evaluateCRAtTime<T>(
  keyframes: T[],
  time: number,
  getTime: (kf: T) => number,
  getValue: (kf: T) => number,
  tension = 0.5,
): number {
  if (keyframes.length === 0) return 0
  if (keyframes.length === 1) return getValue(keyframes[0])

  const first = getTime(keyframes[0])
  const last = getTime(keyframes[keyframes.length - 1])
  if (time <= first) return getValue(keyframes[0])
  if (time >= last) return getValue(keyframes[keyframes.length - 1])

  // Find bracketing segment
  for (let i = 0; i < keyframes.length - 1; i++) {
    const t1 = getTime(keyframes[i])
    const t2 = getTime(keyframes[i + 1])
    if (time >= t1 && time <= t2) {
      const segDur = t2 - t1
      if (segDur <= 0) return getValue(keyframes[i + 1])
      const t = (time - t1) / segDur

      const v0 = getValue(keyframes[Math.max(0, i - 1)])
      const v1 = getValue(keyframes[i])
      const v2 = getValue(keyframes[i + 1])
      const v3 = getValue(keyframes[Math.min(keyframes.length - 1, i + 2)])

      return catmullRomPoint(v0, v1, v2, v3, t, tension)
    }
  }

  return getValue(keyframes[keyframes.length - 1])
}

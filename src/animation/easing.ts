// Easing functions: linear, cubic-bezier ease, damped spring

export type EasingFn = (t: number) => number

// ── Linear ──
export const linear: EasingFn = (t) => t

// ── Cubic Bezier (CSS "ease": 0.25, 0.1, 0.25, 1.0) ──
// Binary-search bezier solver

function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): EasingFn {
  // Evaluate bezier x(t) or y(t) given control points
  const cx = 3 * p1x
  const bx = 3 * (p2x - p1x) - cx
  const ax = 1 - cx - bx
  const cy = 3 * p1y
  const by = 3 * (p2y - p1y) - cy
  const ay = 1 - cy - by

  function sampleX(t: number): number {
    return ((ax * t + bx) * t + cx) * t
  }
  function sampleY(t: number): number {
    return ((ay * t + by) * t + cy) * t
  }
  function sampleDerivX(t: number): number {
    return (3 * ax * t + 2 * bx) * t + cx
  }

  // Find parameter t for given x using Newton-Raphson + bisection fallback
  function solveForX(x: number): number {
    // Newton-Raphson (fast convergence)
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x
      if (Math.abs(err) < 1e-6) return t
      const d = sampleDerivX(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    // Bisection fallback
    let lo = 0, hi = 1
    t = x
    for (let i = 0; i < 20; i++) {
      const v = sampleX(t)
      if (Math.abs(v - x) < 1e-6) return t
      if (v < x) lo = t; else hi = t
      t = (lo + hi) / 2
    }
    return t
  }

  return (x: number): number => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    return sampleY(solveForX(x))
  }
}

export const ease: EasingFn = cubicBezier(0.25, 0.1, 0.25, 1.0)
export const easeIn: EasingFn = cubicBezier(0.42, 0, 1, 1)
export const easeOut: EasingFn = cubicBezier(0, 0, 0.58, 1)
export const easeInOut: EasingFn = cubicBezier(0.42, 0, 0.58, 1)

// ── Damped Spring ──
// Critically/under-damped harmonic oscillator: overshoots then settles
// Returns a function that maps normalized time t∈[0,1] to output (can exceed 1.0)

export function createSpringEasing(stiffness = 0.15, damping = 0.75): EasingFn {
  // Convert spring params to angular frequency and damping ratio
  const omega = Math.sqrt(stiffness) * 20   // scale for responsive feel
  const zeta = 1 - damping                  // lower damping → more oscillation

  return (t: number): number => {
    if (t <= 0) return 0
    if (t >= 1) {
      // Evaluate at t=1 to get final value (may not be exactly 1.0)
      const decay = Math.exp(-zeta * omega * 1)
      const val = 1 - decay * (Math.cos(omega * 1) + zeta * Math.sin(omega * 1))
      // Normalize so that the full animation reaches exactly the target
      const norm = val
      return 1 / norm  // will be used as normalizer below
    }

    const decay = Math.exp(-zeta * omega * t)
    const raw = 1 - decay * (Math.cos(omega * t) + zeta * Math.sin(omega * t))

    // Normalize: compute value at t=1 and scale so output(1) = 1
    const d1 = Math.exp(-zeta * omega)
    const v1 = 1 - d1 * (Math.cos(omega) + zeta * Math.sin(omega))
    return raw / v1
  }
}

// Resolve easing by name (supports both legacy clip-level and new per-keyframe types)
export function resolveEasing(name: string, stiffness?: number, damping?: number): EasingFn {
  switch (name) {
    case 'linear': return linear
    case 'ease': return ease
    case 'ease-in': return easeIn
    case 'ease-out': return easeOut
    case 'ease-in-out': return easeInOut
    case 'spring': return createSpringEasing(stiffness, damping)
    default: return easeInOut
  }
}

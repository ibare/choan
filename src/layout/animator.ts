// Spring-based layout animator with fluid deformation.
//
// Two mechanisms for "water-like" transitions:
// 1. Per-edge springs with asymmetric stiffness — leading edge arrives first,
//    trailing edge catches up, creating a directional flowing motion.
// 2. Radius morphing — during transitions the corner radius temporarily
//    increases toward 1.0 (fully rounded), making shapes look like blobs
//    that lose their rigid form before re-solidifying.

import type { ChoanElement } from '../store/useChoanStore'

interface SpringState {
  // Per-edge springs (pixel coords)
  l: number; t: number; r: number; b: number
  vl: number; vt: number; vr: number; vb: number
  // Fluid radius spring (0–1)
  rad: number; vrad: number
}

export interface SpringParams {
  stiffness: number
  damping: number
  squashIntensity: number
}

const EPSILON = 0.1
const RAD_EPSILON = 0.003

// Radius return spring — intentionally slow so the blob state lingers
const RAD_STIFFNESS = 0.05
const RAD_DAMPING = 0.90

export interface LayoutAnimator {
  tick(elements: ChoanElement[], params: SpringParams, skipIds?: ReadonlySet<string>): ChoanElement[]
  isAnimating(): boolean
}

export function createLayoutAnimator(): LayoutAnimator {
  const springs = new Map<string, SpringState>()
  let animating = false

  function tick(elements: ChoanElement[], params: SpringParams, skipIds?: ReadonlySet<string>): ChoanElement[] {
    const { stiffness, damping, squashIntensity: fluid } = params
    const activeIds = new Set<string>()
    animating = false

    const result = elements.map((el) => {
      activeIds.add(el.id)
      const s = springs.get(el.id)

      // Target edges
      const tl = el.x
      const tt = el.y
      const tr = el.x + el.width
      const tb = el.y + el.height

      // Skip animation for elements being directly manipulated by the user
      if (skipIds?.has(el.id)) {
        if (s) {
          s.l = tl; s.t = tt; s.r = tr; s.b = tb
          s.vl = 0; s.vt = 0; s.vr = 0; s.vb = 0
          s.rad = el.radius ?? 0; s.vrad = 0
        } else {
          springs.set(el.id, {
            l: tl, t: tt, r: tr, b: tb,
            vl: 0, vt: 0, vr: 0, vb: 0,
            rad: el.radius ?? 0, vrad: 0,
          })
        }
        return el
      }

      if (!s) {
        springs.set(el.id, {
          l: tl, t: tt, r: tr, b: tb,
          vl: 0, vt: 0, vr: 0, vb: 0,
          rad: el.radius ?? 0, vrad: 0,
        })
        return el
      }

      // --- Compute per-edge stiffness (leading/trailing asymmetry) ---
      let sl = stiffness, st = stiffness, sr = stiffness, sb = stiffness

      if (fluid > 0) {
        // Direction from velocity (preferred) or delta (fallback for frame 1)
        const hvx = (s.vl + s.vr) / 2
        const vvy = (s.vt + s.vb) / 2
        const hdelta = ((tl - s.l) + (tr - s.r)) / 2
        const vdelta = ((tt - s.t) + (tb - s.b)) / 2
        const hSignal = Math.abs(hvx) > 0.3 ? hvx : hdelta
        const vSignal = Math.abs(vvy) > 0.3 ? vvy : vdelta

        const boost = fluid * 0.45
        const leadMul = 1 + boost
        const trailMul = Math.max(0.15, 1 - boost * 0.6)

        // Horizontal: moving right → right edge leads, left trails
        if (Math.abs(hSignal) > 0.5) {
          if (hSignal > 0) { sr = stiffness * leadMul; sl = stiffness * trailMul }
          else              { sl = stiffness * leadMul; sr = stiffness * trailMul }
        }
        // Vertical: moving down → bottom leads, top trails
        if (Math.abs(vSignal) > 0.5) {
          if (vSignal > 0) { sb = stiffness * leadMul; st = stiffness * trailMul }
          else              { st = stiffness * leadMul; sb = stiffness * trailMul }
        }
      }

      // --- Edge spring forces ---
      s.vl += (tl - s.l) * sl
      s.vt += (tt - s.t) * st
      s.vr += (tr - s.r) * sr
      s.vb += (tb - s.b) * sb

      s.vl *= damping; s.vt *= damping
      s.vr *= damping; s.vb *= damping

      s.l += s.vl; s.t += s.vt
      s.r += s.vr; s.b += s.vb

      // Prevent edge crossing (minimum 1 px)
      if (s.r - s.l < 1) {
        const mid = (s.l + s.r) / 2
        s.l = mid - 0.5; s.r = mid + 0.5
      }
      if (s.b - s.t < 1) {
        const mid = (s.t + s.b) / 2
        s.t = mid - 0.5; s.b = mid + 0.5
      }

      // --- Fluid radius morphing ---
      const baseRad = el.radius ?? 0
      let animRad = baseRad

      if (fluid > 0 && el.type === 'rectangle') {
        // Total edge velocity drives radius toward 1.0 (blob)
        const totalV = Math.abs(s.vl) + Math.abs(s.vt) + Math.abs(s.vr) + Math.abs(s.vb)
        const fluidBoost = Math.min(1 - baseRad, totalV * fluid * 0.02)
        const radTarget = baseRad + fluidBoost

        s.vrad += (radTarget - s.rad) * RAD_STIFFNESS
        s.vrad *= RAD_DAMPING
        s.rad += s.vrad
        s.rad = Math.max(0, Math.min(1, s.rad))
        animRad = s.rad
      } else {
        s.rad = baseRad
        s.vrad = 0
      }

      // --- Snap ---
      const edgeSettled =
        Math.abs(tl - s.l) < EPSILON && Math.abs(tt - s.t) < EPSILON &&
        Math.abs(tr - s.r) < EPSILON && Math.abs(tb - s.b) < EPSILON &&
        Math.abs(s.vl) < EPSILON && Math.abs(s.vt) < EPSILON &&
        Math.abs(s.vr) < EPSILON && Math.abs(s.vb) < EPSILON

      const radSettled =
        Math.abs(s.rad - baseRad) < RAD_EPSILON && Math.abs(s.vrad) < RAD_EPSILON

      if (edgeSettled) {
        s.l = tl; s.t = tt; s.r = tr; s.b = tb
        s.vl = 0; s.vt = 0; s.vr = 0; s.vb = 0
      }
      if (radSettled) {
        s.rad = baseRad; s.vrad = 0
      }
      if (!edgeSettled || !radSettled) {
        animating = true
      }

      return {
        ...el,
        x: s.l,
        y: s.t,
        width: s.r - s.l,
        height: s.b - s.t,
        radius: animRad,
      }
    })

    for (const id of springs.keys()) {
      if (!activeIds.has(id)) springs.delete(id)
    }

    return result
  }

  return { tick, isAnimating: () => animating }
}

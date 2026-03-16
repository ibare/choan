// Spring-based layout animator — interpolates element positions/sizes
// between states for fluid mesh-deformation-like transitions

import type { ChoanElement } from '../store/useChoanStore'

interface SpringState {
  x: number; y: number; w: number; h: number
  vx: number; vy: number; vw: number; vh: number
}

const STIFFNESS = 0.18
const DAMPING = 0.72
const EPSILON = 0.1  // snap threshold

export interface LayoutAnimator {
  tick(elements: ChoanElement[]): ChoanElement[]
  isAnimating(): boolean
}

export function createLayoutAnimator(): LayoutAnimator {
  const springs = new Map<string, SpringState>()
  let animating = false

  function tick(elements: ChoanElement[]): ChoanElement[] {
    const activeIds = new Set<string>()
    animating = false

    const result = elements.map((el) => {
      activeIds.add(el.id)
      let s = springs.get(el.id)

      if (!s) {
        // First time seeing this element — no animation, just set current
        springs.set(el.id, {
          x: el.x, y: el.y, w: el.width, h: el.height,
          vx: 0, vy: 0, vw: 0, vh: 0,
        })
        return el
      }

      // Spring toward target
      s.vx += (el.x - s.x) * STIFFNESS
      s.vy += (el.y - s.y) * STIFFNESS
      s.vw += (el.width - s.w) * STIFFNESS
      s.vh += (el.height - s.h) * STIFFNESS

      s.vx *= DAMPING
      s.vy *= DAMPING
      s.vw *= DAMPING
      s.vh *= DAMPING

      s.x += s.vx
      s.y += s.vy
      s.w += s.vw
      s.h += s.vh

      // Snap to target when close enough
      const dx = Math.abs(el.x - s.x)
      const dy = Math.abs(el.y - s.y)
      const dw = Math.abs(el.width - s.w)
      const dh = Math.abs(el.height - s.h)

      if (dx < EPSILON && dy < EPSILON && dw < EPSILON && dh < EPSILON
        && Math.abs(s.vx) < EPSILON && Math.abs(s.vy) < EPSILON
        && Math.abs(s.vw) < EPSILON && Math.abs(s.vh) < EPSILON) {
        s.x = el.x; s.y = el.y; s.w = el.width; s.h = el.height
        s.vx = 0; s.vy = 0; s.vw = 0; s.vh = 0
      } else {
        animating = true
      }

      return {
        ...el,
        x: s.x,
        y: s.y,
        width: Math.max(1, s.w),
        height: Math.max(1, s.h),
      }
    })

    // Clean up removed elements
    for (const id of springs.keys()) {
      if (!activeIds.has(id)) springs.delete(id)
    }

    return result
  }

  function isAnimating() {
    return animating
  }

  return { tick, isAnimating }
}

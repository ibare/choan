// CPU-side SDF functions for hit testing / picking
// Mirrors the GPU SDF primitives exactly

import type { ChoanElement } from '../store/useChoanStore'
import { FRUSTUM, EXTRUDE_DEPTH } from './scene'
import { PALETTE } from '../canvas/materials'

function sdRoundBox(px: number, py: number, pz: number, bx: number, by: number, bz: number, r: number): number {
  const qx = Math.abs(px) - bx + r
  const qy = Math.abs(py) - by + r
  const qz = Math.abs(pz) - bz + r
  const mx = Math.max(qx, 0)
  const my = Math.max(qy, 0)
  const mz = Math.max(qz, 0)
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r
}

// 2D rounded rect extruded along Z — rounds only XY corners (CSS border-radius)
function sdExtrudedRoundRect(px: number, py: number, pz: number, bx: number, by: number, bz: number, r: number): number {
  const qx = Math.abs(px) - bx + r
  const qy = Math.abs(py) - by + r
  const mx = Math.max(qx, 0)
  const my = Math.max(qy, 0)
  const d2d = Math.sqrt(mx * mx + my * my) + Math.min(Math.max(qx, qy), 0) - r
  return Math.max(d2d, Math.abs(pz) - bz)
}

function sdCapsule(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  r: number,
): number {
  const pax = px - ax, pay = py - ay, paz = pz - az
  const bax = bx - ax, bay = by - ay, baz = bz - az
  const dot_pa_ba = pax * bax + pay * bay + paz * baz
  const dot_ba_ba = bax * bax + bay * bay + baz * baz
  const h = Math.max(0, Math.min(1, dot_pa_ba / dot_ba_ba))
  const dx = pax - bax * h
  const dy = pay - bay * h
  const dz = paz - baz * h
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r
}

export interface HitResult {
  distance: number
  objectIndex: number
}

function elementToWorld(el: ChoanElement, canvasW: number, canvasH: number) {
  const aspect = canvasW / canvasH
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  return {
    wx: -FRUSTUM * aspect + (cx / canvasW) * 2 * FRUSTUM * aspect,
    wy: FRUSTUM - (cy / canvasH) * 2 * FRUSTUM,
    wz: el.z * EXTRUDE_DEPTH,
    hw: ((el.width / canvasW) * 2 * FRUSTUM * aspect) / 2,
    hh: ((el.height / canvasH) * 2 * FRUSTUM) / 2,
    hd: EXTRUDE_DEPTH / 2,
  }
}

function evalElementSDF(
  px: number, py: number, pz: number,
  el: ChoanElement,
  canvasW: number, canvasH: number,
): number {
  const { wx, wy, wz, hw, hh, hd } = elementToWorld(el, canvasW, canvasH)
  const lx = px - wx, ly = py - wy, lz = pz - wz

  if (el.type === 'circle') {
    const r = Math.min(hw, hh)
    return sdExtrudedRoundRect(lx, ly, lz, hw, hh, hd, r)
  } else if (el.type === 'line') {
    return sdCapsule(lx, ly, lz, -hw, 0, 0, hw, 0, 0, hh)
  } else {
    // Rectangle
    const radius = el.radius ?? 0
    const maxR = Math.min(hw, hh)
    const r = radius * maxR
    return sdExtrudedRoundRect(lx, ly, lz, hw, hh, hd, r)
  }
}

// Ray march on CPU — returns closest hit element index or -1
export function cpuRayMarch(
  roX: number, roY: number, roZ: number,
  rdX: number, rdY: number, rdZ: number,
  elements: ChoanElement[],
  canvasW: number, canvasH: number,
): HitResult | null {
  const MAX_STEPS = 64
  const MAX_DIST = 100
  const EPSILON = 0.005 // slightly larger than GPU for robustness

  let t = 0
  for (let step = 0; step < MAX_STEPS; step++) {
    const px = roX + rdX * t
    const py = roY + rdY * t
    const pz = roZ + rdZ * t

    let minDist = 1e10
    let hitIdx = -1
    for (let i = 0; i < elements.length; i++) {
      const d = evalElementSDF(px, py, pz, elements[i], canvasW, canvasH)
      if (d < minDist) {
        minDist = d
        hitIdx = i
      }
    }

    if (minDist < EPSILON) {
      return { distance: t, objectIndex: hitIdx }
    }

    t += minDist
    if (t > MAX_DIST) break
  }

  return null
}

// Ray from screen pixel through camera
export function screenToRay(
  clientX: number, clientY: number,
  canvasRect: DOMRect,
  camPos: [number, number, number],
  camForward: [number, number, number],
  camRight: [number, number, number],
  camUp: [number, number, number],
  fovScale: number,
  canvasW: number, canvasH: number,
): { ro: [number, number, number]; rd: [number, number, number] } {
  const dpr = window.devicePixelRatio || 1
  const pixelX = (clientX - canvasRect.left) * dpr
  const pixelY = (canvasRect.height - (clientY - canvasRect.top)) * dpr // flip Y
  const w = canvasW * dpr
  const h = canvasH * dpr

  const uvX = (2.0 * pixelX - w) / h
  const uvY = (2.0 * pixelY - h) / h

  const rdX = camForward[0] + uvX * fovScale * camRight[0] + uvY * fovScale * camUp[0]
  const rdY = camForward[1] + uvX * fovScale * camRight[1] + uvY * fovScale * camUp[1]
  const rdZ = camForward[2] + uvX * fovScale * camRight[2] + uvY * fovScale * camUp[2]
  const len = Math.sqrt(rdX * rdX + rdY * rdY + rdZ * rdZ)

  return {
    ro: [camPos[0], camPos[1], camPos[2]],
    rd: [rdX / len, rdY / len, rdZ / len],
  }
}

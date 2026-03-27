// CPU-side SDF functions for hit testing / picking
// Mirrors the GPU SDF primitives exactly

import type { ChoanElement } from '../store/useChoanStore'
import { FRUSTUM, EXTRUDE_DEPTH } from './scene'
import { MAX_BVH_NODES, type BVHData } from './bvh'

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

function elementToWorld(el: ChoanElement, canvasW: number, canvasH: number, ed = EXTRUDE_DEPTH) {
  const aspect = canvasW / canvasH
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  return {
    wx: -FRUSTUM * aspect + (cx / canvasW) * 2 * FRUSTUM * aspect,
    wy: FRUSTUM - (cy / canvasH) * 2 * FRUSTUM,
    wz: el.z * ed,
    hw: ((el.width / canvasW) * 2 * FRUSTUM * aspect) / 2,
    hh: ((el.height / canvasH) * 2 * FRUSTUM) / 2,
    hd: ed / 2,
  }
}

function evalElementSDF(
  px: number, py: number, pz: number,
  el: ChoanElement,
  canvasW: number, canvasH: number,
  ed = EXTRUDE_DEPTH,
): number {
  const { wx, wy, wz, hw, hh, hd } = elementToWorld(el, canvasW, canvasH, ed)
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

// sceneSDF using BVH traversal — mirrors GPU sceneSDF
function sceneSDF_BVH(
  px: number, py: number, pz: number,
  elements: ChoanElement[],
  canvasW: number, canvasH: number,
  bvh: BVHData,
  ed = EXTRUDE_DEPTH,
): { dist: number; idx: number } {
  let resDist = 1e10
  let resIdx = -1

  const { nodes, objectOrder, numInternalNodes } = bvh
  const stack = new Int32Array(16)
  let sp = 1
  stack[0] = 0

  while (sp > 0) {
    const idx = stack[--sp]
    if (idx >= MAX_BVH_NODES) continue

    const ni = idx * 6
    const minX = nodes[ni], minY = nodes[ni + 1], minZ = nodes[ni + 2]
    const maxX = nodes[ni + 3], maxY = nodes[ni + 4], maxZ = nodes[ni + 5]

    // Degenerate (padding)
    if (minX > maxX) continue

    // 3D AABB distance
    const dx = Math.max(minX - px, Math.max(px - maxX, 0))
    const dy = Math.max(minY - py, Math.max(py - maxY, 0))
    const dz = Math.max(minZ - pz, Math.max(pz - maxZ, 0))
    const boxDist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    // Only prune when point is outside AABB (boxDist > 0).
    // Inside the AABB (boxDist = 0), the actual SDF can be negative
    // (e.g., child inside parent), so we must always descend.
    if (boxDist > 0 && boxDist >= resDist) continue

    if (idx >= numInternalNodes) {
      // Leaf
      const leafIdx = idx - numInternalNodes
      const origIdx = objectOrder[leafIdx]
      if (origIdx >= 0 && origIdx < elements.length) {
        const d = evalElementSDF(px, py, pz, elements[origIdx], canvasW, canvasH, ed)
        if (d < resDist) {
          resDist = d
          resIdx = origIdx
        }
      }
    } else {
      // Internal
      stack[sp++] = idx * 2 + 2
      stack[sp++] = idx * 2 + 1
    }
  }

  return { dist: resDist, idx: resIdx }
}

// Ray march on CPU — returns closest hit element index or -1
export function cpuRayMarch(
  roX: number, roY: number, roZ: number,
  rdX: number, rdY: number, rdZ: number,
  elements: ChoanElement[],
  canvasW: number, canvasH: number,
  bvh?: BVHData,
  extrudeDepth = EXTRUDE_DEPTH,
): HitResult | null {
  const MAX_STEPS = 128
  const MAX_DIST = 500
  const EPSILON = 0.005 // slightly larger than GPU for robustness

  let t = 0
  for (let step = 0; step < MAX_STEPS; step++) {
    const px = roX + rdX * t
    const py = roY + rdY * t
    const pz = roZ + rdZ * t

    let minDist: number
    let hitIdx: number

    if (bvh && bvh.numLeaves > 0) {
      const res = sceneSDF_BVH(px, py, pz, elements, canvasW, canvasH, bvh, extrudeDepth)
      minDist = res.dist
      hitIdx = res.idx
    } else {
      minDist = 1e10
      hitIdx = -1
      for (let i = 0; i < elements.length; i++) {
        if (elements[i].skinOnly || elements[i].frameless) continue
        const d = evalElementSDF(px, py, pz, elements[i], canvasW, canvasH, extrudeDepth)
        if (d < minDist) {
          minDist = d
          hitIdx = i
        }
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

// Ray-plane intersection for skinOnly elements (mirrors GPU skinOnly overlay)
export function cpuSkinOnlyHit(
  roX: number, roY: number, roZ: number,
  rdX: number, rdY: number, rdZ: number,
  elements: ChoanElement[],
  canvasW: number, canvasH: number,
  sdfHitDist: number, // distance of existing SDF hit (-1 if no hit)
  extrudeDepth = EXTRUDE_DEPTH,
): HitResult | null {
  let bestT = sdfHitDist >= 0 ? sdfHitDist : 1e10
  let bestIdx = -1

  for (let i = 0; i < elements.length; i++) {
    if (!elements[i].skinOnly && !elements[i].frameless) continue
    const { wx, wy, wz, hw, hh, hd } = elementToWorld(elements[i], canvasW, canvasH, extrudeDepth)
    const frontZ = wz + hd

    // Ray-plane intersection: plane at z = frontZ
    if (Math.abs(rdZ) < 1e-6) continue
    const t = (frontZ - roZ) / rdZ
    if (t < 0 || t >= bestT) continue

    // Hit point on the plane
    const hx = roX + rdX * t - wx
    const hy = roY + rdY * t - wy

    // Check XY bounds
    if (Math.abs(hx) > hw || Math.abs(hy) > hh) continue

    bestT = t
    bestIdx = i
  }

  if (bestIdx < 0) return null
  return { distance: bestT, objectIndex: bestIdx }
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

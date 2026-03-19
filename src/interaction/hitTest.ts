// Hit testing — pure functions, no hooks.
// Accepts renderer and canvas state as parameters.

import type { ChoanElement } from '../store/useChoanStore'
import type { SDFRenderer } from '../engine/renderer'
import { getCameraRayParams } from '../engine/camera'
import { cpuRayMarch, screenToRay } from '../engine/sdf'
import { useChoanStore } from '../store/useChoanStore'
import { HANDLE_HIT_RADIUS } from '../constants'

export function raycastElement(
  clientX: number,
  clientY: number,
  renderer: SDFRenderer,
  canvasSize: { w: number; h: number },
  elementsOverride?: ChoanElement[],
): string | null {
  const ray = getCameraRayParams(renderer.camera)
  const rect = renderer.canvas.getBoundingClientRect()
  const { w, h } = canvasSize
  const { ro, rd } = screenToRay(
    clientX, clientY, rect, ray.ro, ray.forward, ray.right, ray.up, ray.fovScale, w, h,
  )
  const elements = elementsOverride ?? useChoanStore.getState().elements
  const hit = cpuRayMarch(ro[0], ro[1], ro[2], rd[0], rd[1], rd[2], elements, w, h)
  if (!hit || hit.objectIndex < 0 || hit.objectIndex >= elements.length) return null
  return elements[hit.objectIndex].id
}

export function hitTestCorner(
  clientX: number,
  clientY: number,
  selectedId: string,
  elements: ChoanElement[],
  screenToPixel: (cx: number, cy: number) => { x: number; y: number } | null,
  zoomScale: number,
): number {
  const el = elements.find((e) => e.id === selectedId)
  if (!el) return -1
  const pixel = screenToPixel(clientX, clientY)
  if (!pixel) return -1
  const corners = [
    { x: el.x, y: el.y + el.height },
    { x: el.x + el.width, y: el.y + el.height },
    { x: el.x + el.width, y: el.y },
    { x: el.x, y: el.y },
  ]
  const scaledHitR = HANDLE_HIT_RADIUS * zoomScale
  for (let i = 0; i < corners.length; i++) {
    const dx = pixel.x - corners[i].x
    const dy = pixel.y - corners[i].y
    if (dx * dx + dy * dy <= scaledHitR * scaledHitR) return i
  }
  return -1
}

/** Hit test layout resize handles between children of a row/column container. */
export function hitTestLayoutHandle(
  clientX: number,
  clientY: number,
  containerId: string,
  elements: ChoanElement[],
  screenToPixel: (cx: number, cy: number) => { x: number; y: number } | null,
  zoomScale: number,
): number {
  const container = elements.find((e) => e.id === containerId)
  if (!container) return -1
  const dir = container.layoutDirection
  if (dir !== 'row' && dir !== 'column') return -1
  const pixel = screenToPixel(clientX, clientY)
  if (!pixel) return -1

  const children = elements.filter((e) => e.parentId === containerId)
  const hitR = HANDLE_HIT_RADIUS * zoomScale * 1.2
  for (let i = 0; i < children.length - 1; i++) {
    const child = children[i]
    let hx: number, hy: number
    if (dir === 'row') {
      hx = child.x + child.width
      hy = child.y + child.height / 2
    } else {
      hx = child.x + child.width / 2
      hy = child.y + child.height
    }
    const dx = pixel.x - hx, dy = pixel.y - hy
    if (dx * dx + dy * dy <= hitR * hitR) return i
  }
  return -1
}

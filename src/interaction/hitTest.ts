// Hit testing — pure functions, no hooks.
// Accepts renderer and canvas state as parameters.

import type { ChoanElement } from '../store/useChoanStore'
import type { SDFRenderer } from '../engine/renderer'
import { getCameraRayParams } from '../engine/camera'
import { cpuRayMarch, cpuSkinOnlyHit, screenToRay } from '../engine/sdf'
import { useChoanStore } from '../store/useChoanStore'
import { HANDLE_HIT_RADIUS } from '../constants'
import { useRenderSettings } from '../store/useRenderSettings'

type ScreenToPixelFn = (cx: number, cy: number, zPlane?: number) => { x: number; y: number } | null

function getExtrudeDepth(): number {
  return useRenderSettings.getState().extrudeDepth
}

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
  const ed = getExtrudeDepth()
  const hit = cpuRayMarch(ro[0], ro[1], ro[2], rd[0], rd[1], rd[2], elements, w, h, renderer.bvhData ?? undefined, ed)

  // skinOnly elements (icons etc.) use ray-plane intersection, not SDF
  const skinHit = cpuSkinOnlyHit(ro[0], ro[1], ro[2], rd[0], rd[1], rd[2], elements, w, h, hit?.distance ?? -1, ed)

  const best = skinHit ?? hit
  if (!best || best.objectIndex < 0 || best.objectIndex >= elements.length) return null
  return elements[best.objectIndex].id
}

export function hitTestCorner(
  clientX: number,
  clientY: number,
  selectedId: string,
  elements: ChoanElement[],
  screenToPixel: ScreenToPixelFn,
  zoomScale: number,
): number {
  const el = elements.find((e) => e.id === selectedId)
  if (!el) return -1
  const pixel = screenToPixel(clientX, clientY, el.z * getExtrudeDepth())
  if (!pixel) return -1
  // Corners: 0=BL, 1=BR, 2=TR, 3=TL
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
  // Mid-edge handles: 4=top, 5=right, 6=bottom, 7=left
  // Only test if the edge is long enough (capsule + corners must fit)
  const minEdgePx = 80 * zoomScale  // approximate threshold matching overlay rendering
  const wideEnough = el.width > minEdgePx
  const tallEnough = el.height > minEdgePx
  const midEdges: ({ x: number; y: number } | null)[] = [
    wideEnough ? { x: el.x + el.width / 2, y: el.y } : null,                  // 4: top
    tallEnough ? { x: el.x + el.width, y: el.y + el.height / 2 } : null,      // 5: right
    wideEnough ? { x: el.x + el.width / 2, y: el.y + el.height } : null,      // 6: bottom
    tallEnough ? { x: el.x, y: el.y + el.height / 2 } : null,                  // 7: left
  ]
  for (let i = 0; i < midEdges.length; i++) {
    const m = midEdges[i]
    if (!m) continue
    const dx = pixel.x - m.x
    const dy = pixel.y - m.y
    if (dx * dx + dy * dy <= scaledHitR * scaledHitR) return 4 + i
  }
  return -1
}

/** Hit test sizing indicator (TR corner) of layout children. Returns child ID or null. */
export function hitTestSizingIndicator(
  clientX: number,
  clientY: number,
  containerId: string,
  elements: ChoanElement[],
  screenToPixel: ScreenToPixelFn,
  zoomScale: number,
): string | null {
  const container = elements.find((e) => e.id === containerId)
  if (!container) return null
  const dir = container.layoutDirection
  if (dir !== 'row' && dir !== 'column') return null
  const pixel = screenToPixel(clientX, clientY, container.z * getExtrudeDepth())
  if (!pixel) return null

  const children = elements.filter((e) => e.parentId === containerId)
  const hitR = HANDLE_HIT_RADIUS * zoomScale
  for (const child of children) {
    const ix = child.x + child.width - 12 * zoomScale
    const iy = child.y + 12 * zoomScale
    const dx = pixel.x - ix, dy = pixel.y - iy
    if (dx * dx + dy * dy <= hitR * hitR) return child.id
  }
  return null
}

/** Hit test layout resize handles between children of a row/column container. */
export function hitTestLayoutHandle(
  clientX: number,
  clientY: number,
  containerId: string,
  elements: ChoanElement[],
  screenToPixel: ScreenToPixelFn,
  zoomScale: number,
): number {
  const container = elements.find((e) => e.id === containerId)
  if (!container) return -1
  const dir = container.layoutDirection
  if (dir !== 'row' && dir !== 'column') return -1
  const pixel = screenToPixel(clientX, clientY, container.z * getExtrudeDepth())
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

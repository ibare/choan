// Pointer event handlers hook — owns all interaction refs and the three pointer handlers.
// Returns handlers for the canvas element + refs needed by the rAF render loop.

import { useRef, useState, useCallback, type MutableRefObject } from 'react'
import type { SDFRenderer } from '../engine/renderer'
import type { SnapLine } from '../canvas/snapUtils'
import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import { autoKeyframe } from '../animation/autoKeyframe'
import { nanoid } from '../canvas/nanoid'
import { detectContainment } from '../layout/containment'
import { computeSnapMove, computeSnapResize } from '../canvas/snapUtils'
import { kfAnimator } from '../rendering/kfAnimator'
import { COLOR_FAMILIES } from '../canvas/materials'
import {
  MIN_ELEMENT_SIZE, COLOR_PICKER_HIT_RADIUS,
  COLOR_PICKER_RING_BASE, COLOR_PICKER_RING_STEP,
} from '../constants'
import { raycastElement, hitTestCorner } from './hitTest'
import { applyToSiblings, resolveGroup, DEFAULT_SIZE } from './elementHelpers'
import type { ChoanElement } from '../store/useChoanStore'
import { worldToPixel as worldToPixelCS } from '../coords/coordinateSystem'
import { getCameraRayParams } from '../engine/camera'
import { screenToRay } from '../engine/sdf'

export interface InteractionRefs {
  colorPickerOpenRef: MutableRefObject<boolean>
  colorPickerHoverRef: MutableRefObject<number>
  isDraggingRef: MutableRefObject<boolean>
  dragGroupIdsRef: MutableRefObject<string[]>
  isResizingRef: MutableRefObject<boolean>
  resizeElIdRef: MutableRefObject<string | null>
  isDrawingRef: MutableRefObject<boolean>
  drawElIdRef: MutableRefObject<string | null>
  snapLinesRef: MutableRefObject<SnapLine[]>
}

export interface UsePointerHandlersResult extends InteractionRefs {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  dragSelectBox: { left: number; top: number; width: number; height: number } | null
  cursor: string
}

export function usePointerHandlers({
  rendererRef,
  canvasSizeRef,
  zoomScaleRef,
  mountRef,
}: {
  rendererRef: MutableRefObject<SDFRenderer | null>
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>
  zoomScaleRef: MutableRefObject<number>
  mountRef: MutableRefObject<HTMLDivElement | null>
}): UsePointerHandlersResult {
  // Screen → pseudo-pixel (canvas layout space) conversion
  const screenToPixel = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const renderer = rendererRef.current
    if (!renderer) return null
    const ray = getCameraRayParams(renderer.camera)
    const rect = renderer.canvas.getBoundingClientRect()
    const { w, h } = canvasSizeRef.current
    const { ro, rd } = screenToRay(clientX, clientY, rect, ray.ro, ray.forward, ray.right, ray.up, ray.fovScale, w, h)
    if (Math.abs(rd[2]) < 1e-6) return null
    const t = -ro[2] / rd[2]
    if (t < 0) return null
    const [px, py] = worldToPixelCS(ro[0] + rd[0] * t, ro[1] + rd[1] * t, w, h)
    return { x: px, y: py }
  }, [])

  // ── Interaction refs ──

  const colorPickerOpenRef = useRef(false)
  const colorPickerHoverRef = useRef(-1)

  const isDraggingRef = useRef(false)
  const dragStartPixelRef = useRef({ x: 0, y: 0 })
  const dragGroupStartRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragGroupIdsRef = useRef<string[]>([])
  const dragContainerIdRef = useRef<string | null>(null)

  const isResizingRef = useRef(false)
  const resizeStartPixelRef = useRef({ x: 0, y: 0 })
  const resizeCornerStartRef = useRef({ x: 0, y: 0 })
  const resizeAnchorRef = useRef({ x: 0, y: 0 })
  const resizeElIdRef = useRef<string | null>(null)

  const isRadiusDragRef = useRef(false)
  const radiusStartRef = useRef(0)
  const radiusDragStartPixelRef = useRef({ x: 0, y: 0 })

  const isDrawingRef = useRef(false)
  const drawStartPixelRef = useRef({ x: 0, y: 0 })
  const drawElIdRef = useRef<string | null>(null)

  const isDragSelectRef = useRef(false)
  const dragSelectPointerIdRef = useRef<number>(-1)
  const dragSelectAddModeRef = useRef(false)
  const dragSelectPreSelectionRef = useRef<string[]>([])
  const dragSelectStartClientRef = useRef({ x: 0, y: 0 })
  const dragSelectStartPixelRef = useRef({ x: 0, y: 0 })
  const dragSelectHasMovedRef = useRef(false)
  const [dragSelectBox, setDragSelectBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  const snapLinesRef = useRef<SnapLine[]>([])
  const [cursor, setCursor] = useState('default')

  // ── handlePointerDown ──

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return

    // Reset any stale drag-select state
    if (isDragSelectRef.current) {
      const originalPointerId = dragSelectPointerIdRef.current
      isDragSelectRef.current = false
      dragSelectHasMovedRef.current = false
      dragSelectAddModeRef.current = false
      dragSelectPointerIdRef.current = -1
      setDragSelectBox(null)
      if (originalPointerId !== -1 && e.pointerId !== originalPointerId) return
    }

    // Preview mode: trigger animations directly from element triggers
    const previewState = usePreviewStore.getState().previewState
    if (previewState === 'playing') {
      const renderer = rendererRef.current
      if (!renderer) return
      const hitId = raycastElement(e.clientX, e.clientY, renderer, canvasSizeRef.current)
      if (hitId) {
        const { elements: els, animationBundles: bundles } = useChoanStore.getState()
        const el = els.find((el) => el.id === hitId)
        for (const trigger of el?.triggers ?? []) {
          if (trigger.event === 'click') {
            const bundle = bundles.find((b) => b.id === trigger.animationBundleId)
            if (bundle) {
              for (const clip of bundle.clips) kfAnimator.start(clip, clip.id, performance.now())
            }
          }
        }
      }
      return
    }

    // Color picker click
    if (colorPickerOpenRef.current) {
      const pixel = screenToPixel(e.clientX, e.clientY)
      const { elements: els, selectedIds, updateElement: update } = useChoanStore.getState()
      const selId = selectedIds[0] ?? null
      if (pixel && selId) {
        const el = els.find((el) => el.id === selId)
        if (el) {
          const ax = el.x + el.width
          const ay = el.y
          const zs = zoomScaleRef.current
          const pickHitR = COLOR_PICKER_HIT_RADIUS * zs
          for (let fi = 0; fi < COLOR_FAMILIES.length; fi++) {
            for (let si = 0; si < COLOR_FAMILIES[fi].shades.length; si++) {
              const angle = (fi / COLOR_FAMILIES.length) * Math.PI * 2 - Math.PI / 2
              const ring = (COLOR_PICKER_RING_BASE + si * COLOR_PICKER_RING_STEP) * zs
              const dx = pixel.x - (ax + Math.cos(angle) * ring)
              const dy = pixel.y - (ay + Math.sin(angle) * ring)
              if (dx * dx + dy * dy <= pickHitR * pickHitR) {
                applyToSiblings(update, els, selId, { color: COLOR_FAMILIES[fi].shades[si] }, e.altKey)
                colorPickerOpenRef.current = false
                colorPickerHoverRef.current = -1
                return
              }
            }
          }
        }
      }
      colorPickerOpenRef.current = false
      colorPickerHoverRef.current = -1
      return
    }

    const { tool, selectedIds, elements: els, selectElement, toggleSelectElement, setSelectedIds, addElement, drawColor } = useChoanStore.getState()

    if (tool === 'select') {
      // Shift+click/drag
      if (e.shiftKey) {
        const renderer = rendererRef.current
        const hitId = renderer ? raycastElement(e.clientX, e.clientY, renderer, canvasSizeRef.current) : null
        if (hitId) {
          toggleSelectElement(hitId)
        } else {
          dragSelectAddModeRef.current = true
          dragSelectPreSelectionRef.current = [...selectedIds]
          dragSelectHasMovedRef.current = false
          isDragSelectRef.current = true
          dragSelectPointerIdRef.current = e.pointerId
          dragSelectStartClientRef.current = { x: e.clientX, y: e.clientY }
          const pixel = screenToPixel(e.clientX, e.clientY)
          if (pixel) dragSelectStartPixelRef.current = pixel
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }
        return
      }

      // Handle hit test (single selection only)
      const selId = selectedIds[0] ?? null
      if (selectedIds.length === 1 && selId) {
        const corner = hitTestCorner(e.clientX, e.clientY, selId, els, screenToPixel, zoomScaleRef.current)
        if (corner >= 0) {
          if (corner === 2) {
            colorPickerOpenRef.current = true
            colorPickerHoverRef.current = -1
            return
          }
          if (corner === 3 && els.find((el) => el.id === selId)?.type === 'rectangle') {
            isRadiusDragRef.current = true
            radiusStartRef.current = els.find((el) => el.id === selId)?.radius ?? 0
            const pixel = screenToPixel(e.clientX, e.clientY)
            if (pixel) radiusDragStartPixelRef.current = pixel
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            return
          }
          const el = els.find((el) => el.id === selId)!
          const parentOfEl = el.parentId ? els.find((p) => p.id === el.parentId) : null
          const isManagedChild = el.parentId && parentOfEl?.layoutDirection !== 'free' && parentOfEl?.layoutDirection !== undefined
          if (corner === 1 && !isManagedChild) {
            const cornerPositions = [
              { x: el.x, y: el.y + el.height },
              { x: el.x + el.width, y: el.y + el.height },
              { x: el.x + el.width, y: el.y },
              { x: el.x, y: el.y },
            ]
            isResizingRef.current = true
            resizeElIdRef.current = el.id
            const pixel = screenToPixel(e.clientX, e.clientY)
            if (pixel) resizeStartPixelRef.current = pixel
            resizeCornerStartRef.current = cornerPositions[corner]
            resizeAnchorRef.current = cornerPositions[(corner + 2) % 4]
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            return
          }
        }
      }

      // Element select/drag
      const renderer = rendererRef.current
      const hitId = renderer ? raycastElement(e.clientX, e.clientY, renderer, canvasSizeRef.current) : null
      if (hitId) {
        const freshEls = useChoanStore.getState().elements
        const currentSelectedIds = useChoanStore.getState().selectedIds
        if (currentSelectedIds.includes(hitId)) {
          isDraggingRef.current = true
          dragGroupIdsRef.current = currentSelectedIds
          const pixel = screenToPixel(e.clientX, e.clientY)
          if (pixel) dragStartPixelRef.current = pixel
          const startMap = new Map<string, { x: number; y: number }>()
          for (const sid of currentSelectedIds) {
            const ge = freshEls.find((el) => el.id === sid)
            if (ge) startMap.set(sid, { x: ge.x, y: ge.y })
          }
          dragGroupStartRef.current = startMap
          dragContainerIdRef.current = null
        } else {
          selectElement(hitId)
          const groupIds = resolveGroup(freshEls, hitId)
          isDraggingRef.current = true
          dragGroupIdsRef.current = groupIds
          const pixel = screenToPixel(e.clientX, e.clientY)
          if (pixel) dragStartPixelRef.current = pixel
          const startMap = new Map<string, { x: number; y: number }>()
          for (const gid of groupIds) {
            const ge = freshEls.find((el) => el.id === gid)
            if (ge) startMap.set(gid, { x: ge.x, y: ge.y })
          }
          dragGroupStartRef.current = startMap
          const el = freshEls.find((el) => el.id === hitId)!
          dragContainerIdRef.current =
            el.role === 'container' && groupIds.includes(el.id) ? el.id
            : el.parentId && groupIds.includes(el.parentId) ? el.parentId
            : null
        }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      } else {
        // Empty space → start drag-select box
        dragSelectHasMovedRef.current = false
        isDragSelectRef.current = true
        dragSelectPointerIdRef.current = e.pointerId
        dragSelectAddModeRef.current = false
        dragSelectPreSelectionRef.current = [...selectedIds]
        dragSelectStartClientRef.current = { x: e.clientX, y: e.clientY }
        const pixel = screenToPixel(e.clientX, e.clientY)
        if (pixel) dragSelectStartPixelRef.current = pixel
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }
      return
    }

    // Draw-to-create
    const pixel = screenToPixel(e.clientX, e.clientY)
    if (!pixel) return
    drawStartPixelRef.current = pixel
    const id = nanoid()
    const el: ChoanElement = {
      id,
      type: tool,
      label: tool === 'rectangle' ? 'Box' : tool === 'circle' ? 'Circle' : 'Line',
      role: tool === 'rectangle' ? 'container' : undefined,
      color: drawColor,
      x: pixel.x, y: pixel.y, z: 0,
      width: 1, height: 1, opacity: 1,
    }
    addElement(el)
    selectElement(id)
    isDrawingRef.current = true
    drawElIdRef.current = id
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [screenToPixel])

  // ── handlePointerMove ──

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const { elements: els, selectedIds: selIds, updateElement: update } = useChoanStore.getState()
    const selId = selIds[0] ?? null

    // Color picker hover
    if (colorPickerOpenRef.current && selId) {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (pixel) {
        const el = els.find((el) => el.id === selId)
        if (el) {
          const ax = el.x + el.width, ay = el.y
          const zs = zoomScaleRef.current
          const hoverHitR = COLOR_PICKER_HIT_RADIUS * zs
          let found = -1
          for (let fi = 0; fi < COLOR_FAMILIES.length && found < 0; fi++) {
            for (let si = 0; si < COLOR_FAMILIES[fi].shades.length; si++) {
              const angle = (fi / COLOR_FAMILIES.length) * Math.PI * 2 - Math.PI / 2
              const ring = (COLOR_PICKER_RING_BASE + si * COLOR_PICKER_RING_STEP) * zs
              const dx = pixel.x - (ax + Math.cos(angle) * ring)
              const dy = pixel.y - (ay + Math.sin(angle) * ring)
              if (dx * dx + dy * dy <= hoverHitR * hoverHitR) { found = fi * 5 + si; break }
            }
          }
          colorPickerHoverRef.current = found
          setCursor(found >= 0 ? 'pointer' : 'default')
        }
      }
      return
    }

    // Drag-select box — real-time element selection
    if (isDragSelectRef.current) {
      const mount = mountRef.current
      if (mount) {
        const rect = mount.getBoundingClientRect()
        const startX = dragSelectStartClientRef.current.x - rect.left
        const startY = dragSelectStartClientRef.current.y - rect.top
        const currX = e.clientX - rect.left
        const currY = e.clientY - rect.top
        const boxW = Math.abs(currX - startX)
        const boxH = Math.abs(currY - startY)
        if (boxW > 4 || boxH > 4) dragSelectHasMovedRef.current = true
        setDragSelectBox({ left: Math.min(startX, currX), top: Math.min(startY, currY), width: boxW, height: boxH })
      }
      const currPixel = screenToPixel(e.clientX, e.clientY)
      if (currPixel) {
        const sp = dragSelectStartPixelRef.current
        const boxL = Math.min(sp.x, currPixel.x), boxT = Math.min(sp.y, currPixel.y)
        const boxR = Math.max(sp.x, currPixel.x), boxB = Math.max(sp.y, currPixel.y)
        const intersecting = els
          .filter((el) => !(el.x + el.width < boxL || el.x > boxR || el.y + el.height < boxT || el.y > boxB))
          .map((el) => el.id)
        const { setSelectedIds } = useChoanStore.getState()
        if (dragSelectAddModeRef.current) {
          setSelectedIds([...new Set([...dragSelectPreSelectionRef.current, ...intersecting])])
        } else {
          setSelectedIds(intersecting)
        }
      }
      return
    }

    // Draw-to-create
    if (isDrawingRef.current && drawElIdRef.current) {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (!pixel) return
      const sx = drawStartPixelRef.current.x, sy = drawStartPixelRef.current.y
      update(drawElIdRef.current, {
        x: Math.min(sx, pixel.x), y: Math.min(sy, pixel.y),
        width: Math.max(MIN_ELEMENT_SIZE, Math.abs(pixel.x - sx)),
        height: Math.max(MIN_ELEMENT_SIZE, Math.abs(pixel.y - sy)),
      })
      return
    }

    // Radius drag
    if (isRadiusDragRef.current && selId) {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (!pixel) return
      const el = els.find((el) => el.id === selId)
      if (!el) return
      const dx = pixel.x - radiusDragStartPixelRef.current.x
      const dy = pixel.y - radiusDragStartPixelRef.current.y
      const delta = (dx + dy) / Math.min(el.width, el.height)
      applyToSiblings(update, els, selId, { radius: Math.max(0, Math.min(1, radiusStartRef.current + delta)) }, e.altKey)
      return
    }

    // Resize
    if (isResizingRef.current && selId) {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (!pixel) return
      const dx = pixel.x - resizeStartPixelRef.current.x
      const dy = pixel.y - resizeStartPixelRef.current.y
      const anchor = resizeAnchorRef.current
      const proposed = { x: resizeCornerStartRef.current.x + dx, y: resizeCornerStartRef.current.y + dy }
      const snap = computeSnapResize(anchor, proposed, els.filter((el) => el.id !== selId))
      snapLinesRef.current = snap.lines
      applyToSiblings(update, els, selId, {
        x: Math.min(anchor.x, snap.x), y: Math.min(anchor.y, snap.y),
        width: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.x - snap.x)),
        height: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.y - snap.y)),
      }, e.altKey)
      return
    }

    // Group drag (single or multi-select)
    const { tool } = useChoanStore.getState()
    if (isDraggingRef.current && tool === 'select') {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (!pixel) return
      const dx = pixel.x - dragStartPixelRef.current.x
      const dy = pixel.y - dragStartPixelRef.current.y
      const groupIds = dragGroupIdsRef.current
      const groupSet = new Set(groupIds)
      const refId = dragContainerIdRef.current ?? groupIds[0]
      const refStart = dragGroupStartRef.current.get(refId)
      if (!refStart) return
      const refEl = els.find((el) => el.id === refId)
      if (!refEl) return
      const snap = computeSnapMove(
        { x: refStart.x + dx, y: refStart.y + dy, width: refEl.width, height: refEl.height },
        els.filter((el) => !groupSet.has(el.id)),
      )
      snapLinesRef.current = snap.lines
      const finalDx = dx + snap.dx, finalDy = dy + snap.dy
      for (const gid of groupIds) {
        const start = dragGroupStartRef.current.get(gid)
        if (start) update(gid, { x: start.x + finalDx, y: start.y + finalDy })
      }
      return
    }

    // Hover cursor (idle, single selection)
    if (tool === 'select' && selIds.length === 1 && selId) {
      const corner = hitTestCorner(e.clientX, e.clientY, selId, els, screenToPixel, zoomScaleRef.current)
      if (corner === 2) {
        setCursor('pointer')
      } else if (corner === 3) {
        setCursor(els.find((el) => el.id === selId)?.type === 'rectangle' ? 'grab' : 'default')
      } else if (corner === 1) {
        const el = els.find((el) => el.id === selId)
        const parent = el?.parentId ? els.find((p) => p.id === el.parentId) : null
        setCursor(el?.parentId && parent?.layoutDirection !== 'free' && parent?.layoutDirection !== undefined ? 'default' : 'nwse-resize')
      } else {
        setCursor('default')
      }
    }
  }, [screenToPixel])

  // ── handlePointerUp ──

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // End drag-select
    if (isDragSelectRef.current) {
      if (e.pointerId !== dragSelectPointerIdRef.current) return
      const start = dragSelectStartClientRef.current
      const hasMoved = Math.abs(e.clientX - start.x) > 4 || Math.abs(e.clientY - start.y) > 4
      const wasAddMode = dragSelectAddModeRef.current
      isDragSelectRef.current = false
      dragSelectPointerIdRef.current = -1
      dragSelectAddModeRef.current = false
      dragSelectHasMovedRef.current = false
      dragSelectPreSelectionRef.current = []
      setDragSelectBox(null)
      if (!hasMoved && !wasAddMode) useChoanStore.getState().setSelectedIds([])
      return
    }

    const { elements: els, selectedIds: selIds, reparentElement, runLayout } = useChoanStore.getState()
    const selId = selIds[0] ?? null

    // After draw-to-create
    if (isDrawingRef.current && drawElIdRef.current) {
      const drawId = drawElIdRef.current
      const el = els.find((el) => el.id === drawId)
      if (el) {
        if (el.width <= MIN_ELEMENT_SIZE && el.height <= MIN_ELEMENT_SIZE) {
          const size = DEFAULT_SIZE[el.type]
          const sx = drawStartPixelRef.current.x, sy = drawStartPixelRef.current.y
          useChoanStore.getState().updateElement(drawId, { x: sx - size.w / 2, y: sy - size.h / 2, width: size.w, height: size.h })
        }
        const freshEls = useChoanStore.getState().elements
        const freshEl = freshEls.find((el) => el.id === drawId)
        if (freshEl) {
          const parentId = detectContainment(freshEl, freshEls.filter((el) => el.role === 'container' && el.id !== drawId))
          if (parentId) reparentElement(drawId, parentId)
        }
      }
    }

    // After resize: run layout if container
    if (isResizingRef.current && resizeElIdRef.current) {
      const el = els.find((el) => el.id === resizeElIdRef.current)
      if (el?.role === 'container') runLayout(el.id)
    }

    // After drag: re-evaluate containment (single-element drag only)
    if (isDraggingRef.current && selIds.length === 1 && selId) {
      const el = els.find((el) => el.id === selId)
      if (el && el.role !== 'container') {
        const newParentId = detectContainment(el, els.filter((el) => el.role === 'container' && el.id !== selId))
        if (newParentId !== el.parentId) {
          const oldParentId = el.parentId
          reparentElement(selId, newParentId)
          if (oldParentId) runLayout(oldParentId)
        }
      }
    }

    // Auto-keyframe: record property changes when editing an animation bundle
    const { editingBundleId } = usePreviewStore.getState()
    if (editingBundleId) {
      const freshEls = useChoanStore.getState().elements
      if (isDraggingRef.current && selId) {
        const el = freshEls.find((el) => el.id === selId)
        const orig = dragGroupStartRef.current.get(selId)
        if (el && orig) {
          autoKeyframe(selId, 'x', el.x, orig.x)
          autoKeyframe(selId, 'y', el.y, orig.y)
        }
      }
      if (isResizingRef.current && resizeElIdRef.current) {
        const el = freshEls.find((el) => el.id === resizeElIdRef.current)
        if (el) {
          autoKeyframe(resizeElIdRef.current, 'x', el.x)
          autoKeyframe(resizeElIdRef.current, 'y', el.y)
          autoKeyframe(resizeElIdRef.current, 'width', el.width)
          autoKeyframe(resizeElIdRef.current, 'height', el.height)
        }
      }
      if (isRadiusDragRef.current && selId) {
        const el = freshEls.find((el) => el.id === selId)
        if (el) autoKeyframe(selId, 'radius', el.radius ?? 0, radiusStartRef.current)
      }
    }

    // Reset all state
    isDrawingRef.current = false
    drawElIdRef.current = null
    isResizingRef.current = false
    resizeElIdRef.current = null
    isDraggingRef.current = false
    dragGroupIdsRef.current = []
    dragGroupStartRef.current.clear()
    dragContainerIdRef.current = null
    isRadiusDragRef.current = false
    snapLinesRef.current = []
  }, [])

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    dragSelectBox,
    cursor,
    colorPickerOpenRef,
    colorPickerHoverRef,
    isDraggingRef,
    dragGroupIdsRef,
    isResizingRef,
    resizeElIdRef,
    isDrawingRef,
    drawElIdRef,
    snapLinesRef,
  }
}

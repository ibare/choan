// Pointer event handlers hook — owns all interaction refs and routes to sub-handlers.
// Returns handlers for the canvas element + refs needed by the rAF render loop.

import { useRef, useState, useCallback, useEffect, type MutableRefObject } from 'react'
import type { SDFRenderer } from '../engine/renderer'
import type { SnapLine } from '../utils/snapUtils'
import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import { autoKeyframe } from '../animation/autoKeyframe'
import { nanoid } from '../utils/nanoid'
import { kfAnimator } from '../rendering/kfAnimator'
import { raycastElement, hitTestCorner, hitTestLayoutHandle, hitTestSizingIndicator } from './hitTest'
import { resolveGroup } from './elementHelpers'
import type { ChoanElement } from '../store/useChoanStore'
import { worldToPixel as worldToPixelCS, pixelToWorld } from '../coords/coordinateSystem'
import { DEFAULT_LAYOUT_GAP, DEFAULT_LAYOUT_PADDING } from '../constants'
import { useRenderSettings } from '../store/useRenderSettings'
import { getCameraRayParams } from '../engine/camera'
import { screenToRay } from '../engine/sdf'
import { handleColorPickerClick, computeColorPickerHover } from './colorPickerHandlers'
import { SKIN_BY_ID } from '../config/skins'
import { track } from '../utils/analytics'
import { pushSnapshot } from '../store/history'
import { useDirectorStore } from '../store/useDirectorStore'
import { useSceneStore } from '../store/useSceneStore'
import { createDefaultDirectorTimeline } from '../animation/directorTypes'
import { hitTestCameraKeyframe, computeCameraKeyframeDragPosition } from './cameraPathHandlers'
import { handleDragMove, finalizeDrag } from './dragHandlers'
import { canShowZTunnel, hitTestRotationRing, hitTestTunnelFace, type TunnelHover } from '../rendering/zTunnelOverlay'
import { handleResizeMove, handleRadiusDragMove } from './resizeHandlers'
import { handleDrawMove, finalizeDrawn } from './drawHandlers'
import { handleDragSelectMove } from './dragSelectHandlers'

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
  tunnelHoverRef: MutableRefObject<TunnelHover>
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
  animatedElementsRef,
}: {
  rendererRef: MutableRefObject<SDFRenderer | null>
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>
  zoomScaleRef: MutableRefObject<number>
  mountRef: MutableRefObject<HTMLDivElement | null>
  animatedElementsRef: MutableRefObject<ChoanElement[]>
}): UsePointerHandlersResult {
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

  // ── Space key state (for panning passthrough to OrbitControls) ──
  const spaceDownRef = useRef(false)
  // ── Z key state (for Z-axis drag in Director mode) ──
  const zKeyDownRef = useRef(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = true
      if (e.code === 'KeyZ' && !e.metaKey && !e.ctrlKey) zKeyDownRef.current = true
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false
      if (e.code === 'KeyZ') zKeyDownRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // ── Interaction refs ──

  const colorPickerOpenRef = useRef(false)
  const colorPickerHoverRef = useRef(-1)
  const colorPickerAnchorRef = useRef<{ px: number; py: number } | null>(null)

  // Camera keyframe 3D drag refs
  const isDraggingCameraKfRef = useRef(false)
  const dragCameraKfIdRef = useRef<string | null>(null)
  const dragCameraKfOrigPosRef = useRef<[number, number, number]>([0, 0, 0])
  const dragCameraKfTypeRef = useRef<'position' | 'target'>('position')

  // Z-axis drag refs (Director mode)
  const isZDraggingRef = useRef(false)
  const zDragStartYRef = useRef(0)
  const zDragOriginalZRef = useRef(0)
  const tunnelHoverRef = useRef<TunnelHover>(null)

  // Rotation drag refs (Director mode)
  const isRotationDraggingRef = useRef(false)
  const rotationCenterScreenRef = useRef({ px: 0, py: 0 })
  const rotationOriginalRef = useRef(0)

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
  const resizeAxisRef = useRef<'x' | 'y' | null>(null)

  const isRadiusDragRef = useRef(false)
  const radiusStartRef = useRef(0)
  const radiusDragStartPixelRef = useRef({ x: 0, y: 0 })

  const isDrawingRef = useRef(false)
  const drawStartPixelRef = useRef({ x: 0, y: 0 })
  const drawElIdRef = useRef<string | null>(null)

  const isLayoutResizingRef = useRef(false)
  const layoutResizeContainerRef = useRef<string | null>(null)
  const layoutResizeIndexRef = useRef(-1)
  const layoutResizeStartRef = useRef(0)

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
    // Space + left-click is reserved for panning (handled by OrbitControls)
    if (spaceDownRef.current) return

    // ── Camera keyframe 3D drag (Director mode) ──
    const director = useDirectorStore.getState()
    if (director.directorMode && !director.directorPlaying) {
      const renderer = rendererRef.current
      if (renderer) {
        const scState = useSceneStore.getState()
        const actScene = scState.scenes.find((s) => s.id === scState.activeSceneId)
        const dirTl = actScene?.directorTimeline ?? createDefaultDirectorTimeline()
        if (dirTl.cameraKeyframes.length > 0) {
          const hit = hitTestCameraKeyframe(
            e.clientX, e.clientY,
            renderer.canvas.getBoundingClientRect(),
            renderer.overlay,
            dirTl.cameraKeyframes,
            16,
            e.altKey,
          )
          if (hit) {
            const kf = dirTl.cameraKeyframes.find((k) => k.id === hit.keyframeId)!
            isDraggingCameraKfRef.current = true
            dragCameraKfIdRef.current = hit.keyframeId
            dragCameraKfOrigPosRef.current = hit.type === 'position' ? [...kf.position] : [...kf.target]
            dragCameraKfTypeRef.current = hit.type
            useDirectorStore.getState().setSelectedCameraKeyframeId(hit.keyframeId)
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            return
          }
        }
      }

      // ── Z-axis drag (Director mode + tunnel face click) ──
      if (tunnelHoverRef.current) {
        const { selectedIds, elements: els } = useChoanStore.getState()
        if (selectedIds.length === 1) {
          const selEl = els.find((el) => el.id === selectedIds[0])
          if (selEl) {
            isZDraggingRef.current = true
            zDragStartYRef.current = e.clientY
            zDragOriginalZRef.current = selEl.z
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            return
          }
        }
      }

      // ── Rotation ring drag (Director mode + click near ring) ──
      {
        const { selectedIds, elements: els } = useChoanStore.getState()
        if (selectedIds.length === 1 && renderer) {
          const selEl = els.find((el) => el.id === selectedIds[0])
          if (selEl) {
            const dpr = window.devicePixelRatio || 1
            const rect = renderer.canvas.getBoundingClientRect()
            const canvasPx = (e.clientX - rect.left) * dpr
            const canvasPy = (e.clientY - rect.top) * dpr
            const { w, h } = canvasSizeRef.current
            const rs = useRenderSettings.getState()
            if (hitTestRotationRing(canvasPx, canvasPy, renderer.overlay, selEl, w, h, rs.extrudeDepth, 12 * dpr)) {
              const cxWorld = pixelToWorld(selEl.x + selEl.width / 2, selEl.y + selEl.height / 2, w, h)
              const elZ = selEl.z * rs.extrudeDepth + rs.extrudeDepth / 2
              const centerScreen = renderer.overlay.projectToScreen(cxWorld[0], cxWorld[1], elZ)
              isRotationDraggingRef.current = true
              rotationCenterScreenRef.current = centerScreen
              rotationOriginalRef.current = selEl.rotationY ?? 0
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              return
            }
          }
        }
      }
    }

    if (isDragSelectRef.current) {
      const originalPointerId = dragSelectPointerIdRef.current
      isDragSelectRef.current = false
      dragSelectHasMovedRef.current = false
      dragSelectAddModeRef.current = false
      dragSelectPointerIdRef.current = -1
      setDragSelectBox(null)
      if (originalPointerId !== -1 && e.pointerId !== originalPointerId) return
    }

    // Preview mode: trigger click animations
    if (usePreviewStore.getState().previewState === 'playing') {
      const renderer = rendererRef.current
      if (!renderer) return
      const hitId = raycastElement(e.clientX, e.clientY, renderer, canvasSizeRef.current, animatedElementsRef.current)
      if (hitId) {
        const { elements: els, animationBundles: bundles } = useChoanStore.getState()
        const el = els.find((el) => el.id === hitId)
        for (const trigger of el?.triggers ?? []) {
          if (trigger.event === 'click') {
            const bundle = bundles.find((b) => b.id === trigger.animationBundleId)
            if (bundle) for (const clip of bundle.clips) kfAnimator.start(clip, clip.id, performance.now())
          }
        }
      }
      return
    }

    // Color picker click (screen-space hit test)
    if (colorPickerOpenRef.current) {
      const renderer = rendererRef.current
      const { elements: els, selectedIds, updateElement: update } = useChoanStore.getState()
      const selId = selectedIds[0] ?? null
      const el = selId ? els.find((e) => e.id === selId) : null
      if (renderer && el && selId) {
        const dpr = window.devicePixelRatio || 1
        const rect = renderer.canvas.getBoundingClientRect()
        const mouseCanvas = { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr }
        let anchor: { px: number; py: number }
        if (colorPickerAnchorRef.current) {
          anchor = colorPickerAnchorRef.current
        } else {
          const { w, h } = canvasSizeRef.current
          const [awx, awy] = pixelToWorld(el.x + el.width, el.y, w, h)
          const rs = useRenderSettings.getState()
          const anchorZ = (el.z ?? 0) * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.01
          anchor = renderer.overlay.projectToScreen(awx, awy, anchorZ)
        }
        if (handleColorPickerClick(mouseCanvas, { x: anchor.px, y: anchor.py }, dpr, els, selId, e.altKey, update, renderer.colorWheel)) {
          colorPickerOpenRef.current = false
          colorPickerHoverRef.current = -1
          return
        }
      }
      colorPickerOpenRef.current = false
      colorPickerHoverRef.current = -1
      return
    }

    const { tool, selectedIds, elements: els, selectElement, toggleSelectElement, addElement, drawColor } = useChoanStore.getState()

    if (tool === 'select') {
      if (e.shiftKey) {
        const hitId = rendererRef.current ? raycastElement(e.clientX, e.clientY, rendererRef.current, canvasSizeRef.current, animatedElementsRef.current) : null
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

      const selId = selectedIds[0] ?? null
      if (selectedIds.length === 1 && selId) {
        // Sizing indicator click (TR corner of layout children)
        const sizingHit = hitTestSizingIndicator(e.clientX, e.clientY, selId, els, screenToPixel, zoomScaleRef.current)
        if (sizingHit) {
          const child = els.find((el) => el.id === sizingHit)
          if (child) {
            const current = child.layoutSizing ?? 'equal'
            const cycle: Array<'equal' | 'fill' | 'fixed-px'> = ['equal', 'fill', 'fixed-px']
            const mapped = current === 'fixed-ratio' ? 'fixed-px' : current
            const next = cycle[(cycle.indexOf(mapped) + 1) % cycle.length]
            const { updateElement, runLayout } = useChoanStore.getState()
            updateElement(sizingHit, { layoutSizing: next, layoutRatio: undefined })
            if (child.parentId) runLayout(child.parentId)
          }
          return
        }

        // Layout resize handle check (between children)
        const layoutHandle = hitTestLayoutHandle(e.clientX, e.clientY, selId, els, screenToPixel, zoomScaleRef.current)
        if (layoutHandle >= 0) {
          isLayoutResizingRef.current = true
          layoutResizeContainerRef.current = selId
          layoutResizeIndexRef.current = layoutHandle
          const pixel = screenToPixel(e.clientX, e.clientY)
          const selEl = els.find((el) => el.id === selId)
          layoutResizeStartRef.current = pixel ? (selEl?.layoutDirection === 'column' ? pixel.y : pixel.x) : 0
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          return
        }

        const corner = hitTestCorner(e.clientX, e.clientY, selId, els, screenToPixel, zoomScaleRef.current)
        if (corner >= 0) {
          const el = els.find((el) => el.id === selId)!
          const parentOfEl = el.parentId ? els.find((p) => p.id === el.parentId) : null
          const isManagedChild = el.parentId && parentOfEl?.layoutDirection !== 'free' && parentOfEl?.layoutDirection !== undefined
          if (!isManagedChild) {
            isResizingRef.current = true
            resizeElIdRef.current = el.id
            const pixel = screenToPixel(e.clientX, e.clientY)
            if (pixel) resizeStartPixelRef.current = pixel

            if (corner < 4) {
              // Corner handles (0-3): free resize
              const cp = [
                { x: el.x, y: el.y + el.height }, { x: el.x + el.width, y: el.y + el.height },
                { x: el.x + el.width, y: el.y }, { x: el.x, y: el.y },
              ]
              resizeCornerStartRef.current = cp[corner]
              resizeAnchorRef.current = cp[(corner + 2) % 4]
              resizeAxisRef.current = null
            } else {
              // Mid-edge handles (4=top, 5=right, 6=bottom, 7=left): axis-locked resize
              const edgeMap: Record<number, { corner: { x: number; y: number }; anchor: { x: number; y: number }; axis: 'x' | 'y' }> = {
                4: { corner: { x: el.x + el.width, y: el.y },           anchor: { x: el.x, y: el.y + el.height },             axis: 'y' },
                5: { corner: { x: el.x + el.width, y: el.y + el.height }, anchor: { x: el.x, y: el.y },                       axis: 'x' },
                6: { corner: { x: el.x + el.width, y: el.y + el.height }, anchor: { x: el.x, y: el.y },                       axis: 'y' },
                7: { corner: { x: el.x, y: el.y + el.height },           anchor: { x: el.x + el.width, y: el.y },             axis: 'x' },
              }
              const cfg = edgeMap[corner]
              resizeCornerStartRef.current = cfg.corner
              resizeAnchorRef.current = cfg.anchor
              resizeAxisRef.current = cfg.axis
            }

            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            return
          }
        }
      }

      const hitId = rendererRef.current ? raycastElement(e.clientX, e.clientY, rendererRef.current, canvasSizeRef.current, animatedElementsRef.current) : null
      if (hitId) {
        const freshEls = useChoanStore.getState().elements
        const animEls = animatedElementsRef.current
        const currentSelectedIds = useChoanStore.getState().selectedIds
        const pixel = screenToPixel(e.clientX, e.clientY)
        const startMap = new Map<string, { x: number; y: number }>()
        if (currentSelectedIds.includes(hitId)) {
          // Resolve group to include children even when already selected
          const groupIds = resolveGroup(freshEls, hitId)
          if (pixel) dragStartPixelRef.current = pixel
          for (const gid of groupIds) {
            const ge = animEls.find((el) => el.id === gid)
            if (ge) startMap.set(gid, { x: ge.x, y: ge.y })
          }
          isDraggingRef.current = true
          dragGroupIdsRef.current = groupIds
          dragGroupStartRef.current = startMap
          dragContainerIdRef.current = null
        } else {
          selectElement(hitId)
          const groupIds = resolveGroup(freshEls, hitId)
          if (pixel) dragStartPixelRef.current = pixel
          for (const gid of groupIds) {
            const ge = animEls.find((el) => el.id === gid)
            if (ge) startMap.set(gid, { x: ge.x, y: ge.y })
          }
          isDraggingRef.current = true
          dragGroupIdsRef.current = groupIds
          dragGroupStartRef.current = startMap
          const el = freshEls.find((el) => el.id === hitId)!
          dragContainerIdRef.current =
            el.role === 'container' && groupIds.includes(el.id) ? el.id
            : el.parentId && groupIds.includes(el.parentId) ? el.parentId
            : null
        }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      } else {
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
    const storeState = useChoanStore.getState() as Record<string, unknown>
    const pendingSkin = storeState.pendingSkin as string | null
    const pendingFrame = storeState.pendingFrame as string | null

    // Frame/skin props — always start at width:1, height:1 (consistent with rect)
    const frameExtra: Partial<ChoanElement> = {}
    if (pendingFrame === 'browser' || pendingFrame === 'mobile') {
      frameExtra.frame = pendingFrame
      frameExtra.safeInset = pendingFrame === 'browser'
        ? { top: 14, bottom: 0, left: 0, right: 0 }
        : { top: 20, bottom: 10, left: 0, right: 0 }
    }

    const newEl: ChoanElement = {
      id, type: tool as ChoanElement['type'],
      label: pendingFrame
        ? (pendingFrame === 'browser' ? 'Browser' : 'Mobile')
        : pendingSkin
          ? (SKIN_BY_ID.get(pendingSkin)?.label ?? pendingSkin)
          : (tool === 'rectangle' ? 'Rect' : tool === 'circle' ? 'Circle' : 'Line'),
      role: tool === 'rectangle' ? 'container' : undefined,
      color: drawColor, x: pixel.x, y: pixel.y, z: 0, width: 1, height: 1,
      ...(pendingSkin ? { skin: pendingSkin, skinOnly: true, componentState: pendingSkin === 'image' ? { seed: Math.floor(Math.random() * 9999) } : undefined } : {}),
      ...frameExtra,
    }
    addElement(newEl)
    track('create-element', { type: newEl.type, skin: newEl.skin ?? 'none', frame: newEl.frame ?? 'none' })
    selectElement(id)
    isDrawingRef.current = true
    drawElIdRef.current = id
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [screenToPixel])

  // ── handlePointerMove ──

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // ── Camera keyframe drag ──
    if (isDraggingCameraKfRef.current && dragCameraKfIdRef.current) {
      const { w, h } = canvasSizeRef.current
      const renderer = rendererRef.current
      const rect = renderer?.canvas.getBoundingClientRect()
      const canvasX = rect ? e.clientX - rect.left : e.clientX
      const canvasY = rect ? e.clientY - rect.top : e.clientY
      const newPos = computeCameraKeyframeDragPosition(
        canvasX, canvasY, w, h,
        dragCameraKfOrigPosRef.current, e.shiftKey,
      )
      const patch = dragCameraKfTypeRef.current === 'position'
        ? { position: newPos as [number, number, number] }
        : { target: newPos as [number, number, number] }
      useDirectorStore.getState().updateCameraKeyframe(dragCameraKfIdRef.current, patch)
      return
    }

    // ── Z-axis drag ──
    if (isZDraggingRef.current) {
      const dy = e.clientY - zDragStartYRef.current
      const zSpeed = 0.30
      const zDelta = dy * zSpeed  // drag down = Z+ (forward), drag up = Z- (backward)
      const { selectedIds, updateElement } = useChoanStore.getState()
      if (selectedIds.length === 1) {
        updateElement(selectedIds[0], { z: zDragOriginalZRef.current + zDelta })
      }
      return
    }

    // ── Rotation drag ──
    if (isRotationDraggingRef.current) {
      const dpr = window.devicePixelRatio || 1
      const renderer = rendererRef.current
      const rect = renderer?.canvas.getBoundingClientRect()
      if (rect) {
        const canvasPx = (e.clientX - rect.left) * dpr
        const canvasPy = (e.clientY - rect.top) * dpr
        const center = rotationCenterScreenRef.current
        const angle = Math.atan2(canvasPy - center.py, canvasPx - center.px)
        const { selectedIds, updateElement } = useChoanStore.getState()
        if (selectedIds.length === 1) {
          updateElement(selectedIds[0], { rotationY: angle })
        }
      }
      return
    }

    const { elements: els, selectedIds: selIds, updateElement: update } = useChoanStore.getState()
    const selId = selIds[0] ?? null
    const setSnap = (lines: SnapLine[]) => { snapLinesRef.current = lines }

    if (colorPickerOpenRef.current && selId) {
      const renderer = rendererRef.current
      const el = els.find((ee) => ee.id === selId)
      if (renderer && el) {
        const dpr = window.devicePixelRatio || 1
        const rect = renderer.canvas.getBoundingClientRect()
        const mouseCanvas = { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr }
        let anchor: { px: number; py: number }
        if (colorPickerAnchorRef.current) {
          anchor = colorPickerAnchorRef.current
        } else {
          const { w, h } = canvasSizeRef.current
          const [awx, awy] = pixelToWorld(el.x + el.width, el.y, w, h)
          const rs = useRenderSettings.getState()
          const anchorZ = (el.z ?? 0) * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.01
          anchor = renderer.overlay.projectToScreen(awx, awy, anchorZ)
        }
        const hover = computeColorPickerHover(mouseCanvas, { x: anchor.px, y: anchor.py }, dpr, renderer.colorWheel)
        colorPickerHoverRef.current = hover
        setCursor(hover >= 0 ? 'pointer' : 'default')
      }
      return
    }

    if (isLayoutResizingRef.current && layoutResizeContainerRef.current) {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (pixel) {
        const cId = layoutResizeContainerRef.current
        const container = els.find((el) => el.id === cId)
        const children = els.filter((el) => el.parentId === cId)
        const idx = layoutResizeIndexRef.current
        if (container && idx >= 0 && idx < children.length - 1) {
          const isRow = container.layoutDirection === 'row'
          const current = isRow ? pixel.x : pixel.y
          const delta = current - layoutResizeStartRef.current
          layoutResizeStartRef.current = current

          // Calculate total inner size for ratio
          const pad = container.layoutPadding ?? DEFAULT_LAYOUT_PADDING
          const totalInner = (isRow ? container.width : container.height) - 2 * pad
            - (children.length - 1) * (container.layoutGap ?? DEFAULT_LAYOUT_GAP)

          // Direct: the dragged child gets fixed-ratio
          const a = children[idx]
          const aSize = isRow ? a.width : a.height
          const newASize = Math.max(10, aSize + delta)
          const newRatio = Math.max(0.01, Math.min(0.95, newASize / totalInner))
          update(a.id, { layoutSizing: 'fixed-ratio', layoutRatio: newRatio })

          // Indirect: all others stay as they are (equal remains equal)
          useChoanStore.getState().runLayout(cId)
        }
      }
      return
    }

    if (isDragSelectRef.current) {
      const mountRect = mountRef.current?.getBoundingClientRect()
      const currPixel = screenToPixel(e.clientX, e.clientY)
      if (mountRect && currPixel) {
        const result = handleDragSelectMove(
          e.clientX, e.clientY,
          dragSelectStartClientRef.current.x, dragSelectStartClientRef.current.y,
          mountRect, currPixel, dragSelectStartPixelRef.current,
          els, dragSelectPreSelectionRef.current, dragSelectAddModeRef.current,
        )
        if (result.hasMoved) dragSelectHasMovedRef.current = true
        setDragSelectBox(result.box)
        useChoanStore.getState().setSelectedIds(result.selectedIds)
      }
      return
    }

    if (isDrawingRef.current && drawElIdRef.current) {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (pixel) handleDrawMove(pixel, drawStartPixelRef.current, drawElIdRef.current, update, els)
      return
    }

    if (isRadiusDragRef.current && selId) {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (pixel) handleRadiusDragMove(pixel, radiusDragStartPixelRef.current, radiusStartRef.current, els, selId, e.altKey, update)
      return
    }

    if (isResizingRef.current && resizeElIdRef.current) {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (pixel) handleResizeMove(pixel, resizeStartPixelRef.current, resizeCornerStartRef.current, resizeAnchorRef.current, els, resizeElIdRef.current, e.altKey, update, setSnap, resizeAxisRef.current)
      return
    }

    const { tool } = useChoanStore.getState()
    if (isDraggingRef.current && tool === 'select') {
      const pixel = screenToPixel(e.clientX, e.clientY)
      if (pixel) handleDragMove(pixel, dragStartPixelRef.current, dragGroupIdsRef.current, dragGroupStartRef.current, dragContainerIdRef.current, els, update, setSnap)
      return
    }

    // ── Tunnel face hover (Director mode) ──
    const dirMoveState = useDirectorStore.getState()
    if (dirMoveState.directorMode && !dirMoveState.directorPlaying && selIds.length === 1 && selId) {
      const renderer = rendererRef.current
      const selEl = els.find((el) => el.id === selId)
      if (renderer && selEl) {
        const dpr = window.devicePixelRatio || 1
        const rect = renderer.canvas.getBoundingClientRect()
        const cpx = (e.clientX - rect.left) * dpr
        const cpy = (e.clientY - rect.top) * dpr
        const { w, h } = canvasSizeRef.current
        const cam = renderer.camera
        const dx = cam.position[0] - cam.target[0]
        const dy = cam.position[1] - cam.target[1]
        const dz = cam.position[2] - cam.target[2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const phi = Math.acos(dy / dist)
        const theta = Math.atan2(dx, dz)
        if (canShowZTunnel(phi, theta)) {
          const rs = useRenderSettings.getState()
          tunnelHoverRef.current = hitTestTunnelFace(cpx, cpy, renderer.overlay, selEl, w, h, rs.extrudeDepth)
        } else {
          tunnelHoverRef.current = null
        }
      }
    } else {
      tunnelHoverRef.current = null
    }

    // Hover cursor
    if (tool === 'select' && selIds.length === 1 && selId) {
      const corner = hitTestCorner(e.clientX, e.clientY, selId, els, screenToPixel, zoomScaleRef.current)
      if (corner >= 0) {
        const el = els.find((el) => el.id === selId)
        const parent = el?.parentId ? els.find((p) => p.id === el.parentId) : null
        const isManagedChild = el?.parentId && parent?.layoutDirection !== 'free' && parent?.layoutDirection !== undefined
        // Corners: BL(0)/TR(2) = nesw, BR(1)/TL(3) = nwse
        // Mid-edges: top(4)/bottom(6) = ns, right(5)/left(7) = ew
        const cursorMap = ['nesw-resize', 'nwse-resize', 'nesw-resize', 'nwse-resize', 'ns-resize', 'ew-resize', 'ns-resize', 'ew-resize'] as const
        setCursor(isManagedChild ? 'default' : cursorMap[corner])
      } else {
        setCursor('default')
      }
    }
  }, [screenToPixel])

  // ── handlePointerUp ──

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // ── Camera keyframe drag cleanup ──
    if (isDraggingCameraKfRef.current) {
      isDraggingCameraKfRef.current = false
      dragCameraKfIdRef.current = null
      pushSnapshot()
      return
    }

    // ── Z-axis drag cleanup ──
    if (isZDraggingRef.current) {
      isZDraggingRef.current = false
      pushSnapshot()
      return
    }

    // ── Rotation drag cleanup ──
    if (isRotationDraggingRef.current) {
      isRotationDraggingRef.current = false
      pushSnapshot()
      return
    }

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

    const { elements: els, selectedIds: selIds, reparentElement, runLayout, updateElement: update } = useChoanStore.getState()

    if (isDrawingRef.current && drawElIdRef.current) {
      finalizeDrawn(drawElIdRef.current, drawStartPixelRef.current, () => useChoanStore.getState().elements, update, reparentElement)
    }

    if (isResizingRef.current && resizeElIdRef.current) {
      const el = els.find((el) => el.id === resizeElIdRef.current)
      if (el?.role === 'container') runLayout(el.id)
    }

    if (isDraggingRef.current && selIds.length === 1 && selIds[0]) {
      finalizeDrag(selIds[0], selIds, els, reparentElement, runLayout)
    }

    // Auto-keyframe when editing a bundle — use animated (scrub) coordinates
    const { editingBundleId } = usePreviewStore.getState()
    if (editingBundleId) {
      const animEls = animatedElementsRef.current
      const selId = selIds[0] ?? null
      if (isDraggingRef.current && selId) {
        const orig = dragGroupStartRef.current.get(selId)
        if (orig) {
          const endPixel = screenToPixel(e.clientX, e.clientY)
          const startPixel = dragStartPixelRef.current
          const hasMoved = endPixel && (Math.abs(endPixel.x - startPixel.x) > 2 || Math.abs(endPixel.y - startPixel.y) > 2)
          if (hasMoved) {
            const el = animEls.find((el) => el.id === selId)
            if (el) { autoKeyframe(selId, 'x', el.x, orig.x); autoKeyframe(selId, 'y', el.y, orig.y) }
          } else {
            // Click only — keyframe at current scrub position (no jump)
            autoKeyframe(selId, 'x', orig.x, orig.x)
            autoKeyframe(selId, 'y', orig.y, orig.y)
          }
        }
      }
      if (isResizingRef.current && resizeElIdRef.current) {
        const el = animEls.find((el) => el.id === resizeElIdRef.current)
        if (el) {
          autoKeyframe(resizeElIdRef.current, 'x', el.x)
          autoKeyframe(resizeElIdRef.current, 'y', el.y)
          autoKeyframe(resizeElIdRef.current, 'width', el.width)
          autoKeyframe(resizeElIdRef.current, 'height', el.height)
        }
      }
      if (isRadiusDragRef.current && selId) {
        const el = animEls.find((el) => el.id === selId)
        if (el) autoKeyframe(selId, 'radius', el.radius ?? 0, radiusStartRef.current)
      }
    }

    // Snapshot for undo after any meaningful interaction
    if (isDrawingRef.current || isResizingRef.current || isDraggingRef.current || isRadiusDragRef.current) {
      pushSnapshot()
    }

    isDrawingRef.current = false; drawElIdRef.current = null
    isResizingRef.current = false; resizeElIdRef.current = null
    isDraggingRef.current = false; dragGroupIdsRef.current = []; dragGroupStartRef.current.clear(); dragContainerIdRef.current = null
    isRadiusDragRef.current = false
    isLayoutResizingRef.current = false; layoutResizeContainerRef.current = null; layoutResizeIndexRef.current = -1
    snapLinesRef.current = []
  }, [])

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    dragSelectBox, cursor,
    colorPickerOpenRef, colorPickerHoverRef,
    isDraggingRef, dragGroupIdsRef,
    isResizingRef, resizeElIdRef,
    isDrawingRef, drawElIdRef,
    snapLinesRef,
    tunnelHoverRef,
  }
}

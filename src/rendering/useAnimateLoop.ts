// Animation loop hook — owns the rAF loop, layout animator, and kfAnimator lifecycle.
//
// Replaces the large useEffect in SDFCanvas. Returns nothing; all updates are
// written to the renderer and stores as side effects each frame.

import { useEffect, type MutableRefObject } from 'react'
import type { SDFRenderer } from '../engine/renderer'
import type { OrbitControls } from '../engine/controls'
import type { SceneManager } from '../engine/sceneManager'
import type { SnapLine, DistanceMeasure } from '../utils/snapUtils'
import { useChoanStore, type ChoanElement } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { useSceneStore } from '../store/useSceneStore'
import { evaluateAnimation } from '../animation/animationEvaluator'
import { addGhostElements } from './ghostPreview'
import { applyMultiSelectTint } from './multiSelectTint'
import { drawOverlay } from './overlayCommands'
import { kfAnimator } from './kfAnimator'
import { createLayoutAnimator } from '../layout/animator'
import { paintComponent, type StrokeStyle } from '../engine/painters'
import { hoveredHistoryColor } from '../utils/colorHistoryHover'
import { tickExportAnim, getExportAnim, phaseProgress } from '../animation/exportAnimation'
import { useDirectorStore } from '../store/useDirectorStore'
import { evaluateDirectorCamera } from '../animation/directorCameraEvaluator'
import { evaluateDirectorEvents } from '../animation/directorEventEvaluator'
import { evaluateDirectorFrame } from '../animation/directorAnimationEvaluator'
import { createDefaultDirectorTimeline } from '../animation/directorTypes'
import { drawCameraPathOverlay, drawDirectorCameraSetup } from './cameraPathOverlay'
import { buildViewProjMatrix } from '../engine/camera'
import { drawZTunnelOverlay, drawRotationRing, drawGroundGrid, drawCameraFootprint, canShowZTunnel, drawCameraAxisHandles, type AxisHover } from './zTunnelOverlay'
import { pixelToWorld } from '../coords/coordinateSystem'

export function useAnimateLoop({
  rendererRef,
  controlsRef,
  sceneManagerRef,
  canvasSizeRef,
  zoomScaleRef,
  distMeasuresRef,
  isDraggingRef,
  dragGroupIdsRef,
  isResizingRef,
  resizeElIdRef,
  isDrawingRef,
  drawElIdRef,
  snapLinesRef,
  colorPickerOpenRef,
  colorPickerHoverRef,
  animatedElementsRef,
  splitModeRef,
  tunnelHoverRef,
}: {
  rendererRef: MutableRefObject<SDFRenderer | null>
  controlsRef: MutableRefObject<OrbitControls | null>
  sceneManagerRef: MutableRefObject<SceneManager | null>
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>
  zoomScaleRef: MutableRefObject<number>
  distMeasuresRef: MutableRefObject<(DistanceMeasure | null)[]>
  isDraggingRef: MutableRefObject<boolean>
  dragGroupIdsRef: MutableRefObject<string[]>
  isResizingRef: MutableRefObject<boolean>
  resizeElIdRef: MutableRefObject<string | null>
  isDrawingRef: MutableRefObject<boolean>
  drawElIdRef: MutableRefObject<string | null>
  snapLinesRef: MutableRefObject<SnapLine[]>
  colorPickerOpenRef: MutableRefObject<boolean>
  colorPickerHoverRef: MutableRefObject<number>
  animatedElementsRef: MutableRefObject<ChoanElement[]>
  splitModeRef: MutableRefObject<{ active: boolean; count: number; elementId: string; direction: 'horizontal' | 'vertical' }>
  tunnelHoverRef: MutableRefObject<AxisHover>
}): void {
  useEffect(() => {
    kfAnimator.onComplete = (elementId, finalValues) => {
      useChoanStore.getState().updateElement(elementId, finalValues)
    }

    const animator = createLayoutAnimator()
    const atlasDirty = new Map<string, string>() // id → stateKey for dirty tracking
    let frameId = 0

    // Q key: frustum spotlight toggle
    const onQDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ' && !e.repeat) useDirectorStore.getState().toggleFrustumSpotlight()
    }
    window.addEventListener('keydown', onQDown)

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const renderer = rendererRef.current
      if (!renderer) return

      controlsRef.current?.update()

      const cam = renderer.camera
      const state = useChoanStore.getState()
      const preview = usePreviewStore.getState()

      // ── Director mode playback ──
      const director = useDirectorStore.getState()
      if (director.directorMode && director.directorPlaying) {
        // Advance playhead
        const elapsed = performance.now() - director.playStartTime
        const sceneState = useSceneStore.getState()
        const activeScene = sceneState.scenes.find((s) => s.id === sceneState.activeSceneId)
        const sceneDuration = activeScene?.duration ?? 3000
        const dt = activeScene?.directorTimeline ?? createDefaultDirectorTimeline()

        if (elapsed >= sceneDuration) {
          useDirectorStore.getState().stopPlaying()
          useDirectorStore.getState().setDirectorPlayheadTime(sceneDuration)
        } else {
          useDirectorStore.getState().setDirectorPlayheadTime(elapsed)

          // Camera interpolation
          const camState = evaluateDirectorCamera(dt.cameraKeyframes, elapsed)
          if (camState) {
            cam.position[0] = camState.position[0]
            cam.position[1] = camState.position[1]
            cam.position[2] = camState.position[2]
            cam.target[0] = camState.target[0]
            cam.target[1] = camState.target[1]
            cam.target[2] = camState.target[2]
            cam.fov = camState.fov
          }

          // Event evaluation
          const activeEvents = evaluateDirectorEvents(dt.eventMarkers, elapsed, state.animationBundles)
          if (activeEvents.length > 0) {
            const animated = evaluateDirectorFrame(state.elements, activeEvents)
            animatedElementsRef.current = animated
          }
        }

        if (controlsRef.current) controlsRef.current.disabled = true
      } else {
        if (controlsRef.current) controlsRef.current.disabled = false
      }

      const cdx = cam.position[0] - cam.target[0]
      const cdy = cam.position[1] - cam.target[1]
      const cdz = cam.position[2] - cam.target[2]
      zoomScaleRef.current = Math.sqrt(cdx * cdx + cdy * cdy + cdz * cdz) / 20
      const rs = useRenderSettings.getState()

      const manipulatedIds = new Set<string>()
      if (isDraggingRef.current) for (const id of dragGroupIdsRef.current) manipulatedIds.add(id)
      if (isResizingRef.current && resizeElIdRef.current) manipulatedIds.add(resizeElIdRef.current)
      if (isDrawingRef.current && drawElIdRef.current) manipulatedIds.add(drawElIdRef.current)

      let animatedElements = evaluateAnimation({
        elements: state.elements, previewState: preview.previewState,
        editingBundleId: preview.editingBundleId, playheadTime: preview.playheadTime,
        animationBundles: state.animationBundles, kfAnimator, layoutAnimator: animator,
        springParams: { stiffness: rs.springStiffness, damping: rs.springDamping, squashIntensity: rs.squashIntensity },
        manipulatedIds,
      })

      animatedElementsRef.current = animatedElements

      if (preview.ghostPreview && preview.editingBundleId && preview.previewState === 'stopped') {
        const bundle = state.animationBundles.find((b) => b.id === preview.editingBundleId)
        if (bundle) animatedElements = addGhostElements(animatedElements, state.elements, bundle, preview.playheadTime)
      }

      // Paint component textures into atlas (rebuild when any component is dirty)
      const dpr = window.devicePixelRatio || 1
      const ec = rs.edgeColor
      const strokeStyle: StrokeStyle = {
        color: `rgb(${Math.round(ec[0] * 255)},${Math.round(ec[1] * 255)},${Math.round(ec[2] * 255)})`,
        width: rs.outlineWidth * 0.5,
      }
      // Include both skin and frame elements for atlas painting
      const skinnedEls = animatedElements.filter((el) => !!el.skin || !!el.frame)
      const getSkinKey = (el: ChoanElement) => el.frame ? `${el.frame}-frame` : el.skin!

      // Fast hash — avoids JSON.stringify per frame
      const hashState = (el: ChoanElement) => {
        const cs = el.componentState
        if (!cs) return ''
        let h = ''
        for (const k in cs) h += k + ':' + (cs as Record<string, unknown>)[k] + '|'
        return h
      }
      const makeKey = (el: ChoanElement, texW: number, texH: number) =>
        `${getSkinKey(el)}:${texW}x${texH}:${strokeStyle.color}:${strokeStyle.width}:${el.color}:${hashState(el)}`

      const skinnedIds = new Set(skinnedEls.map((el) => el.id))
      let atlasNeedsRebuild = false
      for (const id of atlasDirty.keys()) {
        if (!skinnedIds.has(id)) { atlasNeedsRebuild = true; break }
      }
      if (!atlasNeedsRebuild) {
        for (const el of skinnedEls) {
          const texScale = el.frame ? 2 : dpr
          const texW = Math.round(el.width * texScale)
          const texH = Math.round(el.height * texScale)
          if (atlasDirty.get(el.id) !== makeKey(el, texW, texH)) { atlasNeedsRebuild = true; break }
        }
      }
      if (atlasNeedsRebuild) {
        renderer.atlas.reset()
        atlasDirty.clear()
        const sharedRegions = new Map<string, string>()
        for (const el of skinnedEls) {
          const texScale = el.frame ? 2 : dpr
          const texW = Math.round(el.width * texScale)
          const texH = Math.round(el.height * texScale)
          if (texW < 1 || texH < 1) continue
          const stateKey = makeKey(el, texW, texH)
          const existingId = sharedRegions.get(stateKey)
          if (existingId) {
            renderer.atlas.alias(el.id, existingId)
          } else {
            const region = renderer.atlas.allocate(el.id, texW, texH)
            if (region) {
              const ctx = renderer.atlas.getContext(region)
              paintComponent(getSkinKey(el), ctx, texW, texH, { ...el.componentState, _elColor: el.color }, strokeStyle)
              sharedRegions.set(stateKey, el.id)
            }
          }
          atlasDirty.set(el.id, stateKey)
        }
      }

      // Repaint playing image elements each frame with current time (no full atlas rebuild)
      const now = performance.now()
      for (const el of skinnedEls) {
        if (el.skin !== 'image' || !el.componentState?.playing) continue
        const region = renderer.atlas.getRegion(el.id)
        if (!region) continue
        const actx = renderer.atlas.getContext(region)
        paintComponent(getSkinKey(el), actx, region.w, region.h, { ...el.componentState, _elColor: el.color }, strokeStyle, now)
      }

      // Export animation: tick phase + compute smoothK
      tickExportAnim()
      const exportAnim = getExportAnim()
      let smoothK = 0
      if (exportAnim.phase === 'merging') {
        smoothK = phaseProgress() * 3.0  // 0 → 3.0
      } else if (exportAnim.phase === 'blob') {
        // Wobbly blob: layered sine oscillation
        const t = performance.now() / 1000
        smoothK = 3.0 + Math.sin(t * 2.2) * 0.3 + Math.sin(t * 3.7) * 0.15
      } else if (exportAnim.phase === 'restoring') {
        smoothK = 3.0 * (1 - phaseProgress())  // 3.0 → 0
      }
      renderer.setSmoothK(smoothK)

      renderer.updateScene(applyMultiSelectTint(animatedElements, state.selectedIds), rs.extrudeDepth, hoveredHistoryColor)

      // Pre-compute director camera viewProj for frustum mask (Q key toggle)
      let dirCamStateForMask: Float32Array | null = null
      const dirForMask = useDirectorStore.getState()
      if (dirForMask.frustumSpotlightOn && dirForMask.directorMode && !dirForMask.directorPlaying) {
        {
          const camPos = dirForMask.directorCameraPos
          const camTgt = dirForMask.directorTargetPos
          if (camPos && camTgt) {
            const focalMm = dirForMask.focalLengthMm
            const fovMask = 2 * Math.atan(36 / (2 * focalMm)) * (180 / Math.PI)
            const [vfaw, vfah] = dirForMask.viewfinderAspect.split(':').map(Number)
            dirCamStateForMask = buildViewProjMatrix(
              camPos, camTgt, [0, 1, 0],
              fovMask, vfaw / vfah, 0.1, 500,
            )
          }
        }
      }

      // ── Scene transition rendering ──
      const transitionState = useSceneStore.getState().transitionState
      const sceneMgr = sceneManagerRef.current

      if (transitionState && sceneMgr) {
        const elapsed = performance.now() - transitionState.startTime
        const duration = transitionState.transition.duration
        const progress = Math.min(1, elapsed / duration)

        renderer.applyPendingResize()
        renderer.renderPipeline(rs)

        // Composite snapshot (from) + live resolveTex (to) via transition shader
        sceneMgr.renderTransition(
          renderer.getResolveTex(),
          progress,
          renderer.canvas.width,
          renderer.canvas.height,
        )

        // Overlay on top of transition
        renderer.blitAndOverlay()

        if (progress >= 1) {
          useSceneStore.getState().endTransition()
        }
      } else {
        // Q key: frustum spotlight — darken pixels outside director camera frustum
        if (dirForMask.frustumSpotlightOn && dirCamStateForMask) {
          renderer.applyPendingResize()
          renderer.renderPipeline(rs)
          renderer.applyFrustumMask(dirCamStateForMask)
          renderer.blitAndOverlay()
        } else {
          renderer.render(rs)
        }
      }

      drawOverlay(
        renderer.overlay,
        state.selectedIds,
        state.elements,
        snapLinesRef.current,
        distMeasuresRef.current,
        colorPickerOpenRef.current,
        colorPickerHoverRef.current,
        canvasSizeRef.current,
        zoomScaleRef.current,
        rs,
        splitModeRef.current,
        renderer.colorWheel,
      )

      // ── Director mode overlays (not playing) ──
      const dirState = useDirectorStore.getState()
      if (dirState.directorMode && !dirState.directorPlaying) {
        // Ground grid for spatial orientation
        drawGroundGrid(renderer.overlay)

        // Z tunnel guide overlay (single selection only)
        if (state.selectedIds.length === 1) {
          const selEl = state.elements.find((e) => e.id === state.selectedIds[0])
          const angles = controlsRef.current?.getAngles()
          if (selEl && angles && canShowZTunnel(angles.phi, angles.theta)) {
            drawZTunnelOverlay(renderer.overlay, selEl, canvasSizeRef.current.w, canvasSizeRef.current.h, rs.extrudeDepth, tunnelHoverRef.current)
          }
          // Rotation ring (always shown in Director mode when element selected)
          if (selEl) {
            const dprRing = window.devicePixelRatio || 1
            drawRotationRing(renderer.overlay, selEl, canvasSizeRef.current.w, canvasSizeRef.current.h, rs.extrudeDepth, dprRing)
          }
        }

        // ── Update target position if attached to an element ──
        if (dirState.directorTargetAttachedTo) {
          const el = state.elements.find((e) => e.id === dirState.directorTargetAttachedTo)
          if (el) {
            const { w: cw, h: ch } = canvasSizeRef.current
            const [wx, wy] = pixelToWorld(el.x + el.width / 2, el.y + el.height / 2, cw, ch)
            const rs2 = useRenderSettings.getState()
            const wz = el.z * rs2.extrudeDepth + rs2.extrudeDepth / 2
            useDirectorStore.getState().setDirectorTargetPos([wx, wy, wz])
          }
        }

        // ── Director camera object + rails overlay ──
        const dpr = window.devicePixelRatio || 1
        const focalMm = dirState.focalLengthMm
        const dirFov = 2 * Math.atan(36 / (2 * focalMm)) * (180 / Math.PI)
        const [vfaw, vfah] = dirState.viewfinderAspect.split(':').map(Number)

        // Camera frustum footprint on Z=0 ground plane
        drawCameraFootprint(
          renderer.overlay,
          dirState.directorCameraPos, dirState.directorTargetPos,
          dirFov, vfaw / vfah,
          false,
        )

        // Camera icon + target marker + rails
        drawDirectorCameraSetup(
          renderer.overlay,
          dirState.directorCameraPos,
          dirState.directorTargetPos,
          dirState.directorRails,
          dirState.railWorldAnchor,
          dirState.directorCameraSelected,
          dirState.directorTargetAttachedTo !== null,
          dirFov,
          dpr,
        )

        // Camera axis move handles — only for non-extended axes
        // Extended axes use the rail slider instead of tunnels
        if (dirState.directorCameraSelected) {
          const r = dirState.directorRails
          const stub = 0.501  // RAIL_MIN_STUB + epsilon
          const tunnelAxes: ('x' | 'y' | 'z')[] = []
          if (r.truck.neg < stub && r.truck.pos < stub) tunnelAxes.push('x')
          if (r.boom.neg  < stub && r.boom.pos  < stub) tunnelAxes.push('y')
          if (r.dolly.neg < stub && r.dolly.pos < stub) tunnelAxes.push('z')
          if (tunnelAxes.length > 0) {
            drawCameraAxisHandles(
              renderer.overlay,
              dirState.directorCameraPos,
              tunnelAxes,
              dirState.directorCameraAxisHover,
            )
          }
        }

        // Legacy keyframe path overlay (kept for playback preview)
        const scState = useSceneStore.getState()
        const actScene = scState.scenes.find((s) => s.id === scState.activeSceneId)
        const dirTl = actScene?.directorTimeline ?? createDefaultDirectorTimeline()
        if (dirTl.cameraKeyframes.length >= 1) {
          const curCamState = evaluateDirectorCamera(dirTl.cameraKeyframes, dirState.directorPlayheadTime)
          drawCameraPathOverlay(
            renderer.overlay,
            dirTl.cameraKeyframes,
            curCamState,
            dirState.selectedCameraKeyframeId ?? null,
            0.5,
            dpr,
          )
        }
      }
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      kfAnimator.stopAll()
      window.removeEventListener('keydown', onQDown)
    }
  }, [])
}

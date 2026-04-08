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
import type { ActiveBundleInput } from '../animation/animationEvaluator'
import { createDefaultDirectorTimeline, hasActiveRailTiming } from '../animation/directorTypes'
import { findCameraDerivedPose } from '../animation/cameraTimeTrack'
import { drawCameraPathOverlay, drawCameraMarks, drawDirectorCameraSetup, type RailTimeLabel } from './cameraPathOverlay'
import { buildViewProjMatrix } from '../engine/camera'
import { drawZTunnelOverlay, drawRotationRing, drawGroundGrid, drawCameraFootprint, canShowZTunnel, drawCameraAxisHandles, type AxisHover } from './zTunnelOverlay'
import { pixelToWorld } from '../coords/coordinateSystem'
import { updateElevationLabel } from './elevationLabel'

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
  railTimeLabelsRef,
  elevationAngleRef,
  elevationLabelElRef,
  alignMarkerHoveredRef,
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
  railTimeLabelsRef: MutableRefObject<RailTimeLabel[]>
  elevationAngleRef: MutableRefObject<{ deg: number; screenX: number; screenY: number } | null>
  elevationLabelElRef: MutableRefObject<HTMLSpanElement | null>
  alignMarkerHoveredRef: MutableRefObject<boolean>
}): void {
  useEffect(() => {
    kfAnimator.onComplete = (elementId, finalValues) => {
      useChoanStore.getState().updateElement(elementId, finalValues)
    }

    const animator = createLayoutAnimator()
    const atlasDirty = new Map<string, string>() // id → stateKey for dirty tracking
    let frameId = 0

    // Director mode hotkeys
    const onDirectorKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const ds = useDirectorStore.getState()
      if (!ds.selectedCameraId) return
      if (e.code === 'KeyQ') ds.toggleFrustumSpotlight()
      if (e.code === 'KeyF') ds.alignCameraFront()
    }
    window.addEventListener('keydown', onDirectorKeyDown)

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const renderer = rendererRef.current
      if (!renderer) return

      // Skip rendering while video export owns the canvas
      if (useDirectorStore.getState().exporting) return

      controlsRef.current?.update()

      const cam = renderer.camera
      const state = useChoanStore.getState()
      const preview = usePreviewStore.getState()

      // ── Director mode playback ──
      let directorBundles: ActiveBundleInput[] | undefined
      const director = useDirectorStore.getState()
      if (director.directorMode && director.directorPlaying) {
        // Advance playhead
        const elapsed = performance.now() - director.playStartTime
        const sceneState = useSceneStore.getState()
        const activeScene = sceneState.scenes.find((s) => s.id === sceneState.activeSceneId)
        const sceneDuration = activeScene?.duration ?? 3000
        const dt = activeScene?.directorTimeline ?? createDefaultDirectorTimeline()

        // Clip-based total duration: if clips exist, use the last clip's end point
        const clips = dt.cameraClips ?? []
        const totalDuration = clips.length > 0
          ? Math.max(...clips.map(c => c.timelineStart + c.duration))
          : sceneDuration

        if (elapsed >= totalDuration) {
          useDirectorStore.getState().stopPlaying()
          useDirectorStore.getState().setDirectorPlayheadTime(totalDuration)
        } else {
          useDirectorStore.getState().setDirectorPlayheadTime(elapsed)

          // Animation events — always evaluated at absolute time from top-level markers
          const activeEvents = evaluateDirectorEvents(dt.eventMarkers, elapsed, state.animationBundles)
          if (activeEvents.length > 0) {
            directorBundles = activeEvents.map((e) => ({ bundle: e.bundle, localTime: e.localTime }))
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
        manipulatedIds, scrubHeldIds: preview.scrubHeldIds,
        activeBundles: directorBundles,
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

      // Pre-compute director camera viewProj for frustum mask (Q key toggle).
      // Mirrors the selected-camera render policy: transient while editing,
      // derived pose while scrubbing so the spotlight tracks the frustum.
      let dirCamStateForMask: Float32Array | null = null
      const dirForMask = useDirectorStore.getState()
      if (dirForMask.frustumSpotlightOn && dirForMask.directorMode && !dirForMask.directorPlaying && dirForMask.selectedCameraId) {
        let maskPos: [number, number, number] = dirForMask.directorCameraPos
        let maskTgt: [number, number, number] = dirForMask.directorTargetPos
        let maskFov = 2 * Math.atan(36 / (2 * dirForMask.focalLengthMm)) * (180 / Math.PI)
        if (dirForMask.lastInteraction === 'playhead') {
          const scStateMask = useSceneStore.getState()
          const actSceneMask = scStateMask.scenes.find((s) => s.id === scStateMask.activeSceneId)
          const dtMask = actSceneMask?.directorTimeline ?? createDefaultDirectorTimeline()
          const pose = findCameraDerivedPose(
            dirForMask.selectedCameraId,
            dtMask.cameraClips,
            dirForMask.directorPlayheadTime,
            dirForMask.directorTargetMode,
          )
          if (pose) {
            maskPos = pose.position
            maskTgt = pose.target
            maskFov = pose.fov
          }
        }
        const [vfaw, vfah] = dirForMask.viewfinderAspect.split(':').map(Number)
        dirCamStateForMask = buildViewProjMatrix(
          maskPos, maskTgt, [0, 1, 0],
          maskFov, vfaw / vfah, 0.1, 500,
        )
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
        preview.previewState === 'playing' ? [] : state.selectedIds,
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
      railTimeLabelsRef.current = []
      elevationAngleRef.current = null
      updateElevationLabel(elevationLabelElRef.current, null)
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
            const [wx, wy] = pixelToWorld(el.x + el.width / 2, el.y + el.height / 2)
            const rs2 = useRenderSettings.getState()
            const wz = el.z * rs2.extrudeDepth + rs2.extrudeDepth / 2
            useDirectorStore.getState().setDirectorTargetPos([wx, wy, wz])
          }
        }

        // ── Multi-camera rendering ──
        const dpr = window.devicePixelRatio || 1
        const scStateOv = useSceneStore.getState()
        const actSceneOv = scStateOv.scenes.find((s) => s.id === scStateOv.activeSceneId)
        const dirTl = actSceneOv?.directorTimeline ?? createDefaultDirectorTimeline()
        const allCameras = dirTl.cameras ?? []
        const FRUSTUM_INACTIVE: [number, number, number, number] = [0.5, 0.5, 0.6, 0.25]

        for (const cam of allCameras) {
          const isSelected = cam.id === dirState.selectedCameraId
          // Policy: the selected camera is the only one whose view maps to the
          // viewfinder. Non-selected cameras render as static frustums from
          // their stored setup. The selected camera always keeps its full
          // editing UI (rails, handles, footprint, marks) so the user retains
          // a clear selection indicator; only the camera pose itself swaps to
          // the time-derived pose while `lastInteraction === 'playhead'`, so
          // scrubbing moves the frustum without dropping the selection visuals.
          if (isSelected) {
            // Resolve pose: transient while editing, derived while scrubbing.
            let camPos: [number, number, number] = dirState.directorCameraPos
            let camTgt: [number, number, number] = dirState.directorTargetPos
            let dirFov = 2 * Math.atan(36 / (2 * dirState.focalLengthMm)) * (180 / Math.PI)
            if (dirState.lastInteraction === 'playhead') {
              const pose = findCameraDerivedPose(
                cam.id,
                dirTl.cameraClips,
                dirState.directorPlayheadTime,
                dirState.directorTargetMode,
              )
              if (pose) {
                camPos = pose.position
                camTgt = pose.target
                dirFov = pose.fov
              }
            }

            const railLabels = drawDirectorCameraSetup(
              renderer.overlay,
              camPos,
              camTgt,
              dirState.directorRails,
              dirState.railWorldAnchor,
              true,
              dirState.directorTargetAttachedTo !== null,
              dirFov, dpr, dirState.activeRailAxis,
              undefined, dirState.directorTargetMode,
              alignMarkerHoveredRef.current,
            )
            railTimeLabelsRef.current = railLabels

            // Tilt angle: view camera forward vs Z axis (0°=top-down, 90°=side)
            {
              const vcPos = renderer.camera.position
              const vcTgt = renderer.camera.target
              const fwdX = vcTgt[0] - vcPos[0], fwdY = vcTgt[1] - vcPos[1], fwdZ = vcTgt[2] - vcPos[2]
              const fwdLen = Math.sqrt(fwdX * fwdX + fwdY * fwdY + fwdZ * fwdZ)
              const tiltDeg = fwdLen > 0.001 ? Math.acos(Math.min(1, Math.abs(fwdZ) / fwdLen)) * (180 / Math.PI) : 0
              const [tx, ty, tz] = camTgt
              const tScreen = renderer.overlay.projectToScreen(tx, ty, tz)
              const elData = { deg: tiltDeg, screenX: tScreen.px, screenY: tScreen.py }
              elevationAngleRef.current = elData
              updateElevationLabel(elevationLabelElRef.current, elData)
            }

            // Selected-only overlays
            const [vfaw, vfah] = dirState.viewfinderAspect.split(':').map(Number)
            drawCameraFootprint(
              renderer.overlay,
              camPos, camTgt,
              dirFov, vfaw / vfah, false,
            )

            const r = dirState.directorRails
            const stub = 0.501
            const tunnelAxes: ('x' | 'y' | 'z')[] = []
            if (r.truck.neg < stub && r.truck.pos < stub) tunnelAxes.push('x')
            if (r.boom.neg  < stub && r.boom.pos  < stub) tunnelAxes.push('y')
            if (r.dolly.neg < stub && r.dolly.pos < stub) tunnelAxes.push('z')
            if (tunnelAxes.length > 0) {
              drawCameraAxisHandles(
                renderer.overlay,
                camPos,
                tunnelAxes,
                dirState.directorCameraAxisHover,
              )
            }

            if (!hasActiveRailTiming(dirState.directorRails)) {
              const marks = dirTl.cameraMarks ?? []
              if (marks.length > 0) {
                drawCameraMarks(renderer.overlay, marks, dirState.directorRails, dirState.railWorldAnchor, camPos)
              }
            }

            if (dirTl.cameraKeyframes.length >= 1) {
              const curCamState = evaluateDirectorCamera(dirTl.cameraKeyframes, dirState.directorPlayheadTime)
              drawCameraPathOverlay(renderer.overlay, dirTl.cameraKeyframes, curCamState, dirState.selectedCameraKeyframeId ?? null, 0.5, dpr)
            }
          } else {
            // Non-selected camera: static frustum from the stored setup only.
            const camFov = 2 * Math.atan(36 / (2 * cam.focalLengthMm)) * (180 / Math.PI)
            drawDirectorCameraSetup(
              renderer.overlay,
              cam.setup.cameraPos, cam.setup.targetPos,
              cam.setup.rails, cam.setup.railWorldAnchor,
              false, false, camFov, dpr, null, FRUSTUM_INACTIVE,
            )
          }
        }
      }
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      kfAnimator.stopAll()
      window.removeEventListener('keydown', onDirectorKeyDown)
    }
  }, [])
}

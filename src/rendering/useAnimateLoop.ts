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
}): void {
  useEffect(() => {
    kfAnimator.onComplete = (elementId, finalValues) => {
      useChoanStore.getState().updateElement(elementId, finalValues)
    }

    const animator = createLayoutAnimator()
    const atlasDirty = new Map<string, string>() // id → stateKey for dirty tracking
    let frameId = 0

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const renderer = rendererRef.current
      if (!renderer) return

      controlsRef.current?.update()

      const cam = renderer.camera
      const cdx = cam.position[0] - cam.target[0]
      const cdy = cam.position[1] - cam.target[1]
      const cdz = cam.position[2] - cam.target[2]
      zoomScaleRef.current = Math.sqrt(cdx * cdx + cdy * cdy + cdz * cdz) / 20
      const rs = useRenderSettings.getState()

      const manipulatedIds = new Set<string>()
      if (isDraggingRef.current) for (const id of dragGroupIdsRef.current) manipulatedIds.add(id)
      if (isResizingRef.current && resizeElIdRef.current) manipulatedIds.add(resizeElIdRef.current)
      if (isDrawingRef.current && drawElIdRef.current) manipulatedIds.add(drawElIdRef.current)

      const state = useChoanStore.getState()
      const preview = usePreviewStore.getState()

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
        renderer.render(rs)
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
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      kfAnimator.stopAll()
    }
  }, [])
}

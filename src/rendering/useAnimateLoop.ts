// Animation loop hook — owns the rAF loop, layout animator, and kfAnimator lifecycle.
//
// Replaces the large useEffect in SDFCanvas. Returns nothing; all updates are
// written to the renderer and stores as side effects each frame.

import { useEffect, type MutableRefObject } from 'react'
import type { SDFRenderer } from '../engine/renderer'
import type { OrbitControls } from '../engine/controls'
import type { SnapLine, DistanceMeasure } from '../canvas/snapUtils'
import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { evaluateAnimation } from '../animation/animationEvaluator'
import { addGhostElements } from './ghostPreview'
import { applyMultiSelectTint } from './multiSelectTint'
import { drawOverlay } from './overlayCommands'
import { kfAnimator } from './kfAnimator'
import { createLayoutAnimator } from '../layout/animator'

export function useAnimateLoop({
  rendererRef,
  controlsRef,
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
}: {
  rendererRef: MutableRefObject<SDFRenderer | null>
  controlsRef: MutableRefObject<OrbitControls | null>
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
}): void {
  useEffect(() => {
    kfAnimator.onComplete = (elementId, finalValues) => {
      useChoanStore.getState().updateElement(elementId, finalValues)
    }

    const animator = createLayoutAnimator()
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

      if (preview.ghostPreview && preview.editingBundleId && preview.previewState === 'stopped') {
        const bundle = state.animationBundles.find((b) => b.id === preview.editingBundleId)
        if (bundle) animatedElements = addGhostElements(animatedElements, state.elements, bundle, preview.playheadTime)
      }

      renderer.updateScene(applyMultiSelectTint(animatedElements, state.selectedIds), rs.extrudeDepth)
      renderer.render(rs)

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
      )
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      kfAnimator.stopAll()
    }
  }, [])
}

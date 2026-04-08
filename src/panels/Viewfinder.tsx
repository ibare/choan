// Viewfinder — shows the director camera view in the inspector panel.
// Uses a dedicated vf FBO (renderer.renderViewfinderFrame) so the main camera
// and GBuffer are never touched. Works during both edit and playback.

import { useRef, useEffect } from 'react'
import { useDirectorStore } from '../store/useDirectorStore'
import { useChoanStore } from '../store/useChoanStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { useSceneStore } from '../store/useSceneStore'
import { createDefaultDirectorTimeline } from '../animation/directorTypes'
import { rendererSingleton } from '../rendering/rendererRef'
import { evaluateDirectorEvents } from '../animation/directorEventEvaluator'
import { evaluateBundles } from '../animation/animationEvaluator'
import { findCameraDerivedPose } from '../animation/cameraTimeTrack'
import { Section } from '../components/ui/Section'

export default function Viewfinder() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const {
    directorMode, directorPlayheadTime,
    selectedCameraId,
    focalLengthMm, viewfinderAspect,
    directorCameraPos, directorTargetPos,
    lastInteraction, directorTargetMode,
  } = useDirectorStore()

  const visible = directorMode && selectedCameraId !== null

  const [aw, ah] = viewfinderAspect.split(':').map(Number)
  const vfAspectRatio = aw / ah

  useEffect(() => {
    if (!visible) return
    const vfCanvas = canvasRef.current
    const renderer = rendererSingleton.renderer
    if (!vfCanvas || !renderer) return

    const ctx = vfCanvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssW = vfCanvas.clientWidth
    const cssH = Math.round(cssW / vfAspectRatio)

    vfCanvas.width = Math.round(cssW * dpr)
    vfCanvas.height = Math.round(cssH * dpr)

    // Policy: the selected camera's view is what the viewfinder shows. When the
    // user edits the camera directly (`lastInteraction === 'camera'`), live
    // transient state drives the pose. When the playhead moved last
    // (`lastInteraction === 'playhead'`), evaluate the selected camera's clips
    // at the playhead time — the derived pose handles gaps by holding the last
    // clip's end pose. If there are no clips for the selected camera, fall back
    // to the transient state so a freshly added camera still shows something.
    const state = useChoanStore.getState()
    const sceneState = useSceneStore.getState()
    const activeScene = sceneState.scenes.find((s) => s.id === sceneState.activeSceneId)
    const dt = activeScene?.directorTimeline ?? createDefaultDirectorTimeline()

    let camPos: [number, number, number] = directorCameraPos
    let camTgt: [number, number, number] = directorTargetPos
    let camFov = 2 * Math.atan(36 / (2 * focalLengthMm)) * (180 / Math.PI)
    if (lastInteraction === 'playhead' && selectedCameraId) {
      const pose = findCameraDerivedPose(
        selectedCameraId, dt.cameraClips, directorPlayheadTime, directorTargetMode,
      )
      if (pose) {
        camPos = pose.position
        camTgt = pose.target
        camFov = pose.fov
      }
    }

    // Evaluate animation events at playhead time
    const activeEvents = evaluateDirectorEvents(dt.eventMarkers, directorPlayheadTime, state.animationBundles)
    const activeBundles = activeEvents.map((e) => ({ bundle: e.bundle, localTime: e.localTime }))
    const animated = activeBundles.length > 0
      ? evaluateBundles(state.elements, activeBundles)
      : state.elements

    // Render to dedicated vf FBO — does NOT touch renderer.camera or main GBuffer
    const rs = useRenderSettings.getState()
    renderer.updateScene(animated, rs.extrudeDepth)
    renderer.renderViewfinderFrame(camPos, camTgt, camFov, cssW, cssH, rs)

    // Copy vf FBO to preview canvas
    ctx.clearRect(0, 0, vfCanvas.width, vfCanvas.height)
    renderer.blitViewfinderToCtx(ctx, vfCanvas.width, vfCanvas.height)
  }, [visible, directorPlayheadTime, focalLengthMm, viewfinderAspect, directorCameraPos, directorTargetPos, lastInteraction, directorTargetMode, selectedCameraId])

  if (!visible) return null

  return (
    <Section title="Viewfinder">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', aspectRatio: String(vfAspectRatio), borderRadius: 6, display: 'block' }}
      />
    </Section>
  )
}

// Viewfinder — shows the director camera view in the inspector panel.
// Renders by temporarily overriding the main camera, rendering one frame
// to the WebGL canvas, and copying to a 2D preview canvas.

import { useRef, useEffect } from 'react'
import { useDirectorStore } from '../store/useDirectorStore'
import { useChoanStore } from '../store/useChoanStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { rendererSingleton } from '../rendering/rendererRef'
import { evaluateDirectorEvents } from '../animation/directorEventEvaluator'
import { evaluateDirectorFrame } from '../animation/directorAnimationEvaluator'
import { Section } from '../components/ui/Section'

export default function Viewfinder() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const {
    directorMode, directorPlaying, directorPlayheadTime,
    selectedCameraId,
    focalLengthMm, viewfinderAspect,
    directorCameraPos, directorTargetPos,
  } = useDirectorStore()

  const visible = directorMode && !directorPlaying && selectedCameraId !== null

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

    // Save camera + renderer CSS size
    const cam = renderer.camera
    const savedPos: [number, number, number] = [...cam.position]
    const savedTarget: [number, number, number] = [...cam.target]
    const savedFov = cam.fov
    const savedSize = renderer.getCssSize()

    // Apply director camera from current transient state
    cam.position[0] = directorCameraPos[0]
    cam.position[1] = directorCameraPos[1]
    cam.position[2] = directorCameraPos[2]
    cam.target[0] = directorTargetPos[0]
    cam.target[1] = directorTargetPos[1]
    cam.target[2] = directorTargetPos[2]
    cam.fov = 2 * Math.atan(36 / (2 * focalLengthMm)) * (180 / Math.PI)

    // Resize renderer to viewfinder aspect
    renderer.resizeViewport(cssW, cssH)
    renderer.applyPendingResize()

    // Evaluate top-level events at playhead time
    const state = useChoanStore.getState()
    const activeEvents = evaluateDirectorEvents([], directorPlayheadTime, state.animationBundles)
    const animated = activeEvents.length > 0
      ? evaluateDirectorFrame(state.elements, activeEvents)
      : state.elements

    // Render one frame
    const rs = useRenderSettings.getState()
    renderer.updateScene(animated, rs.extrudeDepth)
    renderer.renderPipeline(rs)
    renderer.blitAndOverlay()

    // Copy to viewfinder
    ctx.clearRect(0, 0, vfCanvas.width, vfCanvas.height)
    ctx.drawImage(renderer.canvas, 0, 0, vfCanvas.width, vfCanvas.height)

    // Restore renderer size and camera
    renderer.resize(savedSize.w, savedSize.h)
    renderer.applyPendingResize()

    cam.position[0] = savedPos[0]
    cam.position[1] = savedPos[1]
    cam.position[2] = savedPos[2]
    cam.target[0] = savedTarget[0]
    cam.target[1] = savedTarget[1]
    cam.target[2] = savedTarget[2]
    cam.fov = savedFov

    // Re-render main view with restored camera
    renderer.updateScene(state.elements, rs.extrudeDepth)
    renderer.renderPipeline(rs)
    renderer.blitAndOverlay()
  }, [visible, directorPlayheadTime, focalLengthMm, viewfinderAspect, directorCameraPos, directorTargetPos])

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

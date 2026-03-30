// Viewfinder — shows the director camera view in the inspector panel.
// Renders by temporarily overriding the main camera, rendering one frame
// to the WebGL canvas, and copying to a 2D preview canvas.

import { useRef, useEffect } from 'react'
import { useDirectorStore } from '../store/useDirectorStore'
import { useSceneStore } from '../store/useSceneStore'
import { useChoanStore } from '../store/useChoanStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { rendererSingleton } from '../rendering/rendererRef'
import { createDefaultDirectorTimeline } from '../animation/directorTypes'
import { evaluateDirectorCamera } from '../animation/directorCameraEvaluator'
import { evaluateDirectorEvents } from '../animation/directorEventEvaluator'
import { evaluateDirectorFrame } from '../animation/directorAnimationEvaluator'
import { Section } from '../components/ui/Section'

export default function Viewfinder() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { directorMode, directorPlaying, directorPlayheadTime, focalLengthMm, viewfinderAspect } = useDirectorStore()
  const { scenes, activeSceneId } = useSceneStore()

  const scene = scenes.find((s) => s.id === activeSceneId)
  const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
  const hasCameraKfs = dt.cameraKeyframes.length > 0

  const visible = directorMode && !directorPlaying && hasCameraKfs

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

    // Viewfinder canvas pixel dimensions must match render dimensions exactly
    // so ctx.drawImage copies without any stretching
    vfCanvas.width = Math.round(cssW * dpr)
    vfCanvas.height = Math.round(cssH * dpr)

    // Save camera + renderer CSS size
    const cam = renderer.camera
    const savedPos: [number, number, number] = [...cam.position]
    const savedTarget: [number, number, number] = [...cam.target]
    const savedFov = cam.fov
    const savedSize = renderer.getCssSize()

    // Apply director camera
    const fovFromMm = 2 * Math.atan(36 / (2 * focalLengthMm)) * (180 / Math.PI)
    const camState = evaluateDirectorCamera(dt.cameraKeyframes, directorPlayheadTime)
    if (camState) {
      cam.position[0] = camState.position[0]
      cam.position[1] = camState.position[1]
      cam.position[2] = camState.position[2]
      cam.target[0] = camState.target[0]
      cam.target[1] = camState.target[1]
      cam.target[2] = camState.target[2]
    }
    cam.fov = fovFromMm

    // Resize renderer to viewfinder aspect — this sets camera.aspect correctly
    // and resizes the framebuffers so the rendered image matches the viewfinder canvas
    renderer.resizeViewport(cssW, cssH)
    renderer.applyPendingResize()

    // Evaluate events at this time
    const state = useChoanStore.getState()
    const activeEvents = evaluateDirectorEvents(dt.eventMarkers, directorPlayheadTime, state.animationBundles)
    const animated = activeEvents.length > 0
      ? evaluateDirectorFrame(state.elements, activeEvents)
      : state.elements

    // Render one frame with the director camera
    const rs = useRenderSettings.getState()
    renderer.updateScene(animated, rs.extrudeDepth)
    renderer.renderPipeline(rs)
    renderer.blitAndOverlay()

    // Copy to viewfinder — no stretching since canvas and vfCanvas are the same size
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
  }, [visible, directorPlayheadTime, dt, scene, focalLengthMm, hasCameraKfs, viewfinderAspect])

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

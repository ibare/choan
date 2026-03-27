// Camera PIP (Picture-in-Picture) preview overlay.
// Shows the camera view at the current Director playhead time in a small
// corner window. Renders by temporarily overriding the main camera, rendering
// one frame to the WebGL canvas, and copying to a 2D preview canvas.

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

const PIP_W = 320
const PIP_H = 180

export default function CameraPIP() {
  const pipRef = useRef<HTMLCanvasElement>(null)
  const { directorMode, directorPlaying, directorPlayheadTime, focalLengthMm } = useDirectorStore()
  const { scenes, activeSceneId } = useSceneStore()

  const scene = scenes.find((s) => s.id === activeSceneId)
  const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
  const hasCameraKfs = dt.cameraKeyframes.length > 0

  // Show PIP in Director mode when not playing
  const visible = directorMode && !directorPlaying

  useEffect(() => {
    if (!visible) return
    const pipCanvas = pipRef.current
    const renderer = rendererSingleton.renderer
    if (!pipCanvas || !renderer) return

    const ctx = pipCanvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    pipCanvas.width = Math.round(PIP_W * dpr)
    pipCanvas.height = Math.round(PIP_H * dpr)

    // Save current camera state
    const cam = renderer.camera
    const savedPos: [number, number, number] = [...cam.position]
    const savedTarget: [number, number, number] = [...cam.target]
    const savedFov = cam.fov

    // Apply director camera at current playhead time
    const fovFromMm = 2 * Math.atan(36 / (2 * focalLengthMm)) * (180 / Math.PI)
    const camState = hasCameraKfs
      ? evaluateDirectorCamera(dt.cameraKeyframes, directorPlayheadTime)
      : null
    if (camState) {
      cam.position[0] = camState.position[0]
      cam.position[1] = camState.position[1]
      cam.position[2] = camState.position[2]
      cam.target[0] = camState.target[0]
      cam.target[1] = camState.target[1]
      cam.target[2] = camState.target[2]
    }
    // Always use the focal length slider's FOV
    cam.fov = fovFromMm

    // Evaluate events at this time
    const state = useChoanStore.getState()
    const activeEvents = evaluateDirectorEvents(dt.eventMarkers, directorPlayheadTime, state.animationBundles)
    const animated = activeEvents.length > 0
      ? evaluateDirectorFrame(state.elements, activeEvents)
      : state.elements

    // Render one frame with the director camera + DoF
    const rs = useRenderSettings.getState()
    renderer.updateScene(animated, rs.extrudeDepth)
    renderer.renderPipeline(rs)

    // Bokeh DoF — focus at camera target distance
    const dx = cam.position[0] - cam.target[0]
    const dy = cam.position[1] - cam.target[1]
    const dz = cam.position[2] - cam.target[2]
    const focusDist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    renderer.applyDoF({
      focusDist,
      aperture: (focalLengthMm / 50) * 25.0,
      maxBlurPx: 40,
    })

    renderer.blitAndOverlay()

    // Copy the WebGL canvas to the PIP 2D canvas
    ctx.clearRect(0, 0, pipCanvas.width, pipCanvas.height)
    ctx.drawImage(renderer.canvas, 0, 0, pipCanvas.width, pipCanvas.height)

    // Restore camera
    cam.position[0] = savedPos[0]
    cam.position[1] = savedPos[1]
    cam.position[2] = savedPos[2]
    cam.target[0] = savedTarget[0]
    cam.target[1] = savedTarget[1]
    cam.target[2] = savedTarget[2]
    cam.fov = savedFov

    // Re-render with the restored camera so the main view is correct
    renderer.updateScene(state.elements, rs.extrudeDepth)
    renderer.renderPipeline(rs)
    renderer.blitAndOverlay()
  }, [visible, directorPlayheadTime, dt, scene, focalLengthMm, hasCameraKfs])

  if (!visible) return null

  return (
    <div className="ui-camera-pip">
      <div className="ui-camera-pip__label">Camera Preview</div>
      <canvas
        ref={pipRef}
        className="ui-camera-pip__canvas"
        style={{ width: PIP_W, height: PIP_H }}
      />
    </div>
  )
}

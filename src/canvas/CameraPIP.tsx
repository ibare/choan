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
import { createDefaultDirectorTimeline, findActiveClip } from '../animation/directorTypes'
import { evaluateRailAnimation } from '../animation/cameraMarkEvaluator'
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
  const cameraClips = dt.cameraClips ?? []

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

    // Apply director camera at current playhead time via clip system
    const activeClip = cameraClips.length > 0 ? findActiveClip(cameraClips, directorPlayheadTime) : null
    if (activeClip) {
      const setup = activeClip.cameraSetup
      const localTime = Math.max(0, Math.min(activeClip.duration, directorPlayheadTime - activeClip.timelineStart))
      const camState = evaluateRailAnimation(
        setup.rails, localTime, setup.railWorldAnchor, setup.targetPos, activeClip.focalLengthMm,
      )
      if (camState) {
        // Rail animation active — use interpolated position
        cam.position[0] = camState.position[0]
        cam.position[1] = camState.position[1]
        cam.position[2] = camState.position[2]
        cam.target[0] = camState.target[0]
        cam.target[1] = camState.target[1]
        cam.target[2] = camState.target[2]
        cam.fov = camState.fov
      } else {
        // No rail timing — use clip's static camera setup
        cam.position[0] = setup.cameraPos[0]
        cam.position[1] = setup.cameraPos[1]
        cam.position[2] = setup.cameraPos[2]
        cam.target[0] = setup.targetPos[0]
        cam.target[1] = setup.targetPos[1]
        cam.target[2] = setup.targetPos[2]
        cam.fov = 2 * Math.atan(36 / (2 * activeClip.focalLengthMm)) * (180 / Math.PI)
      }
    } else {
      // No clip at this time — use current focal length
      cam.fov = 2 * Math.atan(36 / (2 * focalLengthMm)) * (180 / Math.PI)
    }

    // Evaluate events at this time (clip-local or top-level)
    const state = useChoanStore.getState()
    const evMarkers = activeClip ? activeClip.eventMarkers : dt.eventMarkers
    const evTime = activeClip ? directorPlayheadTime - activeClip.timelineStart : directorPlayheadTime
    const activeEvents = evaluateDirectorEvents(evMarkers, evTime, state.animationBundles)
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
  }, [visible, directorPlayheadTime, dt, scene, focalLengthMm, cameraClips])

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

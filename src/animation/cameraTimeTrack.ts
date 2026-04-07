// Derived camera pose at a given director timeline time.
// Used to drive frustum visualization in the canvas without writing to the store.

import type { CameraClip, TargetMode } from './directorTypes'
import type { DirectorCameraState } from './directorCameraEvaluator'
import { evaluateRailAnimation } from './cameraMarkEvaluator'

/**
 * Find the camera's derived pose at a given absolute time.
 *
 * - If a clip belonging to this camera covers the time, evaluate its rail animation.
 * - In a gap (between clips), hold the most recent past clip's end pose.
 * - Before the first clip, return the first clip's start pose.
 * - If the camera has no clips, return null.
 */
export function findCameraDerivedPose(
  cameraId: string,
  clips: readonly CameraClip[],
  time: number,
  targetMode: TargetMode,
): DirectorCameraState | null {
  const own = clips.filter((c) => c.cameraId === cameraId)
  if (own.length === 0) return null

  const sorted = [...own].sort((a, b) => a.timelineStart - b.timelineStart)

  // Active clip: latest-starting clip that contains time
  let active: CameraClip | null = null
  for (const c of sorted) {
    if (time >= c.timelineStart && time < c.timelineStart + c.duration) {
      if (!active || c.timelineStart > active.timelineStart) active = c
    }
  }

  if (active) {
    const localTime = Math.max(0, Math.min(active.duration, time - active.timelineStart))
    return evalClipPose(active, localTime, targetMode)
  }

  // Out-of-range / gap:
  if (time < sorted[0].timelineStart) {
    return evalClipPose(sorted[0], 0, targetMode)
  }
  // Hold last clip whose start ≤ time at its end pose
  let prev: CameraClip = sorted[0]
  for (const c of sorted) {
    if (c.timelineStart <= time) prev = c
  }
  return evalClipPose(prev, prev.duration, targetMode)
}

function evalClipPose(
  clip: CameraClip,
  localTime: number,
  targetMode: TargetMode,
): DirectorCameraState {
  const setup = clip.cameraSetup
  const railResult = evaluateRailAnimation(
    setup.rails,
    localTime,
    setup.railWorldAnchor,
    setup.targetPos,
    clip.focalLengthMm,
    targetMode,
    setup.cameraPos,
  )
  if (railResult) return railResult
  // Static pose fallback when rails have no active animation
  const fov = 2 * Math.atan(36 / (2 * clip.focalLengthMm)) * (180 / Math.PI)
  return {
    position: [...setup.cameraPos],
    target: [...setup.targetPos],
    fov,
  }
}

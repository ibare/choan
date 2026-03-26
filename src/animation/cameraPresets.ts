// Camera animation presets — template CameraClip generators.

import { nanoid } from '../utils/nanoid'
import type { Camera } from '../engine/camera'
import type { CameraClip, CameraKeyframeTrack, Keyframe } from './types'

export type CameraPreset = 'overview' | 'orbit' | 'z-reveal' | 'push' | 'pull'

export const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'orbit',    label: 'Orbit' },
  { id: 'z-reveal', label: 'Z-Reveal' },
  { id: 'push',     label: 'Push' },
  { id: 'pull',     label: 'Pull' },
]

function kf(time: number, value: number, easing?: string): Keyframe {
  return easing ? { time, value, easing: easing as Keyframe['easing'] } : { time, value }
}

function track(property: CameraKeyframeTrack['property'], keyframes: Keyframe[]): CameraKeyframeTrack {
  return { property, keyframes }
}

function makeClip(duration: number, tracks: CameraKeyframeTrack[]): CameraClip {
  return { id: nanoid(), duration, easing: 'ease-in-out', tracks }
}

export function createCameraPreset(
  preset: CameraPreset,
  duration: number,
  camera: Camera,
): CameraClip {
  const pos = camera.position
  const tgt = camera.target

  switch (preset) {
    case 'overview':
      // Pull out from current position to wide overview, then zoom into target
      return makeClip(duration, [
        track('cam.pos.z', [kf(0, pos[2]), kf(duration * 0.4, pos[2] + 15), kf(duration, pos[2])]),
        track('cam.pos.y', [kf(0, pos[1]), kf(duration * 0.4, pos[1] + 5), kf(duration, pos[1])]),
        track('cam.fov', [kf(0, camera.fov), kf(duration * 0.4, 60), kf(duration, camera.fov)]),
      ])

    case 'orbit': {
      // 360 orbit around the scene center using sinusoidal X/Z positions
      const r = Math.sqrt(
        (pos[0] - tgt[0]) ** 2 + (pos[2] - tgt[2]) ** 2,
      ) || 20
      const steps = 8
      const xKfs: Keyframe[] = []
      const zKfs: Keyframe[] = []
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * duration
        const angle = (i / steps) * Math.PI * 2
        xKfs.push(kf(t, tgt[0] + r * Math.sin(angle)))
        zKfs.push(kf(t, tgt[2] + r * Math.cos(angle)))
      }
      return makeClip(duration, [
        track('cam.pos.x', xKfs),
        track('cam.pos.z', zKfs),
        track('cam.target.x', [kf(0, tgt[0]), kf(duration, tgt[0])]),
        track('cam.target.y', [kf(0, tgt[1]), kf(duration, tgt[1])]),
      ])
    }

    case 'z-reveal':
      // Start from far away looking flat (2D), rotate to reveal Z depth
      return makeClip(duration, [
        track('cam.pos.z', [kf(0, 40, 'ease-out'), kf(duration, pos[2])]),
        track('cam.pos.x', [kf(0, 0, 'ease-out'), kf(duration, pos[0] + 8)]),
        track('cam.pos.y', [kf(0, pos[1], 'ease-out'), kf(duration, pos[1] + 3)]),
      ])

    case 'push':
      // Slow push in toward the scene
      return makeClip(duration, [
        track('cam.pos.z', [kf(0, pos[2], 'ease-in-out'), kf(duration, pos[2] - 8)]),
        track('cam.fov', [kf(0, camera.fov), kf(duration, Math.max(10, camera.fov - 10))]),
      ])

    case 'pull':
      // Slow pull out from the scene
      return makeClip(duration, [
        track('cam.pos.z', [kf(0, pos[2], 'ease-in-out'), kf(duration, pos[2] + 10)]),
        track('cam.fov', [kf(0, camera.fov), kf(duration, Math.min(120, camera.fov + 10))]),
      ])
  }
}

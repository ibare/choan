// Camera motion presets — generate CameraViewKeyframe[] for common camera moves.
// Pure functions, no React/Zustand imports.

import { nanoid } from '../utils/nanoid'
import type { CameraViewKeyframe } from './directorTypes'

export type CameraPresetType = 'orbit' | 'dolly' | 'crane' | 'flythrough' | 'pan'

export const CAMERA_PRESET_OPTIONS: { value: CameraPresetType; label: string }[] = [
  { value: 'orbit',      label: 'Orbit' },
  { value: 'dolly',      label: 'Dolly' },
  { value: 'crane',      label: 'Crane' },
  { value: 'flythrough', label: 'Fly-through' },
  { value: 'pan',        label: 'Pan' },
]

export interface PresetParams {
  center: [number, number, number]
  radius?: number
  duration?: number
  fov?: number
}

function kf(time: number, position: [number, number, number], target: [number, number, number], fov: number): CameraViewKeyframe {
  return { id: nanoid(), time: Math.round(time), position: [...position], target: [...target], fov }
}

export function generateCameraPreset(
  type: CameraPresetType,
  params: PresetParams,
): CameraViewKeyframe[] {
  const { center } = params
  const radius = params.radius ?? 15
  const duration = params.duration ?? 3000
  const fov = params.fov ?? 50

  switch (type) {
    case 'orbit': {
      const n = 8
      const keyframes: CameraViewKeyframe[] = []
      for (let i = 0; i <= n; i++) {
        const angle = (i / n) * Math.PI * 2
        const t = (i / n) * duration
        keyframes.push(kf(t,
          [center[0] + radius * Math.sin(angle), center[1], center[2] + radius * Math.cos(angle)],
          center, fov,
        ))
      }
      return keyframes
    }

    case 'dolly':
      return [
        kf(0,              [center[0], center[1], center[2] + radius * 2], center, fov),
        kf(duration * 0.3, [center[0], center[1], center[2] + radius * 1.2], center, fov),
        kf(duration * 0.7, [center[0], center[1], center[2] + radius * 0.6], center, fov - 5),
        kf(duration,       [center[0], center[1], center[2] + radius * 0.4], center, fov - 10),
      ]

    case 'crane':
      return [
        kf(0,              [center[0], center[1] - 2, center[2] + radius], center, fov),
        kf(duration * 0.4, [center[0], center[1] + 5, center[2] + radius], center, fov),
        kf(duration * 0.7, [center[0], center[1] + 10, center[2] + radius * 0.8],
                           [center[0], center[1] - 2, center[2]], fov),
        kf(duration,       [center[0], center[1] + 15, center[2] + radius * 0.5],
                           [center[0], center[1] - 3, center[2]], fov + 5),
      ]

    case 'flythrough': {
      const depth = radius * 2
      return [
        kf(0,              [center[0] - 5, center[1] + 2, center[2] + depth],
                           [center[0], center[1], center[2] + depth * 0.5], fov),
        kf(duration * 0.25,[center[0] + 3, center[1] + 1, center[2] + depth * 0.6],
                           [center[0], center[1], center[2] + depth * 0.2], fov),
        kf(duration * 0.5, [center[0] - 2, center[1], center[2] + depth * 0.3],
                           [center[0], center[1], center[2]], fov),
        kf(duration * 0.75,[center[0] + 4, center[1] - 1, center[2] + depth * 0.1],
                           [center[0], center[1], center[2] - depth * 0.2], fov),
        kf(duration,       [center[0], center[1], center[2] - depth * 0.2],
                           [center[0], center[1], center[2] - depth * 0.5], fov),
      ]
    }

    case 'pan':
      return [
        kf(0,              [center[0], center[1], center[2] + radius],
                           [center[0] - 8, center[1], center[2]], fov),
        kf(duration * 0.5, [center[0], center[1], center[2] + radius],
                           [center[0], center[1], center[2]], fov),
        kf(duration,       [center[0], center[1], center[2] + radius],
                           [center[0] + 8, center[1], center[2]], fov),
      ]
  }
}

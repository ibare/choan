// Director Timeline type definitions — scene-level camera + event scheduling.

import type { EasingType } from './types'

export interface CameraViewKeyframe {
  id: string
  time: number  // absolute ms within scene
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  easing?: EasingType
}

export interface EventMarker {
  id: string
  time: number            // absolute start ms
  bundleId: string        // references existing AnimationBundle
  durationOverride?: number  // optional: override bundle's natural duration
}

export interface DirectorTimeline {
  cameraKeyframes: CameraViewKeyframe[]
  eventMarkers: EventMarker[]
}

export function createDefaultDirectorTimeline(): DirectorTimeline {
  return { cameraKeyframes: [], eventMarkers: [] }
}

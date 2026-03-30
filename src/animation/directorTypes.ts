// Director Timeline type definitions — scene-level camera + event scheduling.

import type { EasingType } from './types'

// ── Rail system ──────────────────────────────────────────────────────────────
// Each linear rail has a negative and positive extent from the camera position.
// sphere is the orbital radius around the target.

export const RAIL_MIN_STUB = 0.5  // world units — minimum red stub per side

export interface RailExtents { neg: number; pos: number }

export interface DirectorRails {
  dolly:  RailExtents  // Z axis (forward / backward)
  truck:  RailExtents  // X axis (left / right)
  boom:   RailExtents  // Y axis (up / down)
  sphere: number       // orbit radius around target
}

export type RailAxis = 'dolly' | 'truck' | 'boom' | 'sphere'
export type RailDir  = 'neg' | 'pos'
export interface RailHandleId { axis: RailAxis; dir: RailDir }

export function createDefaultRails(): DirectorRails {
  return {
    dolly:  { neg: RAIL_MIN_STUB, pos: RAIL_MIN_STUB },
    truck:  { neg: RAIL_MIN_STUB, pos: RAIL_MIN_STUB },
    boom:   { neg: RAIL_MIN_STUB, pos: RAIL_MIN_STUB },
    sphere: RAIL_MIN_STUB,
  }
}

// ── Camera keyframes (used for playback in step 2) ────────────────────────

export interface CameraViewKeyframe {
  id: string
  time: number  // absolute ms within scene
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  easing?: EasingType
  tension?: number  // Catmull-Rom tension, default 0.5
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

// Director Timeline type definitions — scene-level camera + event scheduling.

import type { EasingType } from './types'

// ── Rail system ──────────────────────────────────────────────────────────────
// Each rail has neg/pos extents. Truck (X) and Boom (Y) support circular mode
// where the rail becomes an arc centered at Z=0.
// Dolly (Z) is always linear.

export const RAIL_MIN_STUB = 0.5  // world units — minimum red stub per side

export type RailMode = 'linear' | 'circular'

export interface RailExtents { neg: number; pos: number }

export interface DirectorRails {
  dolly:     RailExtents  // Z axis (forward / backward) — linear only
  truck:     RailExtents  // X axis (left / right)
  boom:      RailExtents  // Y axis (up / down)
  truckMode: RailMode     // X axis rail mode
  boomMode:  RailMode     // Y axis rail mode
  sphere:    number       // (legacy) orbit radius around target
}

export type RailAxis = 'dolly' | 'truck' | 'boom' | 'sphere'
export type RailDir  = 'neg' | 'pos'
export interface RailHandleId { axis: RailAxis; dir: RailDir }

export function createDefaultRails(): DirectorRails {
  return {
    dolly:     { neg: RAIL_MIN_STUB, pos: RAIL_MIN_STUB },
    truck:     { neg: RAIL_MIN_STUB, pos: RAIL_MIN_STUB },
    boom:      { neg: RAIL_MIN_STUB, pos: RAIL_MIN_STUB },
    truckMode: 'linear',
    boomMode:  'linear',
    sphere:    RAIL_MIN_STUB,
  }
}

// ── Circular rail math utilities ─────────────────────────────────────────────

/** X circular (truck): horizontal orbit in XZ plane at camera Y height. */
export function truckCircularParams(camPos: [number, number, number]) {
  const cx = 0, cy = camPos[1], cz = 0  // center on Y-axis at cam height
  const radius = Math.sqrt(camPos[0] ** 2 + camPos[2] ** 2)
  const angle = Math.atan2(camPos[0], camPos[2])  // angle from +Z axis
  return { center: [cx, cy, cz] as [number, number, number], radius, angle }
}

/** Y circular (boom): vertical orbit in the plane containing Y-axis and camera XZ direction. */
export function boomCircularParams(camPos: [number, number, number]) {
  const hDist = Math.sqrt(camPos[0] ** 2 + camPos[2] ** 2)
  const hAngle = Math.atan2(camPos[0], camPos[2])  // horizontal heading
  const radius = Math.sqrt(hDist ** 2 + camPos[1] ** 2)
  const elevAngle = Math.atan2(camPos[1], hDist)    // elevation from XZ plane
  return { center: [0, 0, 0] as [number, number, number], radius, elevAngle, hAngle }
}

/** Point on X circular orbit. */
export function pointOnTruckCircle(
  center: [number, number, number], radius: number, angle: number,
): [number, number, number] {
  return [center[0] + Math.sin(angle) * radius, center[1], center[2] + Math.cos(angle) * radius]
}

/** Point on Y circular orbit (vertical arc in the camera's heading plane). */
export function pointOnBoomCircle(
  radius: number, elevAngle: number, hAngle: number,
): [number, number, number] {
  const h = Math.cos(elevAngle) * radius
  const y = Math.sin(elevAngle) * radius
  return [Math.sin(hAngle) * h, y, Math.cos(hAngle) * h]
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

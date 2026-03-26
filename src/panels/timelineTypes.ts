// Shared constants, types, and helpers for Timeline components.

import type { AnimationClip, AnimatableProperty, CameraAnimatableProperty, CameraKeyframeTrack } from '../animation/types'

export const TRACK_HEIGHT = 38
export const LEFT_WIDTH = 190
export const RULER_HEIGHT = 35
export const LAYER_HEADER_HEIGHT = 24
export const INDENT_PX = 16
export const PX_PER_MS = 0.4

export const ANIMATABLE_PROPERTIES: AnimatableProperty[] = [
  'x', 'y', 'width', 'height', 'color', 'radius',
]

export const CAMERA_PROPERTIES: CameraAnimatableProperty[] = [
  'cam.pos.x', 'cam.pos.y', 'cam.pos.z',
  'cam.target.x', 'cam.target.y', 'cam.target.z',
  'cam.fov',
]

/** Clip entry for timeline display. For camera clips, cameraTracks provides type-safe access. */
export interface DisplayClipEntry {
  clip: AnimationClip
  label: string
  depth: number
  bundleId?: string
  isCamera?: boolean
  cameraTracks?: CameraKeyframeTrack[]
}

export function formatValue(prop: AnimatableProperty | CameraAnimatableProperty, value: number | undefined): string {
  if (value === undefined) return '?'
  if (prop === 'color') return `#${value.toString(16).padStart(6, '0')}`
  if (prop === 'radius') return value.toFixed(2)
  if ((prop as string).startsWith('cam.')) return value.toFixed(1)
  return String(Math.round(value))
}

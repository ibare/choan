// Shared constants, types, and helpers for Timeline components.

import type { AnimationClip, AnimatableProperty } from '../animation/types'

export const TRACK_HEIGHT = 38
export const LEFT_WIDTH = 190
export const RULER_HEIGHT = 44
export const LAYER_HEADER_HEIGHT = 24
export const INDENT_PX = 16
export const PX_PER_MS = 0.8

export const ANIMATABLE_PROPERTIES: AnimatableProperty[] = [
  'x', 'y', 'width', 'height', 'opacity', 'color', 'radius',
]

export interface DisplayClipEntry {
  clip: AnimationClip
  label: string
  depth: number
  bundleId?: string
}

export function formatValue(prop: AnimatableProperty, value: number | undefined): string {
  if (value === undefined) return '?'
  if (prop === 'color') return `#${value.toString(16).padStart(6, '0')}`
  if (prop === 'opacity' || prop === 'radius') return value.toFixed(2)
  return String(Math.round(value))
}

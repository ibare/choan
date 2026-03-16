// AnimationHint → AnimationClip preset resolver

import type { AnimationHint, ChoanElement } from '../store/useChoanStore'
import type { AnimationClip, KeyframeTrack } from './types'

const DEFAULT_DURATION = 300 // ms

function track(property: KeyframeTrack['property'], from: number, to: number, duration = DEFAULT_DURATION): KeyframeTrack {
  return { property, keyframes: [{ time: 0, value: from }, { time: duration, value: to }] }
}

export function resolvePreset(
  hint: AnimationHint,
  element: ChoanElement,
  easing: 'spring' | 'ease' | 'linear',
): AnimationClip {
  const { x, y, width, height } = element

  let tracks: KeyframeTrack[]
  let finalEasing = easing
  let duration = DEFAULT_DURATION

  switch (hint) {
    case 'fade':
      tracks = [track('opacity', 0, 1)]
      break
    case 'slide-up':
      tracks = [track('y', y + 40, y), track('opacity', 0, 1)]
      break
    case 'slide-down':
      tracks = [track('y', y - 40, y), track('opacity', 0, 1)]
      break
    case 'slide-left':
      tracks = [track('x', x + 60, x), track('opacity', 0, 1)]
      break
    case 'slide-right':
      tracks = [track('x', x - 60, x), track('opacity', 0, 1)]
      break
    case 'spring':
      tracks = [
        track('width', width * 0.8, width),
        track('height', height * 0.8, height),
      ]
      finalEasing = 'spring' // always spring
      duration = 400
      break
    case 'scale-in':
      tracks = [
        track('width', 0, width),
        track('height', 0, height),
        track('opacity', 0, 1),
      ]
      break
    case 'scale-out':
      tracks = [
        track('width', width, 0),
        track('height', height, 0),
        track('opacity', 1, 0),
      ]
      break
    default:
      tracks = [track('opacity', 0, 1)]
  }

  return {
    id: `preset_${hint}_${element.id}`,
    elementId: element.id,
    duration,
    easing: finalEasing,
    tracks,
  }
}

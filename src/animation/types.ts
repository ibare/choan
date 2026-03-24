// Animation system type definitions

export type AnimatableProperty = 'x' | 'y' | 'width' | 'height' | 'color' | 'radius'

// Per-keyframe granular easing (Keyframe.easing) and clip-level fallback (AnimationClip.easing).
// 'ease' maps to CSS cubic-bezier(0.25, 0.1, 0.25, 1.0) — resolveEasing() handles all values.
export type EasingType = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring'

export interface Keyframe {
  time: number    // ms offset from animation start (0 = start)
  value: number   // for color: 0xRRGGBB; for others: direct numeric value
  easing?: EasingType  // curve from this keyframe to the next (default: 'ease-in-out')
}

export interface KeyframeTrack {
  property: AnimatableProperty
  keyframes: Keyframe[]   // sorted by time, minimum 2 entries
}

export interface AnimationClip {
  id: string
  elementId: string
  duration: number        // ms, derived from max keyframe time
  easing: EasingType
  tracks: KeyframeTrack[]
}

export interface AnimationBundle {
  id: string              // nanoid
  name: string            // user-visible name (e.g. "메뉴 열기")
  clips: AnimationClip[]  // one clip per participating element
}

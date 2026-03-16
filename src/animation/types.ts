// Animation system type definitions

export type AnimatableProperty = 'x' | 'y' | 'width' | 'height' | 'opacity' | 'color' | 'radius'

export interface Keyframe {
  time: number    // ms offset from animation start (0 = start)
  value: number   // for color: 0xRRGGBB; for others: direct numeric value
}

export interface KeyframeTrack {
  property: AnimatableProperty
  keyframes: Keyframe[]   // sorted by time, minimum 2 entries
}

export interface AnimationClip {
  id: string
  elementId: string
  duration: number        // ms, derived from max keyframe time
  easing: 'spring' | 'ease' | 'linear'
  tracks: KeyframeTrack[]
}

export interface AnimationBundle {
  id: string              // nanoid
  name: string            // user-visible name (e.g. "메뉴 열기")
  clips: AnimationClip[]  // one clip per participating element
}

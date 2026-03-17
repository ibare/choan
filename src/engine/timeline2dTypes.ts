// Public types and interfaces for the Timeline 2D engine.

export interface TimelineHit {
  type: 'keyframe' | 'track' | 'ruler' | 'none'
  layerIdx: number
  trackIdx: number
  kfIdx: number
  time: number
}

export interface DisplayTrack {
  property: string
  keyframes: Array<{ time: number; value: number; easing?: string }>
}

export interface DisplayLayer {
  clipId: string
  label: string
  tracks: DisplayTrack[]
}

export interface RenderOptions {
  scrollX: number
  scrollY: number
  pxPerMs: number
  rulerHeight: number
  trackHeight: number
  layerHeaderHeight: number
  maxDuration: number
  hoverKf: { layerIdx: number; trackIdx: number; kfIdx: number } | null
  playheadTime: number | null
}

export interface Timeline2D {
  canvas: HTMLCanvasElement
  resize(width: number, height: number): void
  render(layers: DisplayLayer[], opts: RenderOptions): void
  hitTest(x: number, y: number, layers: DisplayLayer[], opts: RenderOptions): TimelineHit
  dispose(): void
}

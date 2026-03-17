// Choan Timeline 2D Canvas Engine — factory only.
// Rendering helpers → timeline2dRenderer.ts
// Drawing primitives → timeline2dPrimitives.ts
// Public types → timeline2dTypes.ts

export type { TimelineHit, DisplayTrack, DisplayLayer, RenderOptions, Timeline2D } from './timeline2dTypes'
import type { DisplayLayer, RenderOptions, Timeline2D } from './timeline2dTypes'
import { renderRuler, renderTracks, renderPlayhead } from './timeline2dRenderer'

const DIAMOND_HIT = 10
const DPR = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
const LEFT_PAD = 24  // px of space before t=0 so the playhead handle isn't clipped

export function createTimeline2D(container: HTMLElement): Timeline2D {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  container.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  let w = 0, h = 0

  function resize(width: number, height: number) {
    w = width; h = height
    canvas.width = Math.round(w * DPR)
    canvas.height = Math.round(h * DPR)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  }

  function msToX(ms: number, opts: RenderOptions): number {
    return ms * opts.pxPerMs - opts.scrollX + LEFT_PAD
  }

  function xToMs(x: number, opts: RenderOptions): number {
    return Math.max(0, Math.round((x - LEFT_PAD + opts.scrollX) / opts.pxPerMs))
  }

  function render(layers: DisplayLayer[], opts: RenderOptions) {
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, opts.rulerHeight, w, h - opts.rulerHeight)
    ctx.clip()
    renderTracks(ctx, w, h, layers, opts, msToX)
    ctx.restore()
    renderRuler(ctx, w, opts, msToX)
    renderPlayhead(ctx, w, h, opts, msToX)
  }

  function hitTest(x: number, y: number, layers: DisplayLayer[], opts: RenderOptions) {
    const none = { type: 'none' as const, layerIdx: -1, trackIdx: -1, kfIdx: -1, time: xToMs(x, opts) }
    if (y < opts.rulerHeight) return { type: 'ruler' as const, layerIdx: -1, trackIdx: -1, kfIdx: -1, time: xToMs(x, opts) }

    let curY = opts.rulerHeight - opts.scrollY
    for (let li = 0; li < layers.length; li++) {
      curY += opts.layerHeaderHeight
      for (let ti = 0; ti < layers[li].tracks.length; ti++) {
        const trackMidY = curY + opts.trackHeight / 2
        if (y >= curY && y < curY + opts.trackHeight) {
          for (let ki = 0; ki < layers[li].tracks[ti].keyframes.length; ki++) {
            const kf = layers[li].tracks[ti].keyframes[ki]
            const kx = msToX(kf.time, opts)
            if (Math.abs(x - kx) <= DIAMOND_HIT && Math.abs(y - trackMidY) <= DIAMOND_HIT) {
              return { type: 'keyframe' as const, layerIdx: li, trackIdx: ti, kfIdx: ki, time: kf.time }
            }
          }
          return { type: 'track' as const, layerIdx: li, trackIdx: ti, kfIdx: -1, time: xToMs(x, opts) }
        }
        curY += opts.trackHeight
      }
    }
    return none
  }

  return { canvas, resize, render, hitTest, xToMs, dispose: () => canvas.remove() }
}

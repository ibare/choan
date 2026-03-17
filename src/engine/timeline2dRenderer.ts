// Canvas2D rendering helpers for the timeline engine.
// All functions accept explicit ctx/w/h to allow extraction from the closure.

import type { DisplayLayer, RenderOptions } from './timeline2dTypes'
import { drawDiamond } from './timeline2dPrimitives'

export const BAR_HEIGHT = 3
const DIAMOND_SIZE = 15

const C = {
  rulerBg: '#f0ece6',
  rulerBorder: '#d6cfc5',
  rulerMajorTick: '#999',
  rulerMinorTick: '#ccc',
  rulerLabel: '#888',
  trackBg0: '#ffffff',
  trackBg1: '#f9f8f6',
  layerBg: '#f2efe9',
  layerBorder: '#e0d8d0',
  trackBar: '#ece9ff',
  playhead: '#1a1a2e',
  playheadHandle: '#1a1a2e',
}

const NICE_STEPS = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]

export function computeTickInterval(pxPerMs: number): { major: number; minor: number } {
  const targetMs = 100 / pxPerMs
  let major = NICE_STEPS[NICE_STEPS.length - 1]
  for (const step of NICE_STEPS) {
    if (step >= targetMs) { major = step; break }
  }
  return { major, minor: major <= 100 ? major / 4 : major / 5 }
}

export function formatTickLabel(ms: number): string {
  if (ms === 0) return '0'
  if (ms >= 1000) {
    const s = ms / 1000
    return ms % 1000 === 0 ? `${s}s` : `${s.toFixed(1)}s`
  }
  return `${ms}ms`
}

export function renderRuler(
  ctx: CanvasRenderingContext2D,
  w: number,
  opts: RenderOptions,
  msToX: (ms: number, opts: RenderOptions) => number,
) {
  const rh = opts.rulerHeight
  ctx.fillStyle = C.rulerBg
  ctx.fillRect(0, 0, w, rh)
  ctx.strokeStyle = C.rulerBorder
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, rh - 0.5)
  ctx.lineTo(w, rh - 0.5)
  ctx.stroke()

  const { major: majorInterval, minor: minorInterval } = computeTickInterval(opts.pxPerMs)
  const startMs = Math.max(0, Math.floor(opts.scrollX / opts.pxPerMs / minorInterval) * minorInterval)
  const endMs = Math.ceil((opts.scrollX + w) / opts.pxPerMs / minorInterval) * minorInterval
  const midY = rh * 0.55

  ctx.fillStyle = C.rulerMinorTick
  for (let t = startMs; t <= endMs; t += minorInterval) {
    const rt = Math.round(t)
    if (rt % majorInterval === 0) continue
    const x = msToX(rt, opts)
    if (x < -1 || x > w + 1) continue
    ctx.beginPath()
    ctx.arc(Math.round(x), midY, 1, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.font = '10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  const majorStart = Math.floor(startMs / majorInterval) * majorInterval
  for (let t = majorStart; t <= endMs; t += majorInterval) {
    const x = msToX(t, opts)
    if (x < -20 || x > w + 20) continue
    const px = Math.round(x) + 0.5
    ctx.strokeStyle = C.rulerMajorTick
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px, midY - 5)
    ctx.lineTo(px, midY + 5)
    ctx.stroke()
    ctx.fillStyle = C.rulerLabel
    ctx.fillText(formatTickLabel(t), px + 4, midY)
  }
}

export function renderTracks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  layers: DisplayLayer[],
  opts: RenderOptions,
  msToX: (ms: number, opts: RenderOptions) => number,
) {
  let y = opts.rulerHeight - opts.scrollY
  let colorIdx = 0

  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li]
    const lhH = opts.layerHeaderHeight
    if (y + lhH > opts.rulerHeight && y < h) {
      ctx.fillStyle = C.layerBg
      ctx.fillRect(0, y, w, lhH)
      ctx.strokeStyle = C.layerBorder
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, Math.round(y + lhH) - 0.5)
      ctx.lineTo(w, Math.round(y + lhH) - 0.5)
      ctx.stroke()
    }
    y += lhH

    for (let ti = 0; ti < layer.tracks.length; ti++) {
      const track = layer.tracks[ti]
      const th = opts.trackHeight
      const trackMidY = y + th / 2

      if (y + th > opts.rulerHeight && y < h) {
        ctx.fillStyle = colorIdx % 2 === 0 ? C.trackBg0 : C.trackBg1
        ctx.fillRect(0, y, w, th)

        if (track.keyframes.length >= 2) {
          const barX1 = msToX(track.keyframes[0].time, opts)
          const barX2 = msToX(track.keyframes[track.keyframes.length - 1].time, opts)
          ctx.fillStyle = C.trackBar
          ctx.beginPath()
          ctx.roundRect(barX1, trackMidY - BAR_HEIGHT / 2, barX2 - barX1, BAR_HEIGHT, 2)
          ctx.fill()
        }

        for (let ki = 0; ki < track.keyframes.length; ki++) {
          const kf = track.keyframes[ki]
          const kx = msToX(kf.time, opts)
          if (kx < -DIAMOND_SIZE || kx > w + DIAMOND_SIZE) continue
          const isHover = opts.hoverKf?.layerIdx === li && opts.hoverKf?.trackIdx === ti && opts.hoverKf?.kfIdx === ki
          drawDiamond(ctx, kx, trackMidY, isHover, kf.easing ?? undefined)
        }
      }
      y += th
      colorIdx++
    }
    if (layer.tracks.length === 0) colorIdx++
  }
}

export function renderPlayhead(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: RenderOptions,
  msToX: (ms: number, opts: RenderOptions) => number,
) {
  if (opts.playheadTime === null) return
  const x = msToX(opts.playheadTime, opts)
  if (x < -8 || x > w + 8) return
  const px = Math.round(x) + 0.5
  const rh = opts.rulerHeight

  ctx.strokeStyle = C.playhead
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, rh)
  ctx.lineTo(px, h)
  ctx.stroke()

  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(px, rh * 0.55 + 6)
  ctx.lineTo(px, rh)
  ctx.stroke()

  ctx.fillStyle = C.playheadHandle
  ctx.beginPath()
  ctx.arc(px, rh * 0.55, 5, 0, Math.PI * 2)
  ctx.fill()
}

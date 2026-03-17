// Choan Timeline 2D Canvas Engine
// Renders ruler, track bars, keyframe diamonds, and playhead on a single <canvas>.
// All hit testing is coordinate-based (no DOM nodes).

import { drawDiamond } from './timeline2dPrimitives'
export type { TimelineHit, DisplayTrack, DisplayLayer, RenderOptions, Timeline2D } from './timeline2dTypes'
import type { DisplayLayer, RenderOptions, Timeline2D } from './timeline2dTypes'

// ── Constants ──

const DIAMOND_SIZE = 15
const DIAMOND_HIT = 10
const BAR_HEIGHT = 3
const DPR = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1

// ── Colors ──

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

// ── Factory ──

export function createTimeline2D(container: HTMLElement): Timeline2D {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  container.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  let w = 0, h = 0

  function resize(width: number, height: number) {
    w = width
    h = height
    canvas.width = Math.round(w * DPR)
    canvas.height = Math.round(h * DPR)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  }

  function msToX(ms: number, opts: RenderOptions): number {
    return ms * opts.pxPerMs - opts.scrollX
  }

  function xToMs(x: number, opts: RenderOptions): number {
    return Math.max(0, Math.round((x + opts.scrollX) / opts.pxPerMs))
  }

  // ── Ruler ──

  // Pick a "nice" major interval so ticks are ~80-150px apart on screen
  const NICE_STEPS = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]

  function computeTickInterval(pxPerMs: number): { major: number; minor: number } {
    const targetPx = 100 // desired screen gap between major ticks
    const targetMs = targetPx / pxPerMs
    let major = NICE_STEPS[NICE_STEPS.length - 1]
    for (const step of NICE_STEPS) {
      if (step >= targetMs) { major = step; break }
    }
    // 4-5 minor divisions per major
    const minor = major <= 100 ? major / 4 : major / 5
    return { major, minor }
  }

  function formatTickLabel(ms: number): string {
    if (ms === 0) return '0'
    if (ms >= 1000) {
      const s = ms / 1000
      return ms % 1000 === 0 ? `${s}s` : `${s.toFixed(1)}s`
    }
    return `${ms}ms`
  }

  function renderRuler(opts: RenderOptions) {
    const rh = opts.rulerHeight

    // Background
    ctx.fillStyle = C.rulerBg
    ctx.fillRect(0, 0, w, rh)
    // Bottom border
    ctx.strokeStyle = C.rulerBorder
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, rh - 0.5)
    ctx.lineTo(w, rh - 0.5)
    ctx.stroke()

    // Adaptive tick intervals
    const { major: majorInterval, minor: minorInterval } = computeTickInterval(opts.pxPerMs)
    const startMs = Math.max(0, Math.floor(opts.scrollX / opts.pxPerMs / minorInterval) * minorInterval)
    const endMs = Math.ceil((opts.scrollX + w) / opts.pxPerMs / minorInterval) * minorInterval

    const midY = rh * 0.55 // vertical center for labels

    // Minor ticks — small dots hanging from top
    ctx.fillStyle = C.rulerMinorTick
    for (let t = startMs; t <= endMs; t += minorInterval) {
      const rt = Math.round(t)
      if (rt % majorInterval === 0) continue
      const x = msToX(rt, opts)
      if (x < -1 || x > w + 1) continue
      const px = Math.round(x)
      ctx.beginPath()
      ctx.arc(px, midY, 1, 0, Math.PI * 2)
      ctx.fill()
    }

    // Major ticks — vertical line from top + label
    ctx.font = '10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    const majorStart = Math.floor(startMs / majorInterval) * majorInterval
    for (let t = majorStart; t <= endMs; t += majorInterval) {
      const x = msToX(t, opts)
      if (x < -20 || x > w + 20) continue
      const px = Math.round(x) + 0.5

      // Tick line
      ctx.strokeStyle = C.rulerMajorTick
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px, midY - 5)
      ctx.lineTo(px, midY + 5)
      ctx.stroke()

      // Label right of tick
      ctx.fillStyle = C.rulerLabel
      ctx.fillText(formatTickLabel(t), px + 4, midY)
    }
  }

  // ── Tracks ──

  function renderTracks(layers: DisplayLayer[], opts: RenderOptions) {
    const startY = opts.rulerHeight - opts.scrollY
    let y = startY
    let colorIdx = 0

    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li]

      // Layer header background
      const lhH = opts.layerHeaderHeight
      if (y + lhH > opts.rulerHeight && y < h) {
        ctx.fillStyle = C.layerBg
        ctx.fillRect(0, y, w, lhH)
        // Bottom border
        ctx.strokeStyle = C.layerBorder
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, Math.round(y + lhH) - 0.5)
        ctx.lineTo(w, Math.round(y + lhH) - 0.5)
        ctx.stroke()
      }
      y += lhH

      // Tracks
      for (let ti = 0; ti < layer.tracks.length; ti++) {
        const track = layer.tracks[ti]
        const th = opts.trackHeight
        const trackY = y
        const trackMidY = trackY + th / 2

        if (trackY + th > opts.rulerHeight && trackY < h) {
          // Track background (alternating)
          ctx.fillStyle = colorIdx % 2 === 0 ? C.trackBg0 : C.trackBg1
          ctx.fillRect(0, trackY, w, th)

          // Track bar
          if (track.keyframes.length >= 2) {
            const sorted = track.keyframes
            const barX1 = msToX(sorted[0].time, opts)
            const barX2 = msToX(sorted[sorted.length - 1].time, opts)
            ctx.fillStyle = C.trackBar
            ctx.beginPath()
            ctx.roundRect(barX1, trackMidY - BAR_HEIGHT / 2, barX2 - barX1, BAR_HEIGHT, 2)
            ctx.fill()
          }

          // Keyframe diamonds
          for (let ki = 0; ki < track.keyframes.length; ki++) {
            const kf = track.keyframes[ki]
            const kx = msToX(kf.time, opts)
            if (kx < -DIAMOND_SIZE || kx > w + DIAMOND_SIZE) continue

            const isHover = opts.hoverKf?.layerIdx === li
              && opts.hoverKf?.trackIdx === ti
              && opts.hoverKf?.kfIdx === ki

            drawDiamond(ctx, kx, trackMidY, isHover, kf.easing ?? undefined)
          }
        }
        y += th
        colorIdx++
      }

      // If layer has no tracks, still advance a bit for the header
      if (layer.tracks.length === 0) {
        colorIdx++
      }
    }
  }

  // ── Playhead ──

  function renderPlayhead(opts: RenderOptions) {
    if (opts.playheadTime === null) return
    const x = msToX(opts.playheadTime, opts)
    if (x < -8 || x > w + 8) return
    const px = Math.round(x) + 0.5
    const rh = opts.rulerHeight

    // Vertical line spanning full height
    ctx.strokeStyle = C.playhead
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(px, rh)
    ctx.lineTo(px, h)
    ctx.stroke()

    // Stem in ruler area
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(px, rh * 0.55 + 6)
    ctx.lineTo(px, rh)
    ctx.stroke()

    // Round handle at ruler center
    ctx.fillStyle = C.playheadHandle
    ctx.beginPath()
    ctx.arc(px, rh * 0.55, 5, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── Main render ──

  function render(layers: DisplayLayer[], opts: RenderOptions) {
    ctx.clearRect(0, 0, w, h)

    // Clip below ruler to avoid tracks bleeding into ruler area
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, opts.rulerHeight, w, h - opts.rulerHeight)
    ctx.clip()
    renderTracks(layers, opts)
    ctx.restore()

    // Ruler always on top
    renderRuler(opts)

    // Playhead spans full height
    renderPlayhead(opts)
  }

  // ── Hit Test ──

  function hitTest(x: number, y: number, layers: DisplayLayer[], opts: RenderOptions): TimelineHit {
    const none: TimelineHit = { type: 'none', layerIdx: -1, trackIdx: -1, kfIdx: -1, time: xToMs(x, opts) }

    // Ruler area
    if (y < opts.rulerHeight) {
      return { type: 'ruler', layerIdx: -1, trackIdx: -1, kfIdx: -1, time: xToMs(x, opts) }
    }

    let curY = opts.rulerHeight - opts.scrollY

    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li]
      curY += opts.layerHeaderHeight

      for (let ti = 0; ti < layer.tracks.length; ti++) {
        const trackTop = curY
        const trackBot = curY + opts.trackHeight
        const trackMidY = curY + opts.trackHeight / 2

        if (y >= trackTop && y < trackBot) {
          // Check keyframes (closest first)
          for (let ki = 0; ki < layer.tracks[ti].keyframes.length; ki++) {
            const kf = layer.tracks[ti].keyframes[ki]
            const kx = msToX(kf.time, opts)
            const dx = x - kx
            const dy = y - trackMidY
            if (Math.abs(dx) <= DIAMOND_HIT && Math.abs(dy) <= DIAMOND_HIT) {
              return { type: 'keyframe', layerIdx: li, trackIdx: ti, kfIdx: ki, time: kf.time }
            }
          }
          // Empty track area
          return { type: 'track', layerIdx: li, trackIdx: ti, kfIdx: -1, time: xToMs(x, opts) }
        }

        curY += opts.trackHeight
      }
    }

    return none
  }

  // ── Dispose ──

  function dispose() {
    canvas.remove()
  }

  return { canvas, resize, render, hitTest, dispose }
}

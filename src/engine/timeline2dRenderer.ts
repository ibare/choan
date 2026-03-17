// Canvas2D rendering helpers for the timeline engine.
// All functions accept explicit ctx/w/h to allow extraction from the closure.

import type { DisplayLayer, RenderOptions } from './timeline2dTypes'
import { drawDiamond } from './timeline2dPrimitives'

export const BAR_HEIGHT = 3
const DIAMOND_SIZE = 15

const C = {
  rulerBg0: '#f7f4ef',
  rulerBg1: '#ece8e1',
  rulerBorder: '#d6cfc5',
  rulerMajorTick: '#aaa',
  rulerMediumTick: '#ccc',
  rulerMinorTick: '#ddd',
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

export function computeTickInterval(pxPerMs: number): { major: number; medium: number; minor: number } {
  const targetMs = 100 / pxPerMs
  let major = NICE_STEPS[NICE_STEPS.length - 1]
  for (const step of NICE_STEPS) {
    if (step >= targetMs) { major = step; break }
  }
  const minor = major <= 100 ? major / 4 : major / 5
  return { major, medium: major / 2, minor }
}

export function formatTickLabel(ms: number): string {
  const s = ms / 1000
  return `${parseFloat(s.toFixed(2))}s`
}

export function renderRuler(
  ctx: CanvasRenderingContext2D,
  w: number,
  opts: RenderOptions,
  msToX: (ms: number, opts: RenderOptions) => number,
) {
  const rh = opts.rulerHeight

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, rh)
  grad.addColorStop(0, C.rulerBg0)
  grad.addColorStop(1, C.rulerBg1)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, rh)

  // Bottom border
  ctx.strokeStyle = C.rulerBorder
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, rh - 0.5)
  ctx.lineTo(w, rh - 0.5)
  ctx.stroke()

  const { major: majorInterval, medium: mediumInterval, minor: minorInterval } = computeTickInterval(opts.pxPerMs)
  const startMs = Math.max(0, Math.floor(opts.scrollX / opts.pxPerMs / minorInterval) * minorInterval)
  const endMs = Math.ceil((opts.scrollX + w) / opts.pxPerMs / minorInterval) * minorInterval

  // Tick heights from bottom
  const majorH = 14
  const mediumH = 8
  const minorH = 4

  // Draw ticks (all minor intervals, bottom-up)
  for (let t = Math.floor(startMs / minorInterval) * minorInterval; t <= endMs; t += minorInterval) {
    const rt = Math.round(t)
    const x = msToX(rt, opts)
    if (x < -1 || x > w + 1) continue
    const px = Math.round(x) + 0.5

    const isMajor = rt % majorInterval === 0
    const isMedium = !isMajor && rt % mediumInterval === 0
    let tickH: number
    let color: string
    if (isMajor) {
      tickH = majorH; color = C.rulerMajorTick
    } else if (isMedium) {
      tickH = mediumH; color = C.rulerMediumTick
    } else {
      tickH = minorH; color = C.rulerMinorTick
    }

    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px, rh - tickH)
    ctx.lineTo(px, rh - 1)
    ctx.stroke()
  }

  // Draw labels at top (major ticks only)
  ctx.font = '500 9px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  ctx.fillStyle = C.rulerLabel
  const majorStart = Math.floor(startMs / majorInterval) * majorInterval
  for (let t = majorStart; t <= endMs; t += majorInterval) {
    const x = msToX(t, opts)
    if (x < -40 || x > w + 40) continue
    ctx.fillText(formatTickLabel(t), Math.round(x), 6)
  }
  ctx.textAlign = 'left'
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

function formatPlayheadLabel(ms: number): string {
  const s = ms / 1000
  return parseFloat(s.toFixed(2)).toString()
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
  if (x < -80 || x > w + 80) return
  const px = Math.round(x) + 0.5
  const rh = opts.rulerHeight

  // Snapped = exactly on a major tick
  const { major: majorInterval } = computeTickInterval(opts.pxPerMs)
  const isSnapped = opts.playheadTime % majorInterval === 0

  // Vertical line over tracks
  ctx.strokeStyle = C.playhead
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, rh)
  ctx.lineTo(px, h)
  ctx.stroke()

  // Shield handle dimensions
  const label = formatPlayheadLabel(opts.playheadTime)
  ctx.font = '500 9px Inter, system-ui, sans-serif'
  const textW = ctx.measureText(label).width
  const handlePadX = 8
  const handleW = Math.max(textW + handlePadX * 2, 38)
  const handleBodyH = 27
  const handleR = 4
  const handleY = 2
  const tipY = rh - 2

  // Handle rect x: centered on px, clamped to canvas bounds
  let handleX = px - handleW / 2
  handleX = Math.max(2, Math.min(w - handleW - 2, handleX))

  // Tip x: always px, clamped inside handle rect
  const tipX = Math.max(handleX + handleR + 2, Math.min(handleX + handleW - handleR - 2, px))

  // Vertical line inside ruler (tip → ruler bottom)
  ctx.strokeStyle = C.playhead
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX, rh)
  ctx.stroke()

  // Shield shape: rounded top corners, straight bottom corners → pointed tip
  const bodyBottom = handleY + handleBodyH
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.moveTo(handleX + handleR, handleY)
  ctx.lineTo(handleX + handleW - handleR, handleY)
  ctx.quadraticCurveTo(handleX + handleW, handleY, handleX + handleW, handleY + handleR)
  ctx.lineTo(handleX + handleW, bodyBottom)
  ctx.lineTo(tipX, tipY)
  ctx.lineTo(handleX, bodyBottom)
  ctx.lineTo(handleX, handleY + handleR)
  ctx.quadraticCurveTo(handleX, handleY, handleX + handleR, handleY)
  ctx.closePath()
  ctx.fill()

  // Inner box: white normally, green glow when snapped
  const innerPad = 4
  const innerR = 3
  const innerX = handleX + innerPad
  const innerY = handleY + innerPad
  const innerW = handleW - innerPad * 2
  const innerH = handleBodyH - innerPad * 2

  if (isSnapped) {
    // Green glow behind the box
    ctx.save()
    ctx.shadowColor = '#4ade80'
    ctx.shadowBlur = 6
    ctx.fillStyle = '#4ade80'
    ctx.beginPath()
    ctx.roundRect(innerX, innerY, innerW, innerH, innerR)
    ctx.fill()
    ctx.restore()
  } else {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.roundRect(innerX, innerY, innerW, innerH, innerR)
    ctx.fill()
  }

  // Time label inside inner box
  ctx.fillStyle = isSnapped ? '#fff' : '#222'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(label, handleX + handleW / 2, handleY + handleBodyH / 2)

  ctx.textAlign = 'left'
}

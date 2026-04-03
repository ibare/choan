// Rail time labels — shows start/end time with leader lines from rail handles.
// Uses perpendicular offset from rail direction to avoid overlap.
// Reads from a ref updated by the animation loop (direct DOM update, no React re-render).

import { useRef, useEffect, type MutableRefObject } from 'react'

export interface RailTimeLabelData {
  anchorX: number   // screen px — handle center
  anchorY: number
  timeMs: number    // raw ms — for sequence numbering
  text: string
  color: string
  railDirX: number  // normalized screen-space rail direction
  railDirY: number
}

interface RailTimeLabelsProps {
  labelsRef: MutableRefObject<RailTimeLabelData[]>
}

const LEADER_LEN = 40   // px — leader line length
const LABEL_PAD_X = 6
const LABEL_PAD_Y = 2
const MARGIN = 12        // px — viewport edge margin

export default function RailTimeLabels({ labelsRef }: RailTimeLabelsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let frameId = 0
    const update = () => {
      frameId = requestAnimationFrame(update)
      const canvas = canvasRef.current
      if (!canvas) return
      const labels = labelsRef.current
      const parent = canvas.parentElement
      if (!parent) return

      const w = parent.clientWidth
      const h = parent.clientHeight
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      if (labels.length === 0) return

      // ── Compute sequence numbers ──
      // Collect all unique times, sort ascending, assign 1-based sequence.
      // Same time = same sequence number but flagged as simultaneous.
      const allTimes = labels.map(l => l.timeMs)
      const uniqueTimes = [...new Set(allTimes)].sort((a, b) => a - b)
      const timeToSeq = new Map<number, number>()
      uniqueTimes.forEach((t, i) => timeToSeq.set(t, i + 1))
      // 6 sequence color tones (max 3 axes × 2 endpoints = 6)
      // Each: [dark (number badge), light (time background)]
      const SEQ_TONES: Array<[string, string]> = [
        ['#2d8a4e', '#5ec97d'],  // 1: green
        ['#2975b0', '#5aade0'],  // 2: blue
        ['#9b45b5', '#c87de0'],  // 3: purple
        ['#c07020', '#e8a84c'],  // 4: orange
        ['#b83b5e', '#e86888'],  // 5: rose
        ['#4a8a8a', '#70c0c0'],  // 6: teal
      ]

      // ── Compute label positions with perpendicular offset ──
      type PlacedLabel = { lx: number; ly: number; lbl: RailTimeLabelData; seq: number }
      const placed: PlacedLabel[] = []

      for (const lbl of labels) {
        const seq = timeToSeq.get(lbl.timeMs)!

        // Perpendicular to rail direction (rotate 90 degrees)
        let perpX = -lbl.railDirY
        let perpY = lbl.railDirX

        // Choose the perpendicular direction that points more toward viewport center
        const cx = w / 2, cy = h / 2
        const toCenterX = cx - lbl.anchorX, toCenterY = cy - lbl.anchorY
        if (perpX * toCenterX + perpY * toCenterY < 0) {
          perpX = -perpX
          perpY = -perpY
        }

        // Label endpoint
        let lx = lbl.anchorX + perpX * LEADER_LEN
        let ly = lbl.anchorY + perpY * LEADER_LEN

        // Estimate total width: number badge + time text
        ctx.font = '700 11px system-ui, sans-serif'
        const numText = `${seq}`
        const numW = ctx.measureText(numText).width + 8
        const timeW = ctx.measureText(lbl.text).width + LABEL_PAD_X * 2
        const totalW = numW + timeW
        const th = 20

        // Clamp to viewport edges
        lx = Math.max(MARGIN + totalW / 2, Math.min(w - MARGIN - totalW / 2, lx))
        ly = Math.max(MARGIN + th / 2, Math.min(h - MARGIN - th / 2, ly))

        // Simple overlap avoidance
        for (const prev of placed) {
          const dx = lx - prev.lx, dy = ly - prev.ly
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < th + 6) {
            const push = (th + 6 - dist) / 2
            const nx = dist > 0.01 ? dx / dist : 0
            const ny = dist > 0.01 ? dy / dist : 1
            lx += nx * push
            ly += ny * push
          }
        }

        placed.push({ lx, ly, lbl, seq })
      }

      // ── Draw leader lines + two-part labels ──
      for (const { lx, ly, lbl, seq } of placed) {
        const tone = SEQ_TONES[(seq - 1) % SEQ_TONES.length]
        const darkColor = tone[0]
        const lightColor = tone[1]

        ctx.font = '700 11px system-ui, sans-serif'
        const numText = `${seq}`
        const numW = ctx.measureText(numText).width + 10
        const timeW = ctx.measureText(lbl.text).width + LABEL_PAD_X * 2
        const totalW = numW + timeW
        const th = 20
        const bx = lx - totalW / 2
        const by = ly - th / 2

        // Leader line
        ctx.beginPath()
        ctx.moveTo(lbl.anchorX, lbl.anchorY)
        ctx.lineTo(bx + numW / 2, ly)
        ctx.strokeStyle = lightColor + '99'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Small dot at anchor
        ctx.beginPath()
        ctx.arc(lbl.anchorX, lbl.anchorY, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = lightColor
        ctx.fill()

        // Number badge (left part — dark tone)
        ctx.beginPath()
        ctx.roundRect(bx, by, numW, th, [4, 0, 0, 4])
        ctx.fillStyle = darkColor
        ctx.fill()

        // Number text
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(numText, bx + numW / 2, ly)

        // Time part (right part — light tone)
        ctx.beginPath()
        ctx.roundRect(bx + numW, by, timeW, th, [0, 4, 4, 0])
        ctx.fillStyle = lightColor
        ctx.fill()

        // Time text
        ctx.fillStyle = '#fff'
        ctx.fillText(lbl.text, bx + numW + timeW / 2, ly)

        // Outer border
        ctx.beginPath()
        ctx.roundRect(bx, by, totalW, th, 4)
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
    frameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frameId)
  }, [labelsRef])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  )
}

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

const LEADER_LEN = 80   // px — leader line length
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
      type PlacedLabel = { lx: number; ly: number; lbl: RailTimeLabelData; seq: number; tw: number; th: number }
      const placed: PlacedLabel[] = []

      // Helper: compute bounding box overlap area with all placed labels
      const overlapScore = (cx: number, cy: number, tw: number, th: number): number => {
        let score = 0
        const ax0 = cx - tw / 2, ax1 = cx + tw / 2, ay0 = cy - th / 2, ay1 = cy + th / 2
        for (const prev of placed) {
          const bx0 = prev.lx - prev.tw / 2, bx1 = prev.lx + prev.tw / 2
          const by0 = prev.ly - prev.th / 2, by1 = prev.ly + prev.th / 2
          const ox = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0))
          const oy = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0))
          score += ox * oy
        }
        return score
      }

      for (const lbl of labels) {
        const seq = timeToSeq.get(lbl.timeMs)!

        // Two perpendicular candidates (rotate rail direction ±90°)
        const perpAx = -lbl.railDirY, perpAy = lbl.railDirX
        const perpBx = lbl.railDirY, perpBy = -lbl.railDirX

        // Estimate label dimensions
        ctx.font = '700 11px system-ui, sans-serif'
        const numText = `${seq}`
        const numW = ctx.measureText(numText).width + 10
        const timeW = ctx.measureText(lbl.text).width + LABEL_PAD_X * 2
        const totalW = numW + timeW
        const th = 20

        // Clamp helper
        const clamp = (cx: number, cy: number): [number, number] => [
          Math.max(MARGIN + totalW / 2, Math.min(w - MARGIN - totalW / 2, cx)),
          Math.max(MARGIN + th / 2, Math.min(h - MARGIN - th / 2, cy)),
        ]

        // Candidate A: perpendicular direction A
        const [axA, ayA] = clamp(lbl.anchorX + perpAx * LEADER_LEN, lbl.anchorY + perpAy * LEADER_LEN)
        const scoreA = overlapScore(axA, ayA, totalW, th)

        // Candidate B: perpendicular direction B (opposite)
        const [axB, ayB] = clamp(lbl.anchorX + perpBx * LEADER_LEN, lbl.anchorY + perpBy * LEADER_LEN)
        const scoreB = overlapScore(axB, ayB, totalW, th)

        // Pick the candidate with less overlap; tie-break by closer to viewport center
        let lx: number, ly: number
        if (scoreA === 0 && scoreB === 0) {
          // No overlap on either side — prefer toward viewport center
          const cx = w / 2, cy = h / 2
          const dA = (axA - cx) ** 2 + (ayA - cy) ** 2
          const dB = (axB - cx) ** 2 + (ayB - cy) ** 2
          ;[lx, ly] = dA <= dB ? [axA, ayA] : [axB, ayB]
        } else {
          ;[lx, ly] = scoreA <= scoreB ? [axA, ayA] : [axB, ayB]
        }

        placed.push({ lx, ly, lbl, seq, tw: totalW, th })
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

        // Leader line (dashed)
        ctx.beginPath()
        ctx.setLineDash([4, 3])
        ctx.moveTo(lbl.anchorX, lbl.anchorY)
        ctx.lineTo(bx + numW / 2, ly)
        ctx.strokeStyle = lightColor + '99'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.setLineDash([])

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

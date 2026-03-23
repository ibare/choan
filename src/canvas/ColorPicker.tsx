// Custom color picker — gradient canvas + 9-step rotating shade swatches.
// Opens as Radix Popover content from the context toolbar.

import { useEffect, useRef } from 'react'

// ── HSL conversion utilities ─────────────────────────────────

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60)       { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else              { r = c; b = x }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return [h, s, l]
}

function colorToHsl(n: number): [number, number, number] {
  return rgbToHsl((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff)
}

function hslToColor(h: number, s: number, l: number): number {
  const [r, g, b] = hslToRgb(h, s, l)
  return (r << 16) | (g << 8) | b
}

function colorToHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

// ── Constants ────────────────────────────────────────────────

const W = 360
const H = 240
const SAT = 0.80
const BW_THRESHOLD = 0.90 // rightmost 10% is grayscale band
const L_MAX = 0.90
const L_MIN = 0.10
const L_RANGE = L_MAX - L_MIN

// 9 lightness steps in a circular ring
const STEP_COUNT = 9
const ALL_STEPS = Array.from({ length: STEP_COUNT }, (_, i) => 0.10 + i * 0.10)
// [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90]

// Tripled track for infinite carousel: [...steps, ...steps, ...steps] = 27 items.
// The middle copy (indices 9–17) is the "home" — we translateX so the active
// item in the middle copy sits at the visible center (position 4 of 9).
const TRIPLED = [...ALL_STEPS, ...ALL_STEPS, ...ALL_STEPS]

// ── Component ────────────────────────────────────────────────

interface ColorPickerProps {
  color: number
  onChange: (color: number) => void
}

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef(false)

  // Draw gradient once on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(canvas.width, canvas.height)
    const data = imageData.data
    const pw = canvas.width, ph = canvas.height
    for (let y = 0; y < ph; y++) {
      const l = L_MAX - (y / ph) * L_RANGE
      for (let x = 0; x < pw; x++) {
        const nx = x / pw
        const [r, g, b] = nx >= BW_THRESHOLD
          ? hslToRgb(0, 0, l)                          // grayscale band
          : hslToRgb((nx / BW_THRESHOLD) * 360, SAT, l) // color region
        const i = (y * pw + x) * 4
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }, [])

  // Pick color from canvas coordinates
  const pick = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    const l = L_MAX - ny * L_RANGE
    if (nx >= BW_THRESHOLD) {
      onChange(hslToColor(0, 0, l)) // grayscale
    } else {
      const h = (nx / BW_THRESHOLD) * 360
      onChange(hslToColor(h, SAT, l))
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pick(e.clientX, e.clientY)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) pick(e.clientX, e.clientY)
  }
  const handlePointerUp = () => { dragRef.current = false }

  // Cursor position derived from current color
  const [curH, curS, curL] = colorToHsl(color)
  const isGray = curS < 0.05
  const cursorLeft = isGray
    ? `${(BW_THRESHOLD + (1 - BW_THRESHOLD) / 2) * 100}%`  // center of BW band
    : `${(curH / 360) * BW_THRESHOLD * 100}%`               // within color region
  const cursorTop = `${((L_MAX - Math.max(L_MIN, Math.min(L_MAX, curL))) / L_RANGE) * 100}%`

  // Active step index (0–8) in ALL_STEPS
  const [shadeH] = colorToHsl(color)
  const activeIdx = ALL_STEPS.reduce((best, l, i) =>
    Math.abs(l - curL) < Math.abs(ALL_STEPS[best] - curL) ? i : best, 0)

  // translateX: center the active item from the middle copy (index 9+activeIdx)
  // Each item = 100%/27 of track width. Window starts at (5+activeIdx).
  const offsetPct = -((5 + activeIdx) / 27) * 100

  return (
    <>
      {/* Gradient canvas */}
      <div
        className="color-picker-canvas-wrap"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <canvas ref={canvasRef} />
        <div
          className="color-picker-cursor"
          style={{ left: cursorLeft, top: cursorTop, background: colorToHex(color) }}
        />
      </div>

      {/* Shade carousel — slides so active is always centered */}
      <div className="color-picker-shades">
        <div
          className="color-picker-shades__track"
          style={{ transform: `translateX(${offsetPct}%)` }}
        >
          {TRIPLED.map((l, i) => {
            const c = hslToColor(shadeH, SAT, l)
            const isCenter = i === 9 + activeIdx
            return (
              <button
                key={i}
                className={`color-picker-shade${isCenter ? ' active' : ''}`}
                onClick={() => onChange(c)}
              >
                <div className="color-picker-shade__swatch" style={{ background: colorToHex(c) }} />
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

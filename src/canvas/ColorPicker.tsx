// Custom color picker — gradient canvas + grayscale strip + 9-step rotating shade swatches.
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

const SAT = 0.80
const L_MAX = 1.0
const L_MIN = 0.0
const L_RANGE = L_MAX - L_MIN  // 1.0

const STEP_COUNT = 9
// 0.0 (black) → 1.0 (white) in 9 even steps
const ALL_STEPS = Array.from({ length: STEP_COUNT }, (_, i) => i / (STEP_COUNT - 1))
const TRIPLED = [...ALL_STEPS, ...ALL_STEPS, ...ALL_STEPS]

// ── Component ────────────────────────────────────────────────

interface ColorPickerProps {
  color: number
  onChange: (color: number) => void
}

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
  const colorCanvasRef = useRef<HTMLCanvasElement>(null)
  const bwCanvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<'color' | 'bw' | false>(false)

  // Draw color gradient on mount
  useEffect(() => {
    const canvas = colorCanvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cw = 320, ch = 240
    canvas.width = cw * dpr
    canvas.height = ch * dpr
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(canvas.width, canvas.height)
    const d = img.data
    for (let y = 0; y < canvas.height; y++) {
      const l = L_MAX - (y / canvas.height) * L_RANGE
      for (let x = 0; x < canvas.width; x++) {
        const h = (x / canvas.width) * 360
        const [r, g, b] = hslToRgb(h, SAT, l)
        const i = (y * canvas.width + x) * 4
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [])

  // Draw grayscale strip on mount
  useEffect(() => {
    const canvas = bwCanvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cw = 32, ch = 240
    canvas.width = cw * dpr
    canvas.height = ch * dpr
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(canvas.width, canvas.height)
    const d = img.data
    for (let y = 0; y < canvas.height; y++) {
      const l = 1.0 - (y / canvas.height) // full range: white(1.0) → black(0.0)
      const [r, g, b] = hslToRgb(0, 0, l)
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [])

  // Snap extremes so pure white/black are easily reachable
  const snapY = (ny: number) => ny < 0.02 ? 0 : ny > 0.98 ? 1 : ny

  // Pick from color canvas
  const pickColor = (clientX: number, clientY: number) => {
    const canvas = colorCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const ny = snapY(Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)))
    onChange(hslToColor(nx * 360, SAT, L_MAX - ny * L_RANGE))
  }

  // Pick from BW strip
  const pickBW = (clientX: number, clientY: number) => {
    const canvas = bwCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const ny = snapY(Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)))
    void clientX // only Y matters
    onChange(hslToColor(0, 0, 1.0 - ny))
  }

  const handleDown = (src: 'color' | 'bw') => (e: React.PointerEvent) => {
    dragRef.current = src
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    ;(src === 'color' ? pickColor : pickBW)(e.clientX, e.clientY)
  }
  const handleMove = (src: 'color' | 'bw') => (e: React.PointerEvent) => {
    if (dragRef.current === src) (src === 'color' ? pickColor : pickBW)(e.clientX, e.clientY)
  }
  const handleUp = () => { dragRef.current = false }

  // Current color analysis
  const [curH, curS, curL] = colorToHsl(color)
  const isGray = curS < 0.05

  // Cursor for color canvas
  const colorCursorLeft = `${(curH / 360) * 100}%`
  const colorCursorTop = `${((L_MAX - Math.max(L_MIN, Math.min(L_MAX, curL))) / L_RANGE) * 100}%`

  // Cursor for BW strip (full 0–1 range)
  const bwCursorTop = `${(1.0 - Math.max(0, Math.min(1, curL))) * 100}%`

  // Shade carousel
  const shadeSat = isGray ? 0 : SAT
  const shadeHue = isGray ? 0 : curH
  const activeIdx = ALL_STEPS.reduce((best, l, i) =>
    Math.abs(l - curL) < Math.abs(ALL_STEPS[best] - curL) ? i : best, 0)
  const offsetPct = -((5 + activeIdx) / 27) * 100

  return (
    <>
      {/* Top row: color gradient + BW strip */}
      <div className="color-picker-top">
        {/* Color gradient */}
        <div
          className="color-picker-canvas-wrap"
          onPointerDown={handleDown('color')}
          onPointerMove={handleMove('color')}
          onPointerUp={handleUp}
        >
          <canvas ref={colorCanvasRef} />
          {!isGray && (
            <div
              className="color-picker-cursor"
              style={{ left: colorCursorLeft, top: colorCursorTop, background: colorToHex(color) }}
            />
          )}
        </div>

        {/* Grayscale strip */}
        <div
          className="color-picker-bw-wrap"
          onPointerDown={handleDown('bw')}
          onPointerMove={handleMove('bw')}
          onPointerUp={handleUp}
        >
          <canvas ref={bwCanvasRef} />
          {isGray && (
            <div
              className="color-picker-cursor"
              style={{ left: '50%', top: bwCursorTop, background: colorToHex(color) }}
            />
          )}
        </div>
      </div>

      {/* Shade carousel */}
      <div className="color-picker-shades">
        <div
          className="color-picker-shades__track"
          style={{ transform: `translateX(${offsetPct}%)` }}
        >
          {TRIPLED.map((l, i) => {
            const c = hslToColor(shadeHue, shadeSat, l)
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

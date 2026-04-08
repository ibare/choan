// Component painters — Canvas 2D draw functions for atlas regions.
// Each painter renders a UI component with toon-style outlines matching
// the SDF renderer's edge color and width settings.

export interface StrokeStyle {
  color: string
  width: number
}

type PaintFn = (
  ctx: OffscreenCanvasRenderingContext2D,
  w: number, h: number,
  state: Record<string, unknown>,
  stroke: StrokeStyle,
  time?: number,
) => void

// ── Helpers ──

function outlined(ctx: OffscreenCanvasRenderingContext2D, stroke: StrokeStyle) {
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.stroke()
}

// ── Switch ──

function paintSwitch(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const isOn = !!state.on
  const trackH = h * 0.52, trackW = w * 0.82
  const tx = (w - trackW) / 2, ty = (h - trackH) / 2, trackR = trackH / 2

  ctx.beginPath()
  ctx.roundRect(tx, ty, trackW, trackH, trackR)
  ctx.fillStyle = isOn ? '#34C759' : '#ccc'
  ctx.fill()
  outlined(ctx, stroke)

  const handleR = trackH * 0.42
  const hx = isOn ? tx + trackW - trackR : tx + trackR
  ctx.beginPath()
  ctx.arc(hx, h / 2, handleR, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  outlined(ctx, stroke)
}

// ── Checkbox ──

function paintCheckbox(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const checked = !!state.checked
  const s = Math.min(w, h)
  const boxSize = s * 0.6
  const bx = (w - boxSize) / 2, by = (h - boxSize) / 2, r = boxSize * 0.15

  ctx.beginPath()
  ctx.roundRect(bx, by, boxSize, boxSize, r)
  ctx.fillStyle = checked ? '#5b4fcf' : '#fff'
  ctx.fill()
  outlined(ctx, stroke)

  if (checked) {
    ctx.beginPath()
    ctx.moveTo(bx + boxSize * 0.22, by + boxSize * 0.52)
    ctx.lineTo(bx + boxSize * 0.42, by + boxSize * 0.72)
    ctx.lineTo(bx + boxSize * 0.78, by + boxSize * 0.3)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = stroke.width * 1.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
}

// ── Radio ──

function paintRadio(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const selected = !!state.selected
  const r = Math.min(w, h) * 0.3

  ctx.beginPath()
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  outlined(ctx, stroke)

  if (selected) {
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = '#5b4fcf'
    ctx.fill()
  }
}

// ── Button ──

function paintButton(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const label = (state.label as string) || 'Button'
  const pressed = !!state.pressed
  const pad = Math.min(w, h) * 0.12
  const r = Math.min(w, h) * 0.22

  ctx.beginPath()
  ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, r)
  ctx.fillStyle = pressed ? '#4a3fb8' : '#5b4fcf'
  ctx.fill()
  outlined(ctx, stroke)

  ctx.fillStyle = '#fff'
  ctx.font = `600 ${h * 0.28}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, w / 2, h / 2)
}

// ── Slider ──

function paintSlider(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const value = Math.max(0, Math.min(1, Number(state.value) || 0))
  const trackH = h * 0.18
  const trackY = (h - trackH) / 2
  const pad = h * 0.35
  const trackR = trackH / 2

  // Background track
  ctx.beginPath()
  ctx.roundRect(pad, trackY, w - pad * 2, trackH, trackR)
  ctx.fillStyle = '#e0e0e0'
  ctx.fill()
  outlined(ctx, stroke)

  // Filled track
  const fillW = (w - pad * 2) * value
  if (fillW > trackH) {
    ctx.beginPath()
    ctx.roundRect(pad, trackY, fillW, trackH, trackR)
    ctx.fillStyle = '#5b4fcf'
    ctx.fill()
    outlined(ctx, stroke)
  }

  // Handle
  const handleR = h * 0.28
  const hx = pad + (w - pad * 2) * value
  ctx.beginPath()
  ctx.arc(hx, h / 2, handleR, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  outlined(ctx, stroke)
}

// ── Text Input ──

function paintTextInput(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const focused = !!state.focused
  const placeholder = (state.placeholder as string) || 'Type here...'
  const pad = Math.min(w, h) * 0.1
  const r = Math.min(w, h) * 0.18

  ctx.beginPath()
  ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, r)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = focused ? '#5b4fcf' : stroke.color
  ctx.lineWidth = focused ? stroke.width * 1.5 : stroke.width
  ctx.stroke()

  ctx.fillStyle = '#aaa'
  ctx.font = `${h * 0.24}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(placeholder, pad * 2.5, h / 2)

  if (focused) {
    const textW = ctx.measureText(placeholder).width
    ctx.fillStyle = '#5b4fcf'
    ctx.fillRect(pad * 2.5 + textW + 4, h * 0.3, stroke.width, h * 0.4)
  }
}

// ── Progress Bar ──

function paintProgress(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const value = Math.max(0, Math.min(1, Number(state.value) || 0))
  const barH = h * 0.35
  const barY = (h - barH) / 2
  const pad = w * 0.08
  const r = barH / 2

  ctx.beginPath()
  ctx.roundRect(pad, barY, w - pad * 2, barH, r)
  ctx.fillStyle = '#e0e0e0'
  ctx.fill()
  outlined(ctx, stroke)

  const fillW = (w - pad * 2) * value
  if (fillW > barH) {
    ctx.beginPath()
    ctx.roundRect(pad, barY, fillW, barH, r)
    ctx.fillStyle = '#34C759'
    ctx.fill()
    outlined(ctx, stroke)
  }

  ctx.fillStyle = stroke.color
  ctx.font = `600 ${h * 0.22}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${Math.round(value * 100)}%`, w / 2, h / 2)
}

// ── Badge ──

function paintBadge(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const count = Math.max(1, Number(state.count) || 1)
  const r = Math.min(w, h) * 0.38

  ctx.beginPath()
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
  ctx.fillStyle = '#ef4444'
  ctx.fill()
  outlined(ctx, stroke)

  ctx.fillStyle = '#fff'
  ctx.font = `700 ${r * 0.88}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(count > 99 ? '99+' : String(count), w / 2, h / 2)
}

// ── Star Rating ──

function paintStarRating(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const rating = Math.max(0, Math.min(5, Number(state.rating) || 0))
  const starCount = 5
  const starSize = Math.min(w / starCount * 0.8, h * 0.55)
  const gap = (w - starSize * starCount) / (starCount + 1)
  const cy = h / 2

  for (let i = 0; i < starCount; i++) {
    const cx = gap + starSize / 2 + i * (starSize + gap)
    drawStar(ctx, cx, cy, starSize / 2, starSize / 4.5, 5)
    ctx.fillStyle = i < rating ? '#f59e0b' : '#e0e0e0'
    ctx.fill()
    outlined(ctx, stroke)
  }
}

function drawStar(ctx: OffscreenCanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, points: number) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (i * Math.PI) / points - Math.PI / 2
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

// ── Avatar ──

function paintAvatar(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const initials = (state.initials as string) || '?'
  const online = !!state.online
  const r = Math.min(w, h) * 0.38

  // Circle background
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
  ctx.fillStyle = '#c4b5fd'
  ctx.fill()
  outlined(ctx, stroke)

  // Initials
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${r * 0.9}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials.slice(0, 2).toUpperCase(), w / 2, h / 2)

  // Status dot
  const dotR = r * 0.28
  const dotX = w / 2 + r * 0.7
  const dotY = h / 2 + r * 0.7
  ctx.beginPath()
  ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
  ctx.fillStyle = online ? '#34C759' : '#999'
  ctx.fill()
  outlined(ctx, stroke)
}

// ── Search Bar ──

function paintSearch(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const query = (state.query as string) || ''
  const pad = Math.min(w, h) * 0.1
  const r = (h - pad * 2) / 2

  // Background
  ctx.beginPath()
  ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, r)
  ctx.fillStyle = '#f5f5f5'
  ctx.fill()
  outlined(ctx, stroke)

  // Search icon (magnifying glass)
  const iconR = h * 0.13
  const iconX = pad * 3
  const iconY = h / 2
  ctx.beginPath()
  ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2)
  ctx.strokeStyle = '#999'
  ctx.lineWidth = stroke.width * 0.8
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(iconX + iconR * 0.7, iconY + iconR * 0.7)
  ctx.lineTo(iconX + iconR * 1.5, iconY + iconR * 1.5)
  ctx.stroke()

  // Placeholder/query
  ctx.fillStyle = query ? stroke.color : '#aaa'
  ctx.font = `${h * 0.24}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(query || 'Search...', iconX + iconR * 2, h / 2)
}

// ── Dropdown ──

function paintDropdown(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const label = (state.label as string) || 'Select...'
  const open = !!state.open
  const pad = Math.min(w, h) * 0.1
  const r = Math.min(w, h) * 0.18

  ctx.beginPath()
  ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, r)
  ctx.fillStyle = '#fff'
  ctx.fill()
  outlined(ctx, stroke)

  ctx.fillStyle = stroke.color
  ctx.font = `${h * 0.24}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, pad * 2.5, h / 2)

  // Chevron
  const chevX = w - pad * 3.5
  const chevY = h / 2
  const chevS = h * 0.1
  ctx.beginPath()
  ctx.moveTo(chevX - chevS, chevY - chevS * (open ? -0.6 : 0.6))
  ctx.lineTo(chevX, chevY + chevS * (open ? -0.6 : 0.6))
  ctx.lineTo(chevX + chevS, chevY - chevS * (open ? -0.6 : 0.6))
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

// ── Text ──

function paintText(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const text = (state.text as string) || 'Text'
  const fontSize = Number(state.fontSize) || Math.round(h * 0.5)
  const align = (state.align as string) || 'center'
  const bold = !!state.bold

  ctx.fillStyle = (state.textColor as string) || stroke.color
  ctx.font = `${bold ? '700' : '400'} ${fontSize}px Inter, system-ui, sans-serif`
  ctx.textAlign = align as CanvasTextAlign
  ctx.textBaseline = 'middle'

  const x = align === 'left' ? fontSize * 0.3 : align === 'right' ? w - fontSize * 0.3 : w / 2
  ctx.fillText(text, x, h / 2, w - fontSize * 0.6)
}

// ── Table Skeleton ──

function paintTableSkeleton(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const cols = Math.max(1, Math.min(10, Number(state.columns) || 3))
  const pad = w * 0.04
  const headerH = h * 0.07
  const ROW_HEIGHT = 28 // fixed row height in px
  const rows = Math.max(1, Math.floor((h - pad * 2 - headerH) / ROW_HEIGHT))
  const rowH = (h - pad * 2 - headerH) / rows
  const colW = (w - pad * 2) / cols
  const barH = Math.min(rowH * 0.4, 14)
  const barR = barH / 2

  // Outer border
  ctx.beginPath()
  ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, stroke.width * 2)
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.stroke()

  // Header row
  const hy = pad
  for (let c = 0; c < cols; c++) {
    const bx = pad + c * colW + colW * 0.12
    const bw = colW * 0.76
    ctx.beginPath()
    ctx.roundRect(bx, hy + (headerH - barH) / 2, bw, barH, barR)
    ctx.fillStyle = '#ccc'
    ctx.fill()
  }

  // Header separator
  const sepY = pad + headerH
  ctx.beginPath()
  ctx.moveTo(pad, sepY)
  ctx.lineTo(w - pad, sepY)
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width * 0.6
  ctx.stroke()

  // Data rows — varying widths for skeleton look
  // Use deterministic pseudo-random based on row/col index
  for (let r = 0; r < rows; r++) {
    const ry = sepY + r * rowH
    for (let c = 0; c < cols; c++) {
      const seed = (r * 7 + c * 13 + 5) % 10
      const widthFrac = 0.4 + seed * 0.04 // 0.4 ~ 0.76
      const bx = pad + c * colW + colW * 0.12
      const bw = colW * 0.76 * widthFrac
      ctx.beginPath()
      ctx.roundRect(bx, ry + (rowH - barH) / 2, bw, barH, barR)
      ctx.fillStyle = '#e8e8e8'
      ctx.fill()
    }

    // Row separator (except last)
    if (r < rows - 1) {
      const lineY = ry + rowH
      ctx.beginPath()
      ctx.moveTo(pad + colW * 0.06, lineY)
      ctx.lineTo(w - pad - colW * 0.06, lineY)
      ctx.strokeStyle = '#eee'
      ctx.lineWidth = stroke.width * 0.4
      ctx.stroke()
    }
  }

  // Column separators
  for (let c = 1; c < cols; c++) {
    const cx = pad + c * colW
    ctx.beginPath()
    ctx.moveTo(cx, pad)
    ctx.lineTo(cx, h - pad)
    ctx.strokeStyle = '#eee'
    ctx.lineWidth = stroke.width * 0.4
    ctx.stroke()
  }
}

// ── Generative Image ──────────────────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function paintImage(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle, time = 0) {
  const seed = Number(state.seed) || 42
  const rng = seededRandom(seed)
  const genres = [genLandscape, genCity, genOcean, genAbstract, genSpace]
  const genre = genres[Math.abs(seed) % genres.length]
  genre(ctx, w, h, rng, time)
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  outlined(ctx, stroke)
}

type RNG = () => number
const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`

// ── Value Noise — seeded 2D grid with smooth bilinear interpolation ──
function makeNoise(rng: RNG, res = 8): (x: number, y: number) => number {
  const g = Array.from({ length: res + 1 }, () => Array.from({ length: res + 1 }, rng))
  const smooth = (t: number) => t * t * (3 - 2 * t)
  return (nx: number, ny: number): number => {
    const xi = ((Math.floor(nx) % res) + res) % res, yi = ((Math.floor(ny) % res) + res) % res
    const xf = nx - Math.floor(nx), yf = ny - Math.floor(ny)
    const sx = smooth(xf), sy = smooth(yf)
    return (
      g[xi][yi] * (1 - sx) * (1 - sy) +
      g[xi + 1][yi] * sx * (1 - sy) +
      g[xi][yi + 1] * (1 - sx) * sy +
      g[xi + 1][yi + 1] * sx * sy
    )
  }
}

// ── fBm — stacked octaves of noise ──
function fbm(noise: (x: number, y: number) => number, x: number, y: number, oct = 4): number {
  let v = 0, amp = 0.5, freq = 1, total = 0
  for (let i = 0; i < oct; i++) {
    v += noise(x * freq, y * freq) * amp
    total += amp; amp *= 0.5; freq *= 2
  }
  return v / total
}

// ── Genre: Landscape ──
function genLandscape(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG, time = 0) {
  const noise = makeNoise(rng, 8)

  const moods = [
    { sky: [215, 55, 60], hor: [205, 35, 82], mt: [160, 22, 30], gnd: [100, 28, 38], sun: [52, 95, 74] },
    { sky: [22, 68, 50], hor: [38, 72, 72], mt: [18, 28, 26], gnd: [32, 36, 30], sun: [40, 95, 74] },
    { sky: [265, 35, 20], hor: [238, 30, 38], mt: [255, 18, 18], gnd: [215, 12, 20], sun: [280, 55, 80] },
    { sky: [338, 48, 60], hor: [20, 58, 78], mt: [275, 18, 36], gnd: [28, 22, 46], sun: [45, 95, 80] },
    { sky: [42, 28, 72], hor: [32, 45, 58], mt: [28, 30, 36], gnd: [38, 40, 50], sun: [50, 90, 85] },
  ]
  const m = moods[Math.floor(rng() * moods.length)]

  // Sky gradient
  const skyG = ctx.createLinearGradient(0, 0, 0, h)
  skyG.addColorStop(0, hsl(m.sky[0], m.sky[1], m.sky[2]))
  skyG.addColorStop(0.6, hsl(m.hor[0], m.hor[1], m.hor[2]))
  skyG.addColorStop(1, hsl(m.hor[0], m.hor[1] * 0.5, m.hor[2] * 0.75))
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, w, h)

  // Sun / Moon with atmospheric glow
  const sx = w * (0.12 + rng() * 0.76), sy = h * (0.06 + rng() * 0.2)
  const sr = Math.min(w, h) * (0.035 + rng() * 0.04)
  const sunGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 7)
  sunGlow.addColorStop(0, `hsla(${m.sun[0]},${m.sun[1]}%,${m.sun[2]}%,0.35)`)
  sunGlow.addColorStop(0.4, `hsla(${m.sun[0]},${Math.round(m.sun[1] * 0.6)}%,${m.sun[2]}%,0.1)`)
  sunGlow.addColorStop(1, 'rgba(255,200,100,0)')
  ctx.fillStyle = sunGlow; ctx.fillRect(0, 0, w, h * 0.5)
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2)
  ctx.fillStyle = hsl(m.sun[0], m.sun[1], m.sun[2]); ctx.fill()

  // 3 mountain layers (far → near) via fBm terrain profiles
  const layers = [
    { baseY: 0.30, amp: 0.18, scale: 1.6, oct: 5, off: rng() * 10 },
    { baseY: 0.44, amp: 0.21, scale: 1.2, oct: 4, off: rng() * 10 },
    { baseY: 0.57, amp: 0.17, scale: 0.9, oct: 3, off: rng() * 10 },
  ]
  for (let li = 0; li < layers.length; li++) {
    const { baseY, amp, scale, oct, off } = layers[li]
    const t = li / (layers.length - 1)
    ctx.beginPath(); ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 2) {
      const n = fbm(noise, (x / w + off) * scale, 0.3 + li * 0.2, oct)
      ctx.lineTo(x, h * baseY - n * h * amp)
    }
    ctx.lineTo(w, h); ctx.closePath()
    ctx.fillStyle = hsl(m.mt[0] + t * 20, m.mt[1] + t * 10, m.mt[2] + t * 22)
    ctx.fill()
  }

  // Ground
  const gY = h * 0.72
  const gG = ctx.createLinearGradient(0, gY, 0, h)
  gG.addColorStop(0, hsl(m.gnd[0], m.gnd[1], m.gnd[2]))
  gG.addColorStop(1, hsl(m.gnd[0] - 5, m.gnd[1] * 0.8, m.gnd[2] - 8))
  ctx.fillStyle = gG; ctx.fillRect(0, gY, w, h - gY)

  // Horizon haze
  const hazeG = ctx.createLinearGradient(0, h * 0.52, 0, h * 0.72)
  hazeG.addColorStop(0, `hsla(${m.hor[0]},${Math.round(m.hor[1] * 0.4)}%,${m.hor[2]}%,0.28)`)
  hazeG.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hazeG; ctx.fillRect(0, h * 0.52, w, h * 0.2)

  drawClouds(ctx, w, h, rng, m.sky[2] < 30, time)
}

// ── Genre: City Skyline ──
function genCity(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG, time = 0) {
  const isNight = rng() > 0.5
  const skyHue = isNight ? 235 + rng() * 15 : 205 + rng() * 40
  const skyL = isNight ? 10 + rng() * 8 : 55 + rng() * 20
  const skyS = isNight ? 20 + rng() * 15 : 45 + rng() * 20

  const skyG = ctx.createLinearGradient(0, 0, 0, h * 0.85)
  skyG.addColorStop(0, hsl(skyHue, skyS, skyL))
  skyG.addColorStop(1, hsl(skyHue + 15, skyS * 0.8, skyL + (isNight ? 8 : 18)))
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, w, h)

  if (isNight) {
    for (let i = 0; i < 100; i++) {
      const sz = 0.2 + rng() * 1.5
      ctx.beginPath()
      ctx.arc(rng() * w, rng() * h * 0.6, sz, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,${220 + Math.floor(rng() * 35)},${0.3 + rng() * 0.7})`
      ctx.fill()
    }
  } else {
    drawClouds(ctx, w, h, rng, false, time)
  }

  // 3 depth layers of buildings (far → near)
  for (let layer = 0; layer < 3; layer++) {
    const t = layer / 2
    const baseY = h * (0.5 + t * 0.2)
    const maxBH = h * (0.18 + t * 0.28)
    const bLight = isNight ? 12 + t * 14 : 38 + t * 20
    const bHue = 210 + rng() * 30

    let x = -rng() * 20
    while (x < w + 20) {
      const bw = w * (0.025 + rng() * 0.05 + t * 0.02)
      const bh = maxBH * (0.35 + rng() * 0.65)
      const by = baseY - bh

      ctx.fillStyle = hsl(bHue + rng() * 20, 8 + t * 8, bLight + rng() * 14)
      ctx.fillRect(x, by, bw, bh + 2)

      // Windows
      if (bw > w * 0.025 && bh > h * 0.05) {
        const cols = Math.max(1, Math.round(bw / (w * 0.011)))
        const rows = Math.max(1, Math.round(bh / (h * 0.055)))
        const cw = bw / cols, rh2 = bh / rows
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (rng() < 0.22) continue
            if (isNight) {
              const wg = 200 + Math.floor(rng() * 55)
              const wb = 100 + Math.floor(rng() * 120)
              const baseA = 0.4 + rng() * 0.6
              const flickerPhase = r * 13.7 + c * 7.3
              const wa = time > 0 ? baseA * (0.6 + 0.4 * Math.abs(Math.sin(time * 0.0025 + flickerPhase))) : baseA
              ctx.fillStyle = `rgba(255,${wg},${wb},${wa})`
            } else {
              ctx.fillStyle = `rgba(200,220,245,${0.25 + rng() * 0.3})`
            }
            ctx.fillRect(x + c * cw + cw * 0.2, by + r * rh2 + rh2 * 0.2, cw * 0.6, rh2 * 0.55)
          }
        }
      }

      x += bw + rng() * 5 - 1
    }
  }

  // Ground
  const roadY = h * 0.88
  ctx.fillStyle = hsl(0, 0, isNight ? 10 : 28)
  ctx.fillRect(0, roadY, w, h - roadY)

  // Night: puddle reflection
  if (isNight) {
    const refG = ctx.createLinearGradient(0, roadY, 0, h)
    refG.addColorStop(0, `hsla(${skyHue},25%,${Math.round(skyL * 2.5)}%,0.18)`)
    refG.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = refG; ctx.fillRect(0, roadY, w, h - roadY)
  }
}

// ── Genre: Ocean ──
function genOcean(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG, time = 0) {
  const noise = makeNoise(rng, 8)
  const horizon = h * (0.28 + rng() * 0.18)
  const isGolden = rng() > 0.6
  const skyHue = isGolden ? 25 + rng() * 15 : 198 + rng() * 30

  // Sky
  const skyG = ctx.createLinearGradient(0, 0, 0, horizon)
  skyG.addColorStop(0, hsl(skyHue, isGolden ? 65 : 50, isGolden ? 52 : 58))
  skyG.addColorStop(1, hsl(skyHue + (isGolden ? 15 : 12), isGolden ? 72 : 38, isGolden ? 72 : 80))
  ctx.fillStyle = skyG; ctx.fillRect(0, 0, w, horizon)

  // Sun with atmospheric glow
  const sx = w * (0.2 + rng() * 0.6), sy = horizon * (0.35 + rng() * 0.4)
  const sr = Math.min(w, h) * (0.05 + rng() * 0.04)
  const sunHue = isGolden ? 38 : 55
  const sunG = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 6)
  sunG.addColorStop(0, `hsla(${sunHue},90%,82%,0.5)`)
  sunG.addColorStop(0.3, `hsla(${sunHue},70%,72%,0.15)`)
  sunG.addColorStop(1, 'rgba(255,200,100,0)')
  ctx.fillStyle = sunG; ctx.fillRect(0, 0, w, horizon)
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2)
  ctx.fillStyle = hsl(sunHue, 95, 88); ctx.fill()

  // Water base gradient
  const waterHue = isGolden ? 192 : 196 + rng() * 24
  const wG = ctx.createLinearGradient(0, horizon, 0, h)
  wG.addColorStop(0, hsl(waterHue, 44 + rng() * 16, 48 + rng() * 12))
  wG.addColorStop(0.5, hsl(waterHue + 8, 50 + rng() * 14, 34 + rng() * 10))
  wG.addColorStop(1, hsl(waterHue + 12, 55, 20 + rng() * 10))
  ctx.fillStyle = wG; ctx.fillRect(0, horizon, w, h - horizon)

  // Sun path reflection
  const refW = sr * (2 + rng() * 2)
  const refG = ctx.createLinearGradient(0, horizon, 0, h)
  refG.addColorStop(0, `hsla(${sunHue},80%,82%,0.22)`)
  refG.addColorStop(0.6, `hsla(${sunHue},80%,82%,0.08)`)
  refG.addColorStop(1, `hsla(${sunHue},80%,82%,0.01)`)
  ctx.fillStyle = refG
  ctx.fillRect(sx - refW, horizon, refW * 2, h - horizon)

  // fBm wave lines (far → near)
  const waveOff = rng() * 10
  const waveLayers = 10 + Math.floor(rng() * 6)
  for (let wi = 0; wi < waveLayers; wi++) {
    const t = wi / (waveLayers - 1)
    const wY = horizon + (h - horizon) * (0.04 + t * 0.9)
    const amp = (h - horizon) * (0.007 + t * 0.028)
    const scale = 2.5 - t * 0.8

    ctx.beginPath(); ctx.moveTo(0, wY)
    for (let x = 0; x <= w; x += 3) {
      const n = fbm(noise, (x / w + waveOff + wi * 0.4 + time * 0.00012) * scale, wi * 0.12, 3)
      ctx.lineTo(x, wY + (n - 0.5) * amp * 2)
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + t * 0.14})`
    ctx.lineWidth = 0.5 + t * 1.8; ctx.stroke()
  }

  drawClouds(ctx, w, horizon, rng, false, time)
}

// ── Genre: Abstract ──
function genAbstract(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG, time = 0) {
  const noise = makeNoise(rng, 6)
  const baseHue = rng() * 360
  const palette: [number, number, number][] = [
    [baseHue, 60 + rng() * 30, 44 + rng() * 22],
    [(baseHue + 120 + rng() * 40) % 360, 55 + rng() * 30, 50 + rng() * 20],
    [(baseHue + 240 + rng() * 40) % 360, 50 + rng() * 25, 55 + rng() * 18],
    [(baseHue + 60 + rng() * 30) % 360, 65 + rng() * 25, 40 + rng() * 25],
  ]

  // Background
  ctx.fillStyle = hsl(baseHue, 12 + rng() * 15, 90 + rng() * 7)
  ctx.fillRect(0, 0, w, h)

  // Soft gradient blobs (Voronoi-like cells)
  for (let i = 0; i < 3 + Math.floor(rng() * 4); i++) {
    const bxBase = rng() * w, byBase = rng() * h
    const bx = bxBase + Math.sin(i * 1.3 + time * 0.0008) * w * 0.06
    const by = byBase + Math.cos(i * 2.1 + time * 0.0006) * h * 0.06
    const br = Math.min(w, h) * (0.22 + rng() * 0.38)
    const [bh, bs, bl] = palette[i % palette.length]
    const bG = ctx.createRadialGradient(bx, by, 0, bx, by, br)
    bG.addColorStop(0, `hsla(${bh},${bs}%,${bl}%,${0.5 + rng() * 0.3})`)
    bG.addColorStop(0.55, `hsla(${bh},${Math.round(bs * 0.8)}%,${bl}%,${0.15 + rng() * 0.15})`)
    bG.addColorStop(1, `hsla(${bh},${Math.round(bs * 0.5)}%,${bl}%,0)`)
    ctx.fillStyle = bG; ctx.fillRect(0, 0, w, h)
  }

  // Noise-warped geometric shapes
  for (let i = 0; i < 5 + Math.floor(rng() * 8); i++) {
    const [sh, ss, sl] = palette[Math.floor(rng() * palette.length)]
    const alpha = 0.15 + rng() * 0.35
    ctx.fillStyle = `hsla(${sh},${ss}%,${sl}%,${alpha})`

    const type = Math.floor(rng() * 3)
    if (type === 0) {
      const ex = rng() * w, ey = rng() * h
      const rx = Math.min(w, h) * (0.05 + rng() * 0.18), ry = rx * (0.5 + rng())
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(rng() * Math.PI * 2)
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill(); ctx.restore()
    } else if (type === 1) {
      // Noise-warped polygon
      const cx = rng() * w, cy = rng() * h
      const sides = 3 + Math.floor(rng() * 4)
      const r = Math.min(w, h) * (0.05 + rng() * 0.18)
      ctx.beginPath()
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * Math.PI * 2 + rng() * 0.5
        const warp = fbm(noise, cx / w + Math.cos(a) * 0.08, cy / h + Math.sin(a) * 0.08, 3)
        const pr = r * (0.7 + warp * 0.65)
        const [px, py] = [cx + Math.cos(a) * pr, cy + Math.sin(a) * pr]
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.fill()
    } else {
      // Bezier curve
      ctx.strokeStyle = `hsla(${sh},${ss}%,${Math.round(sl * 0.6)}%,${alpha * 0.9})`
      ctx.lineWidth = 1 + rng() * 3
      ctx.beginPath()
      ctx.moveTo(rng() * w, rng() * h)
      ctx.bezierCurveTo(rng() * w, rng() * h, rng() * w, rng() * h, rng() * w, rng() * h)
      ctx.stroke()
    }
  }
}

// ── Genre: Space ──
function genSpace(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG, time = 0) {
  // Deep space background
  const bgHue = 230 + rng() * 50
  const bgG = ctx.createLinearGradient(0, 0, w * 0.5, h)
  bgG.addColorStop(0, hsl(bgHue, 30 + rng() * 25, 5 + rng() * 8))
  bgG.addColorStop(1, hsl(bgHue + 30, 20 + rng() * 20, 8 + rng() * 10))
  ctx.fillStyle = bgG; ctx.fillRect(0, 0, w, h)

  // Nebula blobs (layered radial gradients)
  for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
    const nx = rng() * w, ny = rng() * h
    const nr = Math.min(w, h) * (0.2 + rng() * 0.32)
    const nHue = rng() * 360
    for (let j = 0; j < 2; j++) {
      const ox = nx + (rng() - 0.5) * nr * 0.5, oy = ny + (rng() - 0.5) * nr * 0.5
      const or = nr * (0.6 + j * 0.45)
      const nG = ctx.createRadialGradient(ox, oy, 0, ox, oy, or)
      nG.addColorStop(0, `hsla(${nHue + j * 30},65%,55%,${0.08 + rng() * 0.12})`)
      nG.addColorStop(0.45, `hsla(${nHue + j * 20},45%,40%,${0.03 + rng() * 0.07})`)
      nG.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = nG; ctx.fillRect(0, 0, w, h)
    }
  }

  // Stars (varied brightness and color temperature)
  for (let i = 0; i < 120 + Math.floor(rng() * 100); i++) {
    const sx = rng() * w, sy = rng() * h, sr = 0.2 + rng() * 1.8
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    if (sr > 1.2) {
      const isBlue = rng() > 0.6
      const baseHue = isBlue ? 220 + rng() * 40 : 38 + rng() * 20
      const baseLightness = 85 + rng() * 12
      const twinkle = time > 0 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 0.0018 + i * 2.4)) : 1
      ctx.globalAlpha = twinkle
      ctx.fillStyle = hsl(baseHue, sr > 1.5 ? 30 : 10, baseLightness)
    } else {
      const baseA = 0.3 + rng() * 0.7
      const a = time > 0 ? baseA * (0.08 + 0.92 * Math.abs(Math.sin(time * 0.0022 + i * 2.1))) : baseA
      ctx.fillStyle = `rgba(255,255,255,${a})`
    }
    ctx.fill()
    ctx.globalAlpha = 1
    // Diffraction spikes on bright stars
    if (sr > 1.5) {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(sx - sr * 3, sy); ctx.lineTo(sx + sr * 3, sy)
      ctx.moveTo(sx, sy - sr * 3); ctx.lineTo(sx, sy + sr * 3)
      ctx.stroke()
    }
  }

  // Planet
  const px = w * (0.2 + rng() * 0.6), py = h * (0.2 + rng() * 0.6)
  const pr = Math.min(w, h) * (0.1 + rng() * 0.13)
  const pHue = rng() * 360
  const pG = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.05, px, py, pr)
  pG.addColorStop(0, hsl(pHue, 40 + rng() * 25, 60 + rng() * 20))
  pG.addColorStop(0.7, hsl(pHue + 15, 35, 34 + rng() * 14))
  pG.addColorStop(1, hsl(pHue + 25, 25, 18 + rng() * 10))
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fillStyle = pG; ctx.fill()

  // Jupiter-like turbulent banded surface
  ctx.save()
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip()

  // Hash-based surface noise — no rng() calls consumed
  const jSeed = pHue + px * 0.01 + py * 0.007
  const jHash = (u: number, v: number) => {
    const n = Math.sin(u * 127.1 + v * 311.7 + jSeed) * 43758.5453
    return n - Math.floor(n)
  }
  const jNoise = (u: number, v: number) => {
    const xi = Math.floor(u), yi = Math.floor(v)
    const xf = u - xi, yf = v - yi
    const sm = (t: number) => t * t * (3 - 2 * t)
    const sx = sm(xf), sy = sm(yf)
    return jHash(xi, yi)*(1-sx)*(1-sy) + jHash(xi+1, yi)*sx*(1-sy) + jHash(xi, yi+1)*(1-sx)*sy + jHash(xi+1, yi+1)*sx*sy
  }
  const jFbm = (u: number, v: number) => {
    let val = 0, amp = 0.5, freq = 1, tot = 0
    for (let o = 0; o < 4; o++) { val += jNoise(u*freq, v*freq)*amp; tot += amp; amp *= 0.5; freq *= 2 }
    return val / tot
  }

  const scroll = time * 0.00006

  // Color palette: pole / dark belt / bright zone / equatorial belt (alternating)
  const pole: [number,number,number]  = [pHue+15, 22, 18]
  const belt: [number,number,number]  = [pHue+22, 42, 30]
  const zone: [number,number,number]  = [pHue+4,  16, 66]
  const eBelt: [number,number,number] = [pHue+30, 50, 26]

  const bandEdges = [-1.0, -0.74, -0.52, -0.28, -0.06, 0.14, 0.36, 0.58, 0.78, 1.0]
  const bandCols: [number,number,number][] = [pole, belt, zone, eBelt, zone, eBelt, zone, belt, pole]

  for (let b = 0; b < bandCols.length; b++) {
    const [ch, cs, cl] = bandCols[b]
    ctx.beginPath()
    let first = true
    for (let dx = -pr; dx <= pr + 1; dx += 2) {
      const t = dx / pr
      const warp = (jFbm((t + scroll) * 2.8, b * 1.1) - 0.5) * 0.09
      const ey = py + (bandEdges[b] + warp) * pr
      if (first) { ctx.moveTo(px + dx, ey); first = false }
      else ctx.lineTo(px + dx, ey)
    }
    for (let dx = pr; dx >= -pr - 1; dx -= 2) {
      const t = dx / pr
      const warp = (jFbm((t + scroll) * 2.8, (b+1) * 1.1) - 0.5) * 0.09
      const ey = py + (bandEdges[b+1] + warp) * pr
      ctx.lineTo(px + dx, ey)
    }
    ctx.closePath()
    ctx.fillStyle = hsl(ch, cs, cl)
    ctx.fill()
  }

  // Oval storms: 2 fixed rng draws each (x, y, size) = 6 rng calls total
  const storms = [
    { sx: rng(), sy: rng(), sz: rng(), yBand: -0.17, speed: 18, hOff: 35, big: true  },
    { sx: rng(), sy: rng(), sz: rng(), yBand:  0.28, speed: 28, hOff: 18, big: false },
  ]
  for (const s of storms) {
    const baseX = (s.sx * pr * 2 + scroll * pr * s.speed) % (pr * 2)
    const stormX = px - pr + baseX
    const stormY = py + (s.yBand + (s.sy - 0.5) * 0.05) * pr
    const rx = pr * (s.big ? 0.20 + s.sz * 0.08 : 0.09 + s.sz * 0.04)
    const ry = rx * (s.big ? 0.52 : 0.60)
    ctx.save()
    ctx.translate(stormX, stormY)
    ctx.scale(1, ry / rx)
    const sG = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
    sG.addColorStop(0,    `hsla(${pHue+s.hOff}, 68%, ${s.big ? 42 : 58}%, 0.92)`)
    sG.addColorStop(0.55, `hsla(${pHue+s.hOff-10}, 52%, ${s.big ? 32 : 46}%, 0.65)`)
    sG.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2)
    ctx.fillStyle = sG; ctx.fill()
    ctx.restore()
  }

  // Limb darkening — makes the planet look spherical
  const limbG = ctx.createRadialGradient(px, py, pr * 0.55, px, py, pr)
  limbG.addColorStop(0, 'rgba(0,0,0,0)')
  limbG.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = limbG
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()

  ctx.restore()

  // Atmosphere rim
  const rimG = ctx.createRadialGradient(px, py, pr * 0.82, px, py, pr * 1.22)
  rimG.addColorStop(0, 'rgba(0,0,0,0)')
  rimG.addColorStop(0.5, `hsla(${pHue + 40},55%,68%,0.18)`)
  rimG.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = rimG; ctx.fillRect(px - pr * 1.3, py - pr * 1.3, pr * 2.6, pr * 2.6)

  // Ring (50% chance)
  if (rng() > 0.5) {
    ctx.save(); ctx.translate(px, py); ctx.scale(1, 0.28); ctx.rotate(rng() * 0.6 - 0.3)
    for (let ri = 0; ri < 3; ri++) {
      const rr = pr * (1.45 + ri * 0.22)
      const rw = pr * (0.1 + rng() * 0.08)
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${pHue + 30},25%,58%,${0.5 - ri * 0.12})`
      ctx.lineWidth = rw * (1 - ri * 0.25); ctx.stroke()
    }
    ctx.restore()
  }

  // Shooting stars — purely time-based, no rng
  if (time > 0) {
    const shootConfigs = [
      { period: 5200, offset: 0,    startFrac: [0.05, 0.08], angle: 0.38 },
      { period: 7800, offset: 2600, startFrac: [0.45, 0.18], angle: 0.28 },
    ]
    for (const sc of shootConfigs) {
      const phase = ((time + sc.offset) % sc.period) / sc.period
      if (phase > 0.1) continue
      const progress = phase / 0.1
      const fade = Math.sin(progress * Math.PI)
      const speed = w * 0.55
      const hx = sc.startFrac[0] * w + Math.cos(sc.angle) * speed * progress
      const hy = sc.startFrac[1] * h + Math.sin(sc.angle) * speed * progress
      const trailLen = w * 0.14 * fade
      const tx = hx - Math.cos(sc.angle) * trailLen
      const ty = hy - Math.sin(sc.angle) * trailLen
      const grad = ctx.createLinearGradient(tx, ty, hx, hy)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(1, `rgba(255,255,255,${0.9 * fade})`)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.8
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke()
    }
  }
}

// ── Shared: Clouds ──
function drawClouds(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG, isNight: boolean, time = 0) {
  const count = isNight ? Math.floor(rng() * 2) : 1 + Math.floor(rng() * 4)
  for (let i = 0; i < count; i++) {
    const baseCx = w * rng(), cy = h * (0.06 + rng() * 0.28)
    const driftSpeed = 0.018 + i * 0.007
    const cx = ((baseCx + time * driftSpeed) % (w * 1.4)) - w * 0.2
    const cw = w * (0.08 + rng() * 0.16), ch = cw * (0.28 + rng() * 0.28)
    const alpha = isNight ? 0.12 : 0.35 + rng() * 0.45
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    const puffs = 3 + Math.floor(rng() * 3)
    for (let j = 0; j < puffs; j++) {
      const t = j / Math.max(1, puffs - 1) - 0.5
      ctx.beginPath()
      ctx.ellipse(
        cx + t * cw * 0.85,
        cy + rng() * ch * 0.25,
        cw * (0.35 + rng() * 0.25),
        ch * (0.5 + rng() * 0.35),
        0, 0, Math.PI * 2,
      )
      ctx.fill()
    }
  }
}

// ── Icon ──

import { ICON_PATHS } from './iconPaths'

function paintIcon(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const name = (state.icon as string) || 'heart'
  const pathData = ICON_PATHS[name]
  if (!pathData) return

  const padding = Math.min(w, h) * 0.15
  const iconSize = Math.min(w - padding * 2, h - padding * 2)
  const scale = iconSize / 256 // Phosphor icons use 256x256 viewBox
  const offsetX = (w - iconSize) / 2
  const offsetY = (h - iconSize) / 2

  ctx.save()
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, scale)

  const path = new Path2D(pathData)
  ctx.fillStyle = stroke.color
  ctx.fill(path)

  ctx.restore()
}

// ── Device Frames ──

export const FRAME_PRESETS = {
  browser: { width: 1280, height: 800, ratio: 1280 / 800 },
  mobile: { width: 375, height: 812, ratio: 375 / 812 },
} as const

function paintBrowserFrame(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, _state: Record<string, unknown>, stroke: StrokeStyle) {
  const barH = Math.min(h * 0.06, 36)
  const r = Math.min(barH * 0.3, 6)

  // Top bar background
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, w, barH)

  // Bar bottom border
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width * 0.6
  ctx.beginPath()
  ctx.moveTo(0, barH)
  ctx.lineTo(w, barH)
  ctx.stroke()

  // Traffic lights
  const dotR = Math.min(barH * 0.15, 5)
  const dotY = barH / 2
  const dotStart = barH * 0.5
  const colors = ['#ff5f57', '#febc2e', '#28c840']
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(dotStart + i * dotR * 3, dotY, dotR, 0, Math.PI * 2)
    ctx.fillStyle = colors[i]
    ctx.fill()
  }

  // Address bar
  const abX = dotStart + dotR * 12
  const abW = w * 0.5
  const abH = barH * 0.5
  const abY = (barH - abH) / 2
  ctx.beginPath()
  ctx.roundRect(abX, abY, abW, abH, r)
  ctx.fillStyle = '#e0e0e0'
  ctx.fill()

  // URL text placeholder
  ctx.fillStyle = '#999'
  ctx.font = `${abH * 0.55}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const url = (_state.url as string) || 'https://example.com'
  ctx.fillText(url, abX + r * 2, barH / 2, abW - r * 4)

  // Rest is transparent (SDF box color shows through)
}

function paintMobileFrame(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, _state: Record<string, unknown>, stroke: StrokeStyle) {
  const statusH = Math.min(h * 0.05, 44)
  const homeH = Math.min(h * 0.03, 20)

  // Status bar background
  ctx.fillStyle = 'rgba(0,0,0,0.03)'
  ctx.fillRect(0, 0, w, statusH)

  // Dynamic Island / Notch
  const islandW = w * 0.28
  const islandH = statusH * 0.55
  const islandX = (w - islandW) / 2
  const islandY = statusH * 0.15
  ctx.beginPath()
  ctx.roundRect(islandX, islandY, islandW, islandH, islandH / 2)
  ctx.fillStyle = '#1a1a1a'
  ctx.fill()

  // Status bar icons (time left, battery right)
  ctx.fillStyle = '#333'
  ctx.font = `600 ${statusH * 0.32}px Inter, system-ui, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText('9:41', w * 0.07, statusH / 2)

  // Battery icon (simple rect)
  const batW = w * 0.06, batH = statusH * 0.25
  const batX = w * 0.88, batY = (statusH - batH) / 2
  ctx.strokeStyle = '#333'
  ctx.lineWidth = stroke.width * 0.5
  ctx.beginPath()
  ctx.roundRect(batX, batY, batW, batH, 2)
  ctx.stroke()
  ctx.fillStyle = '#333'
  ctx.fillRect(batX + 1, batY + 1, batW * 0.7, batH - 2)

  // Home indicator
  const homeW = w * 0.35
  const homeY = h - homeH * 0.6
  ctx.beginPath()
  ctx.roundRect((w - homeW) / 2, homeY, homeW, homeH * 0.25, homeH * 0.125)
  ctx.fillStyle = '#1a1a1a'
  ctx.fill()

  // Rest is transparent
}

// ── Registry ──

export const painters: Record<string, PaintFn> = {
  switch: paintSwitch,
  checkbox: paintCheckbox,
  radio: paintRadio,
  button: paintButton,
  slider: paintSlider,
  'text-input': paintTextInput,
  progress: paintProgress,
  badge: paintBadge,
  'star-rating': paintStarRating,
  avatar: paintAvatar,
  search: paintSearch,
  dropdown: paintDropdown,
  text: paintText,
  'table-skeleton': paintTableSkeleton,
  image: paintImage,
  icon: paintIcon,
  'browser-frame': paintBrowserFrame,
  'mobile-frame': paintMobileFrame,
}

/** Paint a component into an atlas region context. Returns true if painter exists. */
export function paintComponent(
  skin: string,
  ctx: OffscreenCanvasRenderingContext2D,
  w: number, h: number,
  state: Record<string, unknown>,
  stroke: StrokeStyle,
  time = 0,
): boolean {
  const painter = painters[skin]
  if (!painter) return false
  painter(ctx, w, h, state, stroke, time)
  ctx.restore()
  return true
}

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
  const count = Number(state.count) || 0
  const r = Math.min(w, h) * 0.38

  ctx.beginPath()
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
  ctx.fillStyle = '#ef4444'
  ctx.fill()
  outlined(ctx, stroke)

  if (count > 0) {
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${r * 1.1}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(count > 99 ? '99+' : String(count), w / 2, h / 2)
  }
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

  ctx.fillStyle = stroke.color
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

// ── Generative Landscape Image ──

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function paintImage(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>, stroke: StrokeStyle) {
  const seed = Number(state.seed) || 42
  const rng = seededRandom(seed)

  // Pick genre deterministically from seed (RNG first values cluster near 0)
  const genres = [genLandscape, genCity, genOcean, genAbstract, genSpace]
  const genre = genres[Math.abs(seed) % genres.length]
  genre(ctx, w, h, rng)

  // Outline
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  outlined(ctx, stroke)
}

type RNG = () => number
const jitter = (rng: RNG, v: number, range: number) => v + (rng() - 0.5) * range
const hsl = (h: number, s: number, l: number) => `hsl(${h},${s}%,${l}%)`

// ── Genre: Landscape ──

function genLandscape(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const moods = [
    { sky: [210, 55, 65], bot: [200, 40, 85], mt: [150, 25, 35], gnd: [90, 30, 45], sun: 'rgba(255,250,220,0.95)' },
    { sky: [25, 75, 55], bot: [40, 80, 75], mt: [20, 30, 30], gnd: [35, 40, 35], sun: 'rgba(255,180,80,0.95)' },
    { sky: [270, 40, 25], bot: [240, 35, 45], mt: [260, 20, 20], gnd: [220, 15, 25], sun: 'rgba(220,210,255,0.8)' },
    { sky: [340, 50, 65], bot: [20, 60, 80], mt: [280, 20, 40], gnd: [30, 25, 50], sun: 'rgba(255,220,200,0.9)' },
    { sky: [45, 30, 75], bot: [35, 50, 60], mt: [30, 35, 40], gnd: [40, 45, 55], sun: 'rgba(255,240,200,0.9)' },
  ]
  const m = moods[Math.floor(rng() * moods.length)]
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.7)
  g.addColorStop(0, hsl(jitter(rng, m.sky[0], 30), jitter(rng, m.sky[1], 15), jitter(rng, m.sky[2], 10)))
  g.addColorStop(1, hsl(jitter(rng, m.bot[0], 30), jitter(rng, m.bot[1], 15), jitter(rng, m.bot[2], 10)))
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)

  // Sun
  const sx = w * (0.1 + rng() * 0.8), sy = h * (0.08 + rng() * 0.3), sr = Math.min(w, h) * (0.05 + rng() * 0.07)
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fillStyle = m.sun; ctx.fill()

  // Mountains
  for (let l = 0; l < 2 + Math.floor(rng() * 3); l++) {
    const t = l / 3, baseY = h * (0.3 + rng() * 0.15 + t * 0.2)
    ctx.beginPath(); ctx.moveTo(-10, h)
    const peaks = 3 + Math.floor(rng() * 5), segW = (w + 20) / peaks
    for (let i = 0; i <= peaks; i++) {
      const px = -10 + i * segW, amp = h * (0.05 + rng() * 0.25) * (1 - t * 0.4)
      if (i === 0) ctx.lineTo(-10, baseY)
      ctx.quadraticCurveTo(px + segW * (0.3 + rng() * 0.4), baseY - amp, px + segW, baseY + rng() * h * 0.03)
    }
    ctx.lineTo(w + 10, h); ctx.closePath()
    ctx.fillStyle = hsl(jitter(rng, m.mt[0], 40), m.mt[1] + t * 5, m.mt[2] + t * 25); ctx.fill()
  }

  // Ground + clouds
  ctx.fillStyle = hsl(jitter(rng, m.gnd[0], 30), m.gnd[1], m.gnd[2])
  ctx.fillRect(0, h * 0.78, w, h * 0.22)
  drawClouds(ctx, w, h, rng, m.sky[2] < 35)
}

// ── Genre: City Skyline ──

function genCity(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const isNight = rng() > 0.5
  const skyH = isNight ? [240, 20, 15] : [210 + rng() * 40, 50, 60 + rng() * 20]
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, hsl(skyH[0], skyH[1], skyH[2]))
  g.addColorStop(1, hsl(skyH[0] + 20, skyH[1] - 10, skyH[2] + (isNight ? 5 : 15)))
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)

  if (isNight) for (let i = 0; i < 50; i++) {
    ctx.beginPath(); ctx.arc(rng() * w, rng() * h * 0.5, 0.5 + rng(), 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,240,${0.3 + rng() * 0.7})`; ctx.fill()
  } else drawClouds(ctx, w, h, rng, false)

  // Buildings
  const buildingCount = 8 + Math.floor(rng() * 10)
  for (let i = 0; i < buildingCount; i++) {
    const bw = w * (0.04 + rng() * 0.08)
    const bh = h * (0.15 + rng() * 0.45)
    const bx = rng() * (w - bw)
    const by = h - bh
    const light = isNight ? 15 + rng() * 15 : 40 + rng() * 25
    ctx.fillStyle = hsl(220 + rng() * 30, 10 + rng() * 15, light)
    ctx.fillRect(bx, by, bw, bh)

    // Windows
    const winRows = Math.floor(bh / (8 + rng() * 6))
    const winCols = Math.max(1, Math.floor(bw / (6 + rng() * 4)))
    const winW = bw * 0.12, winH = bh / winRows * 0.4
    for (let r = 1; r < winRows; r++) {
      for (let c = 0; c < winCols; c++) {
        if (rng() < 0.3) continue
        const wx = bx + (c + 0.5) * (bw / winCols) - winW / 2
        const wy = by + r * (bh / winRows) - winH / 2
        ctx.fillStyle = isNight
          ? `rgba(255,230,${150 + rng() * 100},${0.5 + rng() * 0.5})`
          : `rgba(200,220,240,${0.4 + rng() * 0.3})`
        ctx.fillRect(wx, wy, winW, winH)
      }
    }
  }

  // Road
  ctx.fillStyle = hsl(0, 0, isNight ? 12 : 35)
  ctx.fillRect(0, h * 0.92, w, h * 0.08)
}

// ── Genre: Ocean ──

function genOcean(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const horizon = h * (0.3 + rng() * 0.2)
  const skyHue = 200 + rng() * 40
  const sg = ctx.createLinearGradient(0, 0, 0, horizon)
  sg.addColorStop(0, hsl(skyHue, 50 + rng() * 20, 60 + rng() * 20))
  sg.addColorStop(1, hsl(skyHue + 15, 40, 80 + rng() * 10))
  ctx.fillStyle = sg; ctx.fillRect(0, 0, w, horizon)

  // Sun near horizon
  const sx = w * (0.2 + rng() * 0.6), sy = horizon * (0.4 + rng() * 0.4), sr = Math.min(w, h) * (0.06 + rng() * 0.05)
  const sunG = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 4)
  sunG.addColorStop(0, 'rgba(255,240,200,0.9)')
  sunG.addColorStop(0.3, 'rgba(255,200,150,0.2)')
  sunG.addColorStop(1, 'rgba(255,200,150,0)')
  ctx.fillStyle = sunG; ctx.fillRect(0, 0, w, horizon)
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,250,230,0.95)'; ctx.fill()

  // Water
  const waterHue = 195 + rng() * 30
  const wg = ctx.createLinearGradient(0, horizon, 0, h)
  wg.addColorStop(0, hsl(waterHue, 40 + rng() * 20, 50 + rng() * 15))
  wg.addColorStop(1, hsl(waterHue + 10, 50, 30 + rng() * 15))
  ctx.fillStyle = wg; ctx.fillRect(0, horizon, w, h - horizon)

  // Waves
  for (let i = 0; i < 12 + rng() * 10; i++) {
    const wy = horizon + (h - horizon) * (0.05 + rng() * 0.9)
    ctx.beginPath(); ctx.moveTo(0, wy)
    const segs = 5 + Math.floor(rng() * 6)
    for (let s = 0; s < segs; s++) {
      const x1 = (s + 0.5) * w / segs, y1 = wy + (rng() - 0.5) * 6
      const x2 = (s + 1) * w / segs, y2 = wy + (rng() - 0.5) * 3
      ctx.quadraticCurveTo(x1, y1, x2, y2)
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + rng() * 0.12})`
    ctx.lineWidth = 1 + rng() * 2; ctx.stroke()
  }

  // Sun reflection
  ctx.fillStyle = `rgba(255,240,200,${0.05 + rng() * 0.1})`
  ctx.fillRect(sx - sr * 0.8, horizon, sr * 1.6, h - horizon)

  drawClouds(ctx, w, horizon, rng, false)
}

// ── Genre: Abstract Geometric ──

function genAbstract(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const baseHue = rng() * 360
  ctx.fillStyle = hsl(baseHue, 15 + rng() * 20, 90 + rng() * 8)
  ctx.fillRect(0, 0, w, h)

  const shapes = 6 + Math.floor(rng() * 12)
  for (let i = 0; i < shapes; i++) {
    const type = Math.floor(rng() * 3)
    const hue = (baseHue + rng() * 180) % 360
    const sat = 40 + rng() * 40
    const light = 40 + rng() * 40
    const alpha = 0.3 + rng() * 0.5
    ctx.fillStyle = `hsla(${hue},${sat}%,${light}%,${alpha})`

    if (type === 0) {
      // Circle
      const r = Math.min(w, h) * (0.05 + rng() * 0.2)
      ctx.beginPath(); ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2); ctx.fill()
    } else if (type === 1) {
      // Rectangle
      const rw = w * (0.1 + rng() * 0.35), rh = h * (0.1 + rng() * 0.35)
      ctx.save(); ctx.translate(rng() * w, rng() * h); ctx.rotate(rng() * Math.PI)
      ctx.fillRect(-rw / 2, -rh / 2, rw, rh); ctx.restore()
    } else {
      // Triangle
      ctx.beginPath()
      const cx = rng() * w, cy = rng() * h, s = Math.min(w, h) * (0.1 + rng() * 0.2)
      for (let j = 0; j < 3; j++) {
        const a = (j / 3) * Math.PI * 2 + rng() * 0.5
        const px = cx + Math.cos(a) * s, py = cy + Math.sin(a) * s
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.fill()
    }
  }

  // Accent lines
  for (let i = 0; i < 3 + Math.floor(rng() * 5); i++) {
    ctx.beginPath()
    ctx.moveTo(rng() * w, rng() * h)
    ctx.lineTo(rng() * w, rng() * h)
    ctx.strokeStyle = `hsla(${(baseHue + 90) % 360},50%,30%,${0.2 + rng() * 0.3})`
    ctx.lineWidth = 1 + rng() * 3; ctx.stroke()
  }
}

// ── Genre: Space ──

function genSpace(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  // Deep space background
  const bgG = ctx.createLinearGradient(0, 0, w * rng(), h)
  bgG.addColorStop(0, hsl(240 + rng() * 40, 30 + rng() * 30, 5 + rng() * 8))
  bgG.addColorStop(1, hsl(260 + rng() * 60, 20 + rng() * 20, 8 + rng() * 10))
  ctx.fillStyle = bgG; ctx.fillRect(0, 0, w, h)

  // Nebula blobs
  for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
    const nx = rng() * w, ny = rng() * h, nr = Math.min(w, h) * (0.2 + rng() * 0.3)
    const nHue = rng() * 360
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr)
    ng.addColorStop(0, `hsla(${nHue},60%,50%,${0.1 + rng() * 0.15})`)
    ng.addColorStop(0.5, `hsla(${nHue + 30},40%,40%,${0.05 + rng() * 0.08})`)
    ng.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = ng; ctx.fillRect(0, 0, w, h)
  }

  // Stars
  for (let i = 0; i < 80 + rng() * 120; i++) {
    const sr = 0.3 + rng() * 2
    ctx.beginPath(); ctx.arc(rng() * w, rng() * h, sr, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,${220 + rng() * 35},${0.3 + rng() * 0.7})`; ctx.fill()
  }

  // Planet
  const px = w * (0.2 + rng() * 0.6), py = h * (0.2 + rng() * 0.6)
  const pr = Math.min(w, h) * (0.08 + rng() * 0.15)
  const planetHue = rng() * 360
  const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr)
  pg.addColorStop(0, hsl(planetHue, 40 + rng() * 30, 55 + rng() * 20))
  pg.addColorStop(1, hsl(planetHue + 20, 30, 25 + rng() * 15))
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fillStyle = pg; ctx.fill()

  // Ring (50% chance)
  if (rng() > 0.5) {
    ctx.save(); ctx.translate(px, py); ctx.scale(1, 0.3); ctx.rotate(rng() * 0.5 - 0.25)
    ctx.beginPath(); ctx.arc(0, 0, pr * 1.6, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(${planetHue + 40},30%,60%,0.5)`; ctx.lineWidth = pr * 0.08; ctx.stroke()
    ctx.restore()
  }
}

// ── Shared: Clouds ──

function drawClouds(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, rng: RNG, isNight: boolean) {
  const count = isNight ? Math.floor(rng() * 2) : 1 + Math.floor(rng() * 4)
  for (let i = 0; i < count; i++) {
    const cx = w * rng(), cy = h * (0.05 + rng() * 0.25)
    const cw = w * (0.06 + rng() * 0.15), ch = cw * (0.3 + rng() * 0.3)
    const alpha = isNight ? 0.15 : 0.4 + rng() * 0.4
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    for (let j = 0; j < 3; j++) {
      ctx.beginPath()
      ctx.ellipse(cx + (j - 1) * cw * 0.4, cy + rng() * ch * 0.3, cw * (0.4 + rng() * 0.3), ch * (0.5 + rng() * 0.3), 0, 0, Math.PI * 2)
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
  const elColor = state._elColor as number | undefined
  if (elColor != null) {
    const r = (elColor >> 16) & 0xFF, g = (elColor >> 8) & 0xFF, b = elColor & 0xFF
    ctx.fillStyle = `rgb(${r},${g},${b})`
  } else {
    ctx.fillStyle = stroke.color
  }
  ctx.fill(path)

  ctx.restore()
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
}

/** Paint a component into an atlas region context. Returns true if painter exists. */
export function paintComponent(
  skin: string,
  ctx: OffscreenCanvasRenderingContext2D,
  w: number, h: number,
  state: Record<string, unknown>,
  stroke: StrokeStyle,
): boolean {
  const painter = painters[skin]
  if (!painter) return false
  painter(ctx, w, h, state, stroke)
  ctx.restore()
  return true
}

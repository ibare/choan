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

// Component painters — Canvas 2D draw functions for atlas regions.
// Each painter renders a UI component with toon-style outlines matching
// the SDF renderer's edge color and width settings.

export interface StrokeStyle {
  color: string    // CSS color (from RenderSettings.edgeColor)
  width: number    // px (from RenderSettings.outlineWidth, scaled to texture size)
}

type PaintFn = (
  ctx: OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
  state: Record<string, unknown>,
  stroke: StrokeStyle,
) => void

function paintSwitch(
  ctx: OffscreenCanvasRenderingContext2D,
  w: number, h: number,
  state: Record<string, unknown>,
  stroke: StrokeStyle,
) {
  const isOn = !!state.on
  const trackH = h * 0.52
  const trackW = w * 0.82
  const tx = (w - trackW) / 2
  const ty = (h - trackH) / 2
  const trackR = trackH / 2

  // Track fill
  ctx.beginPath()
  ctx.roundRect(tx, ty, trackW, trackH, trackR)
  ctx.fillStyle = isOn ? '#34C759' : '#ccc'
  ctx.fill()

  // Track stroke
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.stroke()

  // Handle
  const handleR = trackH * 0.42
  const handleCX = isOn ? tx + trackW - trackR : tx + trackR
  const handleCY = h / 2

  // Handle fill
  ctx.beginPath()
  ctx.arc(handleCX, handleCY, handleR, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()

  // Handle stroke
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.stroke()
}

export const painters: Record<string, PaintFn> = {
  switch: paintSwitch,
}

/** Paint a component into an atlas region context. Returns true if painter exists. */
export function paintComponent(
  role: string,
  ctx: OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
  state: Record<string, unknown>,
  stroke: StrokeStyle,
): boolean {
  const painter = painters[role]
  if (!painter) return false
  painter(ctx, w, h, state, stroke)
  ctx.restore() // restore the clip+translate from atlas.getContext()
  return true
}

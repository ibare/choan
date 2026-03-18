// Component painters — Canvas 2D draw functions for atlas regions.
// Each painter renders a UI component into a given OffscreenCanvas context.

type PaintFn = (
  ctx: OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
  state: Record<string, unknown>,
) => void

function paintSwitch(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number, state: Record<string, unknown>) {
  const isOn = !!state.on
  const trackH = h * 0.52
  const trackW = w * 0.82
  const tx = (w - trackW) / 2
  const ty = (h - trackH) / 2
  const trackR = trackH / 2

  // Track
  ctx.beginPath()
  ctx.roundRect(tx, ty, trackW, trackH, trackR)
  ctx.fillStyle = isOn ? '#34C759' : '#ccc'
  ctx.fill()

  // Handle shadow + circle
  const handleR = trackH * 0.42
  const handleCX = isOn ? tx + trackW - trackR : tx + trackR
  const handleCY = h / 2

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.2)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1
  ctx.beginPath()
  ctx.arc(handleCX, handleCY, handleR, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.restore()
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
): boolean {
  const painter = painters[role]
  if (!painter) return false
  painter(ctx, w, h, state)
  ctx.restore() // restore the clip+translate from atlas.getContext()
  return true
}

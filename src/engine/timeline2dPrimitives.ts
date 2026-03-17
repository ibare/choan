// Canvas2D primitive drawing helpers for the timeline.

const DIAMOND_SIZE = 15
const DIAMOND_HALF = DIAMOND_SIZE / 2

const C = {
  diamond: '#5b4fcf',
  diamondBorder: '#ffffff',
  diamondHover: '#7b6fef',
}

export function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, hover: boolean, easing?: string) {
  const s = hover ? DIAMOND_HALF * 1.3 : DIAMOND_HALF
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(Math.PI / 4)

  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 1

  ctx.fillStyle = hover ? C.diamondHover : C.diamond
  ctx.fillRect(-s / Math.SQRT2, -s / Math.SQRT2, (s * 2) / Math.SQRT2, (s * 2) / Math.SQRT2)

  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = C.diamondBorder
  ctx.lineWidth = 1.5
  ctx.strokeRect(-s / Math.SQRT2, -s / Math.SQRT2, (s * 2) / Math.SQRT2, (s * 2) / Math.SQRT2)

  ctx.restore()

  if (easing) {
    drawEasingIcon(ctx, cx, cy + DIAMOND_HALF + 6, easing)
  }
}

// Mini easing curve icon (10x6px area)
export function drawEasingIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, easing: string) {
  const w = 10, h = 6
  const x0 = cx - w / 2, y0 = cy - h / 2
  ctx.save()
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  switch (easing) {
    case 'linear':
      ctx.moveTo(x0, y0 + h); ctx.lineTo(x0 + w, y0)
      break
    case 'ease-in':
      ctx.moveTo(x0, y0 + h); ctx.quadraticCurveTo(x0 + w * 0.7, y0 + h, x0 + w, y0)
      break
    case 'ease-out':
      ctx.moveTo(x0, y0 + h); ctx.quadraticCurveTo(x0 + w * 0.3, y0, x0 + w, y0)
      break
    case 'ease-in-out':
      ctx.moveTo(x0, y0 + h); ctx.bezierCurveTo(x0 + w * 0.4, y0 + h, x0 + w * 0.6, y0, x0 + w, y0)
      break
    case 'spring':
      ctx.moveTo(x0, y0 + h); ctx.bezierCurveTo(x0 + w * 0.3, y0 - h * 0.3, x0 + w * 0.7, y0 + h * 0.2, x0 + w, y0)
      break
    default:
      ctx.moveTo(x0, y0 + h); ctx.lineTo(x0 + w, y0)
  }
  ctx.stroke()
  ctx.restore()
}

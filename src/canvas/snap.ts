type InputPoint = [number, number] | [number, number, number]
import type { ElementType, LineDirection, LineStyle } from '../store/useChoanStore'

export interface SnapResult {
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  lineDirection?: LineDirection
  lineStyle?: LineStyle
}

function getBoundingBox(points: InputPoint[]) {
  let minX = Infinity, minY = Infinity
  let maxX = -Infinity, maxY = -Infinity

  for (const p of points) {
    const [x, y] = p as [number, number]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

function isCircle(points: InputPoint[]): boolean {
  const { minX, minY, maxX, maxY, w, h } = getBoundingBox(points)
  const aspectRatio = w / h

  // 가로세로 비율이 0.6~1.4 사이이면 원으로 간주
  if (aspectRatio < 0.6 || aspectRatio > 1.4) return false

  // 시작점과 끝점이 가까우면 닫힌 도형(원)
  const first = points[0] as [number, number]
  const last = points[points.length - 1] as [number, number]
  const startEndDist = Math.hypot(last[0] - first[0], last[1] - first[1])
  const diagonal = Math.hypot(w, h)

  // 끝점이 시작점 근처로 돌아오면 원
  if (startEndDist < diagonal * 0.3) return true

  // 중심에서 점들의 거리 분산이 낮으면 원
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const r = (w + h) / 4
  const dists = (points as [number, number][]).map((p) => Math.hypot(p[0] - cx, p[1] - cy))
  const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length
  const variance = dists.reduce((a, b) => a + (b - avgDist) ** 2, 0) / dists.length

  return variance < r * r * 0.15
}

function isLine(points: InputPoint[]): boolean {
  const { w, h } = getBoundingBox(points)
  const aspectRatio = Math.max(w, h) / (Math.min(w, h) || 1)
  return aspectRatio > 4
}

function getLineDirection(points: InputPoint[]): LineDirection {
  const { w, h } = getBoundingBox(points)
  if (w > h * 2) return 'horizontal'
  if (h > w * 2) return 'vertical'
  return 'diagonal'
}

export function snapDrawing(points: InputPoint[]): SnapResult {
  if (points.length < 3) {
    const [x, y] = points[0] as [number, number]
    return { type: 'rectangle', x, y, width: 80, height: 40 }
  }

  const { minX, minY, w, h } = getBoundingBox(points)

  if (isLine(points)) {
    return {
      type: 'line',
      x: minX,
      y: minY,
      width: w,
      height: h,
      lineDirection: getLineDirection(points),
      lineStyle: 'solid',
    }
  }

  if (isCircle(points)) {
    const size = Math.max(w, h)
    return { type: 'circle', x: minX, y: minY, width: size, height: size }
  }

  return { type: 'rectangle', x: minX, y: minY, width: w || 80, height: h || 40 }
}

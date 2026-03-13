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

// 날카로운 방향 전환(코너) 횟수 계산
// 사각형 ≈ 4개, 원 ≈ 0개
function countCorners(points: InputPoint[], angleThresholdDeg = 45): number {
  // 노이즈 제거를 위해 약 30개 포인트로 다운샘플
  const step = Math.max(1, Math.floor(points.length / 30))
  const s = (points as [number, number][]).filter((_, i) => i % step === 0)
  if (s.length < 5) return 0

  let corners = 0
  for (let i = 1; i < s.length - 1; i++) {
    const v1x = s[i][0] - s[i - 1][0]
    const v1y = s[i][1] - s[i - 1][1]
    const v2x = s[i + 1][0] - s[i][0]
    const v2y = s[i + 1][1] - s[i][1]
    const len1 = Math.hypot(v1x, v1y)
    const len2 = Math.hypot(v2x, v2y)
    if (len1 < 1 || len2 < 1) continue
    const cos = (v1x * v2x + v1y * v2y) / (len1 * len2)
    const angleDeg = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI)
    if (angleDeg > angleThresholdDeg) corners++
  }
  return corners
}

function isCircle(points: InputPoint[]): boolean {
  const { w, h } = getBoundingBox(points)

  // 가로세로 비율이 너무 치우치면 원이 아님
  const aspectRatio = w / h
  if (aspectRatio < 0.5 || aspectRatio > 2.0) return false

  // 코너가 3개 이상이면 사각형 — 닫힌 경로여도 원으로 오판하지 않음
  if (countCorners(points) >= 3) return false

  // 시작-끝점이 가까운 닫힌 경로여야 원
  const first = points[0] as [number, number]
  const last = points[points.length - 1] as [number, number]
  const startEndDist = Math.hypot(last[0] - first[0], last[1] - first[1])
  const diagonal = Math.hypot(w, h)

  return startEndDist < diagonal * 0.4
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

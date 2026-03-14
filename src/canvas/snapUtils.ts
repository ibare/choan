export const SNAP_THRESHOLD = 6  // 픽셀 스냅 감지 거리
export const GUIDE_PAD = 20      // 가이드 라인이 요소 밖으로 연장되는 길이 (px)

export interface SnapLine {
  x1: number; y1: number  // 픽셀 좌표
  x2: number; y2: number
}

export interface Rect {
  x: number; y: number; width: number; height: number
}

// 두 배열의 카르테시안 곱
function cross<T>(a: T[], b: T[]): [T, T][] {
  return a.flatMap((x) => b.map((y) => [x, y] as [T, T]))
}

// ── 이동 스냅 ──────────────────────────────────────────
export function computeSnapMove(
  moving: Rect,
  others: Rect[],
  threshold = SNAP_THRESHOLD
): { dx: number; dy: number; lines: SnapLine[] } {
  const mL = moving.x, mCX = moving.x + moving.width / 2, mR = moving.x + moving.width
  const mT = moving.y, mCY = moving.y + moving.height / 2, mB = moving.y + moving.height

  let dx = 0, dy = 0
  let bestX = threshold + 1, bestY = threshold + 1
  let xLine: SnapLine | null = null
  let yLine: SnapLine | null = null

  for (const o of others) {
    const oL = o.x, oCX = o.x + o.width / 2, oR = o.x + o.width
    const oT = o.y, oCY = o.y + o.height / 2, oB = o.y + o.height

    for (const [mv, ov] of cross([mL, mCX, mR], [oL, oCX, oR])) {
      const d = Math.abs(mv - ov)
      if (d < bestX) {
        bestX = d; dx = ov - mv
        xLine = {
          x1: ov, y1: Math.min(mT, oT) - GUIDE_PAD,
          x2: ov, y2: Math.max(mB, oB) + GUIDE_PAD,
        }
      }
    }

    for (const [mv, ov] of cross([mT, mCY, mB], [oT, oCY, oB])) {
      const d = Math.abs(mv - ov)
      if (d < bestY) {
        bestY = d; dy = ov - mv
        yLine = {
          x1: Math.min(mL, oL) - GUIDE_PAD, y1: ov,
          x2: Math.max(mR, oR) + GUIDE_PAD, y2: ov,
        }
      }
    }
  }

  const lines: SnapLine[] = []
  if (bestX <= threshold && xLine) lines.push(xLine)
  else dx = 0
  if (bestY <= threshold && yLine) lines.push(yLine)
  else dy = 0

  return { dx, dy, lines }
}

// ── 리사이즈 스냅 ──────────────────────────────────────
export function computeSnapResize(
  anchor: { x: number; y: number },
  dragCorner: { x: number; y: number },
  others: Rect[],
  threshold = SNAP_THRESHOLD
): { x: number; y: number; lines: SnapLine[] } {
  let sx = dragCorner.x, sy = dragCorner.y
  let bestX = threshold + 1, bestY = threshold + 1
  const lines: SnapLine[] = []

  const signX = dragCorner.x >= anchor.x ? 1 : -1
  const signY = dragCorner.y >= anchor.y ? 1 : -1
  const curW = Math.abs(dragCorner.x - anchor.x)
  const curH = Math.abs(dragCorner.y - anchor.y)

  for (const o of others) {
    // X: 엣지 스냅
    for (const ov of [o.x, o.x + o.width / 2, o.x + o.width]) {
      const d = Math.abs(dragCorner.x - ov)
      if (d < bestX) { bestX = d; sx = ov }
    }
    // X: 동일 너비 스냅
    const dW = Math.abs(curW - o.width)
    if (dW < bestX) { bestX = dW; sx = anchor.x + signX * o.width }

    // Y: 엣지 스냅
    for (const ov of [o.y, o.y + o.height / 2, o.y + o.height]) {
      const d = Math.abs(dragCorner.y - ov)
      if (d < bestY) { bestY = d; sy = ov }
    }
    // Y: 동일 높이 스냅
    const dH = Math.abs(curH - o.height)
    if (dH < bestY) { bestY = dH; sy = anchor.y + signY * o.height }
  }

  if (bestX <= threshold) {
    lines.push({
      x1: sx, y1: Math.min(anchor.y, sy) - GUIDE_PAD,
      x2: sx, y2: Math.max(anchor.y, sy) + GUIDE_PAD,
    })
  }
  if (bestY <= threshold) {
    lines.push({
      x1: Math.min(anchor.x, sx) - GUIDE_PAD, y1: sy,
      x2: Math.max(anchor.x, sx) + GUIDE_PAD, y2: sy,
    })
  }

  return { x: sx, y: sy, lines }
}

// ── 간격 측정 ──────────────────────────────────────────
export interface DistanceMeasure {
  x1: number; y1: number
  x2: number; y2: number
  distance: number
  midX: number; midY: number
}

export function computeDistances(el: Rect, others: Rect[]): {
  left: DistanceMeasure | null
  right: DistanceMeasure | null
  top: DistanceMeasure | null
  bottom: DistanceMeasure | null
} {
  const elL = el.x, elR = el.x + el.width
  const elT = el.y, elB = el.y + el.height
  const elCX = el.x + el.width / 2
  const elCY = el.y + el.height / 2

  let left: DistanceMeasure | null = null
  let right: DistanceMeasure | null = null
  let top: DistanceMeasure | null = null
  let bottom: DistanceMeasure | null = null

  for (const o of others) {
    const oL = o.x, oR = o.x + o.width
    const oT = o.y, oB = o.y + o.height

    if (oR <= elL) {
      const dist = elL - oR
      if (!left || dist < left.distance)
        left = { x1: oR, y1: elCY, x2: elL, y2: elCY, distance: dist, midX: (oR + elL) / 2, midY: elCY }
    }
    if (oL >= elR) {
      const dist = oL - elR
      if (!right || dist < right.distance)
        right = { x1: elR, y1: elCY, x2: oL, y2: elCY, distance: dist, midX: (elR + oL) / 2, midY: elCY }
    }
    if (oB <= elT) {
      const dist = elT - oB
      if (!top || dist < top.distance)
        top = { x1: elCX, y1: oB, x2: elCX, y2: elT, distance: dist, midX: elCX, midY: (oB + elT) / 2 }
    }
    if (oT >= elB) {
      const dist = oT - elB
      if (!bottom || dist < bottom.distance)
        bottom = { x1: elCX, y1: elB, x2: elCX, y2: oT, distance: dist, midX: elCX, midY: (elB + oT) / 2 }
    }
  }

  return { left, right, top, bottom }
}

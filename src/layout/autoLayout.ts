// Pure layout computation — flexbox-like auto-layout for containers

export interface LayoutInput {
  container: { x: number; y: number; width: number; height: number }
  direction: 'free' | 'row' | 'column' | 'grid'
  gap: number
  padding: number
  childCount: number
  columns?: number  // grid only
}

export interface LayoutRect {
  x: number
  y: number
  width: number
  height: number
}

export function computeAutoLayout(input: LayoutInput): LayoutRect[] {
  const { container, direction, gap, padding, childCount } = input
  if (childCount <= 0 || direction === 'free') return []

  const innerX = container.x + padding
  const innerY = container.y + padding
  const innerW = container.width - 2 * padding
  const innerH = container.height - 2 * padding

  const totalGap = (childCount - 1) * gap
  const results: LayoutRect[] = []

  if (direction === 'grid') {
    const cols = Math.max(1, input.columns ?? 2)
    const rows = Math.ceil(childCount / cols)
    const hGap = (cols - 1) * gap
    const vGap = (rows - 1) * gap
    const cellW = Math.max(1, (innerW - hGap) / cols)
    const cellH = Math.max(1, (innerH - vGap) / rows)
    for (let i = 0; i < childCount; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      results.push({
        x: innerX + col * (cellW + gap),
        y: innerY + row * (cellH + gap),
        width: cellW,
        height: cellH,
      })
    }
  } else if (direction === 'column') {
    const childH = Math.max(1, (innerH - totalGap) / childCount)
    for (let i = 0; i < childCount; i++) {
      results.push({
        x: innerX,
        y: innerY + i * (childH + gap),
        width: Math.max(1, innerW),
        height: childH,
      })
    }
  } else {
    const childW = Math.max(1, (innerW - totalGap) / childCount)
    for (let i = 0; i < childCount; i++) {
      results.push({
        x: innerX + i * (childW + gap),
        y: innerY,
        width: childW,
        height: Math.max(1, innerH),
      })
    }
  }

  return results
}

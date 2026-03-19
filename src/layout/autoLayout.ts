// Pure layout computation — flexbox-like auto-layout for containers

export interface LayoutInput {
  container: { x: number; y: number; width: number; height: number }
  direction: 'free' | 'row' | 'column' | 'grid'
  gap: number
  padding: number
  childCount: number
  columns?: number
  // Per-child sizing: 'equal' (default), 'fixed-ratio', 'fixed-px'
  sizings?: ('equal' | 'fixed-ratio' | 'fixed-px')[]
  ratios?: (number | undefined)[]       // for fixed-ratio (0~1)
  fixedSizes?: (number | undefined)[]   // for fixed-px (pixels)
}

export interface LayoutRect {
  x: number
  y: number
  width: number
  height: number
}

const MIN_SIZE = 10

/**
 * Distribute space with 3 modes:
 * 1. fixed-px: absolute pixel size (deducted first)
 * 2. fixed-ratio: proportional to total (deducted second)
 * 3. equal: remaining space split equally among equal children
 */
function distribute(
  total: number, count: number, gap: number,
  sizings?: ('equal' | 'fixed-ratio' | 'fixed-px')[],
  ratios?: (number | undefined)[],
  fixedSizes?: (number | undefined)[],
): number[] {
  const totalGap = (count - 1) * gap
  const available = total - totalGap
  const sizes: number[] = new Array(count).fill(0)

  // Pass 1: fixed-px — deduct from available
  let remaining = available
  for (let i = 0; i < count; i++) {
    if ((sizings?.[i] ?? 'equal') === 'fixed-px') {
      sizes[i] = Math.max(MIN_SIZE, fixedSizes?.[i] ?? MIN_SIZE)
      remaining -= sizes[i]
    }
  }
  remaining = Math.max(0, remaining)

  // Pass 2: fixed-ratio — take proportional share of original available
  let ratioTotal = 0
  for (let i = 0; i < count; i++) {
    if ((sizings?.[i] ?? 'equal') === 'fixed-ratio') {
      const r = ratios?.[i] ?? 0
      sizes[i] = Math.max(MIN_SIZE, available * r)
      remaining -= sizes[i]
      ratioTotal += r
    }
  }
  remaining = Math.max(0, remaining)

  // Pass 3: equal — split remaining among equal children
  const equalIndices: number[] = []
  for (let i = 0; i < count; i++) {
    if ((sizings?.[i] ?? 'equal') === 'equal') equalIndices.push(i)
  }
  if (equalIndices.length > 0) {
    const each = Math.max(MIN_SIZE, remaining / equalIndices.length)
    for (const i of equalIndices) sizes[i] = each
  }

  return sizes
}

export function computeAutoLayout(input: LayoutInput): LayoutRect[] {
  const { container, direction, gap, padding, childCount, sizings, ratios, fixedSizes } = input
  if (childCount <= 0 || direction === 'free') return []

  const innerX = container.x + padding
  const innerY = container.y + padding
  const innerW = container.width - 2 * padding
  const innerH = container.height - 2 * padding

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
    const sizes = distribute(innerH, childCount, gap, sizings, ratios, fixedSizes)
    let curY = innerY
    for (let i = 0; i < childCount; i++) {
      results.push({ x: innerX, y: curY, width: Math.max(1, innerW), height: sizes[i] })
      curY += sizes[i] + gap
    }
  } else {
    // row
    const sizes = distribute(innerW, childCount, gap, sizings, ratios, fixedSizes)
    let curX = innerX
    for (let i = 0; i < childCount; i++) {
      results.push({ x: curX, y: innerY, width: sizes[i], height: Math.max(1, innerH) })
      curX += sizes[i] + gap
    }
  }

  return results
}

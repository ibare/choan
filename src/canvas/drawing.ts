import getStroke from 'perfect-freehand'

type InputPoint = [number, number] | [number, number, number]

export const STROKE_OPTIONS = {
  size: 8,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  easing: (t: number) => t,
  simulatePressure: true,
}

export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''

  const d = stroke.reduce((acc: string[], [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length]
    acc.push(
      x0.toFixed(2),
      y0.toFixed(2),
      ((x0 + x1) / 2).toFixed(2),
      ((y0 + y1) / 2).toFixed(2)
    )
    return acc
  }, [])

  return `M ${d[0]} ${d[1]} Q ${d.slice(2).join(' ')} Z`
}

export function computeStrokePath(points: InputPoint[]): string {
  const stroke = getStroke(points, STROKE_OPTIONS)
  return getSvgPathFromStroke(stroke)
}

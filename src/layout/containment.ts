// Spatial containment detection — center-point inside smallest container

interface Rect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export function detectContainment(
  element: Rect,
  containers: Rect[],
): string | null {
  const cx = element.x + element.width / 2
  const cy = element.y + element.height / 2

  let bestId: string | null = null
  let bestArea = Infinity

  for (const c of containers) {
    if (c.id === element.id) continue
    if (cx >= c.x && cx <= c.x + c.width && cy >= c.y && cy <= c.y + c.height) {
      const area = c.width * c.height
      if (area < bestArea) {
        bestArea = area
        bestId = c.id
      }
    }
  }

  return bestId
}

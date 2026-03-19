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
  let bestId: string | null = null
  let bestArea = Infinity

  // Element must be fully contained (all four corners inside the container)
  const el = element.x
  const et = element.y
  const er = element.x + element.width
  const eb = element.y + element.height

  for (const c of containers) {
    if (c.id === element.id) continue
    const cl = c.x, ct = c.y, cr = c.x + c.width, cb = c.y + c.height
    if (el >= cl && et >= ct && er <= cr && eb <= cb) {
      const area = c.width * c.height
      if (area < bestArea) {
        bestArea = area
        bestId = c.id
      }
    }
  }

  return bestId
}

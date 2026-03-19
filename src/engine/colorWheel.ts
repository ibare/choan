// Color wheel renderer — draws arc-segment cells on an OffscreenCanvas
// and uploads as a WebGL texture for screen-space display.

import { COLOR_FAMILIES } from '../canvas/materials'

const WHEEL_SIZE = 300    // canvas pixel size (square)
const CENTER = WHEEL_SIZE / 2
const INNER_R = 30        // innermost ring inner radius
const OUTER_R = 140       // outermost ring outer radius
const GAP = 2             // gap between cells

export interface ColorWheelTexture {
  texture: WebGLTexture
  size: number            // pixel size of the square texture
  sectorCount: number
  ringCount: number
  /** Get which color was hit. Returns hex or null. */
  hitTest(localX: number, localY: number): { fi: number; si: number; hex: number } | null
  /** Get screen-space highlight info for a swatch. */
  getCellCenter(fi: number, si: number): { x: number; y: number }
  dispose(gl: WebGL2RenderingContext): void
}

export function createColorWheel(gl: WebGL2RenderingContext): ColorWheelTexture {
  const canvas = new OffscreenCanvas(WHEEL_SIZE, WHEEL_SIZE)
  const ctx = canvas.getContext('2d')!

  const familyCount = COLOR_FAMILIES.length
  const shadeCount = COLOR_FAMILIES[0].shades.length
  const ringWidth = (OUTER_R - INNER_R) / shadeCount

  // Draw arc segments
  for (let fi = 0; fi < familyCount; fi++) {
    const startAngle = (fi / familyCount) * Math.PI * 2 - Math.PI / 2
    const endAngle = ((fi + 1) / familyCount) * Math.PI * 2 - Math.PI / 2
    const angleGap = GAP / OUTER_R // angular gap in radians

    for (let si = 0; si < shadeCount; si++) {
      // si=0 (lightest) → innermost ring, si=4 (darkest) → outermost ring
      const ringIdx = si
      const r1 = INNER_R + ringIdx * ringWidth + GAP / 2
      const r2 = INNER_R + (ringIdx + 1) * ringWidth - GAP / 2

      const hex = COLOR_FAMILIES[fi].shades[si]
      const r = ((hex >> 16) & 0xFF)
      const g = ((hex >> 8) & 0xFF)
      const b = (hex & 0xFF)

      ctx.beginPath()
      ctx.arc(CENTER, CENTER, r2, startAngle + angleGap, endAngle - angleGap)
      ctx.arc(CENTER, CENTER, r1, endAngle - angleGap, startAngle + angleGap, true)
      ctx.closePath()
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fill()
    }
  }

  // Center circle (white)
  ctx.beginPath()
  ctx.arc(CENTER, CENTER, INNER_R - GAP, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()

  // Upload to WebGL texture
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)

  function hitTest(localX: number, localY: number) {
    // localX, localY: 0~1 normalized within the wheel quad
    const px = localX * WHEEL_SIZE - CENTER
    const py = localY * WHEEL_SIZE - CENTER
    const dist = Math.sqrt(px * px + py * py)
    if (dist < INNER_R || dist > OUTER_R) return null

    let angle = Math.atan2(py, px) + Math.PI / 2
    if (angle < 0) angle += Math.PI * 2

    const fi = Math.floor((angle / (Math.PI * 2)) * familyCount) % familyCount
    const ringIdx = Math.floor((dist - INNER_R) / ringWidth)
    const si = Math.min(ringIdx, shadeCount - 1) // innermost ring = si=0 (lightest)
    return { fi, si, hex: COLOR_FAMILIES[fi].shades[si] }
  }

  function getCellCenter(fi: number, si: number) {
    const ringIdx = si
    const r = INNER_R + (ringIdx + 0.5) * ringWidth
    const angle = ((fi + 0.5) / familyCount) * Math.PI * 2 - Math.PI / 2
    return {
      x: (CENTER + Math.cos(angle) * r) / WHEEL_SIZE,
      y: (CENTER + Math.sin(angle) * r) / WHEEL_SIZE,
    }
  }

  function dispose(gl: WebGL2RenderingContext) {
    gl.deleteTexture(texture)
  }

  return { texture, size: WHEEL_SIZE, sectorCount: familyCount, ringCount: shadeCount, hitTest, getCellCenter, dispose }
}

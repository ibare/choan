// Scene data pipeline: ChoanElement[] → UBO for GPU

import type { ChoanElement } from '../store/useChoanStore'
import { PALETTE } from '../canvas/materials'
import { pixelToWorld, pixelWidthToWorld, pixelHeightToWorld } from '../coords/coordinateSystem'

export const MAX_OBJECTS = 128
export const EXTRUDE_DEPTH = 0.05
export const FRUSTUM = 10

// Shape type constants (match shader)
const SHAPE_RECT = 0
const SHAPE_CIRCLE = 1
const SHAPE_LINE = 2

// UBO layout (std140) — must match shader SceneData block:
// vec4 uNumObjPad          (offset 0, 16 bytes)
// vec4 uPosType[128]       (offset 16)
// vec4 uSizeRadius[128]    (offset 16 + 128*16)
// vec4 uColorAlpha[128]    (offset 16 + 256*16)
const POS_OFFSET = 4                           // floats: skip numObjPad vec4
const SIZE_OFFSET = POS_OFFSET + MAX_OBJECTS * 4
const COLOR_OFFSET = SIZE_OFFSET + MAX_OBJECTS * 4
const EFFECT_OFFSET = COLOR_OFFSET + MAX_OBJECTS * 4
const TEXRECT_OFFSET = EFFECT_OFFSET + MAX_OBJECTS * 4
const UBO_FLOATS = TEXRECT_OFFSET + MAX_OBJECTS * 4

// Color-change effect tracking
const EFFECT_DURATION = 300 // ms
const prevColors = new Map<string, number>()
const colorChangeTimes = new Map<string, number>()

export interface SceneUBO {
  buffer: WebGLBuffer
  data: Float32Array
  update(
    gl: WebGL2RenderingContext,
    elements: ChoanElement[],
    canvasW: number,
    canvasH: number,
    extrudeDepth?: number,
    texRects?: Map<string, [number, number, number, number]>,
    numRegular?: number,
  ): void
  bind(gl: WebGL2RenderingContext, program: WebGLProgram): void
  dispose(gl: WebGL2RenderingContext): void
}

export function createSceneUBO(gl: WebGL2RenderingContext): SceneUBO {
  const buffer = gl.createBuffer()!
  const data = new Float32Array(UBO_FLOATS)

  gl.bindBuffer(gl.UNIFORM_BUFFER, buffer)
  gl.bufferData(gl.UNIFORM_BUFFER, data.byteLength, gl.DYNAMIC_DRAW)
  gl.bindBuffer(gl.UNIFORM_BUFFER, null)

  function update(
    gl: WebGL2RenderingContext,
    elements: ChoanElement[],
    canvasW: number,
    canvasH: number,
    extrudeDepthOverride?: number,
    texRects?: Map<string, [number, number, number, number]>,
    numRegular?: number,
  ) {
    const ed = extrudeDepthOverride ?? EXTRUDE_DEPTH
    const count = Math.min(elements.length, MAX_OBJECTS)
    const now = performance.now()

    // Clear all data
    data.fill(0)

    // uNumObjPad: x = numObjects, z = numRegular (non-skinOnly count)
    data[0] = count
    data[2] = numRegular ?? count

    for (let i = 0; i < count; i++) {
      const el = elements[i]

      // Center pixel → world
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const [wx, wy] = pixelToWorld(cx, cy, canvasW, canvasH)

      // Size: pixel → world half-size
      const hw = pixelWidthToWorld(el.width, canvasW, canvasH) / 2
      const hh = pixelHeightToWorld(el.height, canvasH) / 2

      // Shape type
      let shapeType = SHAPE_RECT
      if (el.type === 'circle') shapeType = SHAPE_CIRCLE
      else if (el.type === 'line') shapeType = SHAPE_LINE

      // Corner radius
      const radius = el.type === 'rectangle' ? (el.radius ?? 0) : 0

      // Color (hex → RGB 0-1)
      const color = el.color ?? PALETTE[i % PALETTE.length]
      const r = ((color >> 16) & 0xff) / 255
      const g = ((color >> 8) & 0xff) / 255
      const b = (color & 0xff) / 255

      // uPosType[i]
      const pi = POS_OFFSET + i * 4
      data[pi + 0] = wx
      data[pi + 1] = wy
      data[pi + 2] = el.z * ed
      data[pi + 3] = shapeType

      // uSizeRadius[i]
      const si = SIZE_OFFSET + i * 4
      data[si + 0] = hw
      data[si + 1] = hh
      data[si + 2] = ed / 2
      data[si + 3] = radius

      // uColorAlpha[i]
      const ci = COLOR_OFFSET + i * 4
      data[ci + 0] = r
      data[ci + 1] = g
      data[ci + 2] = b
      data[ci + 3] = el.opacity ?? 1

      // Color-change effect: detect change, compute intensity
      const prevColor = prevColors.get(el.id)
      if (prevColor !== undefined && prevColor !== color) {
        colorChangeTimes.set(el.id, now)
      }
      prevColors.set(el.id, color)

      const changeTime = colorChangeTimes.get(el.id) ?? -10000
      const elapsed = now - changeTime
      const t = Math.max(0, 1 - elapsed / EFFECT_DURATION)

      // uEffect[i]: x = pulse, y = flash, z = (reserved), w = skinOnly
      const ei = EFFECT_OFFSET + i * 4
      data[ei + 0] = t * t          // pulse: quadratic ease-out
      data[ei + 1] = t * t * t      // flash: faster cubic decay
      data[ei + 3] = (el.skinOnly || el.frameless) ? 1.0 : 0.0

      // uTexRect[i]: atlas UV rect (0 if no texture)
      const tr = texRects?.get(el.id)
      if (tr) {
        const ti = TEXRECT_OFFSET + i * 4
        data[ti + 0] = tr[0]
        data[ti + 1] = tr[1]
        data[ti + 2] = tr[2]
        data[ti + 3] = tr[3]
      }
    }

    gl.bindBuffer(gl.UNIFORM_BUFFER, buffer)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data)
    gl.bindBuffer(gl.UNIFORM_BUFFER, null)
  }

  function bind(gl: WebGL2RenderingContext, program: WebGLProgram) {
    const blockIndex = gl.getUniformBlockIndex(program, 'SceneData')
    if (blockIndex !== gl.INVALID_INDEX) {
      gl.uniformBlockBinding(program, blockIndex, 0)
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, buffer)
    }
  }

  function dispose(gl: WebGL2RenderingContext) {
    gl.deleteBuffer(buffer)
  }

  return { buffer, data, update, bind, dispose }
}

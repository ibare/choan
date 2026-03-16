// Scene data pipeline: ChoanElement[] → UBO for GPU

import type { ChoanElement } from '../store/useChoanStore'
import { PALETTE } from '../canvas/materials'

export const MAX_OBJECTS = 40
export const EXTRUDE_DEPTH = 0.05
export const FRUSTUM = 10

// Shape type constants (match shader)
const SHAPE_RECT = 0
const SHAPE_CIRCLE = 1
const SHAPE_LINE = 2

// UBO layout (std140) — must match shader SceneData block:
// vec4 uNumObjPad          (offset 0, 16 bytes)
// vec4 uPosType[40]        (offset 16, 640 bytes)
// vec4 uSizeRadius[40]     (offset 656, 640 bytes)
// vec4 uColorAlpha[40]     (offset 1296, 640 bytes)
// Total: 1936 bytes = 484 floats
const POS_OFFSET = 4                           // floats: skip numObjPad vec4
const SIZE_OFFSET = POS_OFFSET + MAX_OBJECTS * 4
const COLOR_OFFSET = SIZE_OFFSET + MAX_OBJECTS * 4
const UBO_FLOATS = COLOR_OFFSET + MAX_OBJECTS * 4

export interface SceneUBO {
  buffer: WebGLBuffer
  data: Float32Array
  update(gl: WebGL2RenderingContext, elements: ChoanElement[], canvasW: number, canvasH: number, extrudeDepth?: number): void
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
  ) {
    const ed = extrudeDepthOverride ?? EXTRUDE_DEPTH
    const count = Math.min(elements.length, MAX_OBJECTS)
    const aspect = canvasW / canvasH

    // Clear all data
    data.fill(0)

    // numObjects
    data[0] = count

    for (let i = 0; i < count; i++) {
      const el = elements[i]

      // Center pixel → world
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const wx = -FRUSTUM * aspect + (cx / canvasW) * 2 * FRUSTUM * aspect
      const wy = FRUSTUM - (cy / canvasH) * 2 * FRUSTUM

      // Size: pixel → world half-size
      const hw = ((el.width / canvasW) * 2 * FRUSTUM * aspect) / 2
      const hh = ((el.height / canvasH) * 2 * FRUSTUM) / 2

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
      data[ci + 3] = el.opacity
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

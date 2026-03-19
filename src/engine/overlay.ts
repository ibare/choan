// UI Overlay renderer — selection box, snap guides, distance lines
// Renders lines and quads on top of the SDF scene (depth test disabled)

import { createProgram } from './gl'
import { OVERLAY_VERT, OVERLAY_FRAG, DASH_VERT, DASH_FRAG, DISC_VERT, DISC_FRAG, DISC_SCREEN_VERT, RECT_SCREEN_FRAG, TEX_SCREEN_VERT, TEX_SCREEN_FRAG } from './overlayShaders'

export interface OverlayRenderer {
  drawLines(vertices: Float32Array, color: [number, number, number, number]): void
  drawDashedLoop(vertices: Float32Array, color: [number, number, number, number]): void
  drawQuads(centers: Float32Array, size: number, color: [number, number, number, number]): void
  drawDisc(cx: number, cy: number, radius: number, color: [number, number, number, number]): void
  drawDiscScreen(canvasPx: number, canvasPy: number, radiusPx: number, color: [number, number, number, number]): void
  drawRectScreen(canvasPx: number, canvasPy: number, widthPx: number, heightPx: number, color: [number, number, number, number]): void
  drawTexturedScreen(canvasPx: number, canvasPy: number, sizePx: number, texture: WebGLTexture): void
  projectToScreen(wx: number, wy: number, z: number): { px: number; py: number }
  beginFrame(viewProj: Float32Array): void
  setZ(z: number): void
  dispose(): void
}

export function createOverlayRenderer(gl: WebGL2RenderingContext): OverlayRenderer {
  const lineProgram = createProgram(gl, OVERLAY_VERT, OVERLAY_FRAG)
  const dashProgram = createProgram(gl, DASH_VERT, DASH_FRAG)
  const discProgram = createProgram(gl, DISC_VERT, DISC_FRAG)
  const discScreenProgram = createProgram(gl, DISC_SCREEN_VERT, DISC_FRAG)
  const rectScreenProgram = createProgram(gl, DISC_SCREEN_VERT, RECT_SCREEN_FRAG)
  const texScreenProgram = createProgram(gl, TEX_SCREEN_VERT, TEX_SCREEN_FRAG)

  // Line VAO
  const lineVao = gl.createVertexArray()!
  const lineVbo = gl.createBuffer()!
  gl.bindVertexArray(lineVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  // Quad VAO (for handles)
  const quadVao = gl.createVertexArray()!
  const quadVbo = gl.createBuffer()!
  gl.bindVertexArray(quadVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  // Disc VAO (vec4: xy position + zw UV)
  const discVao = gl.createVertexArray()!
  const discVbo = gl.createBuffer()!
  gl.bindVertexArray(discVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, discVbo)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  let currentViewProj: Float32Array | null = null
  let currentZ = 0.0

  function beginFrame(viewProj: Float32Array) {
    currentViewProj = viewProj
    currentZ = 0.0
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  function setZ(z: number) {
    currentZ = z
  }

  function drawLines(vertices: Float32Array, color: [number, number, number, number]) {
    if (vertices.length < 4 || !currentViewProj) return

    gl.useProgram(lineProgram)
    gl.uniformMatrix4fv(gl.getUniformLocation(lineProgram, 'uViewProj'), false, currentViewProj)
    gl.uniform4fv(gl.getUniformLocation(lineProgram, 'uColor'), color)
    gl.uniform1f(gl.getUniformLocation(lineProgram, 'uZ'), currentZ)

    gl.bindVertexArray(lineVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.LINES, 0, vertices.length / 2)
    gl.bindVertexArray(null)
  }

  function drawDashedLoop(vertices: Float32Array, color: [number, number, number, number]) {
    if (vertices.length < 4 || !currentViewProj) return

    gl.useProgram(dashProgram)
    gl.uniformMatrix4fv(gl.getUniformLocation(dashProgram, 'uViewProj'), false, currentViewProj)
    gl.uniform4fv(gl.getUniformLocation(dashProgram, 'uColor'), color)
    gl.uniform1f(gl.getUniformLocation(dashProgram, 'uZ'), currentZ)
    gl.uniform1f(gl.getUniformLocation(dashProgram, 'uDashTotal'), 12.0)
    const canvas = gl.canvas as HTMLCanvasElement
    gl.uniform2f(gl.getUniformLocation(dashProgram, 'uResolution'), canvas.width, canvas.height)

    gl.bindVertexArray(lineVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.LINE_LOOP, 0, vertices.length / 2)
    gl.bindVertexArray(null)
  }

  function drawQuads(centers: Float32Array, size: number, color: [number, number, number, number]) {
    if (centers.length < 2 || !currentViewProj) return

    const hs = size / 2
    const tris: number[] = []
    for (let i = 0; i < centers.length; i += 2) {
      const cx = centers[i], cy = centers[i + 1]
      tris.push(
        cx - hs, cy - hs,
        cx + hs, cy - hs,
        cx + hs, cy + hs,
        cx - hs, cy - hs,
        cx + hs, cy + hs,
        cx - hs, cy + hs,
      )
    }

    gl.useProgram(lineProgram)
    gl.uniformMatrix4fv(gl.getUniformLocation(lineProgram, 'uViewProj'), false, currentViewProj)
    gl.uniform4fv(gl.getUniformLocation(lineProgram, 'uColor'), color)
    gl.uniform1f(gl.getUniformLocation(lineProgram, 'uZ'), currentZ)

    gl.bindVertexArray(quadVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tris), gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, tris.length / 2)
    gl.bindVertexArray(null)
  }

  // Static billboard quad: 6 vertices, each = (cx, cy, offsetX, offsetY)
  // cx/cy are filled per-call; offsets are corner directions (-1..1)
  const discQuad = new Float32Array(6 * 4)
  const offsets = [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]
  for (let i = 0; i < 6; i++) {
    discQuad[i * 4 + 2] = offsets[i][0]
    discQuad[i * 4 + 3] = offsets[i][1]
  }

  function drawDisc(cx: number, cy: number, radius: number, color: [number, number, number, number]) {
    if (!currentViewProj) return

    // Fill center for all 6 vertices
    for (let i = 0; i < 6; i++) {
      discQuad[i * 4 + 0] = cx
      discQuad[i * 4 + 1] = cy
    }

    gl.useProgram(discProgram)
    gl.uniformMatrix4fv(gl.getUniformLocation(discProgram, 'uViewProj'), false, currentViewProj)
    gl.uniform4fv(gl.getUniformLocation(discProgram, 'uColor'), color)
    gl.uniform1f(gl.getUniformLocation(discProgram, 'uZ'), currentZ)
    gl.uniform1f(gl.getUniformLocation(discProgram, 'uRadius'), radius)

    gl.bindVertexArray(discVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, discVbo)
    gl.bufferData(gl.ARRAY_BUFFER, discQuad, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  function drawTexturedScreen(canvasPx: number, canvasPy: number, sizePx: number, texture: WebGLTexture) {
    const canvas = gl.canvas as HTMLCanvasElement
    const cw = canvas.width, ch = canvas.height
    const ndcX = canvasPx * 2 / cw - 1
    const ndcY = 1 - canvasPy * 2 / ch
    const ndcHW = sizePx / cw
    const ndcHH = sizePx / ch

    const data = new Float32Array([
      ndcX - ndcHW, ndcY - ndcHH, 0, 1,
      ndcX + ndcHW, ndcY - ndcHH, 1, 1,
      ndcX + ndcHW, ndcY + ndcHH, 1, 0,
      ndcX - ndcHW, ndcY - ndcHH, 0, 1,
      ndcX + ndcHW, ndcY + ndcHH, 1, 0,
      ndcX - ndcHW, ndcY + ndcHH, 0, 0,
    ])

    gl.useProgram(texScreenProgram)
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(gl.getUniformLocation(texScreenProgram, 'uTex'), 3)

    gl.bindVertexArray(discVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, discVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  function drawRectScreen(canvasPx: number, canvasPy: number, widthPx: number, heightPx: number, color: [number, number, number, number]) {
    const canvas = gl.canvas as HTMLCanvasElement
    const cw = canvas.width, ch = canvas.height
    const ndcX = canvasPx * 2 / cw - 1
    const ndcY = 1 - canvasPy * 2 / ch
    const ndcHW = widthPx / cw
    const ndcHH = heightPx / ch

    const data = new Float32Array([
      ndcX - ndcHW, ndcY - ndcHH, 0, 0,
      ndcX + ndcHW, ndcY - ndcHH, 1, 0,
      ndcX + ndcHW, ndcY + ndcHH, 1, 1,
      ndcX - ndcHW, ndcY - ndcHH, 0, 0,
      ndcX + ndcHW, ndcY + ndcHH, 1, 1,
      ndcX - ndcHW, ndcY + ndcHH, 0, 1,
    ])

    gl.useProgram(rectScreenProgram)
    gl.uniform4fv(gl.getUniformLocation(rectScreenProgram, 'uColor'), color)

    gl.bindVertexArray(discVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, discVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  function projectToScreen(wx: number, wy: number, z: number): { px: number; py: number } {
    if (!currentViewProj) return { px: 0, py: 0 }
    const vp = currentViewProj
    const cx = vp[0] * wx + vp[4] * wy + vp[8] * z + vp[12]
    const cy = vp[1] * wx + vp[5] * wy + vp[9] * z + vp[13]
    const cw = vp[3] * wx + vp[7] * wy + vp[11] * z + vp[15]
    const canvas = gl.canvas as HTMLCanvasElement
    return {
      px: (cx / cw * 0.5 + 0.5) * canvas.width,
      py: (0.5 - cy / cw * 0.5) * canvas.height,
    }
  }

  function drawDiscScreen(canvasPx: number, canvasPy: number, radiusPx: number, color: [number, number, number, number]) {
    const canvas = gl.canvas as HTMLCanvasElement
    const cw = canvas.width, ch = canvas.height
    const ndcX = canvasPx * 2 / cw - 1
    const ndcY = 1 - canvasPy * 2 / ch
    const ndcRX = radiusPx * 2 / cw
    const ndcRY = radiusPx * 2 / ch

    const data = new Float32Array([
      ndcX - ndcRX, ndcY - ndcRY, 0, 0,
      ndcX + ndcRX, ndcY - ndcRY, 1, 0,
      ndcX + ndcRX, ndcY + ndcRY, 1, 1,
      ndcX - ndcRX, ndcY - ndcRY, 0, 0,
      ndcX + ndcRX, ndcY + ndcRY, 1, 1,
      ndcX - ndcRX, ndcY + ndcRY, 0, 1,
    ])

    gl.useProgram(discScreenProgram)
    gl.uniform4fv(gl.getUniformLocation(discScreenProgram, 'uColor'), color)

    gl.bindVertexArray(discVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, discVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  function dispose() {
    gl.deleteProgram(lineProgram)
    gl.deleteProgram(dashProgram)
    gl.deleteProgram(discProgram)
    gl.deleteProgram(discScreenProgram)
    gl.deleteProgram(rectScreenProgram)
    gl.deleteProgram(texScreenProgram)
    gl.deleteVertexArray(lineVao)
    gl.deleteBuffer(lineVbo)
    gl.deleteVertexArray(quadVao)
    gl.deleteBuffer(quadVbo)
    gl.deleteVertexArray(discVao)
    gl.deleteBuffer(discVbo)
  }

  return { drawLines, drawDashedLoop, drawQuads, drawDisc, drawDiscScreen, drawRectScreen, drawTexturedScreen, projectToScreen, beginFrame, setZ, dispose }
}

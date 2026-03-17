// UI Overlay renderer — selection box, snap guides, distance lines
// Renders lines and quads on top of the SDF scene (depth test disabled)

import { createProgram } from './gl'
import { OVERLAY_VERT, OVERLAY_FRAG, DASH_VERT, DASH_FRAG, DISC_VERT, DISC_FRAG } from './overlayShaders'

export { buildViewProjMatrix } from './camera'

export interface OverlayRenderer {
  drawLines(vertices: Float32Array, color: [number, number, number, number]): void
  drawDashedLoop(vertices: Float32Array, color: [number, number, number, number]): void
  drawQuads(centers: Float32Array, size: number, color: [number, number, number, number]): void
  drawDisc(cx: number, cy: number, radius: number, color: [number, number, number, number]): void
  beginFrame(viewProj: Float32Array): void
  setZ(z: number): void
  dispose(): void
}

export function createOverlayRenderer(gl: WebGL2RenderingContext): OverlayRenderer {
  const lineProgram = createProgram(gl, OVERLAY_VERT, OVERLAY_FRAG)
  const dashProgram = createProgram(gl, DASH_VERT, DASH_FRAG)
  const discProgram = createProgram(gl, DISC_VERT, DISC_FRAG)

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

  function drawDisc(cx: number, cy: number, radius: number, color: [number, number, number, number]) {
    if (!currentViewProj) return

    const data = new Float32Array([
      cx - radius, cy - radius, 0, 0,
      cx + radius, cy - radius, 1, 0,
      cx + radius, cy + radius, 1, 1,
      cx - radius, cy - radius, 0, 0,
      cx + radius, cy + radius, 1, 1,
      cx - radius, cy + radius, 0, 1,
    ])

    gl.useProgram(discProgram)
    gl.uniformMatrix4fv(gl.getUniformLocation(discProgram, 'uViewProj'), false, currentViewProj)
    gl.uniform4fv(gl.getUniformLocation(discProgram, 'uColor'), color)
    gl.uniform1f(gl.getUniformLocation(discProgram, 'uZ'), currentZ)

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
    gl.deleteVertexArray(lineVao)
    gl.deleteBuffer(lineVbo)
    gl.deleteVertexArray(quadVao)
    gl.deleteBuffer(quadVbo)
    gl.deleteVertexArray(discVao)
    gl.deleteBuffer(discVbo)
  }

  return { drawLines, drawDashedLoop, drawQuads, drawDisc, beginFrame, setZ, dispose }
}

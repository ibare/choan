// UI Overlay renderer — selection box, snap guides, distance lines
// Renders lines and quads on top of the SDF scene (depth test disabled)

import { createProgram } from './gl'

const OVERLAY_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPosition;
uniform mat4 uViewProj;
void main() {
  gl_Position = uViewProj * vec4(aPosition, 0.5, 1.0);
}
`

const OVERLAY_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
  fragColor = uColor;
}
`

const DASH_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uColor;
uniform float uDashTotal;
out vec4 fragColor;
flat in float vStartDist;
in float vDist;
void main() {
  float d = vDist - vStartDist;
  float phase = mod(d, uDashTotal);
  if (phase > uDashTotal * 0.66) discard;
  fragColor = uColor;
}
`

const DASH_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPosition;
uniform mat4 uViewProj;
uniform vec2 uResolution;
flat out float vStartDist;
out float vDist;
void main() {
  gl_Position = uViewProj * vec4(aPosition, 0.5, 1.0);
  // Approximate screen distance for dash pattern
  vec2 screenPos = gl_Position.xy / gl_Position.w * uResolution * 0.5;
  vDist = length(screenPos);
  vStartDist = vDist;
}
`

export interface OverlayRenderer {
  drawLines(vertices: Float32Array, color: [number, number, number, number]): void
  drawDashedLoop(vertices: Float32Array, color: [number, number, number, number]): void
  drawQuads(centers: Float32Array, size: number, color: [number, number, number, number]): void
  beginFrame(viewProj: Float32Array): void
  dispose(): void
}

export function createOverlayRenderer(gl: WebGL2RenderingContext): OverlayRenderer {
  const lineProgram = createProgram(gl, OVERLAY_VERT, OVERLAY_FRAG)
  const dashProgram = createProgram(gl, DASH_VERT, DASH_FRAG)

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

  let currentViewProj: Float32Array | null = null

  function beginFrame(viewProj: Float32Array) {
    currentViewProj = viewProj
    gl.disable(gl.DEPTH_TEST)
  }

  function drawLines(vertices: Float32Array, color: [number, number, number, number]) {
    if (vertices.length < 4 || !currentViewProj) return

    gl.useProgram(lineProgram)
    gl.uniformMatrix4fv(gl.getUniformLocation(lineProgram, 'uViewProj'), false, currentViewProj)
    gl.uniform4fv(gl.getUniformLocation(lineProgram, 'uColor'), color)

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

    gl.bindVertexArray(quadVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tris), gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, tris.length / 2)
    gl.bindVertexArray(null)
  }

  function dispose() {
    gl.deleteProgram(lineProgram)
    gl.deleteProgram(dashProgram)
    gl.deleteVertexArray(lineVao)
    gl.deleteBuffer(lineVbo)
    gl.deleteVertexArray(quadVao)
    gl.deleteBuffer(quadVbo)
  }

  return { drawLines, drawDashedLoop, drawQuads, beginFrame, dispose }
}

// ── View-Projection matrix builder ──

export function buildViewProjMatrix(
  camPos: [number, number, number],
  camTarget: [number, number, number],
  camUp: [number, number, number],
  fov: number, // degrees
  aspect: number,
  near: number,
  far: number,
): Float32Array {
  // View matrix
  const [ex, ey, ez] = camPos
  const [cx, cy, cz] = camTarget

  let fx = cx - ex, fy = cy - ey, fz = cz - ez
  let fl = Math.sqrt(fx * fx + fy * fy + fz * fz)
  fx /= fl; fy /= fl; fz /= fl

  let rx = fy * camUp[2] - fz * camUp[1]
  let ry = fz * camUp[0] - fx * camUp[2]
  let rz = fx * camUp[1] - fy * camUp[0]
  let rl = Math.sqrt(rx * rx + ry * ry + rz * rz)
  rx /= rl; ry /= rl; rz /= rl

  const ux = ry * fz - rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy - ry * fx

  // Perspective matrix
  const f = 1.0 / Math.tan(fov * Math.PI / 180 * 0.5)
  const nf = 1 / (near - far)

  // VP = P * V (column-major)
  // V:
  const v00 = rx, v01 = ux, v02 = -fx
  const v10 = ry, v11 = uy, v12 = -fy
  const v20 = rz, v21 = uz, v22 = -fz
  const v30 = -(rx * ex + ry * ey + rz * ez)
  const v31 = -(ux * ex + uy * ey + uz * ez)
  const v32 = -(-fx * ex + -fy * ey + -fz * ez)

  // P:
  const p00 = f / aspect
  const p11 = f
  const p22 = (far + near) * nf
  const p23 = -1
  const p32 = 2 * far * near * nf

  // VP = P * V (column-major result)
  return new Float32Array([
    p00 * v00, p11 * v01, p22 * v02 + p23 * v02, -v02,
    p00 * v10, p11 * v11, p22 * v12 + p23 * v12, -v12,
    p00 * v20, p11 * v21, p22 * v22 + p23 * v22, -v22,
    p00 * v30, p11 * v31, p22 * v32 + p23 * v32 + p32, -v32,
  ])
}

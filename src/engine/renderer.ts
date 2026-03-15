// Core SDF Renderer — manages WebGL2 state and render loop

import { createGL, createProgram, getUniformLocation } from './gl'
import { createFullscreenQuad, drawFullscreenQuad } from './quad'
import { RAYMARCH_VERT, RAYMARCH_FRAG } from './shaders'

export interface SDFRenderer {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  resize(width: number, height: number): void
  render(): void
  dispose(): void
}

export function createSDFRenderer(container: HTMLElement): SDFRenderer {
  const canvas = document.createElement('canvas')
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  container.appendChild(canvas)

  const gl = createGL(canvas)
  const program = createProgram(gl, RAYMARCH_VERT, RAYMARCH_FRAG)
  const quad = createFullscreenQuad(gl)

  // Uniform locations
  const uResolution = getUniformLocation(gl, program, 'uResolution')
  const uBgColor = getUniformLocation(gl, program, 'uBgColor')

  // Background color: 0xf7f3ee → RGB normalized
  const bgR = 0xf7 / 255
  const bgG = 0xf3 / 255
  const bgB = 0xee / 255

  function resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  function render() {
    gl.useProgram(program)
    gl.uniform2f(uResolution, canvas.width, canvas.height)
    gl.uniform3f(uBgColor, bgR, bgG, bgB)
    drawFullscreenQuad(gl, quad)
  }

  function dispose() {
    gl.deleteProgram(program)
    container.removeChild(canvas)
  }

  // Initial size
  resize(container.clientWidth, container.clientHeight)

  return { canvas, gl, resize, render, dispose }
}

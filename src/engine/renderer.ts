// Core SDF Renderer — manages WebGL2 state and render loop

import { createGL, createProgram, getUniformLocation } from './gl'
import { createFullscreenQuad, drawFullscreenQuad } from './quad'
import { RAYMARCH_VERT, RAYMARCH_FRAG } from './shaders'
import { createCamera, getCameraRayParams, type Camera } from './camera'

export interface SDFRenderer {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  camera: Camera
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

  // Camera
  const camera = createCamera()

  // Uniform locations
  const uResolution = getUniformLocation(gl, program, 'uResolution')
  const uBgColor = getUniformLocation(gl, program, 'uBgColor')
  const uCamPos = getUniformLocation(gl, program, 'uCamPos')
  const uCamForward = getUniformLocation(gl, program, 'uCamForward')
  const uCamRight = getUniformLocation(gl, program, 'uCamRight')
  const uCamUp = getUniformLocation(gl, program, 'uCamUp')
  const uFovScale = getUniformLocation(gl, program, 'uFovScale')

  // Background color: 0xf7f3ee
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
    camera.aspect = width / height
  }

  function render() {
    const ray = getCameraRayParams(camera)

    gl.useProgram(program)
    gl.uniform2f(uResolution, canvas.width, canvas.height)
    gl.uniform3f(uBgColor, bgR, bgG, bgB)
    gl.uniform3f(uCamPos, ray.ro[0], ray.ro[1], ray.ro[2])
    gl.uniform3f(uCamForward, ray.forward[0], ray.forward[1], ray.forward[2])
    gl.uniform3f(uCamRight, ray.right[0], ray.right[1], ray.right[2])
    gl.uniform3f(uCamUp, ray.up[0], ray.up[1], ray.up[2])
    gl.uniform1f(uFovScale, ray.fovScale)
    drawFullscreenQuad(gl, quad)
  }

  function dispose() {
    gl.deleteProgram(program)
    container.removeChild(canvas)
  }

  // Initial size
  resize(container.clientWidth, container.clientHeight)

  return { canvas, gl, camera, resize, render, dispose }
}

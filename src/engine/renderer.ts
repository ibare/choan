// Core SDF Renderer — manages WebGL2 state and render loop

import { createGL, createProgram, getUniformLocation } from './gl'
import { createFullscreenQuad, drawFullscreenQuad } from './quad'
import { RAYMARCH_VERT, RAYMARCH_FRAG } from './shaders'
import { createCamera, getCameraRayParams, type Camera } from './camera'
import { createSceneUBO, type SceneUBO } from './scene'
import { createOverlayRenderer, buildViewProjMatrix, type OverlayRenderer } from './overlay'
import type { ChoanElement } from '../store/useChoanStore'

export interface SDFRenderer {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  camera: Camera
  overlay: OverlayRenderer
  resize(width: number, height: number): void
  updateScene(elements: ChoanElement[]): void
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

  // Scene UBO
  const sceneUBO: SceneUBO = createSceneUBO(gl)
  sceneUBO.bind(gl, program)

  // Overlay renderer
  const overlay = createOverlayRenderer(gl)

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

  let cssWidth = 1
  let cssHeight = 1

  function resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    gl.viewport(0, 0, canvas.width, canvas.height)
    camera.aspect = width / height
    cssWidth = width
    cssHeight = height
  }

  function updateScene(elements: ChoanElement[]) {
    sceneUBO.update(gl, elements, cssWidth, cssHeight)
  }

  function render() {
    const ray = getCameraRayParams(camera)

    // SDF pass
    gl.useProgram(program)
    gl.uniform2f(uResolution, canvas.width, canvas.height)
    gl.uniform3f(uBgColor, bgR, bgG, bgB)
    gl.uniform3f(uCamPos, ray.ro[0], ray.ro[1], ray.ro[2])
    gl.uniform3f(uCamForward, ray.forward[0], ray.forward[1], ray.forward[2])
    gl.uniform3f(uCamRight, ray.right[0], ray.right[1], ray.right[2])
    gl.uniform3f(uCamUp, ray.up[0], ray.up[1], ray.up[2])
    gl.uniform1f(uFovScale, ray.fovScale)
    drawFullscreenQuad(gl, quad)

    // Overlay pass — draw on top of SDF scene
    const vp = buildViewProjMatrix(
      camera.position, camera.target, camera.up,
      camera.fov, camera.aspect, camera.near, camera.far,
    )
    overlay.beginFrame(vp)
  }

  function dispose() {
    sceneUBO.dispose(gl)
    overlay.dispose()
    gl.deleteProgram(program)
    container.removeChild(canvas)
  }

  resize(container.clientWidth, container.clientHeight)

  return { canvas, gl, camera, overlay, resize, updateScene, render, dispose }
}

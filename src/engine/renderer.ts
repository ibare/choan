// Core SDF Renderer — manages WebGL2 state and two-pass render loop
// Pass 1: Geometry → FBO (color + normal/ID via MRT)
// Pass 2: Edge detection + composite → Canvas

import { createGL, createProgram, getUniformLocation } from './gl'
import { createFullscreenQuad, drawFullscreenQuad } from './quad'
import { RAYMARCH_VERT, RAYMARCH_FRAG, EDGE_FRAG } from './shaders'
import { createCamera, getCameraRayParams, type Camera } from './camera'
import { createSceneUBO, type SceneUBO } from './scene'
import { createOverlayRenderer, buildViewProjMatrix, type OverlayRenderer } from './overlay'
import { createGBuffer } from './fbo'
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
  const quad = createFullscreenQuad(gl)

  // Camera
  const camera = createCamera()

  // Scene UBO
  const sceneUBO: SceneUBO = createSceneUBO(gl)

  // Overlay renderer
  const overlay = createOverlayRenderer(gl)

  // ── Pass 1: Geometry program (MRT → FBO) ──
  const geoProgram = createProgram(gl, RAYMARCH_VERT, RAYMARCH_FRAG)
  sceneUBO.bind(gl, geoProgram)

  const uResolution = getUniformLocation(gl, geoProgram, 'uResolution')
  const uBgColor = getUniformLocation(gl, geoProgram, 'uBgColor')
  const uCamPos = getUniformLocation(gl, geoProgram, 'uCamPos')
  const uCamForward = getUniformLocation(gl, geoProgram, 'uCamForward')
  const uCamRight = getUniformLocation(gl, geoProgram, 'uCamRight')
  const uCamUp = getUniformLocation(gl, geoProgram, 'uCamUp')
  const uFovScale = getUniformLocation(gl, geoProgram, 'uFovScale')

  // ── Pass 2: Edge detection program (FBO textures → Canvas) ──
  const edgeProgram = createProgram(gl, RAYMARCH_VERT, EDGE_FRAG)

  const uColorTex = getUniformLocation(gl, edgeProgram, 'uColorTex')
  const uNormalIdTex = getUniformLocation(gl, edgeProgram, 'uNormalIdTex')
  const uTexelSize = getUniformLocation(gl, edgeProgram, 'uTexelSize')
  const uOutlineWidth = getUniformLocation(gl, edgeProgram, 'uOutlineWidth')
  const uEdgeColor = getUniformLocation(gl, edgeProgram, 'uEdgeColor')
  const uEdgeBgColor = getUniformLocation(gl, edgeProgram, 'uBgColor')

  // Background color: 0xf7f3ee
  const bgR = 0xf7 / 255
  const bgG = 0xf3 / 255
  const bgB = 0xee / 255

  // 2x supersampling for edge AA
  const SS = 2

  // GBuffer (created at initial size, resized later)
  const gbuffer = createGBuffer(gl, 1, 1)

  // Resolve FBO — edge pass renders here at 2x, then blits down to canvas
  let resolveFB = gl.createFramebuffer()!
  let resolveTex = gl.createTexture()!
  let ssW = 1, ssH = 1

  function resizeResolve(w: number, h: number) {
    gl.deleteTexture(resolveTex)
    resolveTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, resolveTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)

    gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFB)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resolveTex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    ssW = w
    ssH = h
  }

  let cssWidth = 1
  let cssHeight = 1

  function resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    camera.aspect = width / height
    cssWidth = width
    cssHeight = height

    const sw = canvas.width * SS
    const sh = canvas.height * SS
    gbuffer.resize(gl, sw, sh)
    resizeResolve(sw, sh)
  }

  function updateScene(elements: ChoanElement[]) {
    sceneUBO.update(gl, elements, cssWidth, cssHeight)
  }

  function render() {
    const ray = getCameraRayParams(camera)

    // ── Pass 1: Geometry → GBuffer (2x) ──
    gbuffer.bind(gl)
    gl.viewport(0, 0, ssW, ssH)

    gl.useProgram(geoProgram)
    gl.uniform2f(uResolution, ssW, ssH)
    gl.uniform3f(uBgColor, bgR, bgG, bgB)
    gl.uniform3f(uCamPos, ray.ro[0], ray.ro[1], ray.ro[2])
    gl.uniform3f(uCamForward, ray.forward[0], ray.forward[1], ray.forward[2])
    gl.uniform3f(uCamRight, ray.right[0], ray.right[1], ray.right[2])
    gl.uniform3f(uCamUp, ray.up[0], ray.up[1], ray.up[2])
    gl.uniform1f(uFovScale, ray.fovScale)
    drawFullscreenQuad(gl, quad)

    // ── Pass 2: Edge detection → resolve FBO (2x) ──
    gbuffer.unbind(gl)
    gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFB)
    gl.viewport(0, 0, ssW, ssH)

    gl.useProgram(edgeProgram)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, gbuffer.colorTex)
    gl.uniform1i(uColorTex, 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, gbuffer.normalIdTex)
    gl.uniform1i(uNormalIdTex, 1)

    gl.uniform2f(uTexelSize, 1 / ssW, 1 / ssH)
    gl.uniform1f(uOutlineWidth, 1.0)
    gl.uniform3f(uEdgeColor, 0.133, 0.133, 0.133)
    gl.uniform3f(uEdgeBgColor, bgR, bgG, bgB)

    drawFullscreenQuad(gl, quad)

    // ── Downsample: resolve FBO (2x) → canvas (1x) ──
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, resolveFB)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    gl.blitFramebuffer(
      0, 0, ssW, ssH,
      0, 0, canvas.width, canvas.height,
      gl.COLOR_BUFFER_BIT, gl.LINEAR,
    )

    // ── Overlay pass (native resolution) ──
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    const vp = buildViewProjMatrix(
      camera.position, camera.target, camera.up,
      camera.fov, camera.aspect, camera.near, camera.far,
    )
    overlay.beginFrame(vp)
  }

  function dispose() {
    gbuffer.dispose(gl)
    gl.deleteTexture(resolveTex)
    gl.deleteFramebuffer(resolveFB)
    sceneUBO.dispose(gl)
    overlay.dispose()
    gl.deleteProgram(geoProgram)
    gl.deleteProgram(edgeProgram)
    container.removeChild(canvas)
  }

  resize(container.clientWidth, container.clientHeight)

  return { canvas, gl, camera, overlay, resize, updateScene, render, dispose }
}

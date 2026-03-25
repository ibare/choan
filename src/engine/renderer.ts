// Core SDF Renderer — manages WebGL2 state and two-pass render loop
// Pass 1: Geometry → FBO (color + normal/ID via MRT)
// Pass 2: Edge detection + composite → Canvas

import { createGL, createProgram, getUniformLocation } from './gl'
import { createFullscreenQuad, drawFullscreenQuad } from './quad'
import { RAYMARCH_VERT, RAYMARCH_FRAG, EDGE_FRAG } from './shaders'
import { createCamera, getCameraRayParams, type Camera } from './camera'
import { createSceneUBO, type SceneUBO } from './scene'
import { buildBVH2D, type BVHData, type AABB2D } from './bvh'
import { pixelToWorld, pixelWidthToWorld, pixelHeightToWorld } from '../coords/coordinateSystem'
import { createTextureAtlas, type TextureAtlas } from './textureAtlas'
import { createColorWheel, type ColorWheelTexture } from './colorWheel'
import { createOverlayRenderer, type OverlayRenderer } from './overlay'
import { buildViewProjMatrix } from './camera'
import { createGBuffer } from './fbo'
import type { ChoanElement } from '../store/useChoanStore'
import type { RenderSettings } from '../store/useRenderSettings'

export interface SDFRenderer {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  camera: Camera
  overlay: OverlayRenderer
  atlas: TextureAtlas
  colorWheel: ColorWheelTexture
  bvhData: BVHData | null
  resize(width: number, height: number): void
  updateScene(elements: ChoanElement[], extrudeDepth?: number, hoveredColor?: number | null): void
  setSmoothK(k: number): void
  render(settings: RenderSettings): void
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

  // Texture atlas for component faces
  const atlas = createTextureAtlas(gl)
  const colorWheel = createColorWheel(gl)

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

  // Toon shading uniforms
  const uLightDir = getUniformLocation(gl, geoProgram, 'uLightDir')
  const uShadowMul = getUniformLocation(gl, geoProgram, 'uShadowMul')
  const uWarmTone = getUniformLocation(gl, geoProgram, 'uWarmTone')
  const uSideDarken = getUniformLocation(gl, geoProgram, 'uSideDarken')
  const uSideSmooth = getUniformLocation(gl, geoProgram, 'uSideSmooth')
  const uAtlasTex = getUniformLocation(gl, geoProgram, 'uAtlasTex')
  const uSmoothK = getUniformLocation(gl, geoProgram, 'uSmoothK')

  // ── Pass 2: Edge detection program (FBO textures → Canvas) ──
  const edgeProgram = createProgram(gl, RAYMARCH_VERT, EDGE_FRAG)

  const uColorTex = getUniformLocation(gl, edgeProgram, 'uColorTex')
  const uNormalIdTex = getUniformLocation(gl, edgeProgram, 'uNormalIdTex')
  const uTexelSize = getUniformLocation(gl, edgeProgram, 'uTexelSize')
  const uOutlineWidth = getUniformLocation(gl, edgeProgram, 'uOutlineWidth')
  const uEdgeColor = getUniformLocation(gl, edgeProgram, 'uEdgeColor')
  const uEdgeBgColor = getUniformLocation(gl, edgeProgram, 'uBgColor')
  const uNormalEdgeThreshold = getUniformLocation(gl, edgeProgram, 'uNormalEdgeThreshold')
  const uIdEdgeThreshold = getUniformLocation(gl, edgeProgram, 'uIdEdgeThreshold')

  // GBuffer (created at initial size, resized later)
  const gbuffer = createGBuffer(gl, 1, 1)

  // Resolve FBO — edge pass renders here at SS×, then blits down to canvas
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
  // Pending canvas pixel dimensions — applied at the START of render() to avoid
  // clearing the drawing buffer between a render and the next browser paint.
  let pendingCanvasW = 0
  let pendingCanvasH = 0

  function resize(width: number, height: number) {
    if (width < 1 || height < 1) return  // guard against 0×0 during rapid layout changes
    camera.aspect = width / height
    cssWidth = width
    cssHeight = height

    const dpr = window.devicePixelRatio || 1
    const cw = Math.round(width * dpr)
    const ch = Math.round(height * dpr)
    pendingCanvasW = cw
    pendingCanvasH = ch

    // HiDPI (DPR≥2): DPR already provides sub-pixel sharpness — skip 2× SS
    const ss = dpr >= 2 ? 1 : 2
    const sw = cw * ss
    const sh = ch * ss
    gbuffer.resize(gl, sw, sh)
    resizeResolve(sw, sh)
  }

  // BVH data exposed for CPU hit testing
  let currentBVH: BVHData | null = null
  let currentSmoothK = 0

  function updateScene(elements: ChoanElement[], extrudeDepth?: number, hoveredColor?: number | null) {
    // Separate regular and skinOnly elements, preserving original indices
    const regularWithIdx: { el: ChoanElement; origIdx: number }[] = []
    const skinOnlyElements: ChoanElement[] = []
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].skinOnly || elements[i].frameless) skinOnlyElements.push(elements[i])
      else regularWithIdx.push({ el: elements[i], origIdx: i })
    }

    // Compute 2D AABBs in world space for regular elements
    const aabbs: AABB2D[] = regularWithIdx.map(({ el }) => {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const [wx, wy] = pixelToWorld(cx, cy, cssWidth, cssHeight)
      const hw = pixelWidthToWorld(el.width, cssWidth, cssHeight) / 2
      const hh = pixelHeightToWorld(el.height, cssHeight) / 2
      return { cx: wx, cy: wy, hw, hh }
    })

    // Build BVH
    const rawBvh = buildBVH2D(aabbs)

    // Convert objectOrder from regular-array indices to original elements indices
    const origObjectOrder = rawBvh.objectOrder.map(
      idx => idx >= 0 && idx < regularWithIdx.length ? regularWithIdx[idx].origIdx : -1,
    )

    // Store BVH data with original indices for CPU hit testing
    currentBVH = {
      nodes: rawBvh.nodes,
      objectOrder: origObjectOrder,
      numInternalNodes: rawBvh.numInternalNodes,
      numLeaves: rawBvh.numLeaves,
    }

    // Reorder elements: [regular in BVH leaf order] + [skinOnly]
    const reordered: ChoanElement[] = []
    for (const origIdx of origObjectOrder) {
      if (origIdx >= 0) reordered.push(elements[origIdx])
    }
    const numRegular = reordered.length
    for (const el of skinOnlyElements) reordered.push(el)

    // Build texRects for reordered elements
    const texRects = new Map<string, [number, number, number, number]>()
    for (const el of reordered) {
      const rect = atlas.getTexRect(el.id)
      if (rect) texRects.set(el.id, rect)
    }

    sceneUBO.update(
      gl, reordered, cssWidth, cssHeight, extrudeDepth, texRects, numRegular, hoveredColor,
    )
  }

  function render(s: RenderSettings) {
    // Apply any pending canvas resize here — BEFORE drawing — so that setting
    // canvas.width (which clears the drawing buffer) is immediately followed by
    // a full render.  Doing this in ResizeObserver would clear the buffer after
    // the previous frame was rendered but before the browser paints, causing a
    // visible black flash on every resize event.
    if (pendingCanvasW > 0 && pendingCanvasH > 0) {
      if (canvas.width !== pendingCanvasW || canvas.height !== pendingCanvasH) {
        canvas.width = pendingCanvasW
        canvas.height = pendingCanvasH
      }
      pendingCanvasW = 0
      pendingCanvasH = 0
    }

    const ray = getCameraRayParams(camera)

    // ── Pass 1: Geometry → GBuffer (2x) ──
    gl.disable(gl.BLEND)
    gbuffer.bind(gl)
    gl.viewport(0, 0, ssW, ssH)

    gl.useProgram(geoProgram)
    gl.uniform2f(uResolution, ssW, ssH)
    gl.uniform3f(uBgColor, s.bgColor[0], s.bgColor[1], s.bgColor[2])
    gl.uniform3f(uCamPos, ray.ro[0], ray.ro[1], ray.ro[2])
    gl.uniform3f(uCamForward, ray.forward[0], ray.forward[1], ray.forward[2])
    gl.uniform3f(uCamRight, ray.right[0], ray.right[1], ray.right[2])
    gl.uniform3f(uCamUp, ray.up[0], ray.up[1], ray.up[2])
    gl.uniform1f(uFovScale, ray.fovScale)

    // Toon shading
    gl.uniform3f(uLightDir, s.lightDir[0], s.lightDir[1], s.lightDir[2])
    gl.uniform1f(uShadowMul, s.shadowMul)
    gl.uniform3f(uWarmTone, s.warmTone[0], s.warmTone[1], s.warmTone[2])
    gl.uniform1f(uSideDarken, s.sideDarken)
    gl.uniform2f(uSideSmooth, s.sideSmooth[0], s.sideSmooth[1])

    // Smooth union (export animation)
    gl.uniform1f(uSmoothK, currentSmoothK)

    // Atlas texture
    atlas.upload(gl)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, atlas.texture)
    gl.uniform1i(uAtlasTex, 0)

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
    gl.uniform1f(uOutlineWidth, s.outlineWidth)
    gl.uniform3f(uEdgeColor, s.edgeColor[0], s.edgeColor[1], s.edgeColor[2])
    gl.uniform3f(uEdgeBgColor, s.bgColor[0], s.bgColor[1], s.bgColor[2])
    gl.uniform2f(uNormalEdgeThreshold, s.normalEdgeThreshold[0], s.normalEdgeThreshold[1])
    gl.uniform2f(uIdEdgeThreshold, s.idEdgeThreshold[0], s.idEdgeThreshold[1])

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
    atlas.dispose(gl)
    colorWheel.dispose(gl)
    overlay.dispose()
    gl.deleteProgram(geoProgram)
    gl.deleteProgram(edgeProgram)
    container.removeChild(canvas)
  }

  resize(container.clientWidth, container.clientHeight)

  return {
    canvas, gl, camera, overlay, atlas, colorWheel,
    get bvhData() { return currentBVH },
    resize, updateScene, setSmoothK(k: number) { currentSmoothK = k }, render, dispose,
  }
}

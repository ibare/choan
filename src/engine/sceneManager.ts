// SceneManager — orchestrates scene transitions using a single WebGL2 context.
// Captures a snapshot of the outgoing scene, then composites it with the live
// incoming scene using a transition shader (fade).
//
// Does NOT import React or Zustand (engine layer).

import { createProgram, getUniformLocation } from './gl'
import { drawFullscreenQuad } from './quad'
import { createSimpleFBO, type SimpleFBO } from './fbo'
import { RAYMARCH_VERT, TRANSITION_FRAG } from './shaders'

export interface SceneManager {
  /** Copy the current resolveTex into the snapshot texture. Call before switching scene data. */
  captureSnapshot(resolveFB: WebGLFramebuffer, w: number, h: number): void
  /** Render the transition composite (snapshot + live resolveTex) to the default framebuffer. */
  renderTransition(
    resolveTex: WebGLTexture,
    progress: number,
    canvasW: number,
    canvasH: number,
  ): void
  /** Get the snapshot texture (for debugging or external use). */
  getSnapshotTex(): WebGLTexture | null
  /** Release GPU resources. */
  dispose(): void
}

export function createSceneManager(
  gl: WebGL2RenderingContext,
  quad: WebGLVertexArrayObject,
): SceneManager {
  // Transition shader program
  const program = createProgram(gl, RAYMARCH_VERT, TRANSITION_FRAG)
  const uFromTex = getUniformLocation(gl, program, 'uFromTex')
  const uToTex = getUniformLocation(gl, program, 'uToTex')
  const uProgress = getUniformLocation(gl, program, 'uProgress')

  // Snapshot FBO — stores the "from" scene frame
  let snapshotFBO: SimpleFBO | null = null

  function captureSnapshot(resolveFB: WebGLFramebuffer, w: number, h: number) {
    // Create or resize snapshot FBO to match resolve dimensions
    if (!snapshotFBO) {
      snapshotFBO = createSimpleFBO(gl, w, h)
    } else if (snapshotFBO.width !== w || snapshotFBO.height !== h) {
      snapshotFBO.resize(gl, w, h)
    }

    // Blit resolveFB → snapshotFBO
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, resolveFB)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, snapshotFBO.framebuffer)
    gl.blitFramebuffer(
      0, 0, w, h,
      0, 0, w, h,
      gl.COLOR_BUFFER_BIT, gl.NEAREST,
    )
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
  }

  function renderTransition(
    resolveTex: WebGLTexture,
    progress: number,
    canvasW: number,
    canvasH: number,
  ) {
    if (!snapshotFBO) return

    // Render to default framebuffer (canvas)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvasW, canvasH)
    gl.disable(gl.BLEND)

    gl.useProgram(program)

    // Bind snapshot (from scene) to texture unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, snapshotFBO.texture)
    gl.uniform1i(uFromTex, 0)

    // Bind live resolve (to scene) to texture unit 1
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, resolveTex)
    gl.uniform1i(uToTex, 1)

    gl.uniform1f(uProgress, progress)

    drawFullscreenQuad(gl, quad)
  }

  function dispose() {
    snapshotFBO?.dispose(gl)
    snapshotFBO = null
    gl.deleteProgram(program)
  }

  return {
    captureSnapshot,
    renderTransition,
    getSnapshotTex: () => snapshotFBO?.texture ?? null,
    dispose,
  }
}

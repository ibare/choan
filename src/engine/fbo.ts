// GBuffer — FBO with MRT for screen-space edge detection
// RT0: RGBA8 (toon color + opacity)
// RT1: RGBA16F (world normal + objectID)

export interface GBuffer {
  framebuffer: WebGLFramebuffer
  colorTex: WebGLTexture
  normalIdTex: WebGLTexture
  width: number
  height: number
  resize(gl: WebGL2RenderingContext, w: number, h: number): void
  bind(gl: WebGL2RenderingContext): void
  unbind(gl: WebGL2RenderingContext): void
  dispose(gl: WebGL2RenderingContext): void
}

// Pre-allocated clear value for RT1 sentinel (normal=0, objectId=-1)
const RT1_CLEAR = new Float32Array([0, 0, 0, -1])

function createTexture(
  gl: WebGL2RenderingContext,
  w: number, h: number,
  internalFormat: number,
  format: number,
  type: number,
): WebGLTexture {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return tex
}

export function createGBuffer(gl: WebGL2RenderingContext, w: number, h: number): GBuffer {
  // Enable float rendering
  const ext = gl.getExtension('EXT_color_buffer_float')
  if (!ext) console.warn('EXT_color_buffer_float not available')

  const framebuffer = gl.createFramebuffer()!
  let colorTex = createTexture(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE)
  let normalIdTex = createTexture(gl, w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT)

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, normalIdTex, 0)
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`GBuffer framebuffer incomplete: 0x${status.toString(16)}`)
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  let curW = w, curH = h

  function resize(gl: WebGL2RenderingContext, nw: number, nh: number) {
    if (nw === curW && nh === curH) return
    gl.deleteTexture(colorTex)
    gl.deleteTexture(normalIdTex)

    colorTex = createTexture(gl, nw, nh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE)
    normalIdTex = createTexture(gl, nw, nh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT)

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, normalIdTex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    curW = nw
    curH = nh
  }

  function bind(gl: WebGL2RenderingContext) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.clearBufferfv(gl.COLOR, 0, new Float32Array([0, 0, 0, 0]))
    gl.clearBufferfv(gl.COLOR, 1, RT1_CLEAR)
  }

  function unbind(gl: WebGL2RenderingContext) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  function dispose(gl: WebGL2RenderingContext) {
    gl.deleteTexture(colorTex)
    gl.deleteTexture(normalIdTex)
    gl.deleteFramebuffer(framebuffer)
  }

  return {
    get framebuffer() { return framebuffer },
    get colorTex() { return colorTex },
    get normalIdTex() { return normalIdTex },
    get width() { return curW },
    get height() { return curH },
    resize, bind, unbind, dispose,
  }
}

// ── Simple FBO — single RGBA8 texture, for scene transition snapshots ──

export interface SimpleFBO {
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture
  width: number
  height: number
  resize(gl: WebGL2RenderingContext, w: number, h: number): void
  dispose(gl: WebGL2RenderingContext): void
}

export function createSimpleFBO(gl: WebGL2RenderingContext, w: number, h: number): SimpleFBO {
  const framebuffer = gl.createFramebuffer()!
  let texture = createTexture(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE)

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`SimpleFBO framebuffer incomplete: 0x${status.toString(16)}`)
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  let curW = w, curH = h

  function resize(gl: WebGL2RenderingContext, nw: number, nh: number) {
    if (nw === curW && nh === curH) return
    gl.deleteTexture(texture)
    texture = createTexture(gl, nw, nh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE)

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    curW = nw
    curH = nh
  }

  function dispose(gl: WebGL2RenderingContext) {
    gl.deleteTexture(texture)
    gl.deleteFramebuffer(framebuffer)
  }

  return {
    get framebuffer() { return framebuffer },
    get texture() { return texture },
    get width() { return curW },
    get height() { return curH },
    resize, dispose,
  }
}

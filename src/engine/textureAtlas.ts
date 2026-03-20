// Texture Atlas — shelf-based bin packing on a single 2048×2048 OffscreenCanvas.
// Each UI component is painted into a region, then the entire canvas is uploaded
// as a single WebGL texture. Per-object UV rects are passed to the shader via UBO.

const ATLAS_SIZE = 4096
const PAD = 1 // 1px padding to avoid UV seam bleeding

export interface AtlasRegion {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface Shelf {
  y: number
  height: number
  cursorX: number
}

export interface TextureAtlas {
  texture: WebGLTexture
  allocate(id: string, w: number, h: number): AtlasRegion | null
  reset(): void
  free(id: string): void
  alias(newId: string, existingId: string): void
  getRegion(id: string): AtlasRegion | undefined
  getTexRect(id: string): [number, number, number, number] | null
  getContext(region: AtlasRegion): OffscreenCanvasRenderingContext2D
  upload(gl: WebGL2RenderingContext): void
  needsUpload: boolean
  dispose(gl: WebGL2RenderingContext): void
}

export function createTextureAtlas(gl: WebGL2RenderingContext): TextureAtlas {
  const canvas = new OffscreenCanvas(ATLAS_SIZE, ATLAS_SIZE)
  const ctx = canvas.getContext('2d')!

  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ATLAS_SIZE, ATLAS_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)

  const shelves: Shelf[] = []
  const regions = new Map<string, AtlasRegion>()
  let needsUpload = false

  function allocate(id: string, w: number, h: number): AtlasRegion | null {
    // If already allocated, free first
    if (regions.has(id)) free(id)

    const pw = w + PAD * 2
    const ph = h + PAD * 2

    // Try to fit in existing shelf
    for (const shelf of shelves) {
      if (shelf.cursorX + pw <= ATLAS_SIZE && shelf.height >= ph) {
        const region: AtlasRegion = { id, x: shelf.cursorX + PAD, y: shelf.y + PAD, w, h }
        shelf.cursorX += pw
        regions.set(id, region)
        return region
      }
    }

    // Create new shelf
    const shelfY = shelves.length === 0 ? 0 : shelves[shelves.length - 1].y + shelves[shelves.length - 1].height
    if (shelfY + ph > ATLAS_SIZE) return null // atlas full

    const newShelf: Shelf = { y: shelfY, height: ph, cursorX: pw }
    shelves.push(newShelf)
    const region: AtlasRegion = { id, x: PAD, y: shelfY + PAD, w, h }
    regions.set(id, region)
    return region
  }

  function free(id: string): void {
    regions.delete(id)
  }

  /** Point newId to the same atlas region as existingId (shared texture). */
  function alias(newId: string, existingId: string): void {
    const region = regions.get(existingId)
    if (region) regions.set(newId, { ...region, id: newId })
  }

  /** Clear all shelves and regions — call before rebuilding. */
  function reset(): void {
    shelves.length = 0
    regions.clear()
    ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
    needsUpload = true
  }

  function getRegion(id: string): AtlasRegion | undefined {
    return regions.get(id)
  }

  function getTexRect(id: string): [number, number, number, number] | null {
    const r = regions.get(id)
    if (!r) return null
    return [r.x / ATLAS_SIZE, r.y / ATLAS_SIZE, r.w / ATLAS_SIZE, r.h / ATLAS_SIZE]
  }

  function getContext(region: AtlasRegion): OffscreenCanvasRenderingContext2D {
    ctx.save()
    ctx.beginPath()
    ctx.rect(region.x, region.y, region.w, region.h)
    ctx.clip()
    ctx.clearRect(region.x, region.y, region.w, region.h)
    ctx.translate(region.x, region.y)
    needsUpload = true
    return ctx
  }

  function upload(gl: WebGL2RenderingContext): void {
    if (!needsUpload) return
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
    gl.bindTexture(gl.TEXTURE_2D, null)
    needsUpload = false
  }

  function dispose(gl: WebGL2RenderingContext): void {
    gl.deleteTexture(texture)
  }

  return {
    texture,
    allocate,
    alias,
    reset,
    free,
    getRegion,
    getTexRect,
    getContext,
    upload,
    get needsUpload() { return needsUpload },
    dispose,
  }
}

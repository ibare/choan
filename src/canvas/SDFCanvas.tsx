import { useEffect, useRef, useCallback, useState } from 'react'
import { createSDFRenderer, type SDFRenderer } from '../engine/renderer'
import { createOrbitControls, type OrbitControls } from '../engine/controls'
import { getCameraRayParams } from '../engine/camera'
import { cpuRayMarch, screenToRay } from '../engine/sdf'
import { FRUSTUM, EXTRUDE_DEPTH } from '../engine/scene'
import { useChoanStore } from '../store/useChoanStore'
import type { ChoanElement, Tool } from '../store/useChoanStore'
import { THEME_COLORS } from './materials'
import { nanoid } from './nanoid'
import {
  computeSnapMove, computeSnapResize, computeDistances,
  type SnapLine, type DistanceMeasure,
} from './snapUtils'

const HANDLE_HIT_RADIUS = 16
const MIN_ELEMENT_SIZE = 10

const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  rectangle: { w: 120, h: 90 },
  circle: { w: 100, h: 100 },
  line: { w: 160, h: 6 },
}

export default function SDFCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SDFRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const frameRef = useRef<number>(0)
  const canvasSizeRef = useRef({ w: 1, h: 1 })
  const copiedRef = useRef<ChoanElement | null>(null)
  const snapLinesRef = useRef<SnapLine[]>([])
  const distMeasuresRef = useRef<(DistanceMeasure | null)[]>([])

  const [distanceLabels, setDistanceLabels] = useState<Array<{ x: number; y: number; text: string }>>([])
  const [altPressed, setAltPressed] = useState(false)

  const {
    elements,
    selectedId,
    tool,
    drawColor,
    setTool,
    setDrawColor,
    addElement,
    updateElement,
    selectElement,
    removeElement,
  } = useChoanStore()

  // Drag state
  const isDraggingRef = useRef(false)
  const dragStartPixelRef = useRef({ x: 0, y: 0 })
  const dragElStartRef = useRef({ x: 0, y: 0 })

  // Resize state
  const isResizingRef = useRef(false)
  const resizeStartPixelRef = useRef({ x: 0, y: 0 })
  const resizeCornerStartRef = useRef({ x: 0, y: 0 })
  const resizeAnchorRef = useRef({ x: 0, y: 0 })

  // Radius drag state
  const isRadiusDragRef = useRef(false)
  const radiusStartRef = useRef(0)
  const radiusDragStartPixelRef = useRef({ x: 0, y: 0 })

  // Cursor
  const [cursor, setCursor] = useState('default')

  // ── Coordinate helpers ──

  const screenToPixel = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const renderer = rendererRef.current
    if (!renderer) return null
    const ray = getCameraRayParams(renderer.camera)
    const rect = renderer.canvas.getBoundingClientRect()
    const { ro, rd } = screenToRay(clientX, clientY, rect, ray.ro, ray.forward, ray.right, ray.up, ray.fovScale, canvasSizeRef.current.w, canvasSizeRef.current.h)
    // Intersect z=0 plane
    if (Math.abs(rd[2]) < 1e-6) return null
    const t = -ro[2] / rd[2]
    if (t < 0) return null
    const wx = ro[0] + rd[0] * t
    const wy = ro[1] + rd[1] * t
    return worldToPixel(wx, wy)
  }, [])

  const worldToPixel = useCallback((wx: number, wy: number): { x: number; y: number } => {
    const { w, h } = canvasSizeRef.current
    const aspect = w / h
    const px = ((wx + FRUSTUM * aspect) / (2 * FRUSTUM * aspect)) * w
    const py = ((FRUSTUM - wy) / (2 * FRUSTUM)) * h
    return { x: px, y: py }
  }, [])

  const pixelToWorld = useCallback((px: number, py: number): { wx: number; wy: number } => {
    const { w, h } = canvasSizeRef.current
    const aspect = w / h
    return {
      wx: -FRUSTUM * aspect + (px / w) * 2 * FRUSTUM * aspect,
      wy: FRUSTUM - (py / h) * 2 * FRUSTUM,
    }
  }, [])

  const worldToScreen = useCallback((wx: number, wy: number): { x: number; y: number } | null => {
    // Simplified: assume front view (camera at z=20 looking at z=0)
    // For orbit camera, this is approximate but sufficient for labels
    return worldToPixel(wx, wy)
  }, [worldToPixel])

  // ── Picking ──

  const raycastElement = useCallback((clientX: number, clientY: number): string | null => {
    const renderer = rendererRef.current
    if (!renderer) return null
    const ray = getCameraRayParams(renderer.camera)
    const rect = renderer.canvas.getBoundingClientRect()
    const { w, h } = canvasSizeRef.current
    const { ro, rd } = screenToRay(clientX, clientY, rect, ray.ro, ray.forward, ray.right, ray.up, ray.fovScale, w, h)
    const { elements } = useChoanStore.getState()
    const hit = cpuRayMarch(ro[0], ro[1], ro[2], rd[0], rd[1], rd[2], elements, w, h)
    if (!hit || hit.objectIndex < 0 || hit.objectIndex >= elements.length) return null
    return elements[hit.objectIndex].id
  }, [])

  // ── Place shape ──

  const placeShape = useCallback(
    (shapeType: 'rectangle' | 'circle' | 'line', clientX: number, clientY: number) => {
      const pixel = screenToPixel(clientX, clientY)
      if (!pixel) return
      const size = DEFAULT_SIZE[shapeType]
      const id = nanoid()
      const el: ChoanElement = {
        id,
        type: shapeType,
        label: shapeType === 'rectangle' ? 'Box' : shapeType === 'circle' ? 'Circle' : 'Line',
        role: shapeType === 'rectangle' ? 'container' : undefined,
        color: drawColor,
        x: pixel.x - size.w / 2,
        y: pixel.y - size.h / 2,
        z: 0,
        width: size.w,
        height: size.h,
        opacity: 1,
      }
      addElement(el)
      selectElement(id)
      setTool('select')
    },
    [drawColor, addElement, selectElement, setTool, screenToPixel],
  )

  // ── Corner handle hit test ──

  const hitTestCorner = useCallback(
    (clientX: number, clientY: number): number => {
      if (!selectedId) return -1
      const el = elements.find((e) => e.id === selectedId)
      if (!el) return -1
      const pixel = screenToPixel(clientX, clientY)
      if (!pixel) return -1
      const corners = [
        { x: el.x, y: el.y + el.height },
        { x: el.x + el.width, y: el.y + el.height },
        { x: el.x + el.width, y: el.y },
        { x: el.x, y: el.y },
      ]
      for (let i = 0; i < corners.length; i++) {
        const dx = pixel.x - corners[i].x
        const dy = pixel.y - corners[i].y
        if (dx * dx + dy * dy <= HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS) return i
      }
      return -1
    },
    [selectedId, elements, screenToPixel],
  )

  // ── Pointer events ──

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return

      if (tool === 'select') {
        // 1. Handle check — multi-function anchors
        if (selectedId) {
          const corner = hitTestCorner(e.clientX, e.clientY)
          if (corner >= 0) {
            const el = elements.find((e) => e.id === selectedId)!

            if (corner === 3 && el.type === 'rectangle') {
              // TL handle → radius drag
              isRadiusDragRef.current = true
              radiusStartRef.current = el.radius ?? 0
              const pixel = screenToPixel(e.clientX, e.clientY)
              if (pixel) radiusDragStartPixelRef.current = pixel
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              return
            }

            if (corner === 1) {
              // BR handle → resize (anchor at TL)
              const cornerPositions = [
                { x: el.x, y: el.y + el.height },
                { x: el.x + el.width, y: el.y + el.height },
                { x: el.x + el.width, y: el.y },
                { x: el.x, y: el.y },
              ]
              isResizingRef.current = true
              const pixel = screenToPixel(e.clientX, e.clientY)
              if (pixel) resizeStartPixelRef.current = pixel
              resizeCornerStartRef.current = cornerPositions[corner]
              resizeAnchorRef.current = cornerPositions[(corner + 2) % 4]
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              return
            }
            // corners 0, 2 — reserved, no action
          }
        }

        // 2. Element select / drag
        const hitId = raycastElement(e.clientX, e.clientY)
        if (hitId && hitId === selectedId) {
          isDraggingRef.current = true
          const pixel = screenToPixel(e.clientX, e.clientY)
          if (pixel) dragStartPixelRef.current = pixel
          const el = elements.find((el) => el.id === selectedId)
          if (el) dragElStartRef.current = { x: el.x, y: el.y }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        } else {
          selectElement(hitId)
        }
        return
      }
      placeShape(tool, e.clientX, e.clientY)
    },
    [tool, raycastElement, selectElement, selectedId, elements, placeShape, hitTestCorner, screenToPixel],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const { elements: els, selectedId: selId } = useChoanStore.getState()

      // Radius drag
      if (isRadiusDragRef.current && selId) {
        const pixel = screenToPixel(e.clientX, e.clientY)
        if (!pixel) return
        const el = els.find((e) => e.id === selId)
        if (!el) return
        const dx = pixel.x - radiusDragStartPixelRef.current.x
        const dy = pixel.y - radiusDragStartPixelRef.current.y
        // TL→center = +dx, +dy; map diagonal distance to radius delta
        const delta = (dx + dy) / Math.min(el.width, el.height)
        const newRadius = Math.max(0, Math.min(1, radiusStartRef.current + delta))
        updateElement(selId, { radius: newRadius })
        return
      }

      // Resize
      if (isResizingRef.current && selId) {
        const pixel = screenToPixel(e.clientX, e.clientY)
        if (!pixel) return
        const dx = pixel.x - resizeStartPixelRef.current.x
        const dy = pixel.y - resizeStartPixelRef.current.y
        const anchor = resizeAnchorRef.current
        const proposed = {
          x: resizeCornerStartRef.current.x + dx,
          y: resizeCornerStartRef.current.y + dy,
        }
        const others = els.filter((e) => e.id !== selId)
        const snap = computeSnapResize(anchor, proposed, others)
        snapLinesRef.current = snap.lines
        updateElement(selId, {
          x: Math.min(anchor.x, snap.x),
          y: Math.min(anchor.y, snap.y),
          width: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.x - snap.x)),
          height: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.y - snap.y)),
        })
        return
      }

      // Drag
      if (isDraggingRef.current && tool === 'select' && selId) {
        const pixel = screenToPixel(e.clientX, e.clientY)
        if (!pixel) return
        const dx = pixel.x - dragStartPixelRef.current.x
        const dy = pixel.y - dragStartPixelRef.current.y
        const el = els.find((e) => e.id === selId)
        if (!el) return
        const proposed = {
          x: dragElStartRef.current.x + dx,
          y: dragElStartRef.current.y + dy,
          width: el.width,
          height: el.height,
        }
        const others = els.filter((e) => e.id !== selId)
        const snap = computeSnapMove(proposed, others)
        snapLinesRef.current = snap.lines
        updateElement(selId, {
          x: proposed.x + snap.dx,
          y: proposed.y + snap.dy,
        })
        return
      }

      // Hover cursor — only when idle
      if (tool === 'select' && selId) {
        const corner = hitTestCorner(e.clientX, e.clientY)
        if (corner === 3) {
          const el = els.find((e) => e.id === selId)
          setCursor(el?.type === 'rectangle' ? 'grab' : 'default')
        } else if (corner === 1) {
          setCursor('nwse-resize')
        } else {
          setCursor('default')
        }
      }
    },
    [tool, selectedId, updateElement, screenToPixel, hitTestCorner],
  )

  const handlePointerUp = useCallback(() => {
    isResizingRef.current = false
    isDraggingRef.current = false
    isRadiusDragRef.current = false
    snapLinesRef.current = []
  }, [])

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedId } = useChoanStore.getState()
        if (selectedId) removeElement(selectedId)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const { selectedId, elements } = useChoanStore.getState()
        if (selectedId) copiedRef.current = elements.find((el) => el.id === selectedId) ?? null
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const src = copiedRef.current
        if (src) {
          const id = nanoid()
          const { addElement, selectElement } = useChoanStore.getState()
          addElement({ ...src, id, x: src.x + 20, y: src.y + 20 })
          selectElement(id)
        }
      } else if (e.key === 'v' || e.key === 'V') {
        setTool('select')
      } else if (e.key === 'r' || e.key === 'R') {
        setTool('rectangle')
      } else if (e.key === 'c' || e.key === 'C') {
        setTool('circle')
      } else if (e.key === 'l' || e.key === 'L') {
        setTool('line')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeElement, setTool])

  // Alt key distance visualization
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Alt') { e.preventDefault(); setAltPressed(true) } }
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltPressed(false) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  useEffect(() => {
    if (!altPressed || !selectedId) {
      setDistanceLabels([])
      distMeasuresRef.current = []
      return
    }
    const el = elements.find((e) => e.id === selectedId)
    if (!el) return
    const others = elements.filter((e) => e.id !== selectedId)
    const { left, right, top, bottom } = computeDistances(el, others)
    const measures = [left, right, top, bottom]
    distMeasuresRef.current = measures
    const labels: Array<{ x: number; y: number; text: string }> = []
    for (const m of measures) {
      if (!m) continue
      const { wx, wy } = pixelToWorld(m.midX, m.midY)
      const screen = worldToScreen(wx, wy)
      if (screen) labels.push({ x: screen.x, y: screen.y, text: `${Math.round(m.distance)}` })
    }
    setDistanceLabels(labels)
  }, [altPressed, selectedId, elements, pixelToWorld, worldToScreen])

  // ── Initialize renderer ──

  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current

    const renderer = createSDFRenderer(mount)
    rendererRef.current = renderer
    canvasSizeRef.current = { w: mount.clientWidth, h: mount.clientHeight }

    const controls = createOrbitControls(renderer.canvas, renderer.camera)
    controlsRef.current = controls

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render()

      // ── Overlay pass ──
      const state = useChoanStore.getState()
      const { w, h } = canvasSizeRef.current
      const aspect = w / h
      const ov = renderer.overlay

      const p2w = (px: number, py: number): [number, number] => [
        -FRUSTUM * aspect + (px / w) * 2 * FRUSTUM * aspect,
        FRUSTUM - (py / h) * 2 * FRUSTUM,
      ]

      // Selection anchors on object front face
      if (state.selectedId) {
        const el = state.elements.find(e => e.id === state.selectedId)
        if (el) {
          const frontZ = el.z * EXTRUDE_DEPTH + EXTRUDE_DEPTH / 2
          ov.setZ(frontZ)

          const tl = p2w(el.x, el.y)
          const tr = p2w(el.x + el.width, el.y)
          const br = p2w(el.x + el.width, el.y + el.height)
          const bl = p2w(el.x, el.y + el.height)

          // Dashed edge lines connecting anchors
          ov.drawDashedLoop(
            new Float32Array([...tl, ...tr, ...br, ...bl]),
            [0.26, 0.52, 0.96, 1],
          )

          // Corner handles: blue outline + white fill
          const hWorld = 8 * (2 * FRUSTUM) / h
          const handles = new Float32Array([...tl, ...tr, ...br, ...bl])
          ov.drawQuads(handles, hWorld, [0.26, 0.52, 0.96, 1])
          ov.drawQuads(handles, hWorld * 0.6, [1, 1, 1, 1])

          ov.setZ(0)
        }
      }

      // Snap guide lines (cyan)
      const snaps = snapLinesRef.current
      if (snaps.length > 0) {
        const verts: number[] = []
        for (const s of snaps) {
          verts.push(...p2w(s.x1, s.y1), ...p2w(s.x2, s.y2))
        }
        ov.drawLines(new Float32Array(verts), [0.0, 0.82, 0.82, 1])
      }

      // Distance measurement lines + tick marks (orange)
      const measures = distMeasuresRef.current
      const dVerts: number[] = []
      for (const m of measures) {
        if (!m) continue
        const a = p2w(m.x1, m.y1)
        const b = p2w(m.x2, m.y2)
        dVerts.push(...a, ...b)
        const tick = 4 * (2 * FRUSTUM) / h
        const isHoriz = Math.abs(m.y1 - m.y2) < 1
        if (isHoriz) {
          dVerts.push(a[0], a[1] - tick, a[0], a[1] + tick)
          dVerts.push(b[0], b[1] - tick, b[0], b[1] + tick)
        } else {
          const tickX = 4 * (2 * FRUSTUM * aspect) / w
          dVerts.push(a[0] - tickX, a[1], a[0] + tickX, a[1])
          dVerts.push(b[0] - tickX, b[1], b[0] + tickX, b[1])
        }
      }
      if (dVerts.length > 0) {
        ov.drawLines(new Float32Array(dVerts), [0.97, 0.45, 0.09, 1])
      }
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      canvasSizeRef.current = { w, h }
      renderer.resize(w, h)
      const { elements } = useChoanStore.getState()
      renderer.updateScene(elements)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      rendererRef.current = null
      controlsRef.current = null
    }
  }, [])

  // Sync elements → GPU
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateScene(elements)
    }
  }, [elements])

  const effectiveCursor = tool !== 'select' ? 'crosshair' : cursor

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', cursor: effectiveCursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Canvas floating toolbar */}
      <div className="canvas-toolbar">
        <button className={`canvas-tool ${tool === 'select' ? 'active' : ''}`} onClick={() => setTool('select')} title="Select (V)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 1L3 13L6.5 9.5L10 14L12 13L8.5 8.5L13 8L3 1Z" fill="currentColor"/></svg>
        </button>
        <button className={`canvas-tool ${tool === 'rectangle' ? 'active' : ''}`} onClick={() => setTool('rectangle')} title="Rectangle (R)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
        <button className={`canvas-tool ${tool === 'circle' ? 'active' : ''}`} onClick={() => setTool('circle')} title="Circle (C)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
        <button className={`canvas-tool ${tool === 'line' ? 'active' : ''}`} onClick={() => setTool('line')} title="Line (L)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      {/* Distance labels (Alt key) */}
      {distanceLabels.map((label, i) => (
        <div key={i} style={{
          position: 'absolute', left: label.x, top: label.y,
          transform: 'translate(-50%, -50%)',
          background: 'rgba(249,115,22,0.92)', color: '#fff',
          padding: '2px 6px', borderRadius: 4, fontSize: 11,
          fontWeight: 700, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {label.text}
        </div>
      ))}
      {/* Color picker toolbar */}
      <div className="canvas-toolbar color-picker-toolbar">
        {THEME_COLORS.map(({ name, hex }) => (
          <button
            key={hex}
            className={`color-swatch ${drawColor === hex ? 'active' : ''}`}
            style={{ background: `#${hex.toString(16).padStart(6, '0')}` }}
            onClick={() => setDrawColor(hex)}
            title={name}
          />
        ))}
      </div>
    </div>
  )
}

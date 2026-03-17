import { useEffect, useRef, useCallback, useState } from 'react'
import { createSDFRenderer, type SDFRenderer } from '../engine/renderer'
import { createOrbitControls } from '../engine/controls'
import { FRUSTUM } from '../engine/scene'
import { pixelToWorld as pixelToWorldCS, worldToPixel as worldToPixelCS } from '../coords/coordinateSystem'
import { useChoanStore } from '../store/useChoanStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { THEME_COLORS, COLOR_FAMILIES } from './materials'
import { computeDistances, type DistanceMeasure } from './snapUtils'
import { createLayoutAnimator } from '../layout/animator'
import { createKeyframeAnimator } from '../animation/keyframeEngine'
import { usePreviewStore } from '../store/usePreviewStore'
import { evaluateAnimation } from '../animation/animationEvaluator'
import { addGhostElements } from '../rendering/ghostPreview'
import { applyMultiSelectTint } from '../rendering/multiSelectTint'
import RenderSettingsPanel from '../panels/RenderSettingsPanel'
import { Cursor, Rectangle, Circle, LineSegment } from '@phosphor-icons/react'
import {
  SELECTION_COLOR, SNAP_COLOR, DISTANCE_COLOR,
  COLOR_PICKER_RING_BASE, COLOR_PICKER_RING_STEP, COLOR_PICKER_DISC_RADIUS,
  HANDLE_SIZE_PX, DISTANCE_TICK_PX,
} from '../constants'
import { usePointerHandlers } from '../interaction/usePointerHandlers'
import { useKeyboardHandlers } from '../interaction/useKeyboardHandlers'

export default function SDFCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SDFRenderer | null>(null)
  const frameRef = useRef<number>(0)
  const canvasSizeRef = useRef({ w: 1, h: 1 })
  const zoomScaleRef = useRef(1)
  const distMeasuresRef = useRef<(DistanceMeasure | null)[]>([])

  const { elements, selectedIds, tool, drawColor, setTool, setDrawColor } = useChoanStore()
  const [distanceLabels, setDistanceLabels] = useState<Array<{ x: number; y: number; text: string }>>([])
  const [altPressed, setAltPressed] = useState(false)

  const {
    onPointerDown, onPointerMove, onPointerUp,
    dragSelectBox, cursor,
    colorPickerOpenRef, colorPickerHoverRef,
    isDraggingRef, dragGroupIdsRef,
    isResizingRef, resizeElIdRef,
    isDrawingRef, drawElIdRef,
    snapLinesRef,
  } = usePointerHandlers({ rendererRef, canvasSizeRef, zoomScaleRef, mountRef })

  useKeyboardHandlers(colorPickerOpenRef, colorPickerHoverRef)

  // Coordinate helpers (used for distance labels + overlay pass)
  const worldToPixel = useCallback((wx: number, wy: number) => {
    const { w, h } = canvasSizeRef.current
    const [px, py] = worldToPixelCS(wx, wy, w, h)
    return { x: px, y: py }
  }, [])

  const pixelToWorld = useCallback((px: number, py: number) => {
    const { w, h } = canvasSizeRef.current
    const [wx, wy] = pixelToWorldCS(px, py, w, h)
    return { wx, wy }
  }, [])

  const worldToScreen = useCallback((wx: number, wy: number) => worldToPixel(wx, wy), [worldToPixel])

  // Alt key distance visualization
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Alt') { e.preventDefault(); setAltPressed(true) } }
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltPressed(false) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [])

  useEffect(() => {
    const primaryId = selectedIds[0] ?? null
    if (!altPressed || !primaryId) { setDistanceLabels([]); distMeasuresRef.current = []; return }
    const el = elements.find((e) => e.id === primaryId)
    if (!el) return
    const { left, right, top, bottom } = computeDistances(el, elements.filter((e) => e.id !== primaryId))
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
  }, [altPressed, selectedIds, elements, pixelToWorld, worldToScreen])

  // Initialize renderer + rAF loop
  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current

    const renderer = createSDFRenderer(mount)
    rendererRef.current = renderer
    canvasSizeRef.current = { w: mount.clientWidth, h: mount.clientHeight }

    const controls = createOrbitControls(renderer.canvas, renderer.camera)
    const animator = createLayoutAnimator()
    const kfAnimator = createKeyframeAnimator()
    kfAnimator.onComplete = (elementId, finalValues) => {
      useChoanStore.getState().updateElement(elementId, finalValues)
    }
    ;(window as unknown as Record<string, unknown>).__choanKF = kfAnimator

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()

      const cam = renderer.camera
      const cdx = cam.position[0] - cam.target[0]
      const cdy = cam.position[1] - cam.target[1]
      const cdz = cam.position[2] - cam.target[2]
      zoomScaleRef.current = Math.sqrt(cdx * cdx + cdy * cdy + cdz * cdz) / 20
      const rs = useRenderSettings.getState()

      const manipulatedIds = new Set<string>()
      if (isDraggingRef.current) for (const id of dragGroupIdsRef.current) manipulatedIds.add(id)
      if (isResizingRef.current && resizeElIdRef.current) manipulatedIds.add(resizeElIdRef.current)
      if (isDrawingRef.current && drawElIdRef.current) manipulatedIds.add(drawElIdRef.current)

      const state = useChoanStore.getState()
      const preview = usePreviewStore.getState()

      let animatedElements = evaluateAnimation({
        elements: state.elements, previewState: preview.previewState,
        editingBundleId: preview.editingBundleId, playheadTime: preview.playheadTime,
        animationBundles: state.animationBundles, kfAnimator, layoutAnimator: animator,
        springParams: { stiffness: rs.springStiffness, damping: rs.springDamping, squashIntensity: rs.squashIntensity },
        manipulatedIds,
      })

      if (preview.ghostPreview && preview.editingBundleId && preview.previewState === 'stopped') {
        const bundle = state.animationBundles.find((b) => b.id === preview.editingBundleId)
        if (bundle) animatedElements = addGhostElements(animatedElements, state.elements, bundle, preview.playheadTime)
      }

      renderer.updateScene(applyMultiSelectTint(animatedElements, state.selectedIds), rs.extrudeDepth)
      renderer.render(rs)

      // ── Overlay pass ──
      const { w, h } = canvasSizeRef.current
      const aspect = w / h
      const ov = renderer.overlay
      const p2w = (px: number, py: number): [number, number] => pixelToWorldCS(px, py, w, h)
      const zs = zoomScaleRef.current

      // Selection outlines + corner handles
      for (const selId of state.selectedIds) {
        const el = state.elements.find((e) => e.id === selId)
        if (!el) continue
        ov.setZ(el.z * rs.extrudeDepth + rs.extrudeDepth / 2)
        const tl = p2w(el.x, el.y), tr = p2w(el.x + el.width, el.y)
        const br = p2w(el.x + el.width, el.y + el.height), bl = p2w(el.x, el.y + el.height)
        ov.drawLines(new Float32Array([...tl, ...tr, ...tr, ...br, ...br, ...bl, ...bl, ...tl]), SELECTION_COLOR)
        const hWorld = HANDLE_SIZE_PX * (2 * FRUSTUM) / h * zs
        const handles = new Float32Array([...tl, ...tr, ...br, ...bl])
        ov.drawQuads(handles, hWorld, SELECTION_COLOR)
        ov.drawQuads(handles, hWorld * 0.6, [1, 1, 1, 1])
        ov.setZ(0)
      }

      // Snap guide lines
      const snaps = snapLinesRef.current
      if (snaps.length > 0) {
        ov.drawLines(new Float32Array(snaps.flatMap((s) => [...p2w(s.x1, s.y1), ...p2w(s.x2, s.y2)])), SNAP_COLOR)
      }

      // Distance measurement lines + tick marks
      const dVerts: number[] = []
      for (const m of distMeasuresRef.current) {
        if (!m) continue
        const a = p2w(m.x1, m.y1), b = p2w(m.x2, m.y2)
        dVerts.push(...a, ...b)
        const tick = DISTANCE_TICK_PX * (2 * FRUSTUM) / h * zs
        if (Math.abs(m.y1 - m.y2) < 1) {
          dVerts.push(a[0], a[1] - tick, a[0], a[1] + tick, b[0], b[1] - tick, b[0], b[1] + tick)
        } else {
          const tickX = DISTANCE_TICK_PX * (2 * FRUSTUM * aspect) / w * zs
          dVerts.push(a[0] - tickX, a[1], a[0] + tickX, a[1], b[0] - tickX, b[1], b[0] + tickX, b[1])
        }
      }
      if (dVerts.length > 0) ov.drawLines(new Float32Array(dVerts), DISTANCE_COLOR)

      // WebGL color picker
      if (colorPickerOpenRef.current && state.selectedIds.length === 1) {
        const pickEl = state.elements.find((e) => e.id === state.selectedIds[0])
        if (pickEl) {
          ov.setZ(pickEl.z * rs.extrudeDepth + rs.extrudeDepth / 2 + 0.01)
          const ax = pickEl.x + pickEl.width, ay = pickEl.y
          const pxToW = (2 * FRUSTUM) / h * zs
          const discR = COLOR_PICKER_DISC_RADIUS * pxToW
          const borderR = discR * 1.22
          const hoverIdx = colorPickerHoverRef.current
          for (let fi = 0; fi < COLOR_FAMILIES.length; fi++) {
            for (let si = 0; si < COLOR_FAMILIES[fi].shades.length; si++) {
              const angle = (fi / COLOR_FAMILIES.length) * Math.PI * 2 - Math.PI / 2
              const ring = (COLOR_PICKER_RING_BASE + si * COLOR_PICKER_RING_STEP) * zs
              const [wx, wy] = p2w(ax + Math.cos(angle) * ring, ay + Math.sin(angle) * ring)
              const hex = COLOR_FAMILIES[fi].shades[si]
              const idx = fi * 5 + si
              const isHovered = idx === hoverIdx, isActive = pickEl.color === hex
              ov.drawDisc(wx, wy, isHovered ? borderR * 1.3 : isActive ? borderR * 1.2 : borderR, isActive ? [0.36, 0.31, 0.81, 1] : [1, 1, 1, 0.9])
              ov.drawDisc(wx, wy, isHovered ? discR * 1.3 : discR, [((hex >> 16) & 0xFF) / 255, ((hex >> 8) & 0xFF) / 255, (hex & 0xFF) / 255, 1])
            }
          }
          ov.setZ(0)
        }
      }
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      canvasSizeRef.current = { w, h }
      renderer.resize(w, h)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      kfAnimator.stopAll()
      rendererRef.current = null
      delete (window as unknown as Record<string, unknown>).__choanKF
    }
  }, [])

  const effectiveCursor = tool !== 'select' ? 'crosshair' : cursor

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', cursor: effectiveCursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {dragSelectBox && (
        <div style={{
          position: 'absolute',
          left: dragSelectBox.left, top: dragSelectBox.top,
          width: dragSelectBox.width, height: dragSelectBox.height,
          border: '1.5px solid rgba(66,133,244,0.8)',
          background: 'rgba(66,133,244,0.08)',
          borderRadius: 2, pointerEvents: 'none',
        }} />
      )}
      <div className="canvas-toolbar">
        <button className={`canvas-tool ${tool === 'select' ? 'active' : ''}`} onClick={() => setTool('select')} title="Select (V)"><Cursor size={16} /></button>
        <button className={`canvas-tool ${tool === 'rectangle' ? 'active' : ''}`} onClick={() => setTool('rectangle')} title="Rectangle (R)"><Rectangle size={16} /></button>
        <button className={`canvas-tool ${tool === 'circle' ? 'active' : ''}`} onClick={() => setTool('circle')} title="Circle (C)"><Circle size={16} /></button>
        <button className={`canvas-tool ${tool === 'line' ? 'active' : ''}`} onClick={() => setTool('line')} title="Line (L)"><LineSegment size={16} /></button>
      </div>
      {distanceLabels.map((label, i) => (
        <div key={i} style={{
          position: 'absolute', left: label.x, top: label.y,
          transform: 'translate(-50%, -50%)',
          background: 'rgba(249,115,22,0.92)', color: '#fff',
          padding: '2px 6px', borderRadius: 4, fontSize: 11,
          fontWeight: 700, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>{label.text}</div>
      ))}
      <RenderSettingsPanel />
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

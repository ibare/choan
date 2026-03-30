import { useEffect, useRef, useCallback, useState } from 'react'
import { createSDFRenderer, type SDFRenderer } from '../engine/renderer'
import { createOrbitControls, type OrbitControls } from '../engine/controls'
import { createSceneManager, type SceneManager } from '../engine/sceneManager'
import { worldToPixel as worldToPixelCS, pixelToWorld as pixelToWorldCS } from '../coords/coordinateSystem'
import { useChoanStore, type ChoanElement } from '../store/useChoanStore'
import { computeDistances, type DistanceMeasure } from '../utils/snapUtils'
import { usePointerHandlers } from '../interaction/usePointerHandlers'
import { useKeyboardHandlers } from '../interaction/useKeyboardHandlers'
import { useAnimateLoop } from '../rendering/useAnimateLoop'
import { rendererSingleton } from '../rendering/rendererRef'
import RenderSettingsPanel from '../panels/RenderSettingsPanel'
import DragSelectBox from './DragSelectBox'
import DistanceLabels from './DistanceLabels'
import FrameIndicator from './FrameIndicator'
import NavigationGizmo from './NavigationGizmo'
import SplitLabels from './SplitLabels'
import ContextToolbar from './ContextToolbar'
import { onExportAnimStart } from '../animation/exportAnimation'
import { useDirectorStore } from '../store/useDirectorStore'
// PinOverlay removed — sizing indicators rendered via WebGL overlay

export default function SDFCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SDFRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const sceneManagerRef = useRef<SceneManager | null>(null)
  const canvasSizeRef = useRef({ w: 1, h: 1 })
  const zoomScaleRef = useRef(1)
  const distMeasuresRef = useRef<(DistanceMeasure | null)[]>([])
  const animatedElementsRef = useRef<ChoanElement[]>([])
  const splitModeRef = useRef<{ active: boolean; count: number; elementId: string; direction: 'horizontal' | 'vertical' }>({ active: false, count: 2, elementId: '', direction: 'horizontal' })
  const { elements, selectedIds, tool } = useChoanStore()
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
    tunnelHoverRef,
  } = usePointerHandlers({ rendererRef, canvasSizeRef, zoomScaleRef, mountRef, animatedElementsRef })

  useKeyboardHandlers(colorPickerOpenRef, colorPickerHoverRef, splitModeRef, controlsRef)

  useAnimateLoop({
    rendererRef, controlsRef, sceneManagerRef, canvasSizeRef, zoomScaleRef, distMeasuresRef,
    isDraggingRef, dragGroupIdsRef, isResizingRef, resizeElIdRef,
    isDrawingRef, drawElIdRef, snapLinesRef, colorPickerOpenRef, colorPickerHoverRef,
    animatedElementsRef,
    splitModeRef,
    tunnelHoverRef,
  })

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
    distMeasuresRef.current = [left, right, top, bottom]
    const labels: Array<{ x: number; y: number; text: string }> = []
    for (const m of [left, right, top, bottom]) {
      if (!m) continue
      const { wx, wy } = pixelToWorld(m.midX, m.midY)
      const screen = worldToPixel(wx, wy)
      if (screen) labels.push({ x: screen.x, y: screen.y, text: `${Math.round(m.distance)}` })
    }
    setDistanceLabels(labels)
  }, [altPressed, selectedIds, elements, pixelToWorld, worldToPixel])

  // Initialize directorCameraPos/TargetPos from viewport camera when entering director mode
  const directorMode = useDirectorStore((s) => s.directorMode)
  useEffect(() => {
    if (!directorMode) return
    const renderer = rendererRef.current
    if (!renderer) return
    const { position, target } = renderer.camera
    useDirectorStore.getState().setDirectorCameraPos([...position] as [number, number, number])
    useDirectorStore.getState().setDirectorTargetPos([...target] as [number, number, number])
  }, [directorMode])

  // Initialize renderer + controls
  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current
    const renderer = createSDFRenderer(mount)
    rendererRef.current = renderer
    canvasSizeRef.current = { w: mount.clientWidth, h: mount.clientHeight }
    controlsRef.current = createOrbitControls(renderer.canvas, renderer.camera)
    sceneManagerRef.current = createSceneManager(renderer.gl, renderer.getQuad())
    rendererSingleton.renderer = renderer
    rendererSingleton.controls = controlsRef.current
    onExportAnimStart(() => controlsRef.current?.resetView())
    const ro = new ResizeObserver(() => {
      canvasSizeRef.current = { w: mount.clientWidth, h: mount.clientHeight }
      renderer.resize(mount.clientWidth, mount.clientHeight)
    })
    ro.observe(mount)
    return () => {
      ro.disconnect()
      sceneManagerRef.current?.dispose()
      controlsRef.current?.dispose()
      renderer.dispose()
      rendererSingleton.renderer = null
      rendererSingleton.controls = null
      rendererRef.current = null
      controlsRef.current = null
      sceneManagerRef.current = null
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
      <DragSelectBox box={dragSelectBox} />
      <DistanceLabels labels={distanceLabels} />
      <FrameIndicator zoomScaleRef={zoomScaleRef} />
      <RenderSettingsPanel />
      <NavigationGizmo controlsRef={controlsRef} />
      <SplitLabels splitModeRef={splitModeRef} canvasSizeRef={canvasSizeRef} rendererRef={rendererRef} />
      <ContextToolbar canvasSizeRef={canvasSizeRef} rendererRef={rendererRef} isDraggingRef={isDraggingRef} isResizingRef={isResizingRef} isDrawingRef={isDrawingRef} controlsRef={controlsRef} splitModeRef={splitModeRef} />
    </div>
  )
}

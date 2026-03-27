// Director Timeline Panel — camera view keyframes + event marker bars.
// Absolute-time ruler. "Save Current View" captures orbit position.
// Double-click event bar → switch to bundle editing mode.

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Stop, Camera, Export } from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Tooltip } from '../components/ui/Tooltip'
import { useDirectorStore } from '../store/useDirectorStore'
import { useSceneStore } from '../store/useSceneStore'
import { useChoanStore } from '../store/useChoanStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { rendererSingleton } from '../rendering/rendererRef'
import { nanoid } from '../utils/nanoid'
import { createDefaultDirectorTimeline, type CameraViewKeyframe, type EventMarker } from '../animation/directorTypes'
import { renderRuler, renderPlayhead } from '../engine/timeline2dRenderer'
import { drawDiamond } from '../engine/timeline2dPrimitives'
import type { RenderOptions } from '../engine/timeline2dTypes'
import { evaluateDirectorCamera } from '../animation/directorCameraEvaluator'
import { generateCameraPreset, CAMERA_PRESET_OPTIONS, type CameraPresetType } from '../animation/cameraPresets'
import { evaluateDirectorEvents } from '../animation/directorEventEvaluator'
import { evaluateDirectorFrame } from '../animation/directorAnimationEvaluator'
import { createVideoExporter } from '../engine/videoExporter'
import { applyMultiSelectTint } from '../rendering/multiSelectTint'
import VideoExportDialog, { type VideoExportSettings } from './VideoExportDialog'

const PX_PER_MS = 0.15
const TRACK_H = 32
const RULER_H = 35  // Match bundle timeline ruler height
const SIDEBAR_W = 120
const LEFT_PAD = 24  // Match bundle timeline left padding

// 35mm full-frame sensor: width = 36mm
const SENSOR_W = 36

/** Convert focal length (mm) to vertical FOV (degrees). */
function mmToFov(mm: number): number {
  return 2 * Math.atan(SENSOR_W / (2 * mm)) * (180 / Math.PI)
}

interface DirectorTimelinePanelProps {
  onSwitchToBundle: (bundleId: string) => void
}

export default function DirectorTimelinePanel({ onSwitchToBundle }: DirectorTimelinePanelProps) {
  const { scenes, activeSceneId } = useSceneStore()
  const { animationBundles } = useChoanStore()
  const {
    directorPlayheadTime, directorPlaying, focalLengthMm,
    setDirectorPlayheadTime, startPlaying, stopPlaying, setFocalLengthMm,
    addCameraKeyframe, removeCameraKeyframe, updateCameraKeyframe,
    addEventMarker, updateEventMarker, removeEventMarker,
  } = useDirectorStore()

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [selectedCameraKfId, setSelectedCameraKfId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrubRef = useRef(false)
  const dragRef = useRef<{
    type: 'event' | 'camera-kf'
    id: string; mode: 'move' | 'resize'
    startX: number; startTime: number; startDuration: number
  } | null>(null)

  const scene = scenes.find((s) => s.id === activeSceneId)
  const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
  const sceneDuration = scene?.duration ?? 3000

  // ── Canvas rendering ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Build RenderOptions for shared ruler/playhead
    const renderOpts: RenderOptions = {
      scrollX: 0,
      scrollY: 0,
      pxPerMs: PX_PER_MS,
      rulerHeight: RULER_H,
      trackHeight: TRACK_H,
      layerHeaderHeight: 0,
      maxDuration: sceneDuration,
      hoverKf: null,
      playheadTime: directorPlayheadTime,
    }
    const msToX = (ms: number, _opts?: RenderOptions) => SIDEBAR_W + LEFT_PAD + ms * PX_PER_MS

    // ── Ruler (shared with Bundle timeline) ──
    ctx.save()
    ctx.beginPath()
    ctx.rect(SIDEBAR_W, 0, w - SIDEBAR_W, RULER_H)
    ctx.clip()
    ctx.translate(SIDEBAR_W, 0)
    renderRuler(ctx, w - SIDEBAR_W, renderOpts, (_ms, _o) => LEFT_PAD + _ms * PX_PER_MS)
    ctx.restore()

    // ── Camera track ──
    const camY = RULER_H + TRACK_H / 2
    ctx.fillStyle = 'var(--surface-2)'
    ctx.fillRect(SIDEBAR_W, RULER_H, w - SIDEBAR_W, TRACK_H)
    ctx.strokeStyle = 'var(--border)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(SIDEBAR_W, Math.round(RULER_H + TRACK_H) - 0.5)
    ctx.lineTo(w, Math.round(RULER_H + TRACK_H) - 0.5)
    ctx.stroke()

    for (const kf of dt.cameraKeyframes) {
      const x = msToX(kf.time)
      if (x >= SIDEBAR_W - 10 && x <= w + 10) {
        const isSelected = kf.id === selectedCameraKfId
        drawDiamond(ctx, x, camY, isSelected)
      }
    }

    // ── Events track ──
    const evtY = RULER_H + TRACK_H
    ctx.fillStyle = 'var(--bg)'
    ctx.fillRect(SIDEBAR_W, evtY, w - SIDEBAR_W, TRACK_H)

    const BUNDLE_COLORS = ['#5b4fcf', '#cf5b4f', '#4fcf5b', '#cf9f4f', '#4f9fcf', '#9f4fcf']
    for (let i = 0; i < dt.eventMarkers.length; i++) {
      const marker = dt.eventMarkers[i]
      const bundle = animationBundles.find((b) => b.id === marker.bundleId)
      if (!bundle) continue
      const bundleDur = Math.max(1, ...bundle.clips.map((c) => c.duration))
      const effectiveDur = marker.durationOverride ?? bundleDur
      const x = msToX(marker.time)
      const barW = effectiveDur * PX_PER_MS
      const color = BUNDLE_COLORS[i % BUNDLE_COLORS.length]

      const isSelected = marker.id === selectedMarkerId
      const drawBarW = Math.max(barW, 8)

      ctx.fillStyle = isSelected ? color + 'cc' : color + '88'
      ctx.beginPath()
      ctx.roundRect(x, evtY + 4, drawBarW, TRACK_H - 8, 3)
      ctx.fill()

      ctx.strokeStyle = isSelected ? '#fff' : color
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.beginPath()
      ctx.roundRect(x, evtY + 4, drawBarW, TRACK_H - 8, 3)
      ctx.stroke()
      ctx.lineWidth = 1

      if (isSelected) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(x + drawBarW - 3, evtY + 8, 2, TRACK_H - 16)
      }

      ctx.fillStyle = '#fff'
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      const labelX = x + 4
      if (labelX + 20 < x + drawBarW) {
        ctx.fillText(bundle.name, labelX, evtY + TRACK_H / 2 + 3, drawBarW - 8)
      }
    }

    // ── Playhead (shared with Bundle timeline) ──
    ctx.save()
    ctx.beginPath()
    ctx.rect(SIDEBAR_W, 0, w - SIDEBAR_W, h)
    ctx.clip()
    ctx.translate(SIDEBAR_W, 0)
    renderPlayhead(ctx, w - SIDEBAR_W, h, renderOpts, (_ms, _o) => LEFT_PAD + _ms * PX_PER_MS)
    ctx.restore()

    // ── Sidebar ──
    const sidebarStyle = getComputedStyle(ctx.canvas)
    ctx.fillStyle = sidebarStyle.getPropertyValue('--surface-1').trim() || '#1a1a2e'
    ctx.fillRect(0, 0, SIDEBAR_W, h)
    ctx.strokeStyle = sidebarStyle.getPropertyValue('--border').trim() || '#333'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(SIDEBAR_W - 0.5, 0)
    ctx.lineTo(SIDEBAR_W - 0.5, h)
    ctx.stroke()

    ctx.fillStyle = sidebarStyle.getPropertyValue('--text-2').trim() || '#aaa'
    ctx.font = '500 11px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('🎥 Camera', 8, RULER_H + TRACK_H / 2 + 4)
    ctx.fillText('⚡ Events', 8, RULER_H + TRACK_H + TRACK_H / 2 + 4)
  }, [dt, sceneDuration, directorPlayheadTime, animationBundles, selectedMarkerId, selectedCameraKfId])

  useEffect(() => { draw() }, [draw])

  // Redraw on container resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  // ── Delete key handler ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (selectedCameraKfId) {
          removeCameraKeyframe(selectedCameraKfId)
          setSelectedCameraKfId(null)
          e.preventDefault()
        } else if (selectedMarkerId) {
          removeEventMarker(selectedMarkerId)
          setSelectedMarkerId(null)
          e.preventDefault()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCameraKfId, selectedMarkerId, removeCameraKeyframe, removeEventMarker])

  // ── Pointer handlers ──
  const xToMs = (clientX: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(sceneDuration, (clientX - rect.left - SIDEBAR_W - LEFT_PAD) / PX_PER_MS))
  }

  const EDGE_ZONE = 8  // px from right edge for resize handle

  const hitTestEventBar = (localX: number, localY: number): { marker: EventMarker; isEdge: boolean } | null => {
    const evtY = RULER_H + TRACK_H
    if (localY < evtY || localY >= evtY + TRACK_H) return null
    for (const marker of dt.eventMarkers) {
      const bundle = animationBundles.find((b) => b.id === marker.bundleId)
      if (!bundle) continue
      const bundleDur = Math.max(1, ...bundle.clips.map((c) => c.duration))
      const effectiveDur = marker.durationOverride ?? bundleDur
      const mx = SIDEBAR_W + LEFT_PAD + marker.time * PX_PER_MS
      const mw = Math.max(effectiveDur * PX_PER_MS, 8)
      if (localX >= mx && localX <= mx + mw) {
        const isEdge = localX >= mx + mw - EDGE_ZONE
        return { marker, isEdge }
      }
    }
    return null
  }

  const hitTestCameraKf = (localX: number, localY: number): CameraViewKeyframe | null => {
    const camY = RULER_H
    if (localY < camY || localY >= camY + TRACK_H) return null
    for (const kf of dt.cameraKeyframes) {
      const kx = SIDEBAR_W + LEFT_PAD + kf.time * PX_PER_MS
      if (Math.abs(localX - kx) < 10) return kf
    }
    return null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top

    if (localX < SIDEBAR_W) return

    // Check camera keyframe hit
    const camHit = hitTestCameraKf(localX, localY)
    if (camHit) {
      setSelectedCameraKfId(camHit.id)
      setSelectedMarkerId(null)
      dragRef.current = {
        type: 'camera-kf',
        id: camHit.id,
        mode: 'move',
        startX: e.clientX,
        startTime: camHit.time,
        startDuration: 0,
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Check event bar hit
    const hit = hitTestEventBar(localX, localY)
    if (hit) {
      const { marker, isEdge } = hit
      const bundle = animationBundles.find((b) => b.id === marker.bundleId)
      const bundleDur = bundle ? Math.max(1, ...bundle.clips.map((c) => c.duration)) : 300
      const effectiveDur = marker.durationOverride ?? bundleDur
      setSelectedMarkerId(marker.id)
      setSelectedCameraKfId(null)
      dragRef.current = {
        type: 'event',
        id: marker.id,
        mode: isEdge ? 'resize' : 'move',
        startX: e.clientX,
        startTime: marker.time,
        startDuration: effectiveDur,
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Click on empty area deselects
    setSelectedMarkerId(null)
    setSelectedCameraKfId(null)

    // Ruler/playhead scrub
    scrubRef.current = true
    setDirectorPlayheadTime(xToMs(e.clientX))
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX
      const dtMs = dx / PX_PER_MS
      if (dragRef.current.type === 'camera-kf') {
        const newTime = Math.max(0, Math.min(sceneDuration, dragRef.current.startTime + dtMs))
        updateCameraKeyframe(dragRef.current.id, { time: Math.round(newTime) })
      } else if (dragRef.current.mode === 'move') {
        const newTime = Math.max(0, Math.min(sceneDuration, dragRef.current.startTime + dtMs))
        updateEventMarker(dragRef.current.id, { time: Math.round(newTime) })
      } else {
        const newDur = Math.max(50, dragRef.current.startDuration + dtMs)
        updateEventMarker(dragRef.current.id, { durationOverride: Math.round(newDur) })
      }
      return
    }
    if (scrubRef.current) {
      setDirectorPlayheadTime(xToMs(e.clientX))
      return
    }

    // Cursor feedback on hover
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top
    const camHit = hitTestCameraKf(localX, localY)
    const evtHit = hitTestEventBar(localX, localY)
    if (camHit) {
      canvas.style.cursor = 'grab'
    } else if (evtHit?.isEdge) {
      canvas.style.cursor = 'ew-resize'
    } else if (evtHit) {
      canvas.style.cursor = 'grab'
    } else {
      canvas.style.cursor = 'default'
    }
  }

  const handlePointerUp = () => {
    scrubRef.current = false
    dragRef.current = null
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top

    // Double-click event bar → enter bundle editing
    const evtY = RULER_H + TRACK_H
    if (localY >= evtY && localY < evtY + TRACK_H) {
      for (const marker of dt.eventMarkers) {
        const bundle = animationBundles.find((b) => b.id === marker.bundleId)
        if (!bundle) continue
        const bundleDur = Math.max(1, ...bundle.clips.map((c) => c.duration))
        const effectiveDur = marker.durationOverride ?? bundleDur
        const mx = SIDEBAR_W + LEFT_PAD + marker.time * PX_PER_MS
        const mw = effectiveDur * PX_PER_MS
        if (localX >= mx && localX <= mx + mw) {
          onSwitchToBundle(marker.bundleId)
          return
        }
      }
    }
  }

  // ── Actions ──
  const handleFocalLengthChange = (mm: number) => {
    setFocalLengthMm(mm)
  }

  const handleSaveView = () => {
    const cam = rendererSingleton.renderer?.camera
    if (!cam) return
    const kf: CameraViewKeyframe = {
      id: nanoid(),
      time: Math.round(directorPlayheadTime),
      position: [...cam.position] as [number, number, number],
      target: [...cam.target] as [number, number, number],
      fov: mmToFov(focalLengthMm),
    }
    addCameraKeyframe(kf)
  }

  const handleApplyPreset = (presetType: string) => {
    const cam = rendererSingleton.renderer?.camera
    const keyframes = generateCameraPreset(presetType as CameraPresetType, {
      center: cam ? [...cam.target] as [number, number, number] : [0, 0, 0],
      radius: cam ? Math.sqrt(
        (cam.position[0] - cam.target[0]) ** 2 +
        (cam.position[1] - cam.target[1]) ** 2 +
        (cam.position[2] - cam.target[2]) ** 2,
      ) : 15,
      duration: sceneDuration,
      fov: cam?.fov ?? 50,
    })
    // Clear existing keyframes and apply preset
    for (const kf of dt.cameraKeyframes) {
      useDirectorStore.getState().removeCameraKeyframe(kf.id)
    }
    for (const kf of keyframes) {
      addCameraKeyframe(kf)
    }
  }

  const handleAddEvent = (bundleId: string) => {
    const marker: EventMarker = {
      id: nanoid(),
      time: Math.round(directorPlayheadTime),
      bundleId,
    }
    addEventMarker(marker)
  }

  const handlePlayPause = () => {
    if (directorPlaying) { stopPlaying(); return }
    startPlaying()
  }

  const handleStop = () => {
    stopPlaying()
    setDirectorPlayheadTime(0)
  }

  // ── Export ──
  const handleExport = (settings: VideoExportSettings) => {
    const renderer = rendererSingleton.renderer
    if (!renderer) return

    setExporting(true)
    setExportProgress(0)

    const rs = useRenderSettings.getState()

    const exporter = createVideoExporter(
      renderer.canvas,
      (w, h) => renderer.resize(w, h),
      (timeMs) => {
        const state = useChoanStore.getState()

        // Camera
        const camState = evaluateDirectorCamera(dt.cameraKeyframes, timeMs)
        if (camState) {
          renderer.camera.position[0] = camState.position[0]
          renderer.camera.position[1] = camState.position[1]
          renderer.camera.position[2] = camState.position[2]
          renderer.camera.target[0] = camState.target[0]
          renderer.camera.target[1] = camState.target[1]
          renderer.camera.target[2] = camState.target[2]
          renderer.camera.fov = camState.fov
        }

        // Events
        const activeEvents = evaluateDirectorEvents(dt.eventMarkers, timeMs, state.animationBundles)
        const animated = evaluateDirectorFrame(state.elements, activeEvents)

        renderer.updateScene(applyMultiSelectTint(animated, []), rs.extrudeDepth)
        renderer.render(rs)
      },
    )
    exporter.onProgress = (p) => setExportProgress(p)
    exporter.start(settings).then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'choan-director.webm'
      a.click()
      URL.revokeObjectURL(url)
      setExporting(false)
      setExportDialogOpen(false)
    }).catch(() => {
      setExporting(false)
    })
  }

  const bundleOptions = animationBundles.map((b) => ({ value: b.id, label: b.name }))

  return (
    <div className="ui-director-panel">
      {/* Header */}
      <div className="ui-director-header">
        <Tooltip content={directorPlaying ? 'Pause' : 'Play'}>
          <Button className="btn-small" onClick={handlePlayPause}>
            {directorPlaying ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
          </Button>
        </Tooltip>
        <Tooltip content="Stop">
          <Button className="btn-small" onClick={handleStop}><Stop size={14} weight="fill" /></Button>
        </Tooltip>
        <div className="timeline-separator" />
        <Tooltip content="Save Current View as Keyframe">
          <Button className="btn-small" onClick={handleSaveView}><Camera size={14} /> Save View</Button>
        </Tooltip>
        <Select
          options={CAMERA_PRESET_OPTIONS}
          value=""
          onChange={handleApplyPreset}
          placeholder="Preset"
          size="sm"
        />
        <div className="timeline-separator" />
        <div className="ui-director-focal">
          <input
            type="range"
            min={10}
            max={200}
            value={focalLengthMm}
            onChange={(e) => handleFocalLengthChange(Number(e.target.value))}
            className="ui-director-focal__slider"
          />
          <span className="ui-director-focal__label">{focalLengthMm}mm</span>
        </div>
        <div className="timeline-separator" />
        {bundleOptions.length > 0 && (
          <Select
            options={bundleOptions}
            value=""
            onChange={handleAddEvent}
            placeholder="+ Event"
            size="sm"
          />
        )}
        <div className="timeline-separator" />
        <Tooltip content="Export Video">
          <Button className="btn-small" onClick={() => setExportDialogOpen(true)}><Export size={14} /></Button>
        </Tooltip>
        <span className="ui-director-time">{(directorPlayheadTime / 1000).toFixed(1)}s / {(sceneDuration / 1000).toFixed(1)}s</span>
      </div>

      {/* Canvas */}
      <div className="ui-director-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="ui-director-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
        />
      </div>

      <VideoExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
        exporting={exporting}
        progress={exportProgress}
        duration={sceneDuration}
      />
    </div>
  )
}

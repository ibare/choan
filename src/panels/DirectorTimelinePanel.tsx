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
import { evaluateDirectorCamera } from '../animation/directorCameraEvaluator'
import { evaluateDirectorEvents } from '../animation/directorEventEvaluator'
import { evaluateDirectorFrame } from '../animation/directorAnimationEvaluator'
import { createVideoExporter } from '../engine/videoExporter'
import { applyMultiSelectTint } from '../rendering/multiSelectTint'
import VideoExportDialog, { type VideoExportSettings } from './VideoExportDialog'

const PX_PER_MS = 0.15
const TRACK_H = 32
const RULER_H = 28
const SIDEBAR_W = 120

interface DirectorTimelinePanelProps {
  onSwitchToBundle: (bundleId: string) => void
}

export default function DirectorTimelinePanel({ onSwitchToBundle }: DirectorTimelinePanelProps) {
  const { scenes, activeSceneId } = useSceneStore()
  const { animationBundles } = useChoanStore()
  const {
    directorPlayheadTime, directorPlaying,
    setDirectorPlayheadTime, startPlaying, stopPlaying,
    addCameraKeyframe,
    addEventMarker, updateEventMarker,
  } = useDirectorStore()

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrubRef = useRef(false)
  const dragRef = useRef<{ markerId: string; startX: number; startTime: number } | null>(null)

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

    const msToX = (ms: number) => SIDEBAR_W + ms * PX_PER_MS

    // Ruler
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(SIDEBAR_W, 0, w - SIDEBAR_W, RULER_H)
    ctx.fillStyle = '#666'
    ctx.font = '10px system-ui'
    ctx.textAlign = 'center'
    const step = 500
    for (let ms = 0; ms <= sceneDuration; ms += step) {
      const x = msToX(ms)
      if (x < SIDEBAR_W || x > w) continue
      ctx.fillText(`${(ms / 1000).toFixed(1)}s`, x, RULER_H - 6)
      ctx.fillRect(x, RULER_H - 3, 1, 3)
    }

    // Camera track
    const camY = RULER_H + TRACK_H / 2
    ctx.fillStyle = '#2a2a3e'
    ctx.fillRect(SIDEBAR_W, RULER_H, w - SIDEBAR_W, TRACK_H)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(SIDEBAR_W, RULER_H + TRACK_H)
    ctx.lineTo(w, RULER_H + TRACK_H)
    ctx.stroke()

    // Camera keyframe diamonds
    for (const kf of dt.cameraKeyframes) {
      const x = msToX(kf.time)
      drawDiamond(ctx, x, camY, '#5b9fcf')
    }

    // Events track
    const evtY = RULER_H + TRACK_H
    ctx.fillStyle = '#1e1e30'
    ctx.fillRect(SIDEBAR_W, evtY, w - SIDEBAR_W, TRACK_H)

    // Event bars
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

      ctx.fillStyle = color + '88'
      ctx.beginPath()
      ctx.roundRect(x, evtY + 4, Math.max(barW, 4), TRACK_H - 8, 3)
      ctx.fill()

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(x, evtY + 4, Math.max(barW, 4), TRACK_H - 8, 3)
      ctx.stroke()

      // Label
      ctx.fillStyle = '#fff'
      ctx.font = '9px system-ui'
      ctx.textAlign = 'left'
      const labelX = x + 4
      if (labelX + 40 < x + barW) {
        ctx.fillText(bundle.name, labelX, evtY + TRACK_H / 2 + 3, barW - 8)
      }
    }

    // Playhead
    const phX = msToX(directorPlayheadTime)
    if (phX >= SIDEBAR_W) {
      ctx.strokeStyle = '#ff4444'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(phX, 0)
      ctx.lineTo(phX, h)
      ctx.stroke()

      // Playhead handle
      ctx.fillStyle = '#ff4444'
      ctx.beginPath()
      ctx.moveTo(phX - 5, 0)
      ctx.lineTo(phX + 5, 0)
      ctx.lineTo(phX, 8)
      ctx.closePath()
      ctx.fill()
    }

    // Sidebar labels
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, SIDEBAR_W, h)
    ctx.strokeStyle = '#333'
    ctx.beginPath()
    ctx.moveTo(SIDEBAR_W, 0)
    ctx.lineTo(SIDEBAR_W, h)
    ctx.stroke()

    ctx.fillStyle = '#aaa'
    ctx.font = '11px system-ui'
    ctx.textAlign = 'left'
    ctx.fillText('🎥 Camera', 8, RULER_H + TRACK_H / 2 + 4)
    ctx.fillText('⚡ Events', 8, RULER_H + TRACK_H + TRACK_H / 2 + 4)
  }, [dt, sceneDuration, directorPlayheadTime, animationBundles])

  useEffect(() => { draw() }, [draw])

  // ── Pointer handlers ──
  const xToMs = (clientX: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(sceneDuration, (clientX - rect.left - SIDEBAR_W) / PX_PER_MS))
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top

    if (localX < SIDEBAR_W) return

    // Check event bar hit
    const evtY = RULER_H + TRACK_H
    if (localY >= evtY && localY < evtY + TRACK_H) {
      for (const marker of dt.eventMarkers) {
        const bundle = animationBundles.find((b) => b.id === marker.bundleId)
        if (!bundle) continue
        const bundleDur = Math.max(1, ...bundle.clips.map((c) => c.duration))
        const effectiveDur = marker.durationOverride ?? bundleDur
        const mx = SIDEBAR_W + marker.time * PX_PER_MS
        const mw = effectiveDur * PX_PER_MS
        if (localX >= mx && localX <= mx + mw) {
          dragRef.current = { markerId: marker.id, startX: e.clientX, startTime: marker.time }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          return
        }
      }
    }

    // Ruler/playhead scrub
    scrubRef.current = true
    setDirectorPlayheadTime(xToMs(e.clientX))
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX
      const dtMs = dx / PX_PER_MS
      const newTime = Math.max(0, Math.min(sceneDuration, dragRef.current.startTime + dtMs))
      updateEventMarker(dragRef.current.markerId, { time: Math.round(newTime) })
      return
    }
    if (scrubRef.current) {
      setDirectorPlayheadTime(xToMs(e.clientX))
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
        const mx = SIDEBAR_W + marker.time * PX_PER_MS
        const mw = effectiveDur * PX_PER_MS
        if (localX >= mx && localX <= mx + mw) {
          onSwitchToBundle(marker.bundleId)
          return
        }
      }
    }
  }

  // ── Actions ──
  const handleSaveView = () => {
    const cam = rendererSingleton.renderer?.camera
    if (!cam) return
    const kf: CameraViewKeyframe = {
      id: nanoid(),
      time: Math.round(directorPlayheadTime),
      position: [...cam.position] as [number, number, number],
      target: [...cam.target] as [number, number, number],
      fov: cam.fov,
    }
    addCameraKeyframe(kf)
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

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  const s = 5
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = color
  ctx.fillRect(-s, -s, s * 2, s * 2)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1
  ctx.strokeRect(-s, -s, s * 2, s * 2)
  ctx.restore()
}

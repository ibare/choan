// Director Timeline Panel — camera view keyframes + event marker bars.
// Absolute-time ruler. "Save Current View" captures orbit position.
// Double-click event bar → switch to bundle editing mode.

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Stop, ArrowCounterClockwise, Camera, Export, Screencast, ArrowLeft, Plus, Trash, LinkSimple } from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Tooltip } from '../components/ui/Tooltip'
import { useDirectorStore } from '../store/useDirectorStore'
import { useSceneStore } from '../store/useSceneStore'
import { useChoanStore } from '../store/useChoanStore'
import { useRenderSettings } from '../store/useRenderSettings'
import { rendererSingleton } from '../rendering/rendererRef'
import { nanoid } from '../utils/nanoid'
import { createDefaultDirectorTimeline, ensureAxisMarks, hasActiveRailTiming, findActiveClip, assignLane, resolveLane, RAIL_MIN_STUB, type CameraMark, type CameraViewKeyframe, type EventMarker, type AxisMarkChannel, type AxisMark, type CameraClip, type LaneClip } from '../animation/directorTypes'
import { evaluateCameraMarks, evaluateAxisMarks, evaluateRailAnimation } from '../animation/cameraMarkEvaluator'
import { renderRuler, renderPlayhead } from '../engine/timeline2dRenderer'
import { drawDiamond } from '../engine/timeline2dPrimitives'
import type { RenderOptions } from '../engine/timeline2dTypes'
import { evaluateDirectorCamera } from '../animation/directorCameraEvaluator'
import { generateCameraPreset, CAMERA_PRESET_OPTIONS, type CameraPresetType } from '../animation/cameraPresets'
import { evaluateDirectorEvents } from '../animation/directorEventEvaluator'
import { evaluateBundles } from '../animation/animationEvaluator'
import { createVideoExporter } from '../engine/videoExporter'
import { applyMultiSelectTint } from '../rendering/multiSelectTint'
import VideoExportDialog, { type VideoExportSettings } from './VideoExportDialog'

const VIEWFINDER_ASPECT_OPTIONS = [
  { value: '16:9',   label: '16:9' },
  { value: '4:3',    label: '4:3' },
  { value: '1:1',    label: '1:1' },
  { value: '9:16',   label: '9:16' },
  { value: '2.35:1', label: '2.35:1' },
]

const PX_PER_MS = 0.15
const TRACK_H = 32
const AXIS_TRACK_H = 24
const RULER_H = 35  // Match bundle timeline ruler height
const SIDEBAR_W = 120
const LEFT_PAD = 24  // Match bundle timeline left padding
const SNAP_THRESHOLD_PX = 10  // Magnetic snap distance for clip edges
const MIN_CLIP_DURATION_MS = 100  // Minimum duration of a camera clip

const AXIS_CHANNELS: AxisMarkChannel[] = ['truck', 'boom', 'dolly']
const AXIS_COLORS: Record<AxisMarkChannel, string> = { truck: '#e05555', boom: '#55c055', dolly: '#5588dd' }
const AXIS_LABELS: Record<AxisMarkChannel, string> = { truck: 'X Truck', boom: 'Y Boom', dolly: 'Z Dolly' }

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
    directorPlayheadTime, directorPlaying, focalLengthMm, frustumSpotlightOn, viewfinderAspect,
    directorCameraPos, directorTargetPos, directorRails, selectedCameraId,
    setDirectorPlayheadTime, startPlaying, stopPlaying, setFocalLengthMm, toggleFrustumSpotlight, setViewfinderAspect,
    selectedCameraMarkId, setSelectedCameraMarkId,
    addCameraMark, updateCameraMark, removeCameraMark,
    addCameraKeyframe, removeCameraKeyframe, updateCameraKeyframe,
    addEventMarker, updateEventMarker, removeEventMarker,
    resetDirector,
    selectedAxisMarkId, selectedAxisMarkChannel,
    setSelectedAxisMark, updateAxisMark, removeAxisMark, markActiveAxis, activeRailAxis,
    detailClipId, selectedClipId, activeClipId,
    addCameraClip, removeCameraClip, selectCameraClip, updateCameraClipsBatch,
    enterClipDetail, exitClipDetail,
    addCamera, removeCamera, selectCamera,
    directorTargetMode, toggleDirectorTargetMode,
  } = useDirectorStore()

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [selectedCameraKfId, setSelectedCameraKfId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrubRef = useRef(false)
  interface ClipSnapshot { start: number; duration: number; lane: number }
  const dragRef = useRef<{
    type: 'event' | 'camera-kf' | 'camera-mark' | 'axis-mark' | 'rail-timing' | 'camera-clip'
    id: string; mode: 'move' | 'resize'
    channel?: AxisMarkChannel
    edge?: 'start' | 'end' | 'body' | 'left' | 'right'
    startX: number; startY: number; startTime: number; startDuration: number
    startLane?: number
    /** Snapshot of all camera clips at drag start, used to recompute ripple from a stable baseline. */
    clipSnapshot?: Map<string, ClipSnapshot>
  } | null>(null)

  const scene = scenes.find((s) => s.id === activeSceneId)
  const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
  const sceneDuration = scene?.duration ?? 3000
  const axisMarksData = ensureAxisMarks(dt).axisMarks
  const hasAxisMarks = Object.values(axisMarksData).some((arr) => arr.length > 0)
  const cameras = dt.cameras ?? []
  const cameraClips = dt.cameraClips ?? []
  const isDetailView = detailClipId !== null
  const activeClip = isDetailView ? cameraClips.find(c => c.id === detailClipId) ?? null : null
  const viewDuration = isDetailView && activeClip ? activeClip.duration : (
    cameraClips.length > 0 ? Math.max(...cameraClips.map(c => c.timelineStart + c.duration)) : sceneDuration
  )

  // Lane-based track count: derive from max lane used by camera clips
  const camTrackCount = !isDetailView && cameraClips.length > 0
    ? Math.max(0, ...cameraClips.map((c) => c.lane ?? 0)) + 1
    : 0

  const hasRailTiming = hasActiveRailTiming(directorRails)
  const hasAnyExtendedRail = (() => {
    const stub = RAIL_MIN_STUB + 0.001
    const { truck, boom, dolly } = directorRails
    return truck.neg > stub || truck.pos > stub || boom.neg > stub || boom.pos > stub || dolly.neg > stub || dolly.pos > stub
  })()
  const showAxisTracks = isDetailView || hasAxisMarks || hasRailTiming || hasAnyExtendedRail
  const camAreaH = isDetailView
    ? AXIS_TRACK_H * 3
    : camTrackCount > 0
      ? TRACK_H * camTrackCount
      : showAxisTracks ? AXIS_TRACK_H * 3 : TRACK_H

  // Animation (event marker) lane count
  const evtTrackCount = dt.eventMarkers.length > 0
    ? Math.max(0, ...dt.eventMarkers.map((m) => m.lane ?? 0)) + 1
    : 1
  const evtAreaH = TRACK_H * evtTrackCount

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

    // Resolve CSS custom properties for canvas rendering
    const cs = getComputedStyle(canvas)
    const colorSurface2 = cs.getPropertyValue('--surface-2').trim() || '#1e1e3a'
    const colorBg = cs.getPropertyValue('--bg').trim() || '#141428'
    const colorBorder = cs.getPropertyValue('--border').trim() || '#333'

    // Adjust playhead display for detail view (clip-local time)
    const displayPlayhead = isDetailView && activeClip
      ? directorPlayheadTime - activeClip.timelineStart
      : directorPlayheadTime

    // Build RenderOptions for shared ruler/playhead
    const renderOpts: RenderOptions = {
      scrollX: 0,
      scrollY: 0,
      pxPerMs: PX_PER_MS,
      rulerHeight: RULER_H,
      trackHeight: TRACK_H,
      layerHeaderHeight: 0,
      maxDuration: viewDuration,
      hoverKf: null,
      playheadTime: displayPlayhead,
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
    // Lane-to-Y: highest lane at top, lane 0 at bottom
    const camLaneToY = (lane: number) => RULER_H + (camTrackCount - 1 - lane) * TRACK_H

    if (camTrackCount > 0) {
      // ── Clip View: lane-based NLE layout ──
      const CLIP_COLOR = '#5b4fcf'
      for (let lane = 0; lane < camTrackCount; lane++) {
        const trackY = camLaneToY(lane)
        // Track background
        ctx.fillStyle = lane % 2 === 0 ? colorSurface2 : colorBg
        ctx.fillRect(SIDEBAR_W, trackY, w - SIDEBAR_W, TRACK_H)
        // Track border
        ctx.strokeStyle = colorBorder
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(SIDEBAR_W, Math.round(trackY + TRACK_H) - 0.5)
        ctx.lineTo(w, Math.round(trackY + TRACK_H) - 0.5)
        ctx.stroke()
      }

      // Draw clips by lane
      for (const clip of cameraClips) {
        const lane = clip.lane ?? 0
        const trackY = camLaneToY(lane)
        const x0 = msToX(clip.timelineStart)
        const x1 = msToX(clip.timelineStart + clip.duration)
        const barY = trackY + 4
        const barH = TRACK_H - 8
        const isSelected = clip.id === selectedClipId

        ctx.fillStyle = isSelected ? CLIP_COLOR + 'aa' : CLIP_COLOR + '55'
        ctx.beginPath()
        ctx.roundRect(x0, barY, x1 - x0, barH, 4)
        ctx.fill()

        ctx.strokeStyle = isSelected ? '#fff' : CLIP_COLOR + 'cc'
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.beginPath()
        ctx.roundRect(x0, barY, x1 - x0, barH, 4)
        ctx.stroke()

        if (x1 - x0 > 60) {
          ctx.fillStyle = '#fff'
          ctx.font = '11px system-ui'
          ctx.textBaseline = 'middle'
          ctx.fillText(clip.name, x0 + 8, trackY + TRACK_H / 2, x1 - x0 - 16)
        }
      }
    } else if (showAxisTracks) {
      // Per-axis sub-tracks — rail timing bars
      for (let ci = 0; ci < AXIS_CHANNELS.length; ci++) {
        const ch = AXIS_CHANNELS[ci]
        const trackY = RULER_H + ci * AXIS_TRACK_H
        const centerY = trackY + AXIS_TRACK_H / 2
        const color = AXIS_COLORS[ch]
        const ext = directorRails[ch as keyof typeof directorRails] as import('../animation/directorTypes').RailExtents

        // Track background
        const isExtended = ext.neg > RAIL_MIN_STUB + 0.001 || ext.pos > RAIL_MIN_STUB + 0.001
        ctx.fillStyle = ci % 2 === 0 ? colorSurface2 : colorBg
        ctx.fillRect(SIDEBAR_W, trackY, w - SIDEBAR_W, AXIS_TRACK_H)

        // Dimmed if rail not extended
        if (!isExtended) {
          ctx.fillStyle = 'rgba(0,0,0,0.15)'
          ctx.fillRect(SIDEBAR_W, trackY, w - SIDEBAR_W, AXIS_TRACK_H)
          continue
        }

        // Rail timing bar
        const hasTiming = ext.startTime !== ext.endTime
        if (hasTiming) {
          const tMin = Math.min(ext.startTime, ext.endTime)
          const tMax = Math.max(ext.startTime, ext.endTime)
          const x0 = msToX(tMin)
          const x1 = msToX(tMax)
          const barH = AXIS_TRACK_H - 6
          const barY = trackY + 3

          // Bar body
          ctx.fillStyle = color + '44'
          ctx.fillRect(x0, barY, x1 - x0, barH)

          // Bar border
          ctx.strokeStyle = color + 'aa'
          ctx.lineWidth = 1.5
          ctx.strokeRect(x0, barY, x1 - x0, barH)

          // Start/end handles
          const isActive = activeRailAxis === ch
          for (const hx of [x0, x1]) {
            ctx.beginPath()
            ctx.arc(hx, centerY, isActive ? 6 : 4, 0, Math.PI * 2)
            ctx.fillStyle = isActive ? '#ffd633' : color
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
        }

        // Legacy: axis marks circles (backward compat during transition)
        const chMarks = axisMarksData[ch]
        if (!hasTiming && chMarks.length > 0) {
          for (const mark of chMarks) {
            const x = msToX(mark.time)
            if (x >= SIDEBAR_W - 10 && x <= w + 10) {
              const isSelected = mark.id === selectedAxisMarkId && ch === selectedAxisMarkChannel
              ctx.beginPath()
              ctx.arc(x, centerY, isSelected ? 7 : 5, 0, Math.PI * 2)
              ctx.fillStyle = isSelected ? '#ffd633' : color
              ctx.fill()
              ctx.strokeStyle = '#fff'
              ctx.lineWidth = 1.5
              ctx.stroke()
            }
          }
        }
      }
      // Bottom border
      ctx.strokeStyle = colorBorder
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(SIDEBAR_W, Math.round(RULER_H + camAreaH) - 0.5)
      ctx.lineTo(w, Math.round(RULER_H + camAreaH) - 0.5)
      ctx.stroke()
    } else {
      // Unified camera track (legacy)
      const camY = RULER_H + TRACK_H / 2
      ctx.fillStyle = colorSurface2
      ctx.fillRect(SIDEBAR_W, RULER_H, w - SIDEBAR_W, TRACK_H)
      ctx.strokeStyle = colorBorder
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(SIDEBAR_W, Math.round(RULER_H + TRACK_H) - 0.5)
      ctx.lineTo(w, Math.round(RULER_H + TRACK_H) - 0.5)
      ctx.stroke()

      const marks = dt.cameraMarks ?? []
      if (marks.length > 1) {
        ctx.strokeStyle = '#5b4fcf55'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < marks.length; i++) {
          const x = msToX(marks[i].time)
          if (i === 0) ctx.moveTo(x, camY)
          else ctx.lineTo(x, camY)
        }
        ctx.stroke()
      }
      for (const mark of marks) {
        const x = msToX(mark.time)
        if (x >= SIDEBAR_W - 10 && x <= w + 10) {
          const isSelected = mark.id === selectedCameraMarkId
          ctx.beginPath()
          ctx.arc(x, camY, isSelected ? 8 : 6, 0, Math.PI * 2)
          ctx.fillStyle = isSelected ? '#ffd633' : '#5b4fcf'
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
      for (const kf of dt.cameraKeyframes) {
        const x = msToX(kf.time)
        if (x >= SIDEBAR_W - 10 && x <= w + 10) {
          const isSelected = kf.id === selectedCameraKfId
          drawDiamond(ctx, x, camY, isSelected)
        }
      }
    }

    // ── Animations track (lane-based, highest lane at top) ──
    const evtBaseY = RULER_H + camAreaH
    const evtLaneToY = (lane: number) => evtBaseY + (evtTrackCount - 1 - lane) * TRACK_H
    for (let lane = 0; lane < evtTrackCount; lane++) {
      const trackY = evtLaneToY(lane)
      ctx.fillStyle = lane % 2 === 0 ? colorBg : colorSurface2
      ctx.fillRect(SIDEBAR_W, trackY, w - SIDEBAR_W, TRACK_H)
      ctx.strokeStyle = colorBorder
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(SIDEBAR_W, Math.round(trackY + TRACK_H) - 0.5)
      ctx.lineTo(w, Math.round(trackY + TRACK_H) - 0.5)
      ctx.stroke()
    }

    const BUNDLE_COLORS = ['#5b4fcf', '#cf5b4f', '#4fcf5b', '#cf9f4f', '#4f9fcf', '#9f4fcf']
    for (let i = 0; i < dt.eventMarkers.length; i++) {
      const marker = dt.eventMarkers[i]
      const bundle = animationBundles.find((b) => b.id === marker.bundleId)
      if (!bundle) continue
      const bundleDur = Math.max(1, ...bundle.clips.map((c) => c.duration))
      const effectiveDur = marker.durationOverride ?? bundleDur
      const lane = marker.lane ?? 0
      const trackY = evtLaneToY(lane)
      const x = msToX(marker.time)
      const barW = effectiveDur * PX_PER_MS
      const color = BUNDLE_COLORS[i % BUNDLE_COLORS.length]

      const isSelected = marker.id === selectedMarkerId
      const drawBarW = Math.max(barW, 8)

      ctx.fillStyle = isSelected ? color + 'cc' : color + '88'
      ctx.beginPath()
      ctx.roundRect(x, trackY + 4, drawBarW, TRACK_H - 8, 3)
      ctx.fill()

      ctx.strokeStyle = isSelected ? '#fff' : color
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.beginPath()
      ctx.roundRect(x, trackY + 4, drawBarW, TRACK_H - 8, 3)
      ctx.stroke()
      ctx.lineWidth = 1

      if (isSelected) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(x + drawBarW - 3, trackY + 8, 2, TRACK_H - 16)
      }

      ctx.fillStyle = '#fff'
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      const labelX = x + 4
      if (labelX + 20 < x + drawBarW) {
        ctx.fillText(bundle.name, labelX, trackY + TRACK_H / 2 + 3, drawBarW - 8)
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
    if (isDetailView) {
      // Detail view: axis labels
      ctx.font = '500 10px Inter, system-ui, sans-serif'
      for (let ci = 0; ci < AXIS_CHANNELS.length; ci++) {
        const ch = AXIS_CHANNELS[ci]
        ctx.fillStyle = AXIS_COLORS[ch]
        ctx.fillText(AXIS_LABELS[ch], 8, RULER_H + ci * AXIS_TRACK_H + AXIS_TRACK_H / 2 + 4)
      }
    } else if (camTrackCount > 0) {
      // First track gets the section label; additional lanes are unlabelled
      ctx.fillText('Camera', 8, RULER_H + TRACK_H / 2 + 4)
    } else if (showAxisTracks) {
      ctx.font = '500 10px Inter, system-ui, sans-serif'
      for (let ci = 0; ci < AXIS_CHANNELS.length; ci++) {
        const ch = AXIS_CHANNELS[ci]
        ctx.fillStyle = AXIS_COLORS[ch]
        ctx.fillText(AXIS_LABELS[ch], 8, RULER_H + ci * AXIS_TRACK_H + AXIS_TRACK_H / 2 + 4)
      }
    } else {
      ctx.fillText('🎥 Camera', 8, RULER_H + TRACK_H / 2 + 4)
    }
    ctx.fillStyle = sidebarStyle.getPropertyValue('--text-2').trim() || '#aaa'
    ctx.font = '500 11px Inter, system-ui, sans-serif'
    ctx.fillText('Animations', 8, RULER_H + camAreaH + TRACK_H / 2 + 4)
  }, [dt, sceneDuration, directorPlayheadTime, animationBundles, selectedMarkerId, selectedCameraKfId, selectedCameraMarkId, axisMarksData, hasAxisMarks, selectedAxisMarkId, selectedAxisMarkChannel, cameraClips, isDetailView, activeClip, viewDuration, selectedClipId, activeRailAxis, directorRails, hasRailTiming, hasAnyExtendedRail, camTrackCount, camAreaH, evtTrackCount, evtAreaH])

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
        if (selectedAxisMarkId && selectedAxisMarkChannel) {
          removeAxisMark(selectedAxisMarkChannel, selectedAxisMarkId)
          setSelectedAxisMark(null, null)
          e.preventDefault()
        } else if (selectedCameraMarkId) {
          removeCameraMark(selectedCameraMarkId)
          setSelectedCameraMarkId(null)
          e.preventDefault()
        } else if (selectedCameraKfId) {
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
  }, [selectedCameraMarkId, selectedCameraKfId, selectedMarkerId, selectedAxisMarkId, selectedAxisMarkChannel, removeCameraMark, removeCameraKeyframe, removeEventMarker, removeAxisMark, setSelectedCameraMarkId, setSelectedAxisMark])

  // ── Pointer handlers ──
  const xToMs = (clientX: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(viewDuration, (clientX - rect.left - SIDEBAR_W - LEFT_PAD) / PX_PER_MS))
  }

  const EDGE_ZONE = 8  // px from edge for resize handle

  const camLaneToYHit = (lane: number) => RULER_H + (camTrackCount - 1 - lane) * TRACK_H
  const evtLaneToYHit = (lane: number) => RULER_H + camAreaH + (evtTrackCount - 1 - lane) * TRACK_H

  const hitTestCameraClip = (localX: number, localY: number): { clip: CameraClip; edge: 'left' | 'right' | 'body' } | null => {
    if (isDetailView || camTrackCount === 0) return null
    for (const clip of cameraClips) {
      const lane = clip.lane ?? 0
      const trackY = camLaneToYHit(lane)
      if (localY < trackY + 4 || localY >= trackY + TRACK_H - 4) continue
      const x0 = SIDEBAR_W + LEFT_PAD + clip.timelineStart * PX_PER_MS
      const x1 = SIDEBAR_W + LEFT_PAD + (clip.timelineStart + clip.duration) * PX_PER_MS
      if (Math.abs(localX - x0) < EDGE_ZONE) return { clip, edge: 'left' }
      if (Math.abs(localX - x1) < EDGE_ZONE) return { clip, edge: 'right' }
      if (localX > x0 + EDGE_ZONE && localX < x1 - EDGE_ZONE) return { clip, edge: 'body' }
    }
    return null
  }

  const hitTestRailTimingBar = (localX: number, localY: number): { channel: AxisMarkChannel; edge: 'start' | 'end' | 'body' } | null => {
    for (let ci = 0; ci < AXIS_CHANNELS.length; ci++) {
      const ch = AXIS_CHANNELS[ci]
      const ext = directorRails[ch as keyof typeof directorRails] as import('../animation/directorTypes').RailExtents
      if (ext.startTime === ext.endTime) continue
      const trackY = RULER_H + ci * AXIS_TRACK_H
      if (localY < trackY || localY >= trackY + AXIS_TRACK_H) continue
      const tMin = Math.min(ext.startTime, ext.endTime)
      const tMax = Math.max(ext.startTime, ext.endTime)
      const x0 = SIDEBAR_W + LEFT_PAD + tMin * PX_PER_MS
      const x1 = SIDEBAR_W + LEFT_PAD + tMax * PX_PER_MS
      if (Math.abs(localX - x0) < EDGE_ZONE) return { channel: ch, edge: 'start' }
      if (Math.abs(localX - x1) < EDGE_ZONE) return { channel: ch, edge: 'end' }
      if (localX > x0 + EDGE_ZONE && localX < x1 - EDGE_ZONE) return { channel: ch, edge: 'body' }
    }
    return null
  }

  const hitTestAxisMark = (localX: number, localY: number): { channel: AxisMarkChannel; mark: AxisMark } | null => {
    if (!hasAxisMarks) return null
    for (let ci = 0; ci < AXIS_CHANNELS.length; ci++) {
      const ch = AXIS_CHANNELS[ci]
      const trackY = RULER_H + ci * AXIS_TRACK_H
      const centerY = trackY + AXIS_TRACK_H / 2
      if (localY < trackY || localY >= trackY + AXIS_TRACK_H) continue
      for (const mark of axisMarksData[ch]) {
        const mx = SIDEBAR_W + LEFT_PAD + mark.time * PX_PER_MS
        if (Math.abs(localX - mx) < 10 && Math.abs(localY - centerY) < 12) {
          return { channel: ch, mark }
        }
      }
    }
    return null
  }

  const hitTestEventBar = (localX: number, localY: number): { marker: EventMarker; isEdge: boolean } | null => {
    const evtBaseY = RULER_H + camAreaH
    if (localY < evtBaseY || localY >= evtBaseY + evtAreaH) return null
    for (const marker of dt.eventMarkers) {
      const lane = marker.lane ?? 0
      const trackY = evtLaneToYHit(lane)
      if (localY < trackY || localY >= trackY + TRACK_H) continue
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

  const hitTestCameraMark = (localX: number, localY: number): CameraMark | null => {
    const camY = RULER_H + TRACK_H / 2
    if (localY < RULER_H || localY >= RULER_H + TRACK_H) return null
    for (const mark of (dt.cameraMarks ?? [])) {
      const mx = SIDEBAR_W + LEFT_PAD + mark.time * PX_PER_MS
      if (Math.sqrt((localX - mx) ** 2 + (localY - camY) ** 2) < 10) return mark
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

    // Check camera clip hit (clip view only)
    const clipHit = hitTestCameraClip(localX, localY)
    if (clipHit) {
      selectCameraClip(clipHit.clip.id)
      setSelectedMarkerId(null)
      const startVal = clipHit.edge === 'right'
        ? clipHit.clip.timelineStart + clipHit.clip.duration
        : clipHit.clip.timelineStart
      // Snapshot all camera clips so each frame can recompute ripple from a stable baseline
      const snapshot = new Map<string, ClipSnapshot>()
      for (const c of cameraClips) {
        snapshot.set(c.id, { start: c.timelineStart, duration: c.duration, lane: c.lane ?? 0 })
      }
      dragRef.current = {
        type: 'camera-clip',
        id: clipHit.clip.id,
        edge: clipHit.edge,
        mode: clipHit.edge === 'body' ? 'move' : 'resize',
        startX: e.clientX,
        startY: e.clientY,
        startTime: startVal,
        startDuration: clipHit.clip.duration,
        startLane: clipHit.clip.lane ?? 0,
        clipSnapshot: snapshot,
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Check rail timing bar hit first
    const railHit = hitTestRailTimingBar(localX, localY)
    if (railHit) {
      const ext = directorRails[railHit.channel as keyof typeof directorRails] as import('../animation/directorTypes').RailExtents
      const tMin = Math.min(ext.startTime, ext.endTime)
      const tMax = Math.max(ext.startTime, ext.endTime)
      useDirectorStore.getState().setActiveRailAxis(railHit.channel)
      setSelectedCameraMarkId(null)
      setSelectedCameraKfId(null)
      setSelectedMarkerId(null)
      dragRef.current = {
        type: 'rail-timing',
        id: railHit.channel,
        edge: railHit.edge,
        channel: railHit.channel,
        mode: railHit.edge === 'body' ? 'move' : 'resize',
        startX: e.clientX,
        startY: e.clientY,
        startTime: railHit.edge === 'end' ? tMax : tMin,
        startDuration: tMax - tMin,
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Check axis mark hit (legacy per-axis system)
    const axisHit = hitTestAxisMark(localX, localY)
    if (axisHit) {
      setSelectedAxisMark(axisHit.channel, axisHit.mark.id)
      setSelectedCameraMarkId(null)
      setSelectedCameraKfId(null)
      setSelectedMarkerId(null)
      dragRef.current = {
        type: 'axis-mark',
        id: axisHit.mark.id,
        channel: axisHit.channel,
        mode: 'move',
        startX: e.clientX,
        startY: e.clientY,
        startTime: axisHit.mark.time,
        startDuration: 0,
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Check camera mark hit (unified system)
    const markHit = hitTestCameraMark(localX, localY)
    if (markHit) {
      setSelectedCameraMarkId(markHit.id)
      setSelectedAxisMark(null, null)
      setSelectedCameraKfId(null)
      setSelectedMarkerId(null)
      dragRef.current = {
        type: 'camera-mark',
        id: markHit.id,
        mode: 'move',
        startX: e.clientX,
        startY: e.clientY,
        startTime: markHit.time,
        startDuration: 0,
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Check legacy camera keyframe hit
    const camHit = hitTestCameraKf(localX, localY)
    if (camHit) {
      setSelectedCameraKfId(camHit.id)
      setSelectedCameraMarkId(null)
      setSelectedMarkerId(null)
      dragRef.current = {
        type: 'camera-kf',
        id: camHit.id,
        mode: 'move',
        startX: e.clientX,
        startY: e.clientY,
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
      setSelectedCameraMarkId(null)
      dragRef.current = {
        type: 'event',
        id: marker.id,
        mode: isEdge ? 'resize' : 'move',
        startX: e.clientX,
        startY: e.clientY,
        startTime: marker.time,
        startDuration: effectiveDur,
        startLane: marker.lane ?? 0,
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Click on empty area deselects
    setSelectedMarkerId(null)
    setSelectedCameraKfId(null)
    setSelectedCameraMarkId(null)
    setSelectedAxisMark(null, null)

    // Ruler/playhead scrub
    scrubRef.current = true
    const scrubMs = xToMs(e.clientX)
    setDirectorPlayheadTime(isDetailView && activeClip ? scrubMs + activeClip.timelineStart : scrubMs)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  // ── Snap + ripple helpers (camera clip drag) ──

  /** Find the nearest snap candidate to target within thresholdMs. Returns null if none. */
  const snapToCandidates = (
    candidates: readonly number[],
    target: number,
    thresholdMs: number,
  ): { value: number; dist: number } | null => {
    let best: { value: number; dist: number } | null = null
    for (const c of candidates) {
      const d = Math.abs(target - c)
      if (d <= thresholdMs && (best === null || d < best.dist)) {
        best = { value: c, dist: d }
      }
    }
    return best
  }

  /**
   * Compute snap-adjusted left edge for a clip whose left edge is at `proposedLeft`
   * with given duration. Snaps either the left or right edge — whichever is closer
   * to a candidate within threshold. Returns the new left-edge time.
   */
  const snapClipLeftEdge = (
    proposedLeft: number,
    duration: number,
    leftCandidates: readonly number[],
    rightCandidates: readonly number[],
  ): number => {
    const thresholdMs = SNAP_THRESHOLD_PX / PX_PER_MS
    const snapL = snapToCandidates(leftCandidates, proposedLeft, thresholdMs)
    const snapR = snapToCandidates(rightCandidates, proposedLeft + duration, thresholdMs)
    if (snapL && (!snapR || snapL.dist <= snapR.dist)) return snapL.value
    if (snapR) return snapR.value - duration
    return proposedLeft
  }

  /**
   * Apply snap + resolveLane for a camera clip drag or edge resize.
   *
   * Handles three drag kinds in a unified way:
   * - 'move'         — body drag, both left and right edges can snap
   * - 'resize-left'  — left edge moves, right edge fixed at proposedStart + proposedDuration
   * - 'resize-right' — right edge moves, left edge fixed at proposedStart
   *
   * Builds the same-lane snapshot baseline, snaps the active edge(s), runs ripple
   * via resolveLane, then writes a batch update covering all changed clips and
   * resetting any clips on the previous source lane that should no longer be pushed.
   */
  const applyCameraClipDragFrame = (params: {
    draggedId: string
    lane: number
    kind: 'move' | 'resize-left' | 'resize-right'
    proposedStart: number
    proposedDuration: number
    snapshot: Map<string, ClipSnapshot>
  }): void => {
    const { draggedId, lane, kind, proposedStart, proposedDuration, snapshot } = params

    // Build snap candidates from same-lane snapshot clips + 0 + playhead
    const sameLaneOthers: { id: string; snap: ClipSnapshot }[] = []
    for (const [id, s] of snapshot) {
      if (id !== draggedId && s.lane === lane) sameLaneOthers.push({ id, snap: s })
    }
    const leftCandidates: number[] = [0, directorPlayheadTime]
    const rightCandidates: number[] = [0, directorPlayheadTime]
    for (const o of sameLaneOthers) {
      // dragged left edge can snap to others' right edges
      leftCandidates.push(o.snap.start + o.snap.duration)
      // dragged right edge can snap to others' left edges
      rightCandidates.push(o.snap.start)
    }

    const thresholdMs = SNAP_THRESHOLD_PX / PX_PER_MS

    // Snap based on drag kind
    let snappedStart = proposedStart
    let snappedDuration = proposedDuration

    if (kind === 'move') {
      snappedStart = snapClipLeftEdge(proposedStart, proposedDuration, leftCandidates, rightCandidates)
      snappedStart = Math.max(0, snappedStart)
    } else if (kind === 'resize-left') {
      // Right edge fixed; only the left edge snaps to leftCandidates.
      const fixedRight = proposedStart + proposedDuration
      const snap = snapToCandidates(leftCandidates, proposedStart, thresholdMs)
      if (snap) snappedStart = snap.value
      // Clamp left edge: not below 0, not so far right that duration < MIN_CLIP_DURATION_MS
      if (snappedStart < 0) snappedStart = 0
      if (snappedStart > fixedRight - MIN_CLIP_DURATION_MS) snappedStart = fixedRight - MIN_CLIP_DURATION_MS
      snappedDuration = fixedRight - snappedStart
    } else {
      // resize-right: left edge fixed at proposedStart; only the right edge snaps.
      const proposedRight = proposedStart + proposedDuration
      const snap = snapToCandidates(rightCandidates, proposedRight, thresholdMs)
      if (snap) snappedDuration = snap.value - proposedStart
      if (snappedDuration < MIN_CLIP_DURATION_MS) snappedDuration = MIN_CLIP_DURATION_MS
    }

    // Resolve ripple on target lane
    const laneClips: LaneClip[] = sameLaneOthers.map((o) => ({
      id: o.id, start: o.snap.start, duration: o.snap.duration,
    }))
    laneClips.push({ id: draggedId, start: snappedStart, duration: snappedDuration })
    const { positions, constrainedStart } = resolveLane(laneClips, draggedId, snappedStart, snappedDuration)

    // Determine final dragged-clip placement.
    // - move: use constrainedStart, duration unchanged
    // - resize-left: re-shrink duration if constrainedStart shifted right (right edge stays fixed)
    // - resize-right: ignore constrainedStart, left edge must remain fixed
    let finalStart = constrainedStart
    let finalDuration = snappedDuration
    if (kind === 'resize-left') {
      const fixedRight = proposedStart + proposedDuration
      finalDuration = Math.max(MIN_CLIP_DURATION_MS, fixedRight - finalStart)
    } else if (kind === 'resize-right') {
      finalStart = snappedStart
    }

    // Enforce zero-coverage invariant in the UI so the store doesn't silently reject.
    // If the dragged clip was at 0 and would leave 0 with no other clip filling it,
    // snap finalStart back to 0 (and adjust resize-left duration accordingly).
    const draggedSnap = snapshot.get(draggedId)
    if (draggedSnap && draggedSnap.start === 0 && finalStart > 0) {
      let othersCoverZero = false
      for (const [id, s] of snapshot) {
        if (id === draggedId) continue
        const rippled = s.lane === lane ? positions.get(id) : undefined
        const newStart = rippled ?? s.start
        if (newStart === 0) { othersCoverZero = true; break }
      }
      if (!othersCoverZero) {
        finalStart = 0
        if (kind === 'resize-left') {
          const fixedRight = proposedStart + proposedDuration
          finalDuration = Math.max(MIN_CLIP_DURATION_MS, fixedRight - finalStart)
        }
      }
    }

    // Build batch: reset every non-dragged clip to its snapshot, then overwrite
    // target-lane changes from ripple. This guarantees the previous source lane
    // (if dragged just crossed lanes) is reverted in the same frame.
    const patches: { id: string; patch: Partial<CameraClip> }[] = []
    for (const [id, snap] of snapshot) {
      if (id === draggedId) continue
      const rippled = snap.lane === lane ? positions.get(id) : undefined
      const newStart = rippled ?? snap.start
      patches.push({ id, patch: { timelineStart: newStart } })
    }
    const draggedPatch: Partial<CameraClip> = { timelineStart: finalStart, lane }
    if (kind !== 'move') draggedPatch.duration = finalDuration
    patches.push({ id: draggedId, patch: draggedPatch })
    updateCameraClipsBatch(patches)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX
      const dtMs = dx / PX_PER_MS
      if (dragRef.current.type === 'camera-clip') {
        const snapshot = dragRef.current.clipSnapshot
        const draggedSnap = snapshot?.get(dragRef.current.id)
        if (snapshot && draggedSnap) {
          if (dragRef.current.edge === 'body') {
            // Vertical drag → lane change (reversed: up = higher lane)
            const dy = e.clientY - dragRef.current.startY
            const laneDelta = -Math.round(dy / TRACK_H)
            const newLane = Math.max(0, draggedSnap.lane + laneDelta)
            const proposedStart = Math.round(draggedSnap.start + dtMs)
            applyCameraClipDragFrame({
              draggedId: dragRef.current.id,
              lane: newLane,
              kind: 'move',
              proposedStart,
              proposedDuration: draggedSnap.duration,
              snapshot,
            })
          } else if (dragRef.current.edge === 'left') {
            // Resize from left: right edge fixed at original right
            const fixedRight = draggedSnap.start + draggedSnap.duration
            let proposedStart = Math.round(draggedSnap.start + dtMs)
            if (proposedStart < 0) proposedStart = 0
            if (proposedStart > fixedRight - MIN_CLIP_DURATION_MS) {
              proposedStart = fixedRight - MIN_CLIP_DURATION_MS
            }
            applyCameraClipDragFrame({
              draggedId: dragRef.current.id,
              lane: draggedSnap.lane,
              kind: 'resize-left',
              proposedStart,
              proposedDuration: fixedRight - proposedStart,
              snapshot,
            })
          } else if (dragRef.current.edge === 'right') {
            // Resize from right: left edge fixed at original start
            const proposedDuration = Math.max(
              MIN_CLIP_DURATION_MS,
              Math.round(draggedSnap.duration + dtMs),
            )
            applyCameraClipDragFrame({
              draggedId: dragRef.current.id,
              lane: draggedSnap.lane,
              kind: 'resize-right',
              proposedStart: draggedSnap.start,
              proposedDuration,
              snapshot,
            })
          }
        }
      } else if (dragRef.current.type === 'rail-timing' && dragRef.current.channel) {
        const { setRailTiming } = useDirectorStore.getState()
        const ext = directorRails[dragRef.current.channel as keyof typeof directorRails] as import('../animation/directorTypes').RailExtents
        const clamp = (v: number) => Math.max(0, Math.min(viewDuration, Math.round(v)))
        if (dragRef.current.edge === 'start') {
          const newStart = clamp(dragRef.current.startTime + dtMs)
          setRailTiming(dragRef.current.channel, newStart, ext.endTime)
        } else if (dragRef.current.edge === 'end') {
          const newEnd = clamp(dragRef.current.startTime + dtMs)
          setRailTiming(dragRef.current.channel, ext.startTime, newEnd)
        } else {
          // body drag — move both, preserve duration
          const newStart = clamp(dragRef.current.startTime + dtMs)
          const newEnd = clamp(newStart + dragRef.current.startDuration)
          setRailTiming(dragRef.current.channel, newStart, newEnd)
        }
      } else if (dragRef.current.type === 'axis-mark' && dragRef.current.channel) {
        const newTime = Math.max(0, Math.min(sceneDuration, dragRef.current.startTime + dtMs))
        updateAxisMark(dragRef.current.channel, dragRef.current.id, { time: Math.round(newTime) })
      } else if (dragRef.current.type === 'camera-mark') {
        const newTime = Math.max(0, Math.min(sceneDuration, dragRef.current.startTime + dtMs))
        updateCameraMark(dragRef.current.id, { time: Math.round(newTime) })
      } else if (dragRef.current.type === 'camera-kf') {
        const newTime = Math.max(0, Math.min(sceneDuration, dragRef.current.startTime + dtMs))
        updateCameraKeyframe(dragRef.current.id, { time: Math.round(newTime) })
      } else if (dragRef.current.mode === 'move') {
        const newTime = Math.max(0, Math.min(sceneDuration, dragRef.current.startTime + dtMs))
        // Vertical drag → lane change for event markers
        const dy = e.clientY - dragRef.current.startY
        const laneDelta = -Math.round(dy / TRACK_H)
        const newLane = Math.max(0, (dragRef.current.startLane ?? 0) + laneDelta)
        updateEventMarker(dragRef.current.id, { time: Math.round(newTime), lane: newLane })
      } else {
        const newDur = Math.max(50, dragRef.current.startDuration + dtMs)
        updateEventMarker(dragRef.current.id, { durationOverride: Math.round(newDur) })
      }
      return
    }
    if (scrubRef.current) {
      const scrubMs = xToMs(e.clientX)
      setDirectorPlayheadTime(isDetailView && activeClip ? scrubMs + activeClip.timelineStart : scrubMs)
      return
    }

    // Cursor feedback on hover
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top
    const clipHover = hitTestCameraClip(localX, localY)
    const markHover = hitTestCameraMark(localX, localY)
    const camHit = hitTestCameraKf(localX, localY)
    const evtHit = hitTestEventBar(localX, localY)
    if (clipHover && (clipHover.edge === 'left' || clipHover.edge === 'right')) {
      canvas.style.cursor = 'ew-resize'
    } else if (clipHover) {
      canvas.style.cursor = 'grab'
    } else if (markHover || camHit) {
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

    // Double-click camera clip → enter detail view
    if (!isDetailView) {
      const clipHit = hitTestCameraClip(localX, localY)
      if (clipHit) {
        enterClipDetail(clipHit.clip.id)
        return
      }
    }

    // Double-click event bar → enter bundle editing (use hitTestEventBar for lane support)
    const evtHit = hitTestEventBar(localX, localY)
    if (evtHit) {
      onSwitchToBundle(evtHit.marker.bundleId)
      return
    }
  }

  // ── Actions ──
  const handleFocalLengthChange = (mm: number) => {
    setFocalLengthMm(mm)
  }

  const handleSaveView = () => {
    useDirectorStore.getState().stampRailTime()
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
    const bundle = animationBundles.find((b) => b.id === bundleId)
    const bundleDur = bundle ? Math.max(1, ...bundle.clips.map((c) => c.duration)) : 1000
    const existingItems = dt.eventMarkers.map((m) => {
      const b = animationBundles.find((ab) => ab.id === m.bundleId)
      const dur = m.durationOverride ?? (b ? Math.max(1, ...b.clips.map((c) => c.duration)) : 1000)
      return { time: m.time, duration: dur, lane: m.lane }
    })
    const lane = assignLane(existingItems, Math.round(directorPlayheadTime), bundleDur)
    const marker: EventMarker = {
      id: nanoid(),
      time: Math.round(directorPlayheadTime),
      bundleId,
      lane,
    }
    addEventMarker(marker)
  }

  const handlePlayPause = () => {
    if (directorPlaying) { stopPlaying(); return }
    // If playhead is at or past the end, reset to 0 before playing
    if (directorPlayheadTime >= viewDuration - 1) {
      setDirectorPlayheadTime(0)
    }
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
    useDirectorStore.setState({ exporting: true })

    const rs = useRenderSettings.getState()

    const exporter = createVideoExporter(
      renderer.canvas,
      (w, h) => renderer.resize(w, h),
      (timeMs) => {
        const state = useChoanStore.getState()
        const dirState = useDirectorStore.getState()
        const clips = dt.cameraClips ?? []

        // Camera — clips > railAnimation > axisMarks > cameraMarks > legacy keyframes
        const activeClipForFrame = clips.length > 0 ? findActiveClip(clips, timeMs) : null

        let camState: ReturnType<typeof evaluateRailAnimation> = null
        if (activeClipForFrame) {
          const localTime = Math.max(0, Math.min(activeClipForFrame.duration, timeMs - activeClipForFrame.timelineStart))
          camState = evaluateRailAnimation(
            activeClipForFrame.cameraSetup.rails,
            localTime,
            activeClipForFrame.cameraSetup.railWorldAnchor,
            activeClipForFrame.cameraSetup.targetPos,
            activeClipForFrame.focalLengthMm,
            dirState.directorTargetMode,
            activeClipForFrame.cameraSetup.cameraPos,
          )
        } else {
          const exportHasRailAnim = hasActiveRailTiming(dirState.directorRails)
          const exportAxisData = ensureAxisMarks(dt).axisMarks
          const exportHasAxis = !exportHasRailAnim && Object.values(exportAxisData).some((arr) => arr.length > 0)
          const exportHasMarks = (dt.cameraMarks?.length ?? 0) > 0
          camState = exportHasRailAnim
            ? evaluateRailAnimation(dirState.directorRails, timeMs, dirState.railWorldAnchor, dirState.directorTargetPos, dirState.focalLengthMm, dirState.directorTargetMode, dirState.directorCameraPos)
            : exportHasAxis
              ? evaluateAxisMarks(exportAxisData, timeMs, dirState.railWorldAnchor, dirState.directorTargetPos, dirState.focalLengthMm, dirState.directorRails)
              : exportHasMarks
                ? evaluateCameraMarks(dt.cameraMarks, timeMs, dirState.directorRails)
                : evaluateDirectorCamera(dt.cameraKeyframes, timeMs)
        }
        if (camState) {
          renderer.camera.position[0] = camState.position[0]
          renderer.camera.position[1] = camState.position[1]
          renderer.camera.position[2] = camState.position[2]
          renderer.camera.target[0] = camState.target[0]
          renderer.camera.target[1] = camState.target[1]
          renderer.camera.target[2] = camState.target[2]
          renderer.camera.fov = camState.fov
        }

        // Animation events — always top-level at absolute time
        const activeEvents = evaluateDirectorEvents(dt.eventMarkers, timeMs, state.animationBundles)
        const activeBundles = activeEvents.map((e) => ({ bundle: e.bundle, localTime: e.localTime }))
        const animated = activeBundles.length > 0
          ? evaluateBundles(state.elements, activeBundles)
          : state.elements

        renderer.updateScene(applyMultiSelectTint(animated, []), rs.extrudeDepth)
        renderer.applyPendingResize()
        renderer.renderPipeline(rs)

        // Bokeh DoF — focus at camera target distance
        const cam = renderer.camera
        const ddx = cam.position[0] - cam.target[0]
        const ddy = cam.position[1] - cam.target[1]
        const ddz = cam.position[2] - cam.target[2]
        const focusDist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz)
        renderer.applyDoF({ focusDist, aperture: 25.0, maxBlurPx: 40 })

        renderer.blitAndOverlay()
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
      useDirectorStore.setState({ exporting: false })
      setExportDialogOpen(false)
    }).catch(() => {
      setExporting(false)
      useDirectorStore.setState({ exporting: false })
    })
  }

  const bundleOptions = animationBundles.map((b) => ({ value: b.id, label: b.name }))

  return (
    <div className="ui-director-panel">
      {/* Header */}
      <div className="ui-director-header">
        {/* Camera selector */}
        {cameras.length > 1 && (
          <Select
            options={cameras.map((c) => ({ value: c.id, label: c.name }))}
            value={selectedCameraId ?? ''}
            onChange={(id) => selectCamera(id)}
            size="sm"
          />
        )}
        <Tooltip content="Add camera">
          <Button className="btn-small" onClick={() => addCamera()}>
            <Plus size={14} /> Cam
          </Button>
        </Tooltip>
        {cameras.length > 1 && selectedCameraId && (
          <Tooltip content="Remove selected camera">
            <Button className="btn-small" onClick={() => removeCamera(selectedCameraId)}>
              <Trash size={14} />
            </Button>
          </Tooltip>
        )}
        <div className="timeline-separator" />
        {isDetailView ? (
          <>
            <Tooltip content="Back to clip view">
              <Button className="btn-small" onClick={() => exitClipDetail()}>
                <ArrowLeft size={14} /> Back
              </Button>
            </Tooltip>
            <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 8, opacity: 0.7 }}>
              {activeClip?.name ?? 'Camera'}
            </span>
            <div className="timeline-separator" />
          </>
        ) : (
          <>
            <Tooltip content="Add camera clip">
              <Button className="btn-small" onClick={() => addCameraClip()}>
                <Plus size={14} /> Clip
              </Button>
            </Tooltip>
            <div className="timeline-separator" />
          </>
        )}
        <Tooltip content={directorPlaying ? 'Pause' : 'Play'}>
          <Button className="btn-small" onClick={handlePlayPause}>
            {directorPlaying ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
          </Button>
        </Tooltip>
        <Tooltip content="Stop">
          <Button className="btn-small" onClick={handleStop}><Stop size={14} weight="fill" /></Button>
        </Tooltip>
        <Tooltip content="Reset all director state">
          <Button className="btn-small" onClick={resetDirector}><ArrowCounterClockwise size={14} /></Button>
        </Tooltip>
        {isDetailView && (
          <>
            <div className="timeline-separator" />
            <Tooltip content="Stamp rail timing at current playhead">
              <Button className="btn-small" onClick={handleSaveView}><Camera size={14} /> Stamp</Button>
            </Tooltip>
          </>
        )}
        <Select
          options={CAMERA_PRESET_OPTIONS}
          value=""
          onChange={handleApplyPreset}
          placeholder="Preset"
          size="sm"
        />
        <div className="timeline-separator" />
        <Select
          options={VIEWFINDER_ASPECT_OPTIONS}
          value={viewfinderAspect}
          onChange={setViewfinderAspect}
          size="sm"
        />
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
        <Tooltip content={directorTargetMode === 'locked' ? 'Target: Locked (follows camera)' : 'Target: Fixed'}>
          <Button className="btn-small" active={directorTargetMode === 'locked'} disabled={!selectedCameraId} onClick={toggleDirectorTargetMode}>
            <LinkSimple size={14} />
          </Button>
        </Tooltip>
        <Tooltip content="Frustum Spotlight (Q)">
          <Button className="btn-small" active={frustumSpotlightOn && selectedCameraId !== null} disabled={!selectedCameraId} onClick={toggleFrustumSpotlight}>
            <Screencast size={14} />
          </Button>
        </Tooltip>
        <div className="timeline-separator" />
        {bundleOptions.length > 0 && (
          <Select
            options={bundleOptions}
            value=""
            onChange={handleAddEvent}
            placeholder="+ Animation"
            size="sm"
          />
        )}
        <div className="timeline-separator" />
        <Tooltip content="Export Video">
          <Button className="btn-small" onClick={() => setExportDialogOpen(true)}><Export size={14} /></Button>
        </Tooltip>
        <span className="ui-director-time">{((isDetailView && activeClip ? directorPlayheadTime - activeClip.timelineStart : directorPlayheadTime) / 1000).toFixed(1)}s / {(viewDuration / 1000).toFixed(1)}s</span>
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
        duration={viewDuration}
      />
    </div>
  )
}

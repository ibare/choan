// Canvas 2D engine + pointer interactions for the timeline.
// Owns: canvas init/render, all pointer handlers, keyframe editing, easing popover.

import { useState, useRef, useEffect, useCallback } from 'react'
import { createTimeline2D, type Timeline2D, type DisplayLayer, type RenderOptions } from '../engine/timeline2d'
import type { AnimationClip, AnimatableProperty, EasingType } from '../animation/types'
import { DisplayClipEntry, PX_PER_MS } from './timelineTypes'
import EasingPopover from './EasingPopover'
import KfValueEditor from './KfValueEditor'

interface TimelineCanvasProps {
  displayClips: DisplayClipEntry[]
  displayLayers: DisplayLayer[]
  renderOptions: RenderOptions
  scrollX: number
  onPlayheadChange: (time: number) => void
  onMutateClip: (clipId: string, bundleId: string | undefined, patch: Partial<AnimationClip>) => void
  onScrollX: (delta: number) => void
  canvasWrapRef: React.RefObject<HTMLDivElement | null>
}

export default function TimelineCanvas({
  displayClips, displayLayers, renderOptions, scrollX,
  onPlayheadChange, onMutateClip, onScrollX, canvasWrapRef,
}: TimelineCanvasProps) {
  const tl2dRef = useRef<Timeline2D | null>(null)
  const dragRef = useRef<{
    layerIdx: number; trackIdx: number; kfIdx: number
    startX: number; startTime: number; bundleId?: string
  } | null>(null)
  const scrubRef = useRef(false)

  const [hoverKf, setHoverKf] = useState<{ layerIdx: number; trackIdx: number; kfIdx: number } | null>(null)
  const [selectedKf, setSelectedKf] = useState<{
    layerIdx: number; trackIdx: number; kfIdx: number
    screenX: number; screenY: number
  } | null>(null)
  const [editingKf, setEditingKf] = useState<{
    clipId: string; trackIdx: number; kfIdx: number; value: string; bundleId?: string
  } | null>(null)

  // ── Canvas init ──
  useEffect(() => {
    const wrap = canvasWrapRef.current
    if (!wrap) return
    const tl = createTimeline2D(wrap)
    tl2dRef.current = tl
    const ro = new ResizeObserver(() => tl.resize(wrap.clientWidth, wrap.clientHeight))
    ro.observe(wrap)
    tl.resize(wrap.clientWidth, wrap.clientHeight)
    return () => { ro.disconnect(); tl.dispose(); tl2dRef.current = null }
  }, [])

  // Re-render canvas on every state/prop change
  useEffect(() => {
    tl2dRef.current?.render(displayLayers, { ...renderOptions, hoverKf })
  })

  // ── Edit commit ──
  const handleEditCommit = () => {
    if (!editingKf) return
    const entry = displayClips.find((c) => c.clip.id === editingKf.clipId)
    if (!entry) return
    const prop = entry.clip.tracks[editingKf.trackIdx].property as AnimatableProperty
    const val = prop === 'color'
      ? (parseInt(editingKf.value.replace('#', ''), 16) || 0)
      : (parseFloat(editingKf.value) || 0)
    const newTracks = entry.clip.tracks.map((t, i) =>
      i === editingKf.trackIdx
        ? { ...t, keyframes: t.keyframes.map((kf, ki) => ki === editingKf.kfIdx ? { ...kf, value: val } : kf) }
        : t,
    )
    onMutateClip(editingKf.clipId, editingKf.bundleId, { tracks: newTracks })
    setEditingKf(null)
  }

  // ── Easing change ──
  const handleEasingChange = (easingType: EasingType) => {
    if (!selectedKf) return
    const entry = displayClips[selectedKf.layerIdx]
    if (!entry) return
    const newTracks = entry.clip.tracks.map((t, i) =>
      i === selectedKf.trackIdx
        ? { ...t, keyframes: t.keyframes.map((kf, ki) => ki === selectedKf.kfIdx ? { ...kf, easing: easingType } : kf) }
        : t,
    )
    onMutateClip(entry.clip.id, entry.bundleId, { tracks: newTracks })
    setSelectedKf(null)
  }

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    const tl = tl2dRef.current
    if (!tl) return
    const rect = tl.canvas.getBoundingClientRect()
    const hit = tl.hitTest(e.clientX - rect.left, e.clientY - rect.top, displayLayers, renderOptions)

    if (hit.type === 'ruler') {
      onPlayheadChange(hit.time)
      scrubRef.current = true
      tl.canvas.setPointerCapture(e.pointerId)
      return
    }
    if (hit.type === 'keyframe') {
      const entry = displayClips[hit.layerIdx]
      if (!entry) return
      const kf = entry.clip.tracks[hit.trackIdx].keyframes[hit.kfIdx]
      dragRef.current = { layerIdx: hit.layerIdx, trackIdx: hit.trackIdx, kfIdx: hit.kfIdx, startX: e.clientX, startTime: kf.time, bundleId: entry.bundleId }
      const panelRect = canvasWrapRef.current?.getBoundingClientRect()
      const canvasRect = tl.canvas.getBoundingClientRect()
      setSelectedKf({
        layerIdx: hit.layerIdx, trackIdx: hit.trackIdx, kfIdx: hit.kfIdx,
        screenX: e.clientX - (panelRect?.left ?? canvasRect.left),
        screenY: e.clientY - (panelRect?.top ?? canvasRect.top),
      })
      tl.canvas.setPointerCapture(e.pointerId)
      e.stopPropagation()
      return
    }
    if (hit.type === 'track') {
      const entry = displayClips[hit.layerIdx]
      if (!entry) return
      const track = entry.clip.tracks[hit.trackIdx]
      if (track.keyframes.some((kf) => Math.abs(kf.time - hit.time) < 10)) return
      const sorted = [...track.keyframes].sort((a, b) => a.time - b.time)
      let value = 0
      if (sorted.length === 0) {
        value = 0
      } else if (hit.time <= sorted[0].time) {
        value = sorted[0].value
      } else if (hit.time >= sorted[sorted.length - 1].time) {
        value = sorted[sorted.length - 1].value
      } else {
        for (let i = 0; i < sorted.length - 1; i++) {
          if (hit.time >= sorted[i].time && hit.time <= sorted[i + 1].time) {
            const t = (hit.time - sorted[i].time) / (sorted[i + 1].time - sorted[i].time)
            value = sorted[i].value + (sorted[i + 1].value - sorted[i].value) * t
            if (track.property === 'color') value = Math.round(value)
            break
          }
        }
      }
      const newKfs = [...track.keyframes, { time: hit.time, value }].sort((a, b) => a.time - b.time)
      const newTracks = entry.clip.tracks.map((t, i) => i === hit.trackIdx ? { ...t, keyframes: newKfs } : t)
      const dur = Math.max(...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
      onMutateClip(entry.clip.id, entry.bundleId, { tracks: newTracks, duration: dur })
    }
  }, [displayClips, displayLayers, renderOptions, onPlayheadChange, onMutateClip])

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const tl = tl2dRef.current
    if (!tl) return
    if (scrubRef.current) {
      const x = e.clientX - tl.canvas.getBoundingClientRect().left
      onPlayheadChange(Math.max(0, Math.round((x + scrollX) / PX_PER_MS)))
      return
    }
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX
      const newTime = Math.max(0, Math.round((dragRef.current.startTime * PX_PER_MS + dx) / PX_PER_MS))
      const entry = displayClips[dragRef.current.layerIdx]
      if (!entry) return
      const newTracks = entry.clip.tracks.map((track, ti) => {
        if (ti !== dragRef.current!.trackIdx) return track
        const newKfs = track.keyframes.map((kf, ki) => ki === dragRef.current!.kfIdx ? { ...kf, time: newTime } : kf)
        return { ...track, keyframes: [...newKfs].sort((a, b) => a.time - b.time) }
      })
      const dur = Math.max(...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
      onMutateClip(entry.clip.id, entry.bundleId, { tracks: newTracks, duration: dur })
      return
    }
    const rect = tl.canvas.getBoundingClientRect()
    const hit = tl.hitTest(e.clientX - rect.left, e.clientY - rect.top, displayLayers, renderOptions)
    if (hit.type === 'keyframe') {
      setHoverKf({ layerIdx: hit.layerIdx, trackIdx: hit.trackIdx, kfIdx: hit.kfIdx })
      tl.canvas.style.cursor = 'ew-resize'
    } else {
      setHoverKf(null)
      tl.canvas.style.cursor = hit.type === 'track' ? 'crosshair' : 'default'
    }
  }, [displayClips, displayLayers, renderOptions, scrollX, onPlayheadChange, onMutateClip])

  const handleCanvasPointerUp = useCallback(() => { dragRef.current = null; scrubRef.current = false }, [])

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    const tl = tl2dRef.current
    if (!tl) return
    const rect = tl.canvas.getBoundingClientRect()
    const hit = tl.hitTest(e.clientX - rect.left, e.clientY - rect.top, displayLayers, renderOptions)
    if (hit.type === 'keyframe') {
      const entry = displayClips[hit.layerIdx]
      if (!entry) return
      const kf = entry.clip.tracks[hit.trackIdx].keyframes[hit.kfIdx]
      const prop = entry.clip.tracks[hit.trackIdx].property as AnimatableProperty
      const display = prop === 'color' ? kf.value.toString(16).padStart(6, '0') : String(Math.round(kf.value * 100) / 100)
      setEditingKf({ clipId: entry.clip.id, trackIdx: hit.trackIdx, kfIdx: hit.kfIdx, value: display, bundleId: entry.bundleId })
    }
  }, [displayClips, displayLayers, renderOptions])

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const tl = tl2dRef.current
    if (!tl) return
    const rect = tl.canvas.getBoundingClientRect()
    const hit = tl.hitTest(e.clientX - rect.left, e.clientY - rect.top, displayLayers, renderOptions)
    if (hit.type === 'keyframe') {
      const entry = displayClips[hit.layerIdx]
      if (!entry || entry.clip.tracks[hit.trackIdx].keyframes.length <= 2) return
      const newTracks = entry.clip.tracks.map((t, i) =>
        i === hit.trackIdx ? { ...t, keyframes: t.keyframes.filter((_, ki) => ki !== hit.kfIdx) } : t,
      )
      onMutateClip(entry.clip.id, entry.bundleId, { tracks: newTracks, duration: Math.max(...newTracks.flatMap((t) => t.keyframes.map((k) => k.time))) })
    }
  }, [displayClips, displayLayers, renderOptions, onMutateClip])

  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    onScrollX(e.deltaX + e.deltaY)
  }, [onScrollX])

  return (
    <>
      <div
        className="timeline-canvas-wrap"
        ref={canvasWrapRef as React.RefObject<HTMLDivElement>}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onDoubleClick={handleCanvasDoubleClick}
        onContextMenu={handleCanvasContextMenu}
        onWheel={handleCanvasWheel}
      />
      {selectedKf && (
        <EasingPopover
          {...selectedKf}
          displayClips={displayClips}
          onSelect={handleEasingChange}
          onClose={() => setSelectedKf(null)}
        />
      )}
      {editingKf && (
        <KfValueEditor
          {...editingKf}
          displayClips={displayClips}
          onChange={(value) => setEditingKf({ ...editingKf, value })}
          onCommit={handleEditCommit}
          onClose={() => setEditingKf(null)}
        />
      )}
    </>
  )
}

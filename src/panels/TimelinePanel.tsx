// Animation Timeline Panel — Canvas 2D engine + DOM sidebar hybrid
// Right side: Canvas 2D renders ruler, track bars, keyframe diamonds, playhead
// Left side: DOM renders layer labels, property dropdowns, remove buttons

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import { createTimeline2D, type Timeline2D, type DisplayLayer, type RenderOptions, type TimelineHit } from '../engine/timeline2d'
import type { AnimationClip, AnimationBundle, AnimatableProperty, EasingType } from '../animation/types'
import type { KeyframeAnimator } from '../animation/keyframeEngine'
import type { ChoanElement } from '../store/useChoanStore'
import { nanoid } from '../canvas/nanoid'
import { Play, Pause, Stop, Plus, X } from '@phosphor-icons/react'

const TRACK_HEIGHT = 38
const LEFT_WIDTH = 190
const RULER_HEIGHT = 30
const LAYER_HEADER_HEIGHT = 24
const INDENT_PX = 16
const PX_PER_MS = 0.8

const ANIMATABLE_PROPERTIES: AnimatableProperty[] = [
  'x', 'y', 'width', 'height', 'opacity', 'color', 'radius',
]

function getPropertyValue(el: ChoanElement, prop: AnimatableProperty): number {
  switch (prop) {
    case 'x': return el.x
    case 'y': return el.y
    case 'width': return el.width
    case 'height': return el.height
    case 'opacity': return el.opacity
    case 'color': return el.color ?? 0xe6f8f0
    case 'radius': return el.radius ?? 0
  }
}

// Build hierarchy-ordered list with depth for indentation
function buildLayerTree(elements: ChoanElement[]): Array<{ el: ChoanElement; depth: number }> {
  const result: Array<{ el: ChoanElement; depth: number }> = []
  const childMap = new Map<string, ChoanElement[]>()
  for (const el of elements) {
    const key = el.parentId ?? '__root__'
    if (!childMap.has(key)) childMap.set(key, [])
    childMap.get(key)!.push(el)
  }
  function walk(parentKey: string, depth: number) {
    const children = childMap.get(parentKey) ?? []
    for (const child of children) {
      result.push({ el: child, depth })
      walk(child.id, depth + 1)
    }
  }
  walk('__root__', 0)
  return result
}

function formatValue(prop: AnimatableProperty, value: number | undefined): string {
  if (value === undefined) return '?'
  if (prop === 'color') return `#${value.toString(16).padStart(6, '0')}`
  if (prop === 'opacity' || prop === 'radius') return value.toFixed(2)
  return String(Math.round(value))
}

interface TimelinePanelProps {
  visible: boolean
  height?: number
}

// Shared display clip structure used by both DOM sidebar and Canvas
interface DisplayClipEntry {
  clip: AnimationClip
  label: string
  depth: number
  bundleId?: string
}

export default function TimelinePanel({ visible, height }: TimelinePanelProps) {
  const {
    elements, animationClips, animationBundles,
    addAnimationClip, updateAnimationClip,
    addAnimationBundle, updateAnimationBundle, removeAnimationBundle,
    addClipToBundle, updateClipInBundle, removeClipFromBundle,
  } = useChoanStore()
  const { previewState, play, pause, stop, playheadTime, setPlayheadTime, editingBundleId, setEditingBundle } = usePreviewStore()

  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null)
  const [editingBundleName, setEditingBundleName] = useState<string | null>(null)
  const [bundleNameDraft, setBundleNameDraft] = useState('')
  const [editingKf, setEditingKf] = useState<{
    clipId: string; trackIdx: number; kfIdx: number; value: string; bundleId?: string
  } | null>(null)
  const [scrollX, setScrollX] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [hoverKf, setHoverKf] = useState<{ layerIdx: number; trackIdx: number; kfIdx: number } | null>(null)
  const [selectedKf, setSelectedKf] = useState<{
    layerIdx: number; trackIdx: number; kfIdx: number
    screenX: number; screenY: number // for popover positioning
  } | null>(null)

  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const tl2dRef = useRef<Timeline2D | null>(null)
  const dragRef = useRef<{
    layerIdx: number; trackIdx: number; kfIdx: number
    startX: number; startTime: number; bundleId?: string
  } | null>(null)
  const scrubRef = useRef(false)

  if (!visible) return null

  // ── Create animation bundle with all elements ──
  const handleCreateBundle = () => {
    const layerTree = buildLayerTree(elements)
    const clips: AnimationClip[] = layerTree.map(({ el }) => ({
      id: nanoid(),
      elementId: el.id,
      duration: 300,
      easing: 'ease' as const,
      tracks: [],
    }))
    const bundle: AnimationBundle = {
      id: nanoid(),
      name: `Animation ${animationBundles.length + 1}`,
      clips,
    }
    addAnimationBundle(bundle)
    setSelectedBundleId(bundle.id)
    setEditingBundle(bundle.id)
  }

  // ── Build display clips ──
  let displayClips: DisplayClipEntry[] = []

  // Auto-select first bundle if none selected
  const activeBundleId = selectedBundleId && animationBundles.some((b) => b.id === selectedBundleId)
    ? selectedBundleId
    : animationBundles[0]?.id ?? null

  if (activeBundleId) {
    const bundle = animationBundles.find((b) => b.id === activeBundleId)
    if (bundle) {
      const layerTree = buildLayerTree(elements)
      for (const { el, depth } of layerTree) {
        const clip = bundle.clips.find((c) => c.elementId === el.id)
        if (clip) {
          displayClips.push({ clip, label: el.label, depth, bundleId: bundle.id })
        }
      }
    }
  }

  const maxDuration = Math.max(300, ...displayClips.map((c) => c.clip.duration))

  // ── Convert to DisplayLayer for engine ──
  const displayLayers: DisplayLayer[] = displayClips.map((entry) => ({
    clipId: entry.clip.id,
    label: entry.label,
    tracks: entry.clip.tracks.map((t) => ({
      property: t.property,
      keyframes: [...t.keyframes].sort((a, b) => a.time - b.time),
    })),
  }))

  const renderOptions: RenderOptions = {
    scrollX,
    scrollY,
    pxPerMs: PX_PER_MS,
    rulerHeight: RULER_HEIGHT,
    trackHeight: TRACK_HEIGHT,
    layerHeaderHeight: LAYER_HEADER_HEIGHT,
    maxDuration,
    hoverKf,
    playheadTime: editingBundleId ? playheadTime : null,
  }

  // ── Add track to a clip ──
  const handleAddTrack = (bundleId: string, clipId: string, property: AnimatableProperty) => {
    const bundle = animationBundles.find((b) => b.id === bundleId)
    if (!bundle) return
    const clip = bundle.clips.find((c) => c.id === clipId)
    if (!clip) return
    if (clip.tracks.some((t) => t.property === property)) return
    const el = elements.find((e) => e.id === clip.elementId)
    const currentValue = el ? getPropertyValue(el, property) : 0
    updateClipInBundle(bundleId, clipId, {
      tracks: [...clip.tracks, {
        property,
        keyframes: [
          { time: 0, value: currentValue },
          { time: clip.duration, value: currentValue },
        ],
      }],
    })
  }

  // ── Clip mutation helper ──
  function mutateClip(clipId: string, bundleId: string | undefined, patch: Partial<AnimationClip>) {
    if (bundleId) {
      updateClipInBundle(bundleId, clipId, patch)
    } else {
      const existing = animationClips.find((c) => c.id === clipId)
      if (!existing) {
        const entry = displayClips.find((c) => c.clip.id === clipId)
        if (entry) addAnimationClip(entry.clip)
      }
      updateAnimationClip(clipId, patch)
    }
  }

  // ── Canvas pointer events ──
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    const tl = tl2dRef.current
    if (!tl) return
    const rect = tl.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hit = tl.hitTest(x, y, displayLayers, renderOptions)

    if (hit.type === 'ruler') {
      setPlayheadTime(hit.time)
      scrubRef.current = true
      tl.canvas.setPointerCapture(e.pointerId)
      return
    }

    if (hit.type === 'keyframe') {
      const entry = displayClips[hit.layerIdx]
      if (!entry) return
      const kf = entry.clip.tracks[hit.trackIdx].keyframes[hit.kfIdx]
      dragRef.current = {
        layerIdx: hit.layerIdx, trackIdx: hit.trackIdx, kfIdx: hit.kfIdx,
        startX: e.clientX, startTime: kf.time, bundleId: entry.bundleId,
      }
      // Show easing popover
      const panelRect = canvasWrapRef.current?.getBoundingClientRect()
      const canvasRect = tl.canvas.getBoundingClientRect()
      setSelectedKf({
        layerIdx: hit.layerIdx, trackIdx: hit.trackIdx, kfIdx: hit.kfIdx,
        screenX: e.clientX - (panelRect?.left ?? canvasRect.left),
        screenY: e.clientY - (panelRect?.top ?? canvasRect.top),
      })
      tl.canvas.setPointerCapture(e.pointerId)
      e.stopPropagation()
    } else if (hit.type === 'track') {
      // Add keyframe
      const entry = displayClips[hit.layerIdx]
      if (!entry) return
      const track = entry.clip.tracks[hit.trackIdx]
      if (track.keyframes.some((kf) => Math.abs(kf.time - hit.time) < 10)) return

      let value = 0
      const sorted = [...track.keyframes].sort((a, b) => a.time - b.time)
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
      const newTracks = entry.clip.tracks.map((t, i) =>
        i === hit.trackIdx ? { ...t, keyframes: newKfs } : t,
      )
      const dur = Math.max(...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
      mutateClip(entry.clip.id, entry.bundleId, { tracks: newTracks, duration: dur })
    }
  }, [displayClips, displayLayers, renderOptions])

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const tl = tl2dRef.current
    if (!tl) return

    if (scrubRef.current) {
      const rect = tl.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const time = Math.max(0, Math.round((x + scrollX) / PX_PER_MS))
      setPlayheadTime(time)
      return
    }

    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX
      const newTime = Math.max(0, Math.round((dragRef.current.startTime * PX_PER_MS + dx) / PX_PER_MS))
      const entry = displayClips[dragRef.current.layerIdx]
      if (!entry) return

      const newTracks = entry.clip.tracks.map((track, ti) => {
        if (ti !== dragRef.current!.trackIdx) return track
        const newKfs = track.keyframes.map((kf, ki) =>
          ki === dragRef.current!.kfIdx ? { ...kf, time: newTime } : kf,
        )
        newKfs.sort((a, b) => a.time - b.time)
        return { ...track, keyframes: newKfs }
      })
      const dur = Math.max(...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
      mutateClip(entry.clip.id, entry.bundleId, { tracks: newTracks, duration: dur })
      return
    }

    // Hover detection
    const rect = tl.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hit = tl.hitTest(x, y, displayLayers, renderOptions)
    if (hit.type === 'keyframe') {
      setHoverKf({ layerIdx: hit.layerIdx, trackIdx: hit.trackIdx, kfIdx: hit.kfIdx })
      tl.canvas.style.cursor = 'ew-resize'
    } else {
      setHoverKf(null)
      tl.canvas.style.cursor = hit.type === 'track' ? 'crosshair' : 'default'
    }
  }, [displayClips, displayLayers, renderOptions])

  const handleCanvasPointerUp = useCallback(() => {
    dragRef.current = null
    scrubRef.current = false
  }, [])

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    const tl = tl2dRef.current
    if (!tl) return
    const rect = tl.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hit = tl.hitTest(x, y, displayLayers, renderOptions)
    if (hit.type === 'keyframe') {
      const entry = displayClips[hit.layerIdx]
      if (!entry) return
      const kf = entry.clip.tracks[hit.trackIdx].keyframes[hit.kfIdx]
      const prop = entry.clip.tracks[hit.trackIdx].property as AnimatableProperty
      const display = prop === 'color'
        ? kf.value.toString(16).padStart(6, '0')
        : String(Math.round(kf.value * 100) / 100)
      setEditingKf({ clipId: entry.clip.id, trackIdx: hit.trackIdx, kfIdx: hit.kfIdx, value: display, bundleId: entry.bundleId })
    }
  }, [displayClips, displayLayers, renderOptions])

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const tl = tl2dRef.current
    if (!tl) return
    const rect = tl.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hit = tl.hitTest(x, y, displayLayers, renderOptions)
    if (hit.type === 'keyframe') {
      const entry = displayClips[hit.layerIdx]
      if (!entry) return
      const track = entry.clip.tracks[hit.trackIdx]
      if (track.keyframes.length <= 2) return
      const newKfs = track.keyframes.filter((_, i) => i !== hit.kfIdx)
      const newTracks = entry.clip.tracks.map((t, i) =>
        i === hit.trackIdx ? { ...t, keyframes: newKfs } : t,
      )
      const dur = Math.max(...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
      mutateClip(entry.clip.id, entry.bundleId, { tracks: newTracks, duration: dur })
    }
  }, [displayClips, displayLayers, renderOptions])

  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    setScrollX((prev) => Math.max(0, prev + e.deltaX + e.deltaY))
  }, [])

  // ── Edit commit ──
  const handleEditCommit = () => {
    if (!editingKf) return
    const entry = displayClips.find((c) => c.clip.id === editingKf.clipId)
    if (!entry) return
    const prop = entry.clip.tracks[editingKf.trackIdx].property as AnimatableProperty
    let val: number
    if (prop === 'color') {
      val = parseInt(editingKf.value.replace('#', ''), 16) || 0
    } else {
      val = parseFloat(editingKf.value) || 0
    }
    const newKfs = entry.clip.tracks[editingKf.trackIdx].keyframes.map((kf, i) =>
      i === editingKf.kfIdx ? { ...kf, value: val } : kf,
    )
    const newTracks = entry.clip.tracks.map((t, i) =>
      i === editingKf.trackIdx ? { ...t, keyframes: newKfs } : t,
    )
    mutateClip(editingKf.clipId, editingKf.bundleId, { tracks: newTracks })
    setEditingKf(null)
  }

  // ── Easing change ──
  const handleEasingChange = (easingType: EasingType) => {
    if (!selectedKf) return
    const entry = displayClips[selectedKf.layerIdx]
    if (!entry) return
    const newKfs = entry.clip.tracks[selectedKf.trackIdx].keyframes.map((kf, i) =>
      i === selectedKf.kfIdx ? { ...kf, easing: easingType } : kf,
    )
    const newTracks = entry.clip.tracks.map((t, i) =>
      i === selectedKf.trackIdx ? { ...t, keyframes: newKfs } : t,
    )
    mutateClip(entry.clip.id, entry.bundleId, { tracks: newTracks })
    setSelectedKf(null)
  }

  // ── Playback ──
  const handlePlayPause = () => {
    if (previewState === 'playing') { pause(); return }
    // Save snapshot before first play so stop can restore
    const kf = (window as unknown as Record<string, unknown>).__choanKF as KeyframeAnimator | undefined
    if (previewState === 'stopped' && kf) {
      kf.saveSnapshot(useChoanStore.getState().elements)
    }
    play()
  }
  const handleStop = () => {
    const kf = (window as unknown as Record<string, unknown>).__choanKF as KeyframeAnimator | undefined
    if (kf) {
      kf.stopAll()
      // Restore elements to pre-playback state
      const snapshot = kf.getSnapshot()
      if (snapshot) {
        useChoanStore.getState().loadFile({
          elements: snapshot,
          animationClips: useChoanStore.getState().animationClips,
          animationBundles: useChoanStore.getState().animationBundles,
        })
        kf.clearSnapshot()
      }
    }
    stop()
  }

  // ── Bundle name editing ──
  const startEditBundleName = (id: string, name: string) => { setEditingBundleName(id); setBundleNameDraft(name) }
  const commitBundleName = () => {
    if (editingBundleName && bundleNameDraft.trim()) updateAnimationBundle(editingBundleName, { name: bundleNameDraft.trim() })
    setEditingBundleName(null)
  }

  // ── Track removal ──
  const handleRemoveTrack = (clipId: string, trackIdx: number, bundleId?: string) => {
    const entry = displayClips.find((c) => c.clip.id === clipId)
    if (!entry) return
    const newTracks = entry.clip.tracks.filter((_, i) => i !== trackIdx)
    mutateClip(clipId, bundleId, { tracks: newTracks })
  }


  // ── Canvas init + render ──
  useEffect(() => {
    const wrap = canvasWrapRef.current
    if (!wrap) return
    const tl = createTimeline2D(wrap)
    tl2dRef.current = tl

    const ro = new ResizeObserver(() => {
      tl.resize(wrap.clientWidth, wrap.clientHeight)
    })
    ro.observe(wrap)
    tl.resize(wrap.clientWidth, wrap.clientHeight)

    return () => {
      ro.disconnect()
      tl.dispose()
      tl2dRef.current = null
    }
  }, [])

  // Re-render canvas on data/state change
  useEffect(() => {
    const tl = tl2dRef.current
    if (!tl) return
    tl.render(displayLayers, renderOptions)
  })

  // Sync left panel scroll
  const handleLeftScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollY((e.target as HTMLDivElement).scrollTop)
  }, [])

  return (
    <div className="timeline-panel" style={height ? { height } : undefined}>
      {/* Header: controls (DOM) */}
      <div className="timeline-header-bar">
        <div className="playback-controls">
          <button className="btn-small" onClick={handlePlayPause} title={previewState === 'playing' ? 'Pause' : 'Play'}>
            {previewState === 'playing' ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
          </button>
          <button className="btn-small" onClick={handleStop} title="Stop"><Stop size={14} weight="fill" /></button>
          <button className="btn-small" onClick={handleCreateBundle} title="New Animation"><Plus size={14} /></button>
          {previewState !== 'stopped' && (
            <span className="preview-state-label">
              {previewState === 'playing' ? 'Playing' : 'Paused'}
            </span>
          )}
        </div>
        {/* Tabs */}
        <div className="timeline-tabs">
          {animationBundles.map((b) => (
            editingBundleName === b.id ? (
              <input
                key={b.id}
                className="field-input timeline-tab-name-input"
                autoFocus
                value={bundleNameDraft}
                onChange={(e) => setBundleNameDraft(e.target.value)}
                onBlur={commitBundleName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitBundleName(); if (e.key === 'Escape') setEditingBundleName(null) }}
              />
            ) : (
              <button
                key={b.id}
                className={`btn-small ${activeBundleId === b.id ? 'active' : ''}`}
                onClick={() => { setSelectedBundleId(b.id); setEditingBundle(b.id) }}
                onDoubleClick={() => startEditBundleName(b.id, b.name)}
              >
                {b.name}
              </button>
            )
          ))}
          {activeBundleId && (
            <button
              className="btn-icon timeline-tab-delete"
              onClick={() => { removeAnimationBundle(activeBundleId); setSelectedBundleId(null); setEditingBundle(null) }}
            ><X size={12} /></button>
          )}
        </div>
      </div>

      {/* Body: left DOM + right Canvas */}
      <div className="timeline-body-row">
        {/* Left sidebar (DOM) */}
        <div className="timeline-left-panel" ref={leftPanelRef} onScroll={handleLeftScroll}>
          {/* Ruler spacer */}
          <div style={{ height: RULER_HEIGHT, flexShrink: 0 }} />
          {displayClips.length === 0 && (
            <div className="panel-empty" style={{ padding: '8px', fontSize: 11 }}>
              {animationBundles.length === 0
                ? '+ 버튼으로 애니메이션을 만들어 보세요.'
                : '속성 트랙을 추가하세요.'}
            </div>
          )}
          {displayClips.map((entry) => (
            <div key={entry.clip.id}>
              {/* Layer header */}
              <div className="tl-left-layer" style={{ height: LAYER_HEADER_HEIGHT, paddingLeft: entry.depth * INDENT_PX }}>
                <span className="tl-left-label">{entry.label}</span>
                {entry.bundleId && (
                  <div className="tl-left-actions">
                    <select
                      className="field-select field-select-small"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) handleAddTrack(entry.bundleId!, entry.clip.id, e.target.value as AnimatableProperty)
                        e.target.value = ''
                      }}
                    >
                      <option value="">+</option>
                      {ANIMATABLE_PROPERTIES
                        .filter((p) => !entry.clip.tracks.some((t) => t.property === p))
                        .map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button className="btn-icon" onClick={() => removeClipFromBundle(entry.bundleId!, entry.clip.id)}><X size={10} /></button>
                  </div>
                )}
              </div>
              {/* Track rows */}
              {entry.clip.tracks.map((track, ti) => (
                <div key={ti} className="tl-left-track" style={{ height: TRACK_HEIGHT, paddingLeft: entry.depth * INDENT_PX }}>
                  <span className="tl-left-prop">{track.property}</span>
                  <span className="tl-left-range">
                    {formatValue(track.property as AnimatableProperty, track.keyframes[0]?.value)}
                    →
                    {formatValue(track.property as AnimatableProperty, track.keyframes[track.keyframes.length - 1]?.value)}
                  </span>
                  {entry.bundleId && (
                    <button className="btn-icon tl-track-del" onClick={() => handleRemoveTrack(entry.clip.id, ti, entry.bundleId)}><X size={10} /></button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right Canvas */}
        <div
          className="timeline-canvas-wrap"
          ref={canvasWrapRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onDoubleClick={handleCanvasDoubleClick}
          onContextMenu={handleCanvasContextMenu}
          onWheel={handleCanvasWheel}
        />
      </div>

      {/* Easing curve selector popover */}
      {selectedKf && (
        <div className="easing-popover-backdrop" onClick={() => setSelectedKf(null)}>
          <div
            className="easing-popover"
            style={{ left: selectedKf.screenX + LEFT_WIDTH, top: selectedKf.screenY + 32 + 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            {(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring'] as EasingType[]).map((et) => {
              const entry = displayClips[selectedKf.layerIdx]
              const currentEasing = entry?.clip.tracks[selectedKf.trackIdx]?.keyframes[selectedKf.kfIdx]?.easing
              return (
                <button
                  key={et}
                  className={`easing-option ${currentEasing === et ? 'active' : ''}`}
                  onClick={() => handleEasingChange(et)}
                >
                  {et}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Keyframe value editor popup */}
      {editingKf && (
        <div className="kf-editor-overlay" onClick={() => setEditingKf(null)}>
          <div className="kf-editor" onClick={(e) => e.stopPropagation()}>
            <input
              className="field-input"
              autoFocus
              value={editingKf.value}
              onChange={(e) => setEditingKf({ ...editingKf, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEditCommit(); if (e.key === 'Escape') setEditingKf(null) }}
            />
            <button className="btn-small" onClick={handleEditCommit}>OK</button>
          </div>
        </div>
      )}
    </div>
  )
}

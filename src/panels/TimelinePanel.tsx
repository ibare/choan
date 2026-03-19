// Animation Timeline Panel — thin wrapper.
// Owns state, derived data, and playback logic.
// Delegates Canvas2D to TimelineCanvas, DOM sidebar to TimelineSidebar.

import { useState, useRef, useCallback } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import type { DisplayLayer, RenderOptions } from '../engine/timeline2d'
import type { AnimationClip, AnimationBundle } from '../animation/types'
import { nanoid } from '../canvas/nanoid'
import { Play, Pause, Stop, Plus, X, FilmStrip } from '@phosphor-icons/react'
import { buildLayerTree } from '../animation/buildLayerTree'
import { kfAnimator } from '../rendering/kfAnimator'
import TimelineCanvas from './TimelineCanvas'
import TimelineSidebar from './TimelineSidebar'
import { type DisplayClipEntry, PX_PER_MS, RULER_HEIGHT, TRACK_HEIGHT, LAYER_HEADER_HEIGHT } from './timelineTypes'


interface TimelinePanelProps {
  visible: boolean
  height?: number
}

export default function TimelinePanel({ visible, height }: TimelinePanelProps) {
  const {
    elements, animationClips, animationBundles,
    addAnimationClip, updateAnimationClip,
    addAnimationBundle, updateAnimationBundle, removeAnimationBundle,
    updateClipInBundle, removeClipFromBundle,
  } = useChoanStore()
  const { previewState, play, pause, stop, playheadTime, setPlayheadTime, editingBundleId, setEditingBundle, ghostPreview, toggleGhostPreview } = usePreviewStore()

  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null)
  const [editingBundleName, setEditingBundleName] = useState<string | null>(null)
  const [bundleNameDraft, setBundleNameDraft] = useState('')
  const [scrollX, setScrollX] = useState(0)
  const [scrollY, setScrollY] = useState(0)

  const canvasWrapRef = useRef<HTMLDivElement | null>(null)

  if (!visible) return null

  // ── Derive display data ──
  const activeBundleId = selectedBundleId && animationBundles.some((b) => b.id === selectedBundleId)
    ? selectedBundleId
    : animationBundles[0]?.id ?? null

  const displayClips: DisplayClipEntry[] = []
  if (activeBundleId) {
    const bundle = animationBundles.find((b) => b.id === activeBundleId)
    if (bundle) {
      for (const { el, depth } of buildLayerTree(elements)) {
        const clip = bundle.clips.find((c) => c.elementId === el.id)
        if (clip) displayClips.push({ clip, label: el.label, depth, bundleId: bundle.id })
      }
    }
  }

  const maxDuration = Math.max(300, ...displayClips.map((c) => c.clip.duration))
  const displayLayers: DisplayLayer[] = displayClips.map((entry) => ({
    clipId: entry.clip.id,
    label: entry.label,
    tracks: entry.clip.tracks.map((t) => ({ property: t.property, keyframes: [...t.keyframes].sort((a, b) => a.time - b.time) })),
  }))
  const renderOptions: RenderOptions = {
    scrollX, scrollY, pxPerMs: PX_PER_MS,
    rulerHeight: RULER_HEIGHT, trackHeight: TRACK_HEIGHT, layerHeaderHeight: LAYER_HEADER_HEIGHT,
    maxDuration, hoverKf: null,
    playheadTime: editingBundleId ? playheadTime : null,
  }

  // ── Clip mutation ──
  const mutateClip = useCallback((clipId: string, bundleId: string | undefined, patch: Partial<AnimationClip>) => {
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
  }, [displayClips, animationClips, updateClipInBundle, addAnimationClip, updateAnimationClip])

  // ── Create bundle ──
  const handleCreateBundle = () => {
    const clips: AnimationClip[] = buildLayerTree(elements).map(({ el }) => ({
      id: nanoid(), elementId: el.id, duration: 300, easing: 'ease' as const, tracks: [],
    }))
    const bundle: AnimationBundle = { id: nanoid(), name: `Animation ${animationBundles.length + 1}`, clips }
    addAnimationBundle(bundle)
    setSelectedBundleId(bundle.id)
    setEditingBundle(bundle.id)
  }

  // ── Remove track ──
  const handleRemoveTrack = (clipId: string, trackIdx: number, bundleId?: string) => {
    const entry = displayClips.find((c) => c.clip.id === clipId)
    if (!entry) return
    mutateClip(clipId, bundleId, { tracks: entry.clip.tracks.filter((_, i) => i !== trackIdx) })
  }

  // ── Playback ──
  const handlePlayPause = () => {
    if (previewState === 'playing') { pause(); return }
    if (previewState === 'stopped') kfAnimator.saveSnapshot(useChoanStore.getState().elements)
    play()
  }

  const handleStop = () => {
    kfAnimator.stopAll()
    const snapshot = kfAnimator.getSnapshot()
    if (snapshot) {
      const state = useChoanStore.getState()
      state.loadFile({ elements: snapshot, animationClips: state.animationClips, animationBundles: state.animationBundles })
      kfAnimator.clearSnapshot()
    }
    stop()
  }

  // ── Bundle name ──
  const startEditBundleName = (id: string, name: string) => { setEditingBundleName(id); setBundleNameDraft(name) }
  const commitBundleName = () => {
    if (editingBundleName && bundleNameDraft.trim()) updateAnimationBundle(editingBundleName, { name: bundleNameDraft.trim() })
    setEditingBundleName(null)
  }

  const handleLeftScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollY((e.target as HTMLDivElement).scrollTop)
  }, [])

  return (
    <div className="timeline-panel" style={height ? { height } : undefined}>
      {/* Header: playback controls + bundle tabs */}
      <div className="timeline-header-bar">
        <div className="playback-controls">
          <button className="btn-small" onClick={handlePlayPause} title={previewState === 'playing' ? 'Pause' : 'Play'}>
            {previewState === 'playing' ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
          </button>
          <button className="btn-small" onClick={handleStop} title="Stop"><Stop size={14} weight="fill" /></button>
          <button className="btn-small" onClick={handleCreateBundle} title="New Animation"><Plus size={14} /></button>
          <button className={`btn-small ${ghostPreview ? 'active' : ''}`} onClick={toggleGhostPreview} title="Ghost Preview"><FilmStrip size={14} /></button>
          {previewState !== 'stopped' && (
            <span className="preview-state-label">{previewState === 'playing' ? 'Playing' : 'Paused'}</span>
          )}
        </div>
        <div className="timeline-tabs">
          {animationBundles.map((b) => (
            editingBundleName === b.id ? (
              <input
                key={b.id} className="field-input timeline-tab-name-input" autoFocus value={bundleNameDraft}
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
              >{b.name}</button>
            )
          ))}
          {activeBundleId && (
            <button className="btn-icon timeline-tab-delete" onClick={() => { removeAnimationBundle(activeBundleId); setSelectedBundleId(null); setEditingBundle(null) }}><X size={12} /></button>
          )}
        </div>
      </div>

      {/* Body: sidebar + canvas */}
      <div className="timeline-body-row">
        {displayClips.length === 0 && animationBundles.length === 0 && (
          <div className="panel-empty" style={{ padding: '8px', fontSize: 11, alignSelf: 'flex-start' }}>
            + 버튼으로 애니메이션을 만들어 보세요.
          </div>
        )}
        <TimelineSidebar
          displayClips={displayClips}
          onRemoveTrack={handleRemoveTrack}
          onRemoveClip={removeClipFromBundle}
          scrollY={scrollY}
          onScroll={handleLeftScroll}
        />
        <TimelineCanvas
          displayClips={displayClips}
          displayLayers={displayLayers}
          renderOptions={renderOptions}
          scrollX={scrollX}
          onPlayheadChange={(time) => { setPlayheadTime(time); useChoanStore.getState().setSelectedIds([]) }}
          onMutateClip={mutateClip}
          onScrollX={(delta) => setScrollX((prev) => Math.max(0, prev + delta))}
          canvasWrapRef={canvasWrapRef}
        />
      </div>
    </div>
  )
}

// Animation Timeline Panel — thin wrapper.
// Owns state, derived data, and playback logic.
// Delegates Canvas2D to TimelineCanvas, DOM sidebar to TimelineSidebar.

import { useState, useRef, useCallback } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import { useDirectorStore } from '../store/useDirectorStore'
import DirectorTimelinePanel from './DirectorTimelinePanel'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import type { DisplayLayer, RenderOptions } from '../engine/timeline2d'
import type { AnimationClip, AnimationBundle } from '../animation/types'
import { nanoid } from '../utils/nanoid'
import { Play, Pause, Stop, Plus, X, FilmStrip, Export } from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { Tooltip } from '../components/ui/Tooltip'
import { track } from '../utils/analytics'
import { Input } from '../components/ui/Input'
import { buildLayerTree } from '../animation/buildLayerTree'
import { kfAnimator } from '../rendering/kfAnimator'
import VideoExportDialog, { type VideoExportSettings } from './VideoExportDialog'
import { createVideoExporter } from '../engine/videoExporter'
import { rendererSingleton } from '../rendering/rendererRef'
import { useRenderSettings } from '../store/useRenderSettings'
import { evaluateAnimation } from '../animation/animationEvaluator'
import { createLayoutAnimator } from '../layout/animator'
import { applyMultiSelectTint } from '../rendering/multiSelectTint'
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const canvasWrapRef = useRef<HTMLDivElement | null>(null)

  const { directorMode, setDirectorMode } = useDirectorStore()

  if (!visible) return null

  // ── Director mode ──
  if (directorMode) {
    return (
      <div className="timeline-panel" style={height ? { height } : undefined}>
        <div className="timeline-header-bar">
          <SegmentedControl
            options={[{ value: 'bundle', label: 'Bundle' }, { value: 'director', label: 'Director' }]}
            value="director"
            onChange={(v) => setDirectorMode(v === 'director')}
          />
        </div>
        <DirectorTimelinePanel
          onSwitchToBundle={(bundleId) => {
            setDirectorMode(false)
            setSelectedBundleId(bundleId)
            setEditingBundle(bundleId)
          }}
        />
      </div>
    )
  }

  // ── Derive display data ──
  const activeBundleId = selectedBundleId && animationBundles.some((b) => b.id === selectedBundleId)
    ? selectedBundleId
    : animationBundles[0]?.id ?? null

  // Keep editingBundleId in sync with active bundle so playhead is always visible
  if (activeBundleId && editingBundleId !== activeBundleId) {
    setEditingBundle(activeBundleId)
  }

  const displayClips: DisplayClipEntry[] = []
  if (activeBundleId) {
    const activeBundle = animationBundles.find((b) => b.id === activeBundleId)
    if (activeBundle) {
      for (const { el, depth } of buildLayerTree(elements)) {
        const clip = activeBundle.clips.find((c) => c.elementId === el.id)
        if (clip) displayClips.push({ clip, label: el.label, depth, bundleId: activeBundle.id })
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
    track('create-animation')
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

  // ── Video export ──
  const handleExport = (settings: VideoExportSettings) => {
    const renderer = rendererSingleton.renderer
    if (!renderer) return

    setExporting(true)
    setExportProgress(0)

    const exportAnimator = createLayoutAnimator()
    const rs = useRenderSettings.getState()

    const exporter = createVideoExporter(
      renderer.canvas,
      (w, h) => renderer.resize(w, h),
      (timeMs) => {
        const state = useChoanStore.getState()

        const animated = evaluateAnimation({
          elements: state.elements,
          previewState: 'stopped',
          editingBundleId: activeBundleId,
          playheadTime: timeMs,
          animationBundles: state.animationBundles,
          kfAnimator,
          layoutAnimator: exportAnimator,
          springParams: { stiffness: rs.springStiffness, damping: rs.springDamping, squashIntensity: 0 },
          manipulatedIds: new Set(),
        })

        renderer.updateScene(applyMultiSelectTint(animated, []), rs.extrudeDepth)
        renderer.render(rs)
      },
    )
    exporter.onProgress = (p) => setExportProgress(p)
    exporter.start(settings).then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'choan-export.webm'
      a.click()
      URL.revokeObjectURL(url)
      setExporting(false)
      setExportDialogOpen(false)
    }).catch(() => {
      setExporting(false)
    })
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
        <SegmentedControl
          options={[{ value: 'bundle', label: 'Bundle' }, { value: 'director', label: 'Director' }]}
          value="bundle"
          onChange={(v) => setDirectorMode(v === 'director')}
        />
        <div className="playback-controls">
          <Tooltip content={previewState === 'playing' ? 'Pause' : 'Play'}>
            <Button className="btn-small" onClick={handlePlayPause}>
              {previewState === 'playing' ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
            </Button>
          </Tooltip>
          <Tooltip content="Stop"><Button className="btn-small" onClick={handleStop}><Stop size={14} weight="fill" /></Button></Tooltip>
          <Tooltip content="New Animation"><Button className="btn-small" onClick={handleCreateBundle}><Plus size={14} /></Button></Tooltip>
          <Tooltip content="Ghost Preview"><Button className="btn-small" active={ghostPreview} onClick={toggleGhostPreview}><FilmStrip size={14} /></Button></Tooltip>
          <Tooltip content="Export Video">
            <Button className="btn-small" onClick={() => setExportDialogOpen(true)}><Export size={14} /></Button>
          </Tooltip>
          {previewState !== 'stopped' && (
            <span className="preview-state-label">{previewState === 'playing' ? 'Playing' : 'Paused'}</span>
          )}
        </div>
        <div className="timeline-tabs">
          {animationBundles.map((b) => (
            editingBundleName === b.id ? (
              <Input
                key={b.id} className="field-input timeline-tab-name-input" autoFocus value={bundleNameDraft}
                onChange={(e) => setBundleNameDraft(e.target.value)}
                onBlur={commitBundleName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitBundleName(); if (e.key === 'Escape') setEditingBundleName(null) }}
              />
            ) : (
              <Button
                key={b.id}
                className="btn-small"
                active={activeBundleId === b.id}
                onClick={() => { setSelectedBundleId(b.id); setEditingBundle(b.id) }}
                onDoubleClick={() => startEditBundleName(b.id, b.name)}
              >{b.name}</Button>
            )
          ))}
          {activeBundleId && (
            <Button className="btn-icon timeline-tab-delete" size="icon" onClick={() => { removeAnimationBundle(activeBundleId); setSelectedBundleId(null); setEditingBundle(null) }}><X size={12} /></Button>
          )}
        </div>
      </div>

      {/* Body: sidebar + canvas */}
      <div className="timeline-body-row">
        {displayClips.length === 0 && animationBundles.length === 0 && (
          <div className="panel-empty" style={{ padding: '8px', fontSize: 11, alignSelf: 'flex-start' }}>
            Create an animation with the + button.
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
          onPlayheadChange={(time) => { setPlayheadTime(time) }}
          onMutateClip={mutateClip}
          onScrollX={(delta) => setScrollX((prev) => Math.max(0, prev + delta))}
          canvasWrapRef={canvasWrapRef}
        />
      </div>

      <VideoExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
        exporting={exporting}
        progress={exportProgress}
        duration={maxDuration}
      />
    </div>
  )
}

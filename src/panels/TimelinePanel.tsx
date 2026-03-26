// Animation Timeline Panel — thin wrapper.
// Owns state, derived data, and playback logic.
// Delegates Canvas2D to TimelineCanvas, DOM sidebar to TimelineSidebar.

import { useState, useRef, useCallback } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import type { DisplayLayer, RenderOptions } from '../engine/timeline2d'
import type { AnimationClip, AnimationBundle } from '../animation/types'
import { nanoid } from '../utils/nanoid'
import { Play, Pause, Stop, Plus, X, FilmStrip, VideoCamera, Export } from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Tooltip } from '../components/ui/Tooltip'
import { track } from '../utils/analytics'
import { Input } from '../components/ui/Input'
import { buildLayerTree } from '../animation/buildLayerTree'
import { kfAnimator } from '../rendering/kfAnimator'
import { useAnimationStore } from '../store/useAnimationStore'
import { CAMERA_PRESETS, createCameraPreset, type CameraPreset } from '../animation/cameraPresets'
import VideoExportDialog, { type VideoExportSettings } from './VideoExportDialog'
import { createVideoExporter } from '../engine/videoExporter'
import { rendererSingleton } from '../rendering/rendererRef'
import { useRenderSettings } from '../store/useRenderSettings'
import { evaluateAnimation } from '../animation/animationEvaluator'
import { createLayoutAnimator } from '../layout/animator'
import { evaluateCameraAnimation } from '../animation/cameraEvaluator'
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

  if (!visible) return null

  // ── Derive display data ──
  const activeBundleId = selectedBundleId && animationBundles.some((b) => b.id === selectedBundleId)
    ? selectedBundleId
    : animationBundles[0]?.id ?? null

  const displayClips: DisplayClipEntry[] = []
  let activeBundle: AnimationBundle | undefined
  if (activeBundleId) {
    activeBundle = animationBundles.find((b) => b.id === activeBundleId)
    if (activeBundle) {
      // Camera clip at the top
      if (activeBundle.cameraClip && activeBundle.cameraClip.tracks.length > 0) {
        displayClips.push({
          clip: {
            id: activeBundle.cameraClip.id,
            elementId: '__camera__',
            duration: activeBundle.cameraClip.duration,
            easing: activeBundle.cameraClip.easing,
            tracks: [],  // camera tracks displayed via cameraTracks field
          },
          label: 'Camera',
          depth: 0,
          bundleId: activeBundle.id,
          isCamera: true,
          cameraTracks: activeBundle.cameraClip.tracks,
        })
      }
      for (const { el, depth } of buildLayerTree(elements)) {
        const clip = activeBundle.clips.find((c) => c.elementId === el.id)
        if (clip) displayClips.push({ clip, label: el.label, depth, bundleId: activeBundle.id })
      }
    }
  }

  const maxDuration = Math.max(300, ...displayClips.map((c) => c.clip.duration))
  const displayLayers: DisplayLayer[] = displayClips.map((entry) => {
    const sourceTracks = entry.isCamera && entry.cameraTracks ? entry.cameraTracks : entry.clip.tracks
    return {
      clipId: entry.clip.id,
      label: entry.label,
      tracks: sourceTracks.map((t) => ({ property: t.property, keyframes: [...t.keyframes].sort((a, b) => a.time - b.time) })),
    }
  })
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

  // ── Camera preset ──
  const handleCameraPreset = (presetId: string) => {
    if (!activeBundleId) return
    // Get camera from renderer via the canvas — we need to find it through the DOM
    // For now, use default camera values as fallback
    const defaultCam = { position: [0, 0, 20] as [number, number, number], target: [0, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number], fov: 50, near: 0.1, far: 1000, aspect: 1 }
    const clip = createCameraPreset(presetId as CameraPreset, maxDuration, defaultCam)
    useAnimationStore.getState().setCameraClipInBundle(activeBundleId, clip)
  }

  const handleRemoveCameraClip = () => {
    if (activeBundleId) useAnimationStore.getState().removeCameraClipFromBundle(activeBundleId)
  }

  // ── Video export ──
  const handleExport = (settings: VideoExportSettings) => {
    const renderer = rendererSingleton.renderer
    if (!renderer) return

    setExporting(true)
    setExportProgress(0)

    // Create a dedicated layout animator for export (no spring physics needed)
    const exportAnimator = createLayoutAnimator()
    const rs = useRenderSettings.getState()

    const exporter = createVideoExporter(
      renderer.canvas,
      (w, h) => renderer.resize(w, h),
      (timeMs) => {
        // Evaluate animation at this time
        const state = useChoanStore.getState()
        const bundle = activeBundleId
          ? state.animationBundles.find((b) => b.id === activeBundleId)
          : null

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

        // Apply camera keyframes
        if (bundle?.cameraClip && bundle.cameraClip.tracks.length > 0) {
          const camState = evaluateCameraAnimation(bundle.cameraClip, timeMs, renderer.camera)
          if (camState) {
            renderer.camera.position[0] = camState.position[0]
            renderer.camera.position[1] = camState.position[1]
            renderer.camera.position[2] = camState.position[2]
            renderer.camera.target[0] = camState.target[0]
            renderer.camera.target[1] = camState.target[1]
            renderer.camera.target[2] = camState.target[2]
            renderer.camera.fov = camState.fov
          }
        }

        // Update scene and render
        renderer.updateScene(applyMultiSelectTint(animated, []), rs.extrudeDepth)
        renderer.render(rs)
      },
    )
    exporter.onProgress = (p) => setExportProgress(p)
    exporter.start({ ...settings, duration: maxDuration }).then((blob) => {
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
        <div className="playback-controls">
          <Tooltip content={previewState === 'playing' ? 'Pause' : 'Play'}>
            <Button className="btn-small" onClick={handlePlayPause}>
              {previewState === 'playing' ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
            </Button>
          </Tooltip>
          <Tooltip content="Stop"><Button className="btn-small" onClick={handleStop}><Stop size={14} weight="fill" /></Button></Tooltip>
          <Tooltip content="New Animation"><Button className="btn-small" onClick={handleCreateBundle}><Plus size={14} /></Button></Tooltip>
          <Tooltip content="Ghost Preview"><Button className="btn-small" active={ghostPreview} onClick={toggleGhostPreview}><FilmStrip size={14} /></Button></Tooltip>
          {activeBundleId && (
            <>
              <div className="timeline-separator" />
              <Select
                options={CAMERA_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
                value=""
                onChange={handleCameraPreset}
                placeholder="Camera"
                size="sm"
              />
              {activeBundle?.cameraClip && (
                <Tooltip content="Remove Camera">
                  <Button className="btn-small" onClick={handleRemoveCameraClip}><VideoCamera size={14} /><X size={10} /></Button>
                </Tooltip>
              )}
              <Tooltip content="Export Video">
                <Button className="btn-small" onClick={() => setExportDialogOpen(true)}><Export size={14} /></Button>
              </Tooltip>
            </>
          )}
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

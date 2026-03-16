// Animation Timeline Panel — keyframe editing + playback controls
// Shows one clip per interaction, derived from presets or custom clips.
// Supports: keyframe drag (time), click to add, right-click to delete,
// double-click to edit value, interaction selector.

import { useState, useRef } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import { usePreviewStore } from '../store/usePreviewStore'
import { resolvePreset } from '../animation/presets'
import type { AnimationClip, KeyframeTrack, AnimatableProperty } from '../animation/types'
import type { KeyframeAnimator } from '../animation/keyframeEngine'

const TRACK_HEIGHT = 26
const LEFT_WIDTH = 170
const PX_PER_MS = 0.8
const DIAMOND_SIZE = 10

function msToX(ms: number): number { return ms * PX_PER_MS }
function xToMs(x: number): number { return Math.max(0, Math.round(x / PX_PER_MS)) }

interface TimelinePanelProps {
  visible: boolean
}

// Resolve a clip for each interaction: custom clip if saved, otherwise preset
function resolveClipForInteraction(
  interactionId: string,
  customClips: AnimationClip[],
  elements: ReturnType<typeof useChoanStore.getState>['elements'],
  interactions: ReturnType<typeof useChoanStore.getState>['interactions'],
): AnimationClip | null {
  const ia = interactions.find((i) => i.id === interactionId)
  if (!ia) return null

  // Check for user-customized clip
  const custom = customClips.find((c) => c.id === `clip_${ia.id}`)
  if (custom) return custom

  // Derive from preset
  const el = elements.find((e) => e.id === ia.reaction.elementId)
  if (!el) return null

  const preset = resolvePreset(ia.reaction.animation, el, ia.reaction.easing)
  // Tag with interaction id so we can save it later
  return { ...preset, id: `clip_${ia.id}` }
}

export default function TimelinePanel({ visible }: TimelinePanelProps) {
  const { elements, interactions, animationClips, addAnimationClip, updateAnimationClip } = useChoanStore()
  const { previewState, play, pause, stop } = usePreviewStore()
  const [selectedIaId, setSelectedIaId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<{
    clipId: string; trackIdx: number; kfIdx: number; startX: number; startTime: number
  } | null>(null)
  const [editingKf, setEditingKf] = useState<{
    clipId: string; trackIdx: number; kfIdx: number; value: string
  } | null>(null)

  if (!visible) return null

  // Build display clips from interactions
  const allClips: Array<{ ia: typeof interactions[0]; clip: AnimationClip }> = []
  for (const ia of interactions) {
    const clip = resolveClipForInteraction(ia.id, animationClips, elements, interactions)
    if (clip) allClips.push({ ia, clip })
  }

  // Filter by selected interaction
  const displayClips = selectedIaId
    ? allClips.filter((c) => c.ia.id === selectedIaId)
    : allClips

  const maxDuration = Math.max(300, ...displayClips.map((c) => c.clip.duration))
  const rulerWidth = msToX(maxDuration + 200)

  const ticks: number[] = []
  const tickInterval = maxDuration > 1000 ? 200 : 100
  for (let t = 0; t <= maxDuration + 200; t += tickInterval) ticks.push(t)

  // Ensure clip is persisted as custom before mutating
  function ensureCustomClip(clip: AnimationClip): AnimationClip {
    const existing = animationClips.find((c) => c.id === clip.id)
    if (existing) return existing
    // Save preset-derived clip as custom
    addAnimationClip(clip)
    return clip
  }

  // ── Keyframe time drag ──
  const handleDragStart = (clipId: string, trackIdx: number, kfIdx: number, e: React.PointerEvent) => {
    e.stopPropagation()
    const entry = displayClips.find((c) => c.clip.id === clipId)
    if (!entry) return
    const kf = entry.clip.tracks[trackIdx].keyframes[kfIdx]
    setDragState({ clipId, trackIdx, kfIdx, startX: e.clientX, startTime: kf.time })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragState) return
    const dx = e.clientX - dragState.startX
    const newTime = xToMs(msToX(dragState.startTime) + dx)
    const entry = displayClips.find((c) => c.clip.id === dragState.clipId)
    if (!entry) return

    const clip = ensureCustomClip(entry.clip)
    const newTracks = clip.tracks.map((track, ti) => {
      if (ti !== dragState.trackIdx) return track
      const newKfs = track.keyframes.map((kf, ki) =>
        ki === dragState.kfIdx ? { ...kf, time: newTime } : kf,
      )
      newKfs.sort((a, b) => a.time - b.time)
      return { ...track, keyframes: newKfs }
    })
    const dur = Math.max(...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
    updateAnimationClip(clip.id, { tracks: newTracks, duration: dur })
  }

  const handleDragEnd = () => { setDragState(null) }

  // ── Click on track area to add keyframe ──
  const handleTrackClick = (clipId: string, trackIdx: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = xToMs(x)

    const entry = displayClips.find((c) => c.clip.id === clipId)
    if (!entry) return

    const clip = ensureCustomClip(entry.clip)
    const track = clip.tracks[trackIdx]

    // Don't add if too close to existing keyframe
    if (track.keyframes.some((kf) => Math.abs(kf.time - time) < 10)) return

    // Interpolate value at this time from neighbors
    let value = 0
    const sorted = [...track.keyframes].sort((a, b) => a.time - b.time)
    if (sorted.length === 0) {
      value = 0
    } else if (time <= sorted[0].time) {
      value = sorted[0].value
    } else if (time >= sorted[sorted.length - 1].time) {
      value = sorted[sorted.length - 1].value
    } else {
      for (let i = 0; i < sorted.length - 1; i++) {
        if (time >= sorted[i].time && time <= sorted[i + 1].time) {
          const t = (time - sorted[i].time) / (sorted[i + 1].time - sorted[i].time)
          value = sorted[i].value + (sorted[i + 1].value - sorted[i].value) * t
          if (track.property === 'color') value = Math.round(value)
          break
        }
      }
    }

    const newKfs = [...track.keyframes, { time, value }].sort((a, b) => a.time - b.time)
    const newTracks = clip.tracks.map((t, i) => i === trackIdx ? { ...t, keyframes: newKfs } : t)
    const dur = Math.max(...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
    updateAnimationClip(clip.id, { tracks: newTracks, duration: dur })
  }

  // ── Right-click to delete keyframe ──
  const handleKfContextMenu = (clipId: string, trackIdx: number, kfIdx: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const entry = displayClips.find((c) => c.clip.id === clipId)
    if (!entry) return
    const track = entry.clip.tracks[trackIdx]
    if (track.keyframes.length <= 2) return // keep minimum 2

    const clip = ensureCustomClip(entry.clip)
    const newKfs = clip.tracks[trackIdx].keyframes.filter((_, i) => i !== kfIdx)
    const newTracks = clip.tracks.map((t, i) => i === trackIdx ? { ...t, keyframes: newKfs } : t)
    const dur = Math.max(...newTracks.flatMap((t) => t.keyframes.map((k) => k.time)))
    updateAnimationClip(clip.id, { tracks: newTracks, duration: dur })
  }

  // ── Double-click to edit keyframe value ──
  const handleKfDoubleClick = (clipId: string, trackIdx: number, kfIdx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const entry = displayClips.find((c) => c.clip.id === clipId)
    if (!entry) return
    const kf = entry.clip.tracks[trackIdx].keyframes[kfIdx]
    const prop = entry.clip.tracks[trackIdx].property
    const display = prop === 'color'
      ? kf.value.toString(16).padStart(6, '0')
      : String(Math.round(kf.value * 100) / 100)
    setEditingKf({ clipId, trackIdx, kfIdx, value: display })
  }

  const handleEditCommit = () => {
    if (!editingKf) return
    const entry = displayClips.find((c) => c.clip.id === editingKf.clipId)
    if (!entry) return

    const clip = ensureCustomClip(entry.clip)
    const prop = clip.tracks[editingKf.trackIdx].property
    let val: number
    if (prop === 'color') {
      val = parseInt(editingKf.value.replace('#', ''), 16) || 0
    } else {
      val = parseFloat(editingKf.value) || 0
    }

    const newKfs = clip.tracks[editingKf.trackIdx].keyframes.map((kf, i) =>
      i === editingKf.kfIdx ? { ...kf, value: val } : kf,
    )
    const newTracks = clip.tracks.map((t, i) =>
      i === editingKf.trackIdx ? { ...t, keyframes: newKfs } : t,
    )
    updateAnimationClip(clip.id, { tracks: newTracks })
    setEditingKf(null)
  }

  // ── Playback ──
  const handlePlayPause = () => {
    if (previewState === 'playing') { pause(); return }
    if (previewState === 'stopped') useChoanStore.getState().resetStateValues()
    play()
  }

  const handleStop = () => {
    stop()
    useChoanStore.getState().resetStateValues()
    const kf = (window as unknown as Record<string, unknown>).__choanKF as KeyframeAnimator | undefined
    kf?.stopAll()
  }

  return (
    <div className="timeline-panel" onPointerMove={handleDragMove} onPointerUp={handleDragEnd}>
      {/* Header */}
      <div className="timeline-header">
        <div className="timeline-left-col" style={{ width: LEFT_WIDTH }}>
          <div className="playback-controls">
            <button className="btn-small" onClick={handlePlayPause}
              title={previewState === 'playing' ? 'Pause' : 'Play'}>
              {previewState === 'playing' ? '⏸' : '▶'}
            </button>
            <button className="btn-small" onClick={handleStop} title="Stop">⏹</button>
            <span className="preview-state-label">
              {previewState === 'stopped' ? 'Edit' : previewState === 'playing' ? 'Playing' : 'Paused'}
            </span>
          </div>
        </div>
        <div className="timeline-ruler-wrap">
          <div className="timeline-ruler" style={{ width: rulerWidth }}>
            {ticks.map((t) => (
              <div key={t} className="timeline-tick" style={{ left: msToX(t) }}>
                <span className="timeline-tick-label">{t}ms</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interaction selector */}
      {interactions.length > 1 && (
        <div className="timeline-ia-selector">
          <button
            className={`btn-small ${!selectedIaId ? 'active' : ''}`}
            onClick={() => setSelectedIaId(null)}
          >All</button>
          {interactions.map((ia) => {
            const trigEl = elements.find((e) => e.id === ia.trigger.elementId)
            return (
              <button
                key={ia.id}
                className={`btn-small ${selectedIaId === ia.id ? 'active' : ''}`}
                onClick={() => setSelectedIaId(ia.id)}
              >
                {trigEl?.label ?? '?'}.{ia.trigger.event}
              </button>
            )
          })}
        </div>
      )}

      {/* Tracks */}
      <div className="timeline-body">
        {displayClips.length === 0 && (
          <div className="panel-empty" style={{ padding: '12px' }}>
            States 패널에서 인터랙션을 추가하면 여기에 키프레임이 표시됩니다.
          </div>
        )}
        {displayClips.map(({ ia, clip }) => {
          const el = elements.find((e) => e.id === clip.elementId)
          const rxEl = elements.find((e) => e.id === ia.reaction.elementId)
          return (
            <div key={clip.id} className="timeline-clip">
              <div className="timeline-clip-header">
                <span className="timeline-clip-trigger">
                  {el?.label ?? '?'}.{ia.trigger.event}
                </span>
                <span className="timeline-clip-arrow">→</span>
                <span className="timeline-clip-reaction">
                  {rxEl?.label ?? '?'} ({ia.reaction.animation})
                </span>
                <span className="timeline-clip-duration">{clip.duration}ms</span>
                <span className="timeline-clip-easing">{clip.easing}</span>
              </div>
              {clip.tracks.map((track, ti) => (
                <div key={ti} className="timeline-track" style={{ height: TRACK_HEIGHT }}>
                  <div className="timeline-left-col" style={{ width: LEFT_WIDTH }}>
                    <span className="timeline-prop-name">{track.property}</span>
                    <span className="timeline-prop-range">
                      {formatValue(track.property, track.keyframes[0]?.value)}
                      {' → '}
                      {formatValue(track.property, track.keyframes[track.keyframes.length - 1]?.value)}
                    </span>
                  </div>
                  <div
                    className="timeline-track-area"
                    style={{ width: rulerWidth }}
                    onClick={(e) => handleTrackClick(clip.id, ti, e)}
                  >
                    {track.keyframes.length >= 2 && (
                      <div
                        className="timeline-track-bar"
                        style={{
                          left: msToX(track.keyframes[0].time),
                          width: msToX(track.keyframes[track.keyframes.length - 1].time - track.keyframes[0].time),
                        }}
                      />
                    )}
                    {track.keyframes.map((kf, ki) => (
                      <div
                        key={ki}
                        className={`keyframe-diamond ${editingKf?.clipId === clip.id && editingKf?.trackIdx === ti && editingKf?.kfIdx === ki ? 'editing' : ''}`}
                        style={{ left: msToX(kf.time) - DIAMOND_SIZE / 2 }}
                        title={`${kf.time}ms = ${formatValue(track.property, kf.value)}`}
                        onPointerDown={(e) => handleDragStart(clip.id, ti, ki, e)}
                        onDoubleClick={(e) => handleKfDoubleClick(clip.id, ti, ki, e)}
                        onContextMenu={(e) => handleKfContextMenu(clip.id, ti, ki, e)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

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

function formatValue(prop: AnimatableProperty, value: number | undefined): string {
  if (value === undefined) return '?'
  if (prop === 'color') return `#${value.toString(16).padStart(6, '0')}`
  if (prop === 'opacity' || prop === 'radius') return value.toFixed(2)
  return String(Math.round(value))
}

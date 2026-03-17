// DOM left sidebar — layer labels, property dropdowns, remove buttons.

import type { AnimatableProperty } from '../animation/types'
import { X } from '@phosphor-icons/react'
import { type DisplayClipEntry, formatValue, TRACK_HEIGHT, LAYER_HEADER_HEIGHT, RULER_HEIGHT, INDENT_PX, ANIMATABLE_PROPERTIES } from './timelineTypes'

interface TimelineSidebarProps {
  displayClips: DisplayClipEntry[]
  onAddTrack: (bundleId: string, clipId: string, property: AnimatableProperty) => void
  onRemoveTrack: (clipId: string, trackIdx: number, bundleId?: string) => void
  onRemoveClip: (bundleId: string, clipId: string) => void
  scrollY: number
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
}

export default function TimelineSidebar({
  displayClips, onAddTrack, onRemoveTrack, onRemoveClip, onScroll,
}: TimelineSidebarProps) {
  return (
    <div className="timeline-left-panel" onScroll={onScroll}>
      <div style={{ height: RULER_HEIGHT, flexShrink: 0 }} />
      {displayClips.length === 0 && (
        <div className="panel-empty" style={{ padding: '8px', fontSize: 11 }}>속성 트랙을 추가하세요.</div>
      )}
      {displayClips.map((entry) => (
        <div key={entry.clip.id}>
          <div className="tl-left-layer" style={{ height: LAYER_HEADER_HEIGHT, paddingLeft: entry.depth * INDENT_PX }}>
            <span className="tl-left-label">{entry.label}</span>
            {entry.bundleId && (
              <div className="tl-left-actions">
                <select
                  className="field-select field-select-small"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) onAddTrack(entry.bundleId!, entry.clip.id, e.target.value as AnimatableProperty)
                    e.target.value = ''
                  }}
                >
                  <option value="">+</option>
                  {ANIMATABLE_PROPERTIES
                    .filter((p) => !entry.clip.tracks.some((t) => t.property === p))
                    .map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="btn-icon" onClick={() => onRemoveClip(entry.bundleId!, entry.clip.id)}><X size={10} /></button>
              </div>
            )}
          </div>
          {entry.clip.tracks.map((track, ti) => (
            <div key={ti} className="tl-left-track" style={{ height: TRACK_HEIGHT, paddingLeft: entry.depth * INDENT_PX }}>
              <span className="tl-left-prop">{track.property}</span>
              <span className="tl-left-range">
                {formatValue(track.property as AnimatableProperty, track.keyframes[0]?.value)}
                →
                {formatValue(track.property as AnimatableProperty, track.keyframes[track.keyframes.length - 1]?.value)}
              </span>
              {entry.bundleId && (
                <button className="btn-icon tl-track-del" onClick={() => onRemoveTrack(entry.clip.id, ti, entry.bundleId)}><X size={10} /></button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

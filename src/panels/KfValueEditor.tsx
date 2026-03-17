// Inline keyframe value editor (double-click to open).

import type { AnimatableProperty } from '../animation/types'
import type { DisplayClipEntry } from './timelineTypes'
import { formatValue } from './timelineTypes'

interface Props {
  clipId: string
  trackIdx: number
  kfIdx: number
  value: string
  bundleId?: string
  displayClips: DisplayClipEntry[]
  onChange: (value: string) => void
  onCommit: () => void
  onClose: () => void
}

export default function KfValueEditor({ clipId, trackIdx, value, displayClips, onChange, onCommit, onClose }: Props) {
  const entry = displayClips.find((c) => c.clip.id === clipId)
  const prop = entry?.clip.tracks[trackIdx]?.property as AnimatableProperty | undefined

  return (
    <div className="kf-editor-overlay" onClick={onClose}>
      <div className="kf-editor" onClick={(e) => e.stopPropagation()}>
        <input
          className="field-input"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onClose() }}
          placeholder={prop ? formatValue(prop, undefined) : ''}
        />
        <button className="btn-small" onClick={onCommit}>OK</button>
      </div>
    </div>
  )
}

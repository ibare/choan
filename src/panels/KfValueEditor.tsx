// Inline keyframe value editor — uses Radix Dialog for overlay.

import { Dialog } from '../components/ui/Dialog'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <Input
        className="kf-editor-input"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onClose() }}
        placeholder={prop ? formatValue(prop, undefined) : ''}
      />
      <Button size="sm" onClick={onCommit}>OK</Button>
    </Dialog>
  )
}

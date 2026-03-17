// Easing type selector popover for keyframe editing.

import type { EasingType } from '../animation/types'
import type { DisplayClipEntry } from './timelineTypes'
import { LEFT_WIDTH, RULER_HEIGHT, LAYER_HEADER_HEIGHT, TRACK_HEIGHT } from './timelineTypes'

interface Props {
  layerIdx: number
  trackIdx: number
  kfIdx: number
  screenX: number
  screenY: number
  displayClips: DisplayClipEntry[]
  onSelect: (easing: EasingType) => void
  onClose: () => void
}

const EASING_TYPES: EasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']

export default function EasingPopover({ layerIdx, trackIdx, kfIdx, screenX, screenY, displayClips, onSelect, onClose }: Props) {
  const entry = displayClips[layerIdx]
  const currentEasing = entry?.clip.tracks[trackIdx]?.keyframes[kfIdx]?.easing

  return (
    <div className="easing-popover-backdrop" onClick={onClose}>
      <div
        className="easing-popover"
        style={{ left: screenX + LEFT_WIDTH, top: screenY + RULER_HEIGHT + LAYER_HEADER_HEIGHT + TRACK_HEIGHT }}
        onClick={(e) => e.stopPropagation()}
      >
        {EASING_TYPES.map((et) => (
          <button key={et} className={`easing-option ${currentEasing === et ? 'active' : ''}`} onClick={() => onSelect(et)}>
            {et}
          </button>
        ))}
      </div>
    </div>
  )
}

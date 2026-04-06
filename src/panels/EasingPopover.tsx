// Easing type selector popover for keyframe editing.

import { createPortal } from 'react-dom'
import { Button } from '../components/ui/Button'
import type { EasingType } from '../animation/types'
import type { DisplayClipEntry } from './timelineTypes'
// screenX/screenY are viewport coordinates (clientX/clientY)

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

  const left = screenX
  const top = screenY

  return createPortal(
    <>
      {/* Invisible backdrop to capture outside clicks */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 190 }}
        onPointerDown={onClose}
      />
      <div
        className="easing-popover"
        style={{ position: 'fixed', left, top, zIndex: 191 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {EASING_TYPES.map((et) => (
          <Button
            key={et}
            className="easing-option"
            active={currentEasing === et}
            onClick={() => onSelect(et)}
          >
            {et}
          </Button>
        ))}
      </div>
    </>,
    document.body,
  )
}

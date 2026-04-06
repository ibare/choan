// Diamond-shaped keyframe toggle button (Apple Motion 5 style).
// Visible only when editing an animation bundle.

import { Diamond } from '@phosphor-icons/react'
import { usePreviewStore } from '../../store/usePreviewStore'
import { useAnimationStore } from '../../store/useAnimationStore'
import { toggleKeyframeAtPlayhead } from '../../animation/addKeyframe'
import type { AnimatableProperty } from '../../animation/types'
import { Tooltip } from '../ui/Tooltip'
import { cn } from '../../design-system'

const SNAP_THRESHOLD = 10

interface KeyframeButtonProps {
  elementId: string
  property: AnimatableProperty
  value: number
}

export function KeyframeButton({ elementId, property, value }: KeyframeButtonProps) {
  const editingBundleId = usePreviewStore((s) => s.editingBundleId)
  const playheadTime = usePreviewStore((s) => s.playheadTime)
  const bundles = useAnimationStore((s) => s.animationBundles)

  if (!editingBundleId) return null

  // Check if keyframe exists at current playhead
  const bundle = bundles.find((b) => b.id === editingBundleId)
  const clip = bundle?.clips.find((c) => c.elementId === elementId)
  const track = clip?.tracks.find((t) => t.property === property)
  const hasKf = track?.keyframes.some(
    (kf) => Math.abs(kf.time - playheadTime) < SNAP_THRESHOLD,
  ) ?? false

  return (
    <Tooltip content={hasKf ? `Remove ${property} keyframe` : `Add ${property} keyframe`}>
      <button
        type="button"
        className={cn('ui-kf-btn', hasKf && 'ui-kf-btn--active')}
        onClick={() => toggleKeyframeAtPlayhead(elementId, property, value)}
      >
        <Diamond size={12} weight={hasKf ? 'fill' : 'regular'} />
      </button>
    </Tooltip>
  )
}

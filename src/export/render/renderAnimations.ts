import type { AnimationBundle } from '../../animation/types'
import type { ChoanElement } from '../../store/useChoanStore'
import { hexToCSS } from '../core/colorUtils'

function formatValue(property: string, value: number): string {
  if (property === 'color') return hexToCSS(value)
  if (property === 'opacity') return value.toFixed(2)
  if (property === 'radius') return (value * 100).toFixed(0) + '%'
  return String(Math.round(value))
}

export function renderAnimations(
  bundles: AnimationBundle[],
  elements: ChoanElement[],
): string {
  if (bundles.length === 0) return ''

  const lines: string[] = ['## Animations', '']

  for (const bundle of bundles) {
    lines.push(`### ${bundle.name}`)
    lines.push('')
    lines.push('| Element | Property | From | To | Duration | Easing |')
    lines.push('|---------|----------|------|----|----------|--------|')

    for (const clip of bundle.clips) {
      const label = elements.find((e) => e.id === clip.elementId)?.label ?? clip.elementId

      for (const track of clip.tracks) {
        const kfs = track.keyframes
        if (kfs.length < 2) continue

        // Emit one row per segment so multi-step animations are fully described
        for (let i = 0; i < kfs.length - 1; i++) {
          const a = kfs[i], b = kfs[i + 1]
          const duration = b.time - a.time
          const easing = a.easing ?? clip.easing ?? 'ease-in-out'
          const from = formatValue(track.property, a.value)
          const to = formatValue(track.property, b.value)
          const timeRange = kfs.length > 2 ? ` (${a.time}–${b.time}ms)` : ` (${duration}ms)`
          lines.push(`| ${label} | ${track.property} | ${from} | ${to} |${timeRange} | ${easing} |`)
        }
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

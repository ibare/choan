import type { ChoanElement } from '../store/useChoanStore'
import type { AnimationBundle } from '../animation/types'

function elementDesc(el: ChoanElement): string {
  const parts: string[] = [`\`${el.label}\``, '—', el.type]
  if (el.role) parts.push(`/ ${el.role}`)
  if (el.z !== 0) parts.push(`/ z:${el.z}`)
  if (el.opacity < 1) parts.push(`/ opacity:${el.opacity}`)
  if (el.lineStyle) parts.push(`/ ${el.lineStyle}`)
  if (el.hasArrow) parts.push('/ arrow')
  return parts.join(' ')
}

function layoutDesc(el: ChoanElement): string {
  return `- ${el.label}: x:${Math.round(el.x)}, y:${Math.round(el.y)}, z:${el.z}, size:${Math.round(el.width)}×${Math.round(el.height)}`
}

export function toMarkdown(
  elements: ChoanElement[],
  animationBundles: AnimationBundle[] = [],
): string {
  const lines: string[] = ['## UI Spec', '']

  // Elements
  lines.push('### Elements')
  if (elements.length === 0) {
    lines.push('_(없음)_')
  } else {
    for (const el of elements) {
      lines.push(`- ${elementDesc(el)}`)
    }
  }
  lines.push('')

  // Layout
  lines.push('### Layout')
  if (elements.length === 0) {
    lines.push('_(없음)_')
  } else {
    for (const el of elements) {
      lines.push(layoutDesc(el))
    }
  }
  lines.push('')

  // Triggers
  const triggeredElements = elements.filter((el) => el.triggers && el.triggers.length > 0)
  if (triggeredElements.length > 0) {
    lines.push('### Triggers')
    for (const el of triggeredElements) {
      for (const trigger of el.triggers!) {
        const bundle = animationBundles.find((b) => b.id === trigger.animationBundleId)
        lines.push(`- ${el.label}.${trigger.event} → ${bundle?.name ?? trigger.animationBundleId}`)
      }
    }
    lines.push('')
  }

  // Animation Bundles
  if (animationBundles.length > 0) {
    lines.push('### Animations')
    for (const bundle of animationBundles) {
      lines.push(`- **${bundle.name}** (${bundle.clips.length} elements)`)
      for (const clip of bundle.clips) {
        const el = elements.find((e) => e.id === clip.elementId)
        if (clip.tracks.length > 0) {
          lines.push(`  - ${el?.label ?? clip.elementId}: ${clip.tracks.map((t) => `${t.property} ${t.keyframes[0]?.value}→${t.keyframes[t.keyframes.length - 1]?.value}`).join(', ')} (${clip.duration}ms, ${clip.easing})`)
        }
      }
    }
  }

  return lines.join('\n')
}

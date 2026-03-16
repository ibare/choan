import type { ChoanElement, GlobalState, Interaction } from '../store/useChoanStore'
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

function stateDesc(gs: GlobalState): string {
  return `- \`${gs.name}\` — ${gs.type}, default: ${gs.default}`
}

function interactionDesc(ia: Interaction, elements: ChoanElement[]): string {
  const trigEl = elements.find((e) => e.id === ia.trigger.elementId)
  const rxEl = elements.find((e) => e.id === ia.reaction.elementId)
  const trigName = trigEl?.label ?? ia.trigger.elementId
  const rxName = rxEl?.label ?? ia.reaction.elementId

  return [
    `- Trigger: ${trigName}.${ia.trigger.event} → ${ia.trigger.stateKey} = ${ia.trigger.value}`,
    `- Reaction: ${rxName} [${ia.reaction.condition}] → ${ia.reaction.animation}, ${ia.reaction.easing}`,
  ].join('\n')
}

export function toMarkdown(
  elements: ChoanElement[],
  globalStates: GlobalState[],
  interactions: Interaction[],
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

  // State
  lines.push('### State')
  if (globalStates.length === 0) {
    lines.push('_(없음)_')
  } else {
    for (const gs of globalStates) {
      lines.push(stateDesc(gs))
    }
  }
  lines.push('')

  // Animation Bundles
  if (animationBundles.length > 0) {
    lines.push('### Animation Bundles')
    for (const bundle of animationBundles) {
      lines.push(`- **${bundle.name}** (${bundle.clips.length} elements)`)
      for (const clip of bundle.clips) {
        const el = elements.find((e) => e.id === clip.elementId)
        lines.push(`  - ${el?.label ?? clip.elementId}: ${clip.tracks.map((t) => `${t.property} ${t.keyframes[0]?.value}→${t.keyframes[t.keyframes.length - 1]?.value}`).join(', ')} (${clip.duration}ms, ${clip.easing})`)
      }
    }
    lines.push('')
  }

  // Interaction
  lines.push('### Interaction')
  if (interactions.length === 0) {
    lines.push('_(없음)_')
  } else {
    for (const ia of interactions) {
      lines.push(interactionDesc(ia, elements))
    }
  }

  return lines.join('\n')
}

import type { ChoanElement } from '../store/useChoanStore'
import type { AnimationBundle } from '../animation/types'
import type { Platform } from './platforms/base'
import { buildTree } from './core/buildTree'
import { webRenderer } from './platforms/web'
import { iosRenderer } from './platforms/ios'
import { androidRenderer } from './platforms/android'
import { renderTree } from './render/renderTree'
import { renderAnimations } from './render/renderAnimations'

function getRenderer(platform: Platform) {
  switch (platform) {
    case 'ios': return iosRenderer
    case 'android': return androidRenderer
    default: return webRenderer
  }
}

function platformLabel(p: Platform): string {
  switch (p) {
    case 'web': return 'Web (HTML / CSS Flexbox)'
    case 'ios': return 'iOS (SwiftUI)'
    case 'android': return 'Android (Jetpack Compose)'
  }
}

/** Derive viewport size from root-level element bounds. */
function inferViewport(elements: ChoanElement[]): string {
  const roots = elements.filter((e) => !e.parentId)
  if (roots.length === 0) return '(empty)'
  if (roots.length === 1) {
    const r = roots[0]
    return `${Math.round(r.width)} × ${Math.round(r.height)}px`
  }
  const maxW = Math.max(...roots.map((e) => e.x + e.width))
  const maxH = Math.max(...roots.map((e) => e.y + e.height))
  return `${Math.round(maxW)} × ${Math.round(maxH)}px`
}

/**
 * Generate an AI-readable UI specification markdown document.
 *
 * @param elements        All canvas elements (flat list).
 * @param animationBundles All animation bundles defined in the project.
 * @param platform        Target platform for implementation hints (default: 'web').
 */
export function toMarkdown(
  elements: ChoanElement[],
  animationBundles: AnimationBundle[] = [],
  platform: Platform = 'web',
): string {
  if (elements.length === 0) {
    return '# UI Spec\n\n_(Canvas is empty)_\n'
  }

  const renderer = getRenderer(platform)
  const tree = buildTree(elements)

  const header = [
    '# UI Spec',
    `**Platform:** ${platformLabel(platform)}`,
    `**Viewport:** ${inferViewport(elements)}`,
    '',
    '---',
    '',
  ]

  const body = renderTree(tree, renderer, animationBundles)
  const animations = renderAnimations(animationBundles, elements)

  return [...header, body, ...(animations ? [animations] : [])].join('\n')
}

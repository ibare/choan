import type { ElementNode } from '../core/buildTree'
import type { PlatformRenderer } from '../platforms/base'
import type { ChoanElement } from '../../store/useChoanStore'
import type { AnimationBundle } from '../../animation/types'

// H2 for root, H3 for first-level children, etc. Cap at H5.
const HEADINGS = ['##', '###', '####', '#####', '######']

function h(depth: number, text: string): string {
  return `${HEADINGS[Math.min(depth, HEADINGS.length - 1)]} ${text}`
}

function typeLabel(el: ChoanElement): string {
  if (el.role === 'container') return 'Container'
  const base = el.type.charAt(0).toUpperCase() + el.type.slice(1)
  if (el.skin) return `${base} / Skin`
  if (el.frame) return `${base} / Frame`
  return base
}

function renderNode(
  node: ElementNode,
  renderer: PlatformRenderer,
  bundles: AnimationBundle[],
  parent: ChoanElement | null,
  out: string[],
): void {
  const { el, children, depth } = node

  // ── Heading ──────────────────────────────────────────────────────────────
  const skinSuffix = el.skin ? ` \`${el.skin}\`` : el.frame ? ` \`${el.frame}\`` : ''
  out.push(h(depth, `${el.label}${skinSuffix}  _(${typeLabel(el)})_`))

  // ── Layout ───────────────────────────────────────────────────────────────
  if (el.role === 'container') {
    const layout = renderer.renderLayout(el)
    if (layout) {
      out.push(`**Layout:** ${layout}`)
    } else {
      // free layout: children are absolutely positioned
      out.push('**Layout:** Free — 자식 요소는 절대 위치로 배치')
    }
  }

  // ── Size ─────────────────────────────────────────────────────────────────
  out.push(`**Size:** ${renderer.renderSize(el, parent)}`)

  // ── Position (free-layout children only) ─────────────────────────────────
  if (parent && (!parent.layoutDirection || parent.layoutDirection === 'free')) {
    out.push(`**Position:** ${renderer.renderPosition(el, parent)}`)
  }

  // ── Visual ───────────────────────────────────────────────────────────────
  const visuals = renderer.renderVisual(el)
  if (visuals.length > 0) {
    out.push(`**Style:** ${visuals.join(' | ')}`)
  }

  // ── Component / Skin ─────────────────────────────────────────────────────
  const skin = renderer.renderSkin(el)
  if (skin) out.push(`**Component:** ${skin}`)

  // ── Interactions ─────────────────────────────────────────────────────────
  if (el.triggers && el.triggers.length > 0) {
    for (const t of el.triggers) {
      const name = bundles.find((b) => b.id === t.animationBundleId)?.name ?? t.animationBundleId
      out.push(`**On ${t.event} →** \`${name}\` 애니메이션 실행`)
    }
  }

  out.push('')

  // ── Children ─────────────────────────────────────────────────────────────
  for (const child of children) {
    renderNode(child, renderer, bundles, el, out)
  }
}

export function renderTree(
  roots: ElementNode[],
  renderer: PlatformRenderer,
  bundles: AnimationBundle[],
): string {
  const out: string[] = []
  for (const root of roots) {
    renderNode(root, renderer, bundles, null, out)
    out.push('---', '')
  }
  return out.join('\n')
}

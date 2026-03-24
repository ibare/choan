import type { ElementNode } from '../core/buildTree'
import type { PlatformRenderer } from '../platforms/base'
import type { ChoanElement } from '../../store/useChoanStore'
import type { AnimationBundle } from '../../animation/types'
import { groupSiblings } from '../core/groupSiblings'

// H2 for root, H3 for first-level children, etc. Cap at H6.
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

// ── Core node renderer ──────────────────────────────────────────────────────

function renderNode(
  node: ElementNode,
  renderer: PlatformRenderer,
  bundles: AnimationBundle[],
  parent: ChoanElement | null,
  out: string[],
  headingPrefix = '',
): void {
  const { el, children, depth } = node

  // Heading
  const skinSuffix = el.skin ? ` \`${el.skin}\`` : el.frame ? ` \`${el.frame}\`` : ''
  out.push(h(depth, `${headingPrefix}${el.label}${skinSuffix}  _(${typeLabel(el)})_`))

  // Layout (containers only)
  if (el.role === 'container') {
    const layout = renderer.renderLayout(el)
    out.push(layout
      ? `**Layout:** ${layout}`
      : '**Layout:** Free — children are absolutely positioned')
  }

  // Size
  out.push(`**Size:** ${renderer.renderSize(el, parent)}`)

  // Position (free-layout children)
  if (parent && (!parent.layoutDirection || parent.layoutDirection === 'free')) {
    out.push(`**Position:** ${renderer.renderPosition(el, parent)}`)
  }

  // Visual
  const visuals = renderer.renderVisual(el)
  if (visuals.length > 0) out.push(`**Style:** ${visuals.join(' | ')}`)

  // Component / Skin
  const skin = renderer.renderSkin(el)
  if (skin) out.push(`**Component:** ${skin}`)

  // Interactions
  if (el.triggers?.length) {
    for (const t of el.triggers) {
      const name = bundles.find((b) => b.id === t.animationBundleId)?.name ?? t.animationBundleId
      out.push(`**On ${t.event} →** Run animation \`${name}\``)
    }
  }

  out.push('')

  // ── Children — detect repeated pattern ─────────────────────────────────
  if (children.length === 0) return

  const grouping = groupSiblings(children)

  if (grouping) {
    const { majority, exceptions } = grouping
    const total = children.length
    const excCount = exceptions.length
    const note = excCount > 0
      ? `${majority.indices.length} common pattern(s), ${excCount} exception(s)`
      : `${total} all same pattern`
    out.push(`> **${total} item(s)** — ${note}`)
    out.push('')

    // Render the representative once, prefixed
    renderNode(majority.representative, renderer, bundles, el, out, `[Pattern ×${majority.indices.length}] `)

    // Render each exception (diffs only)
    for (const exc of exceptions) {
      renderExceptionNode(exc.index, exc.node, exc.diffs, out)
    }
  } else {
    // No dominant pattern — render all children normally
    for (const child of children) {
      renderNode(child, renderer, bundles, el, out)
    }
  }
}

// ── Exception node (diffs only) ─────────────────────────────────────────────

function renderExceptionNode(
  ordinal: number,
  node: ElementNode,
  diffs: string[],
  out: string[],
): void {
  const { el, depth } = node
  const skinSuffix = el.skin ? ` \`${el.skin}\`` : ''
  out.push(h(depth, `[Exception #${ordinal}] ${el.label}${skinSuffix}  _(${typeLabel(el)})_`))
  out.push('**Changed properties:**')
  for (const diff of diffs) {
    out.push(`- ${diff}`)
  }
  out.push('')
}

// ── Public entry point ───────────────────────────────────────────────────────

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

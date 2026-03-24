import type { ElementNode } from './buildTree'
import { fingerprint } from './fingerprint'
import { hexToCSS } from './colorUtils'
import { describeComponentState } from './describeComponentState'

export interface PatternGroup {
  fp: string
  indices: number[]       // original child indices belonging to this group
  representative: ElementNode
}

export interface SiblingGrouping {
  majority: PatternGroup
  exceptions: Array<{
    index: number         // 1-based ordinal in original children array
    node: ElementNode
    diffs: string[]       // human-readable diff vs majority pattern
  }>
}

/**
 * Groups sibling nodes by structural fingerprint.
 * Returns null when no single pattern covers more than 50% of children,
 * or when there are fewer than 2 children.
 */
export function groupSiblings(children: ElementNode[]): SiblingGrouping | null {
  if (children.length < 2) return null

  // Build fingerprint → indices map
  const fpMap = new Map<string, number[]>()
  for (let i = 0; i < children.length; i++) {
    const fp = fingerprint(children[i])
    if (!fpMap.has(fp)) fpMap.set(fp, [])
    fpMap.get(fp)!.push(i)
  }

  // Find dominant group (strictly > 50%)
  let majority: PatternGroup | null = null
  for (const [fp, indices] of fpMap) {
    if (indices.length > children.length / 2) {
      if (!majority || indices.length > majority.indices.length) {
        majority = { fp, indices, representative: children[indices[0]] }
      }
    }
  }

  if (!majority || majority.indices.length < 2) return null

  const majoritySet = new Set(majority.indices)
  const exceptions = children
    .map((node, i) => ({ node, i }))
    .filter(({ i }) => !majoritySet.has(i))
    .map(({ node, i }) => ({
      index: i + 1,   // 1-based for human-readable output
      node,
      diffs: diffNodes(majority!.representative, node),
    }))

  return { majority, exceptions }
}

/** Returns a list of human-readable differences between pattern and exception nodes. */
function diffNodes(pattern: ElementNode, exc: ElementNode): string[] {
  const p = pattern.el
  const e = exc.el
  const diffs: string[] = []

  if (p.color !== e.color) {
    const from = p.color !== undefined ? hexToCSS(p.color) : '(none)'
    const to   = e.color !== undefined ? hexToCSS(e.color) : '(none)'
    diffs.push(`background: ${from} → ${to}`)
  }

  if ((p.radius ?? 0).toFixed(2) !== (e.radius ?? 0).toFixed(2)) {
    const fromPx = Math.round((p.radius ?? 0) * Math.min(p.width, p.height) / 2)
    const toPx   = Math.round((e.radius ?? 0) * Math.min(e.width, e.height) / 2)
    diffs.push(`border-radius: ${fromPx}px → ${toPx}px`)
  }

  if (p.skin !== e.skin) {
    diffs.push(`skin: ${p.skin ?? '(none)'} → ${e.skin ?? '(none)'}`)
  }

  if (Math.round(p.width) !== Math.round(e.width) || Math.round(p.height) !== Math.round(e.height)) {
    diffs.push(`size: ${Math.round(p.width)}×${Math.round(p.height)}px → ${Math.round(e.width)}×${Math.round(e.height)}px`)
  }

  if (JSON.stringify(p.componentState ?? {}) !== JSON.stringify(e.componentState ?? {})) {
    const fromDesc = (p.skin && describeComponentState(p.skin, p.componentState)) ?? JSON.stringify(p.componentState ?? {})
    const toDesc   = (e.skin && describeComponentState(e.skin, e.componentState)) ?? JSON.stringify(e.componentState ?? {})
    diffs.push(`content: ${fromDesc} → ${toDesc}`)
  }

  if (diffs.length === 0) diffs.push('(structural differences)')
  return diffs
}

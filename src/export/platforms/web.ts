import type { ChoanElement } from '../../store/useChoanStore'
import type { PlatformRenderer } from './base'
import { DEFAULT_LAYOUT_COLUMNS } from '../../constants'
import { hexToCSS } from '../core/colorUtils'
import { describeComponentState } from '../core/describeComponentState'

export const webRenderer: PlatformRenderer = {
  platform: 'web',

  renderLayout(el: ChoanElement): string | null {
    const dir = el.layoutDirection
    if (!dir || dir === 'free') return null

    const parts: string[] = []
    if (dir === 'row') parts.push('Row `flex-direction: row`')
    else if (dir === 'column') parts.push('Column `flex-direction: column`')
    else if (dir === 'grid') parts.push(`Grid \`grid-template-columns: repeat(${el.layoutColumns ?? DEFAULT_LAYOUT_COLUMNS}, 1fr)\``)

    if (el.layoutGap) parts.push(`gap: ${el.layoutGap}px`)
    if (el.layoutPadding) parts.push(`padding: ${el.layoutPadding}px`)

    return parts.join(' | ')
  },

  renderSize(el: ChoanElement, parent: ChoanElement | null): string {
    const w = Math.round(el.width)
    const h = Math.round(el.height)

    const parentDir = parent?.layoutDirection
    const inAutoLayout = parent && parentDir && parentDir !== 'free'
    if (!inAutoLayout) return `${w} × ${h}px`

    const sizing = el.layoutSizing ?? 'equal'
    const isRow = parentDir === 'row'

    switch (sizing) {
      case 'fill':
        return isRow
          ? `flex: 1 (fill remaining horizontal space) × ${h}px`
          : `${w}px × flex: 1 (fill remaining vertical space)`
      case 'fixed-px':
        return `${w} × ${h}px (fixed)`
      case 'fixed-ratio':
        return `${w} × ${h}px (fixed ratio: ${((el.layoutRatio ?? 0.5) * 100).toFixed(0)}%)`
      default: // equal
        return `${w} × ${h}px (equal split)`
    }
  },

  renderVisual(el: ChoanElement): string[] {
    const parts: string[] = []

    if (el.type === 'circle') {
      parts.push('border-radius: 50%')
    } else if (el.radius && el.radius > 0) {
      const px = Math.round(el.radius * Math.min(el.width, el.height) / 2)
      parts.push(`border-radius: ${px}px`)
    }

    if (el.color !== undefined) {
      parts.push(`background: ${hexToCSS(el.color)}`)
    }

    if (el.z !== 0) {
      parts.push(`z-index: ${el.z}`)
    }

    if (el.lineStyle) {
      const dir = el.lineDirection ? ` ${el.lineDirection}` : ''
      const arrow = el.hasArrow ? ' →' : ''
      parts.push(`border: ${el.lineStyle}${dir}${arrow}`)
    }

    return parts
  },

  renderSkin(el: ChoanElement): string | null {
    if (el.frame) return `\`${el.frame}\` device frame`
    if (!el.skin) return null
    const onlyNote = el.skinOnly ? ' (skin only)' : el.frameless ? ' (frameless)' : ''
    const content = describeComponentState(el.skin, el.componentState)
    const contentNote = content ? ` — ${content}` : ''
    return `\`${el.skin}\`${onlyNote}${contentNote}`
  },

  renderPosition(el: ChoanElement, parent: ChoanElement): string {
    const x = Math.round(el.x - parent.x)
    const y = Math.round(el.y - parent.y)
    return `position: absolute | left: ${x}px, top: ${y}px`
  },
}

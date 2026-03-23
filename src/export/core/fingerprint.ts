import type { ElementNode } from './buildTree'

/**
 * Creates a canonical string signature for structural + visual comparison.
 * Excludes: id, label, x, y (position varies per grid item), z (stacking order).
 * Includes: type, layout, size, style, skin, children (recursive).
 */
export function fingerprint(node: ElementNode): string {
  const { el, children } = node
  const parts = [
    el.type,
    el.role ?? '',
    el.layoutDirection ?? '',
    String(el.layoutGap ?? 0),
    String(el.layoutPadding ?? 0),
    String(el.layoutColumns ?? 0),
    el.layoutSizing ?? 'equal',
    String((el.layoutRatio ?? 0).toFixed(2)),
    String(Math.round(el.width)),
    String(Math.round(el.height)),
    String(el.color ?? ''),
    String((el.radius ?? 0).toFixed(2)),
    el.opacity.toFixed(2),
    el.skin ?? '',
    String(el.skinOnly ?? false),
    String(el.frameless ?? false),
    el.frame ?? '',
    el.lineStyle ?? '',
    el.lineDirection ?? '',
    String(el.hasArrow ?? false),
    el.componentState ? JSON.stringify(el.componentState) : '',
    // Recurse into children (order matters for layout)
    children.map(fingerprint).join('|'),
  ]
  return parts.join(':')
}

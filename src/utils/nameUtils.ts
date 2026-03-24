// Element name inference — structure-based naming.

import { SKIN_BY_ID } from '../config/skins'
import type { ChoanElement } from '../store/useChoanStore'

/** Infer a descriptive name for an element based on its structure:
 *  skin, frame, type, role, layout direction, and children. */
export function inferElementName(el: ChoanElement, elements: ChoanElement[]): string {
  if (el.frame === 'browser') return 'Browser'
  if (el.frame === 'mobile')  return 'Mobile'
  if (el.skin) return SKIN_BY_ID.get(el.skin)?.label ?? el.skin
  if (el.type === 'circle') return 'Circle'
  if (el.type === 'line')   return 'Line'

  // rectangle
  if (el.role !== 'container') return 'Rect'

  // container — use layout direction as hint
  const childCount = elements.filter((e) => e.parentId === el.id).length
  if (childCount === 0) return 'Frame'

  const dir = el.layoutDirection
  if (dir === 'row')    return 'Row'
  if (dir === 'column') return 'Column'
  if (dir === 'grid')   return 'Grid'
  return 'Group'
}

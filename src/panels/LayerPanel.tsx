// Layer panel — tree view of elements with parent/child hierarchy.

import { ArrowCounterClockwise, Rectangle, Circle, LineSegment } from '@phosphor-icons/react'
import { Tooltip } from '../components/ui/Tooltip'
import { useChoanStore } from '../store/useChoanStore'
import { buildLayerTree } from '../animation/buildLayerTree'
import { inferElementName } from '../utils/nameUtils'

const TYPE_ICON: Record<string, React.ReactNode> = {
  rectangle: <Rectangle size={12} weight="fill" />,
  circle: <Circle size={12} weight="fill" />,
  line: <LineSegment size={12} />,
}

export default function LayerPanel() {
  const { elements, selectedIds, selectElement, toggleSelectElement, updateElement } = useChoanStore()
  const tree = buildLayerTree(elements)

  const handleRenameAll = () => {
    for (const el of elements) {
      updateElement(el.id, { label: inferElementName(el, elements) })
    }
  }

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <span>Layers</span>
        <Tooltip content="Rename all elements">
          <button
            className="ui-btn ui-btn--ghost ui-btn--icon"
            onClick={handleRenameAll}
          >
            <ArrowCounterClockwise size={13} />
          </button>
        </Tooltip>
      </div>
      <div className="layer-panel-list">
        {tree.length === 0 && (
          <div className="layer-empty">No elements</div>
        )}
        {tree.map(({ el, depth }) => {
          const isSelected = selectedIds.includes(el.id)
          return (
            <div
              key={el.id}
              className={`layer-item ${isSelected ? 'selected' : ''}`}
              style={{ paddingLeft: 8 + depth * 16 }}
              onClick={(e) => {
                if (e.shiftKey) toggleSelectElement(el.id)
                else selectElement(el.id)
              }}
            >
              <span className="layer-item-icon">{TYPE_ICON[el.type] ?? <Rectangle size={12} />}</span>
              <span className="layer-item-label">{el.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

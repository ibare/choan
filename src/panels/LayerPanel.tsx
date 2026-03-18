// Layer panel — tree view of elements with parent/child hierarchy.

import { useChoanStore } from '../store/useChoanStore'
import { buildLayerTree } from '../animation/buildLayerTree'
import { Rectangle, Circle, LineSegment } from '@phosphor-icons/react'

const TYPE_ICON: Record<string, React.ReactNode> = {
  rectangle: <Rectangle size={12} weight="fill" />,
  circle: <Circle size={12} weight="fill" />,
  line: <LineSegment size={12} />,
}

export default function LayerPanel() {
  const { elements, selectedIds, selectElement, toggleSelectElement } = useChoanStore()
  const tree = buildLayerTree(elements)

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">Layers</div>
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

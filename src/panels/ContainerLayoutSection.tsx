// Container layout properties section for PropertiesPanel.

import type { ChoanElement } from '../store/useChoanStore'

interface Props {
  el: ChoanElement
  childCount: number
  onChange: (patch: Record<string, unknown>) => void
}

const DIRECTIONS = ['free', 'row', 'column', 'grid'] as const

export default function ContainerLayoutSection({ el, childCount, onChange }: Props) {
  const dir = el.layoutDirection ?? 'free'
  const hasLayout = dir !== 'free'

  return (
    <>
      <div className="sub-title">Container Layout</div>

      <label className="field-label">Direction</label>
      <div className="radio-group">
        {DIRECTIONS.map((d) => (
          <label key={d} className={`radio-option ${dir === d ? 'active' : ''}`}>
            <input type="radio" name="layoutDirection" value={d} checked={dir === d}
              onChange={() => onChange({ layoutDirection: d })} />
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </label>
        ))}
      </div>

      {hasLayout && (
        <>
          {dir === 'grid' && (
            <>
              <label className="field-label">Columns</label>
              <input className="field-input" type="number" min={1} max={12} style={{ width: 60 }}
                value={el.layoutColumns ?? 2}
                onChange={(e) => onChange({ layoutColumns: Math.max(1, Number(e.target.value)) })} />
            </>
          )}

          <label className="field-label">Gap</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input className="field-input" type="number" min={0} style={{ width: 60 }}
              value={el.layoutGap ?? 8}
              onChange={(e) => onChange({ layoutGap: Math.max(0, Number(e.target.value)) })} />
            <span style={{ fontSize: 11, color: '#888' }}>px</span>
          </div>

          <label className="field-label">Padding</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input className="field-input" type="number" min={0} style={{ width: 60 }}
              value={el.layoutPadding ?? 8}
              onChange={(e) => onChange({ layoutPadding: Math.max(0, Number(e.target.value)) })} />
            <span style={{ fontSize: 11, color: '#888' }}>px</span>
          </div>
        </>
      )}

      <label className="field-label">Children</label>
      <div className="field-value">{childCount} elements</div>
    </>
  )
}

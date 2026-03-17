// Container layout properties section for PropertiesPanel.

import type { ChoanElement } from '../store/useChoanStore'

interface Props {
  el: ChoanElement
  childCount: number
  onChange: (patch: Record<string, unknown>) => void
}

export default function ContainerLayoutSection({ el, childCount, onChange }: Props) {
  return (
    <>
      <div className="sub-title">Container Layout</div>

      <label className="field-label">Direction</label>
      <select
        className="field-select"
        value={el.layoutDirection ?? 'free'}
        onChange={(e) => onChange({ layoutDirection: e.target.value })}
      >
        <option value="free">Free</option>
        <option value="column">Column</option>
        <option value="row">Row</option>
      </select>

      {(el.layoutDirection === 'row' || el.layoutDirection === 'column') && (
        <>
          <label className="field-label">Gap</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              className="field-input"
              type="number"
              min={0}
              style={{ width: 60 }}
              value={el.layoutGap ?? 8}
              onChange={(e) => onChange({ layoutGap: Math.max(0, Number(e.target.value)) })}
            />
            <span style={{ fontSize: 11, color: '#888' }}>px</span>
          </div>

          <label className="field-label">Padding</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              className="field-input"
              type="number"
              min={0}
              style={{ width: 60 }}
              value={el.layoutPadding ?? 8}
              onChange={(e) => onChange({ layoutPadding: Math.max(0, Number(e.target.value)) })}
            />
            <span style={{ fontSize: 11, color: '#888' }}>px</span>
          </div>
        </>
      )}

      <label className="field-label">Children</label>
      <div className="field-value">{childCount} elements</div>
    </>
  )
}

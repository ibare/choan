import { useChoanStore } from '../store/useChoanStore'
import type { ElementRole, LineStyle } from '../store/useChoanStore'

const ROLES: ElementRole[] = ['container', 'image', 'button', 'input', 'card']
const LINE_STYLES: LineStyle[] = ['solid', 'dashed']

export default function PropertiesPanel() {
  const { elements, selectedId, updateElement, removeElement } = useChoanStore()
  const el = elements.find((e) => e.id === selectedId)

  if (!el) {
    return (
      <div className="panel">
        <div className="panel-title">Properties</div>
        <p className="panel-empty">선택된 요소 없음</p>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-title">Properties</div>

      <label className="field-label">Label</label>
      <input
        className="field-input"
        value={el.label}
        onChange={(e) => updateElement(el.id, { label: e.target.value })}
      />

      <label className="field-label">Type</label>
      <div className="field-value">{el.type}</div>

      {el.type !== 'line' && (
        <>
          <label className="field-label">Role</label>
          <select
            className="field-select"
            value={el.role ?? 'container'}
            onChange={(e) => updateElement(el.id, { role: e.target.value as ElementRole })}
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </>
      )}

      {el.type === 'line' && (
        <>
          <label className="field-label">Line Style</label>
          <select
            className="field-select"
            value={el.lineStyle ?? 'solid'}
            onChange={(e) => updateElement(el.id, { lineStyle: e.target.value as LineStyle })}
          >
            {LINE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <label className="field-label">Arrow</label>
          <input
            type="checkbox"
            checked={el.hasArrow ?? false}
            onChange={(e) => updateElement(el.id, { hasArrow: e.target.checked })}
          />
        </>
      )}

      <label className="field-label">Z (Depth)</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          className="field-input"
          type="number"
          style={{ width: 60 }}
          value={el.z}
          onChange={(e) => updateElement(el.id, { z: Number(e.target.value) })}
        />
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={el.z}
          style={{ flex: 1 }}
          onChange={(e) => updateElement(el.id, { z: Number(e.target.value) })}
        />
      </div>

      <label className="field-label">Opacity</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={el.opacity}
          style={{ flex: 1 }}
          onChange={(e) => updateElement(el.id, { opacity: Number(e.target.value) })}
        />
        <span style={{ fontSize: 11, color: '#666', width: 32 }}>{Math.round(el.opacity * 100)}%</span>
      </div>

      <label className="field-label">Position</label>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="field-input"
          type="number"
          placeholder="X"
          style={{ width: '50%' }}
          value={Math.round(el.x)}
          onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })}
        />
        <input
          className="field-input"
          type="number"
          placeholder="Y"
          style={{ width: '50%' }}
          value={Math.round(el.y)}
          onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })}
        />
      </div>

      <label className="field-label">Size</label>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="field-input"
          type="number"
          placeholder="W"
          style={{ width: '50%' }}
          value={Math.round(el.width)}
          onChange={(e) => updateElement(el.id, { width: Number(e.target.value) })}
        />
        <input
          className="field-input"
          type="number"
          placeholder="H"
          style={{ width: '50%' }}
          value={Math.round(el.height)}
          onChange={(e) => updateElement(el.id, { height: Number(e.target.value) })}
        />
      </div>

      <button
        className="btn btn-danger"
        style={{ marginTop: 12 }}
        onClick={() => removeElement(el.id)}
      >
        Delete
      </button>
    </div>
  )
}

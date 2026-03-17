import { useState } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import type { ElementRole, LineStyle, ElementTrigger } from '../store/useChoanStore'
import { Plus, X } from '@phosphor-icons/react'
import { autoKeyframe } from '../animation/autoKeyframe'
import type { AnimatableProperty } from '../animation/types'

const ROLES: ElementRole[] = ['container', 'image', 'button', 'input', 'card']
const LINE_STYLES: LineStyle[] = ['solid', 'dashed']

export default function PropertiesPanel() {
  const { elements, selectedIds, updateElement, removeElement, runLayout, animationBundles } = useChoanStore()
  const [newTriggerEvent, setNewTriggerEvent] = useState<'click' | 'hover'>('click')
  const [newTriggerBundle, setNewTriggerBundle] = useState('')
  const selectedId = selectedIds[0] ?? null
  const el = elements.find((e) => e.id === selectedId)

  if (!el) {
    return (
      <div className="panel">
        <div className="panel-title">Properties</div>
        <p className="panel-empty">선택된 요소 없음</p>
      </div>
    )
  }

  // Helper: update element + auto-keyframe if editing an animation
  const updateAnimatable = (prop: AnimatableProperty, value: number) => {
    const old = (el as Record<string, unknown>)[prop] as number | undefined
    updateElement(el.id, { [prop]: value })
    autoKeyframe(el.id, prop, value, old ?? 0)
  }

  const isChild = !!el.parentId
  const parentElForLayout = isChild ? elements.find((e) => e.id === el.parentId) : null
  const isManaged = isChild && parentElForLayout?.layoutDirection !== 'free' && parentElForLayout?.layoutDirection !== undefined
  const isContainer = el.role === 'container'
  const childCount = isContainer ? elements.filter((e) => e.parentId === el.id).length : 0
  const parentEl = isChild ? elements.find((e) => e.id === el.parentId) : null

  const handleContainerProp = (patch: Record<string, unknown>) => {
    updateElement(el.id, patch)
    // runLayout after state settles
    setTimeout(() => useChoanStore.getState().runLayout(el.id), 0)
  }

  const handleRoleChange = (newRole: ElementRole) => {
    const oldRole = el.role
    updateElement(el.id, { role: newRole })
    // If changing away from container, orphan children
    if (oldRole === 'container' && newRole !== 'container') {
      const children = elements.filter((e) => e.parentId === el.id)
      for (const child of children) {
        updateElement(child.id, { parentId: undefined })
      }
    }
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
            onChange={(e) => handleRoleChange(e.target.value as ElementRole)}
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </>
      )}

      {/* Container layout properties */}
      {isContainer && (
        <>
          <div className="sub-title">Container Layout</div>

          <label className="field-label">Direction</label>
          <select
            className="field-select"
            value={el.layoutDirection ?? 'free'}
            onChange={(e) => handleContainerProp({ layoutDirection: e.target.value })}
          >
            <option value="free">Free</option>
            <option value="column">Column</option>
            <option value="row">Row</option>
          </select>

          {(el.layoutDirection === 'row' || el.layoutDirection === 'column') && <>
          <label className="field-label">Gap</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              className="field-input"
              type="number"
              min={0}
              style={{ width: 60 }}
              value={el.layoutGap ?? 8}
              onChange={(e) => handleContainerProp({ layoutGap: Math.max(0, Number(e.target.value)) })}
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
              onChange={(e) => handleContainerProp({ layoutPadding: Math.max(0, Number(e.target.value)) })}
            />
            <span style={{ fontSize: 11, color: '#888' }}>px</span>
          </div>
          </>}

          <label className="field-label">Children</label>
          <div className="field-value">{childCount} elements</div>
        </>
      )}

      {/* Child indicator */}
      {isChild && parentEl && (
        <>
          <div className="sub-title">Layout</div>
          <label className="field-label">Parent</label>
          <div className="field-value">{parentEl.label}</div>
        </>
      )}

      {el.type === 'rectangle' && (
        <>
          <label className="field-label">Radius</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={el.radius ?? 0}
              style={{ flex: 1 }}
              onChange={(e) => updateAnimatable('radius', Number(e.target.value))}
            />
            <span style={{ fontSize: 11, color: '#666', width: 32 }}>{Math.round((el.radius ?? 0) * 100)}%</span>
          </div>
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

      <label className="field-label">Z (Depth){isChild ? ' — auto' : ''}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          className="field-input"
          type="number"
          style={{ width: 60 }}
          value={el.z}
          disabled={isChild}
          onChange={(e) => {
            updateElement(el.id, { z: Number(e.target.value) })
            if (isContainer) setTimeout(() => useChoanStore.getState().runLayout(el.id), 0)
          }}
        />
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={el.z}
          disabled={isChild}
          style={{ flex: 1 }}
          onChange={(e) => {
            updateElement(el.id, { z: Number(e.target.value) })
            if (isContainer) setTimeout(() => useChoanStore.getState().runLayout(el.id), 0)
          }}
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
          onChange={(e) => updateAnimatable('opacity', Number(e.target.value))}
        />
        <span style={{ fontSize: 11, color: '#666', width: 32 }}>{Math.round(el.opacity * 100)}%</span>
      </div>

      <label className="field-label">Position{isManaged ? ' — managed' : ''}</label>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="field-input"
          type="number"
          placeholder="X"
          style={{ width: '50%' }}
          value={Math.round(el.x)}
          disabled={isManaged}
          onChange={(e) => updateAnimatable('x', Number(e.target.value))}
        />
        <input
          className="field-input"
          type="number"
          placeholder="Y"
          style={{ width: '50%' }}
          value={Math.round(el.y)}
          disabled={isManaged}
          onChange={(e) => updateAnimatable('y', Number(e.target.value))}
        />
      </div>

      <label className="field-label">Size{isManaged ? ' — managed' : ''}</label>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="field-input"
          type="number"
          placeholder="W"
          style={{ width: '50%' }}
          value={Math.round(el.width)}
          disabled={isManaged}
          onChange={(e) => updateAnimatable('width', Number(e.target.value))}
        />
        <input
          className="field-input"
          type="number"
          placeholder="H"
          style={{ width: '50%' }}
          value={Math.round(el.height)}
          disabled={isManaged}
          onChange={(e) => updateAnimatable('height', Number(e.target.value))}
        />
      </div>

      {/* ── Triggers ── */}
      <div className="sub-title" style={{ marginTop: 8 }}>Triggers</div>
      {(el.triggers ?? []).map((trigger, i) => {
        const bundle = animationBundles.find((b) => b.id === trigger.animationBundleId)
        return (
          <div key={i} className="trigger-item">
            <span className="trigger-event">{trigger.event}</span>
            <span className="trigger-arrow">→</span>
            <span className="trigger-bundle">{bundle?.name ?? '?'}</span>
            <button className="btn-icon" onClick={() => {
              const newTriggers = (el.triggers ?? []).filter((_, idx) => idx !== i)
              updateElement(el.id, { triggers: newTriggers })
            }}><X size={10} /></button>
          </div>
        )
      })}
      {animationBundles.length > 0 && (
        <div className="add-row" style={{ marginTop: 4 }}>
          <select className="field-select" style={{ flex: 1 }} value={newTriggerEvent} onChange={(e) => setNewTriggerEvent(e.target.value as 'click' | 'hover')}>
            <option value="click">click</option>
            <option value="hover">hover</option>
          </select>
          <select className="field-select" style={{ flex: 2 }} value={newTriggerBundle} onChange={(e) => setNewTriggerBundle(e.target.value)}>
            <option value="">animation...</option>
            {animationBundles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button className="btn btn-small" onClick={() => {
            if (!newTriggerBundle) return
            const newTrigger: ElementTrigger = { event: newTriggerEvent, animationBundleId: newTriggerBundle }
            updateElement(el.id, { triggers: [...(el.triggers ?? []), newTrigger] })
            setNewTriggerBundle('')
          }}><Plus size={12} /></button>
        </div>
      )}
      {animationBundles.length === 0 && (
        <div className="panel-empty">타임라인에서 애니메이션을 먼저 만드세요.</div>
      )}

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

import { useChoanStore } from '../store/useChoanStore'
import type { ElementRole, LineStyle } from '../store/useChoanStore'
import { autoKeyframe } from '../animation/autoKeyframe'
import type { AnimatableProperty } from '../animation/types'
import ContainerLayoutSection from './ContainerLayoutSection'
import TriggersSection from './TriggersSection'

const ROLES: ElementRole[] = ['container', 'image', 'button', 'input', 'card']
const LINE_STYLES: LineStyle[] = ['solid', 'dashed']
const SKINS = ['', 'switch'] // '' = no skin

export default function PropertiesPanel() {
  const { elements, selectedIds, updateElement, removeElement, runLayout, animationBundles } = useChoanStore()
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
    setTimeout(() => useChoanStore.getState().runLayout(el.id), 0)
  }

  const handleRoleChange = (newRole: ElementRole) => {
    const oldRole = el.role
    updateElement(el.id, { role: newRole })
    if (oldRole === 'container' && newRole !== 'container') {
      for (const child of elements.filter((e) => e.parentId === el.id)) {
        updateElement(child.id, { parentId: undefined })
      }
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">Properties</div>

      <label className="field-label">Label</label>
      <input className="field-input" value={el.label} onChange={(e) => updateElement(el.id, { label: e.target.value })} />

      <label className="field-label">Type</label>
      <div className="field-value">{el.type}</div>

      {el.type !== 'line' && (
        <>
          <label className="field-label">Role</label>
          <select className="field-select" value={el.role ?? 'container'} onChange={(e) => handleRoleChange(e.target.value as ElementRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </>
      )}

      <label className="field-label">Skin</label>
      <select className="field-select" value={el.skin ?? ''} onChange={(e) => updateElement(el.id, { skin: e.target.value || undefined })}>
        {SKINS.map((s) => <option key={s} value={s}>{s || 'None'}</option>)}
      </select>

      {el.skin === 'switch' && (
        <>
          <label className="field-label">State</label>
          <div className="radio-group">
            {(['Off', 'On'] as const).map((label, i) => {
              const isActive = !!(el.componentState as Record<string, unknown> | undefined)?.on === (i === 1)
              return (
                <label key={label} className={`radio-option ${isActive ? 'active' : ''}`}>
                  <input type="radio" name="switchState" checked={isActive}
                    onChange={() => updateElement(el.id, { componentState: { on: i === 1 } })} />
                  {label}
                </label>
              )
            })}
          </div>
        </>
      )}

      {isContainer && (
        <ContainerLayoutSection el={el} childCount={childCount} onChange={handleContainerProp} />
      )}

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
            <input type="range" min={0} max={1} step={0.01} value={el.radius ?? 0} style={{ flex: 1 }}
              onChange={(e) => updateAnimatable('radius', Number(e.target.value))} />
            <span style={{ fontSize: 11, color: '#666', width: 32 }}>{Math.round((el.radius ?? 0) * 100)}%</span>
          </div>
        </>
      )}

      {el.type === 'line' && (
        <>
          <label className="field-label">Line Style</label>
          <select className="field-select" value={el.lineStyle ?? 'solid'}
            onChange={(e) => updateElement(el.id, { lineStyle: e.target.value as LineStyle })}>
            {LINE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="field-label">Arrow</label>
          <input type="checkbox" checked={el.hasArrow ?? false}
            onChange={(e) => updateElement(el.id, { hasArrow: e.target.checked })} />
        </>
      )}

      <label className="field-label">Z (Depth){isChild ? ' — auto' : ''}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input className="field-input" type="number" style={{ width: 60 }} value={el.z} disabled={isChild}
          onChange={(e) => { updateElement(el.id, { z: Number(e.target.value) }); if (isContainer) setTimeout(() => runLayout(el.id), 0) }} />
        <input type="range" min={0} max={10} step={1} value={el.z} disabled={isChild} style={{ flex: 1 }}
          onChange={(e) => { updateElement(el.id, { z: Number(e.target.value) }); if (isContainer) setTimeout(() => runLayout(el.id), 0) }} />
      </div>

      <label className="field-label">Opacity</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="range" min={0} max={1} step={0.05} value={el.opacity} style={{ flex: 1 }}
          onChange={(e) => updateAnimatable('opacity', Number(e.target.value))} />
        <span style={{ fontSize: 11, color: '#666', width: 32 }}>{Math.round(el.opacity * 100)}%</span>
      </div>

      <label className="field-label">Position{isManaged ? ' — managed' : ''}</label>
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="field-input" type="number" placeholder="X" style={{ width: '50%' }}
          value={Math.round(el.x)} disabled={isManaged} onChange={(e) => updateAnimatable('x', Number(e.target.value))} />
        <input className="field-input" type="number" placeholder="Y" style={{ width: '50%' }}
          value={Math.round(el.y)} disabled={isManaged} onChange={(e) => updateAnimatable('y', Number(e.target.value))} />
      </div>

      <label className="field-label">Size{isManaged ? ' — managed' : ''}</label>
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="field-input" type="number" placeholder="W" style={{ width: '50%' }}
          value={Math.round(el.width)} disabled={isManaged} onChange={(e) => updateAnimatable('width', Number(e.target.value))} />
        <input className="field-input" type="number" placeholder="H" style={{ width: '50%' }}
          value={Math.round(el.height)} disabled={isManaged} onChange={(e) => updateAnimatable('height', Number(e.target.value))} />
      </div>

      <TriggersSection
        elementId={el.id}
        triggers={el.triggers ?? []}
        animationBundles={animationBundles}
        onUpdate={(triggers) => updateElement(el.id, { triggers })}
      />

      <button className="btn btn-danger" style={{ marginTop: 12 }} onClick={() => removeElement(el.id)}>
        Delete
      </button>
    </div>
  )
}

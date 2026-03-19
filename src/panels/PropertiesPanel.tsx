import { useChoanStore } from '../store/useChoanStore'
import type { LineStyle } from '../store/useChoanStore'
import { autoKeyframe } from '../animation/autoKeyframe'
import type { AnimatableProperty } from '../animation/types'
import ContainerLayoutSection from './ContainerLayoutSection'
import TriggersSection from './TriggersSection'

const LINE_STYLES: LineStyle[] = ['solid', 'dashed']
const SKINS = [
  '', 'switch', 'checkbox', 'radio', 'button', 'slider',
  'text-input', 'progress', 'badge', 'star-rating', 'avatar',
  'search', 'dropdown', 'text', 'table-skeleton', 'image',
]

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
    const old = (el as unknown as Record<string, unknown>)[prop] as number | undefined
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


  return (
    <div className="panel">
      <div className="panel-title">Properties</div>

      <label className="field-label">Label</label>
      <input className="field-input" value={el.label} onChange={(e) => updateElement(el.id, { label: e.target.value })} />

      <label className="field-label">Type</label>
      <div className="field-value">{el.type}</div>

      <label className="field-label">Skin</label>
      <select className="field-select" value={el.skin ?? ''} onChange={(e) => {
        const skin = e.target.value || undefined
        const patch: Record<string, unknown> = { skin, skinOnly: !!skin }
        if (skin === 'image') patch.componentState = { seed: Math.floor(Math.random() * 9999) }
        updateElement(el.id, patch)
      }}>
        {SKINS.map((s) => <option key={s} value={s}>{s || 'None'}</option>)}
      </select>

      {el.skin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <input type="checkbox" id="skinOnly" checked={el.skinOnly ?? false}
            onChange={(e) => updateElement(el.id, { skinOnly: e.target.checked })} />
          <label htmlFor="skinOnly" style={{ fontSize: 11 }}>Skin Only</label>
        </div>
      )}

      {el.skin && (() => {
        const cs = (el.componentState ?? {}) as Record<string, unknown>
        const setCS = (patch: Record<string, unknown>) => updateElement(el.id, { componentState: { ...cs, ...patch } })
        const toggle = (key: string) => <div className="radio-group">
          {['Off', 'On'].map((l, i) => <label key={l} className={`radio-option ${!!cs[key] === (i === 1) ? 'active' : ''}`}>
            <input type="radio" checked={!!cs[key] === (i === 1)} onChange={() => setCS({ [key]: i === 1 })} />{l}
          </label>)}
        </div>
        const rangeUI = (key: string, _label?: string) => <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="range" min={0} max={1} step={0.01} value={Number(cs[key]) || 0} style={{ flex: 1 }}
            onChange={(e) => setCS({ [key]: Number(e.target.value) })} />
          <span style={{ fontSize: 11, color: '#666', width: 32 }}>{Math.round((Number(cs[key]) || 0) * 100)}%</span>
        </div>
        const textUI = (key: string, placeholder: string) =>
          <input className="field-input" value={(cs[key] as string) || ''} placeholder={placeholder}
            onChange={(e) => setCS({ [key]: e.target.value })} />

        return <>
          {(el.skin === 'switch') && <><label className="field-label">State</label>{toggle('on')}</>}
          {(el.skin === 'checkbox') && <><label className="field-label">Checked</label>{toggle('checked')}</>}
          {(el.skin === 'radio') && <><label className="field-label">Selected</label>{toggle('selected')}</>}
          {(el.skin === 'button') && <>
            <label className="field-label">Label</label>{textUI('label', 'Button')}
            <label className="field-label">Pressed</label>{toggle('pressed')}
          </>}
          {(el.skin === 'slider') && <><label className="field-label">Value</label>{rangeUI('value', 'Value')}</>}
          {(el.skin === 'text-input') && <>
            <label className="field-label">Placeholder</label>{textUI('placeholder', 'Type here...')}
            <label className="field-label">Focused</label>{toggle('focused')}
          </>}
          {(el.skin === 'progress') && <><label className="field-label">Progress</label>{rangeUI('value', 'Progress')}</>}
          {(el.skin === 'badge') && <><label className="field-label">Count</label>
            <input className="field-input" type="number" min={0} value={Number(cs.count) || 0}
              onChange={(e) => setCS({ count: Number(e.target.value) })} /></>}
          {(el.skin === 'star-rating') && <><label className="field-label">Rating</label>
            <input className="field-input" type="number" min={0} max={5} value={Number(cs.rating) || 0}
              onChange={(e) => setCS({ rating: Number(e.target.value) })} /></>}
          {(el.skin === 'avatar') && <>
            <label className="field-label">Initials</label>{textUI('initials', 'AB')}
            <label className="field-label">Online</label>{toggle('online')}
          </>}
          {(el.skin === 'search') && <><label className="field-label">Query</label>{textUI('query', 'Search...')}</>}
          {(el.skin === 'dropdown') && <>
            <label className="field-label">Label</label>{textUI('label', 'Select...')}
            <label className="field-label">Open</label>{toggle('open')}
          </>}
          {(el.skin === 'text') && <>
            <label className="field-label">Text</label>{textUI('text', 'Text')}
            <label className="field-label">Font Size</label>
            <input className="field-input" type="number" min={8} value={Number(cs.fontSize) || ''}
              placeholder="auto" onChange={(e) => setCS({ fontSize: Number(e.target.value) || undefined })} />
            <label className="field-label">Align</label>
            <div className="radio-group">
              {(['left', 'center', 'right'] as const).map((a) => <label key={a} className={`radio-option ${(cs.align || 'center') === a ? 'active' : ''}`}>
                <input type="radio" checked={(cs.align || 'center') === a} onChange={() => setCS({ align: a })} />{a}
              </label>)}
            </div>
            <label className="field-label">Bold</label>{toggle('bold')}
          </>}
          {(el.skin === 'table-skeleton') && <>
            <label className="field-label">Columns</label>
            <input className="field-input" type="number" min={1} max={10} value={Number(cs.columns) || 3}
              onChange={(e) => setCS({ columns: Number(e.target.value) })} />
          </>}
          {(el.skin === 'image') && <>
            <label className="field-label">Seed</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input className="field-input" type="number" value={Number(cs.seed) || 42} style={{ flex: 1 }}
                onChange={(e) => setCS({ seed: Number(e.target.value) })} />
              <button className="btn-small" onClick={() => setCS({ seed: Math.floor(Math.random() * 9999) })}>Shuffle</button>
            </div>
          </>}
        </>
      })()}

      {isContainer && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <input type="checkbox" id="frameless" checked={!el.skin && (el.skinOnly ?? false)}
              onChange={(e) => updateElement(el.id, { skinOnly: e.target.checked, skin: e.target.checked ? undefined : el.skin })} />
            <label htmlFor="frameless" style={{ fontSize: 11 }}>Frameless</label>
          </div>
          <ContainerLayoutSection el={el} childCount={childCount} onChange={handleContainerProp} />
        </>
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
          {(() => {
            const maxR = Math.min(el.width, el.height) / 2
            const pxVal = Math.round((el.radius ?? 0) * maxR)
            return <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="range" min={0} max={maxR} step={1} value={pxVal} style={{ flex: 1 }}
                onChange={(e) => updateAnimatable('radius', maxR > 0 ? Number(e.target.value) / maxR : 0)} />
              <span style={{ fontSize: 11, color: '#666', width: 36 }}>{pxVal}px</span>
            </div>
          })()}
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

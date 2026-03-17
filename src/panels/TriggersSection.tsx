// Trigger list + add-trigger UI for PropertiesPanel.

import { useState } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import type { AnimationBundle } from '../animation/types'
import type { ElementTrigger } from '../store/useChoanStore'

interface Props {
  elementId: string
  triggers: ElementTrigger[]
  animationBundles: AnimationBundle[]
  onUpdate: (triggers: ElementTrigger[]) => void
}

export default function TriggersSection({ elementId: _elementId, triggers, animationBundles, onUpdate }: Props) {
  const [newEvent, setNewEvent] = useState<'click' | 'hover'>('click')
  const [newBundle, setNewBundle] = useState('')

  return (
    <>
      <div className="sub-title" style={{ marginTop: 8 }}>Triggers</div>
      {triggers.map((trigger, i) => {
        const bundle = animationBundles.find((b) => b.id === trigger.animationBundleId)
        return (
          <div key={i} className="trigger-item">
            <span className="trigger-event">{trigger.event}</span>
            <span className="trigger-arrow">→</span>
            <span className="trigger-bundle">{bundle?.name ?? '?'}</span>
            <button className="btn-icon" onClick={() => onUpdate(triggers.filter((_, idx) => idx !== i))}>
              <X size={10} />
            </button>
          </div>
        )
      })}
      {animationBundles.length > 0 && (
        <div className="add-row" style={{ marginTop: 4 }}>
          <select className="field-select" style={{ flex: 1 }} value={newEvent} onChange={(e) => setNewEvent(e.target.value as 'click' | 'hover')}>
            <option value="click">click</option>
            <option value="hover">hover</option>
          </select>
          <select className="field-select" style={{ flex: 2 }} value={newBundle} onChange={(e) => setNewBundle(e.target.value)}>
            <option value="">animation...</option>
            {animationBundles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button className="btn btn-small" onClick={() => {
            if (!newBundle) return
            onUpdate([...triggers, { event: newEvent, animationBundleId: newBundle }])
            setNewBundle('')
          }}><Plus size={12} /></button>
        </div>
      )}
      {animationBundles.length === 0 && (
        <div className="panel-empty">타임라인에서 애니메이션을 먼저 만드세요.</div>
      )}
    </>
  )
}

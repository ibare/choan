// Trigger list + add-trigger UI for PropertiesPanel.

import { useState } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import type { AnimationBundle } from '../animation/types'
import type { ElementTrigger } from '../store/useChoanStore'
import { Section } from '../components/ui/Section'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'

interface Props {
  triggers: ElementTrigger[]
  animationBundles: AnimationBundle[]
  onUpdate: (triggers: ElementTrigger[]) => void
}

const EVENT_OPTIONS = [
  { value: 'click', label: 'On Click' },
  { value: 'hover', label: 'On Hover' },
]

export default function TriggersSection({ triggers, animationBundles, onUpdate }: Props) {
  const [newEvent, setNewEvent] = useState<'click' | 'hover'>('click')
  const [newBundle, setNewBundle] = useState('__none__')

  const bundleOptions = [
    { value: '__none__', label: 'Animation...' },
    ...animationBundles.map((b) => ({ value: b.id, label: b.name })),
  ]

  return (
    <Section title="Triggers">
      {triggers.map((trigger, i) => {
        const bundle = animationBundles.find((b) => b.id === trigger.animationBundleId)
        return (
          <div key={i} className="trigger-item">
            <span className="trigger-event">{trigger.event}</span>
            <span className="trigger-arrow">→</span>
            <span className="trigger-bundle">{bundle?.name ?? '?'}</span>
            <Button
              variant="ghost" size="icon"
              onClick={() => onUpdate(triggers.filter((_, idx) => idx !== i))}
            >
              <X size={10} />
            </Button>
          </div>
        )
      })}

      {animationBundles.length === 0 && (
        <p className="panel-empty">타임라인에서 애니메이션을 먼저 만드세요.</p>
      )}

      {animationBundles.length > 0 && (
        <div className="add-row">
          <Select
            options={EVENT_OPTIONS}
            value={newEvent}
            onChange={(v) => setNewEvent(v as 'click' | 'hover')}
            size="sm"
          />
          <Select
            options={bundleOptions}
            value={newBundle}
            onChange={setNewBundle}
            size="sm"
          />
          <Button
            size="icon" variant="ghost"
            onClick={() => {
              if (newBundle === '__none__') return
              onUpdate([...triggers, { event: newEvent, animationBundleId: newBundle }])
              setNewBundle('__none__')
            }}
          >
            <Plus size={12} />
          </Button>
        </div>
      )}
    </Section>
  )
}

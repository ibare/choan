import { useState } from 'react'
import { useChoanStore } from '../store/useChoanStore'
import type { GlobalState, Interaction, AnimationHint } from '../store/useChoanStore'
import { nanoid } from '../canvas/nanoid'

const ANIMATION_HINTS: AnimationHint[] = [
  'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right',
  'spring', 'scale-in', 'scale-out',
]

export default function StatePanel() {
  const {
    elements,
    globalStates,
    interactions,
    animationBundles,
    addGlobalState,
    removeGlobalState,
    addInteraction,
    removeInteraction,
  } = useChoanStore()

  const [newStateName, setNewStateName] = useState('')
  const [newStateType, setNewStateType] = useState<'boolean' | 'string' | 'number'>('boolean')

  // Interaction form
  const [triggerEl, setTriggerEl] = useState('')
  const [triggerEvent, setTriggerEvent] = useState<'click' | 'hover' | 'focus'>('click')
  const [triggerState, setTriggerState] = useState('')
  const [triggerValue, setTriggerValue] = useState('true')
  const [reactionEl, setReactionEl] = useState('')
  const [reactionCondition, setReactionCondition] = useState('')
  const [reactionAnim, setReactionAnim] = useState<AnimationHint>('fade')
  const [reactionEasing, setReactionEasing] = useState<'spring' | 'ease' | 'linear'>('spring')
  const [reactionBundleId, setReactionBundleId] = useState('')

  const handleAddState = () => {
    if (!newStateName.trim()) return
    const defaults: Record<string, boolean | string | number> = {
      boolean: false, string: '', number: 0,
    }
    const gs: GlobalState = {
      name: newStateName.trim(),
      type: newStateType,
      default: defaults[newStateType],
    }
    addGlobalState(gs)
    setNewStateName('')
  }

  const handleAddInteraction = () => {
    if (!triggerEl || !triggerState) return
    if (!reactionBundleId && !reactionEl) return
    const interaction: Interaction = {
      id: nanoid(),
      trigger: {
        elementId: triggerEl,
        event: triggerEvent,
        stateKey: triggerState,
        value: triggerValue === 'true' ? true : triggerValue === 'false' ? false : triggerValue,
      },
      reaction: {
        elementId: reactionEl,
        condition: reactionCondition || `${triggerState} == ${triggerValue}`,
        animation: reactionAnim,
        easing: reactionEasing,
        animationBundleId: reactionBundleId || undefined,
      },
    }
    addInteraction(interaction)
    setTriggerEl('')
    setReactionEl('')
    setReactionBundleId('')
  }

  const elementOptions = elements.map((e) => (
    <option key={e.id} value={e.id}>{e.label}</option>
  ))

  const stateOptions = globalStates.map((gs) => (
    <option key={gs.name} value={gs.name}>{gs.name}</option>
  ))

  return (
    <div className="panel">
      <div className="panel-title">States</div>

      {globalStates.map((gs) => (
        <div key={gs.name} className="state-item">
          <span className="state-name">{gs.name}</span>
          <span className="state-type">{gs.type}</span>
          <span className="state-default">{String(gs.default)}</span>
          <button className="btn-icon" onClick={() => removeGlobalState(gs.name)}>×</button>
        </div>
      ))}

      <div className="add-row">
        <input
          className="field-input"
          placeholder="name"
          style={{ flex: 2 }}
          value={newStateName}
          onChange={(e) => setNewStateName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddState()}
        />
        <select
          className="field-select"
          style={{ flex: 1 }}
          value={newStateType}
          onChange={(e) => setNewStateType(e.target.value as typeof newStateType)}
        >
          <option value="boolean">bool</option>
          <option value="string">string</option>
          <option value="number">number</option>
        </select>
        <button className="btn btn-small" onClick={handleAddState}>+</button>
      </div>

      {/* ── Interactions ── */}
      <div className="panel-divider" />
      <div className="panel-title">Interactions</div>

      {interactions.map((ia) => {
        const trigEl = elements.find((e) => e.id === ia.trigger.elementId)
        const rxEl = elements.find((e) => e.id === ia.reaction.elementId)
        const bundle = ia.reaction.animationBundleId
          ? animationBundles.find((b) => b.id === ia.reaction.animationBundleId)
          : null
        return (
          <div key={ia.id} className="interaction-item">
            <div className="interaction-trigger">
              ▶ {trigEl?.label ?? ia.trigger.elementId}.{ia.trigger.event} → {ia.trigger.stateKey} = {String(ia.trigger.value)}
            </div>
            <div className="interaction-reaction">
              {bundle
                ? <>↩ [{ia.reaction.condition}] → <strong>{bundle.name}</strong> ({ia.reaction.easing})</>
                : <>↩ {rxEl?.label ?? ia.reaction.elementId} [{ia.reaction.condition}] → {ia.reaction.animation} ({ia.reaction.easing})</>
              }
            </div>
            <button className="btn-icon" onClick={() => removeInteraction(ia.id)}>×</button>
          </div>
        )
      })}

      {/* Add Interaction Form */}
      <div className="sub-title">Trigger</div>
      <div className="add-row">
        <select className="field-select" style={{ flex: 2 }} value={triggerEl} onChange={(e) => setTriggerEl(e.target.value)}>
          <option value="">element</option>
          {elementOptions}
        </select>
        <select className="field-select" style={{ flex: 1 }} value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value as typeof triggerEvent)}>
          <option value="click">click</option>
          <option value="hover">hover</option>
          <option value="focus">focus</option>
        </select>
      </div>
      <div className="add-row">
        <select className="field-select" style={{ flex: 2 }} value={triggerState} onChange={(e) => setTriggerState(e.target.value)}>
          <option value="">state</option>
          {stateOptions}
        </select>
        <input
          className="field-input"
          style={{ flex: 1 }}
          placeholder="value"
          value={triggerValue}
          onChange={(e) => setTriggerValue(e.target.value)}
        />
      </div>

      <div className="sub-title">Reaction</div>
      <div className="add-row">
        <select
          className="field-select"
          style={{ flex: 3 }}
          value={reactionBundleId}
          onChange={(e) => setReactionBundleId(e.target.value)}
        >
          <option value="">preset...</option>
          {animationBundles.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select className="field-select" style={{ flex: 1 }} value={reactionEasing} onChange={(e) => setReactionEasing(e.target.value as typeof reactionEasing)}>
          <option value="spring">spring</option>
          <option value="ease">ease</option>
          <option value="linear">linear</option>
        </select>
      </div>
      {!reactionBundleId && (
        <div className="add-row">
          <select className="field-select" style={{ flex: 2 }} value={reactionEl} onChange={(e) => setReactionEl(e.target.value)}>
            <option value="">element</option>
            {elementOptions}
          </select>
          <select className="field-select" style={{ flex: 2 }} value={reactionAnim} onChange={(e) => setReactionAnim(e.target.value as AnimationHint)}>
            {ANIMATION_HINTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}
      <div className="add-row">
        <input
          className="field-input"
          style={{ flex: 1 }}
          placeholder="condition (optional)"
          value={reactionCondition}
          onChange={(e) => setReactionCondition(e.target.value)}
        />
      </div>
      <button className="btn btn-small" onClick={handleAddInteraction}>+ Add Interaction</button>
    </div>
  )
}

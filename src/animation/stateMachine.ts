// State machine runtime — connects events to state changes to animation dispatch

import type { ChoanElement, Interaction } from '../store/useChoanStore'
import type { AnimationClip, AnimationBundle } from './types'
import type { KeyframeAnimator } from './keyframeEngine'
import { evaluateCondition } from './conditionParser'
import { resolvePreset } from './presets'

interface StoreAccessor {
  getInteractions(): Interaction[]
  getElements(): ChoanElement[]
  getAnimationClips(): AnimationClip[]
  getAnimationBundles(): AnimationBundle[]
  getStateValues(): Record<string, boolean | string | number>
  setStateValue(key: string, value: boolean | string | number): void
}

export interface StateMachineRuntime {
  handleEvent(elementId: string, event: 'click' | 'hover' | 'focus'): void
}

export function createStateMachineRuntime(
  store: StoreAccessor,
  keyframeAnimator: KeyframeAnimator,
): StateMachineRuntime {

  function handleEvent(elementId: string, event: 'click' | 'hover' | 'focus') {
    const interactions = store.getInteractions()
    const elements = store.getElements()
    const clips = store.getAnimationClips()

    // 1. Find matching triggers
    const matchingTriggers = interactions.filter(
      (ia) => ia.trigger.elementId === elementId && ia.trigger.event === event,
    )

    if (matchingTriggers.length === 0) return

    // 2. Apply state changes from triggers
    for (const ia of matchingTriggers) {
      store.setStateValue(ia.trigger.stateKey, ia.trigger.value)
    }

    // 3. Re-evaluate ALL reactions against updated state
    const stateValues = store.getStateValues()

    const bundles = store.getAnimationBundles()

    for (const ia of interactions) {
      const conditionMet = evaluateCondition(ia.reaction.condition, stateValues)
      if (!conditionMet) continue

      // 4. Resolve clips: bundle or single preset
      if (ia.reaction.animationBundleId) {
        // Bundle: start all clips in the bundle
        const bundle = bundles.find((b) => b.id === ia.reaction.animationBundleId)
        if (bundle) {
          for (const clip of bundle.clips) {
            keyframeAnimator.start(clip, `${ia.id}_${clip.id}`, performance.now())
          }
        }
      } else {
        // Legacy: single preset/custom clip
        const targetEl = elements.find((e) => e.id === ia.reaction.elementId)
        if (!targetEl) continue

        const customClip = clips.find(
          (c) => c.elementId === targetEl.id && c.id === `clip_${ia.id}`,
        )
        const clip = customClip ?? resolvePreset(ia.reaction.animation, targetEl, ia.reaction.easing)
        keyframeAnimator.start(clip, ia.id, performance.now())
      }
    }
  }

  return { handleEvent }
}

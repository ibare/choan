import yaml from 'js-yaml'
import type { ChoanElement, GlobalState, Interaction } from '../store/useChoanStore'
import type { AnimationBundle } from '../animation/types'

interface ChoanFile {
  version: number
  name: string
  elements: ChoanElement[]
  states: GlobalState[]
  interactions: Interaction[]
  animationBundles?: AnimationBundle[]
}

export function serialize(
  name: string,
  elements: ChoanElement[],
  globalStates: GlobalState[],
  interactions: Interaction[],
  animationBundles: AnimationBundle[] = [],
): string {
  const data: ChoanFile = {
    version: 2, name, elements, states: globalStates, interactions,
    animationBundles: animationBundles.length > 0 ? animationBundles : undefined,
  }
  return yaml.dump(data, { indent: 2, lineWidth: 120 })
}

export interface DeserializedFile {
  name: string
  elements: ChoanElement[]
  globalStates: GlobalState[]
  interactions: Interaction[]
  animationBundles: AnimationBundle[]
}

export function deserialize(content: string): DeserializedFile {
  const data = yaml.load(content) as ChoanFile
  return {
    name: data.name ?? 'Untitled',
    elements: data.elements ?? [],
    globalStates: data.states ?? [],
    interactions: data.interactions ?? [],
    animationBundles: data.animationBundles ?? [],
  }
}

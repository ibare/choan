import yaml from 'js-yaml'
import type { ChoanElement, GlobalState, Interaction } from '../store/useChoanStore'

interface ChoanFile {
  version: number
  name: string
  elements: ChoanElement[]
  states: GlobalState[]
  interactions: Interaction[]
}

export function serialize(
  name: string,
  elements: ChoanElement[],
  globalStates: GlobalState[],
  interactions: Interaction[]
): string {
  const data: ChoanFile = { version: 1, name, elements, states: globalStates, interactions }
  return yaml.dump(data, { indent: 2, lineWidth: 120 })
}

export interface DeserializedFile {
  name: string
  elements: ChoanElement[]
  globalStates: GlobalState[]
  interactions: Interaction[]
}

export function deserialize(content: string): DeserializedFile {
  const data = yaml.load(content) as ChoanFile
  return {
    name: data.name ?? 'Untitled',
    elements: data.elements ?? [],
    globalStates: data.states ?? [],
    interactions: data.interactions ?? [],
  }
}

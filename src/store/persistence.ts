// Auto-persistence — debounced LocalStorage backup of elements + animationBundles.
// Subscribes to both stores and saves on change. Restores on app start.

import { useElementStore } from './useElementStore'
import { useAnimationStore } from './useAnimationStore'
import type { ChoanElement } from './useElementStore'
import type { AnimationBundle } from '../animation/types'

const STORAGE_KEY = 'choan-backup'
const DEBOUNCE_MS = 300

interface BackupData {
  version: 1
  elements: ChoanElement[]
  animationBundles: AnimationBundle[]
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function save() {
  const elements = useElementStore.getState().elements
  const animationBundles = useAnimationStore.getState().animationBundles
  const data: BackupData = { version: 1, elements, animationBundles }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function scheduleSave() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(save, DEBOUNCE_MS)
}

/** Restore from LocalStorage. Returns true if data was loaded. */
export function restoreBackup(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw) as BackupData
    if (!data.version || !Array.isArray(data.elements)) return false
    useElementStore.getState().loadElements(data.elements)
    useAnimationStore.getState().loadAnimation(undefined, data.animationBundles)
    return true
  } catch {
    return false
  }
}

/** Start auto-save subscriptions. Call once at app init. */
export function initPersistence() {
  useElementStore.subscribe(scheduleSave)
  useAnimationStore.subscribe(scheduleSave)
}

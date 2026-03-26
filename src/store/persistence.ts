// Auto-persistence — debounced LocalStorage backup of scene data.
// Subscribes to scene/element/animation stores and saves on change. Restores on app start.

import { useElementStore } from './useElementStore'
import { useAnimationStore } from './useAnimationStore'
import { useSceneStore } from './useSceneStore'
import { nanoid } from '../utils/nanoid'
import type { ChoanElement } from './useElementStore'
import type { AnimationBundle } from '../animation/types'
import type { Scene } from './sceneTypes'

const STORAGE_KEY = 'choan-backup'
const DEBOUNCE_MS = 300

// ── Backup formats ──

interface BackupDataV1 {
  version: 1
  elements: ChoanElement[]
  animationBundles: AnimationBundle[]
}

interface BackupDataV2 {
  version: 2
  scenes: Scene[]
  activeSceneId: string
}

type BackupData = BackupDataV1 | BackupDataV2

// ── V1 → V2 migration ──

function migrateV1toV2(v1: BackupDataV1): BackupDataV2 {
  const sceneId = nanoid()
  return {
    version: 2,
    scenes: [{
      id: sceneId,
      name: 'Scene 1',
      elements: v1.elements,
      animationBundles: v1.animationBundles,
      order: 0,
      duration: 3000,
    }],
    activeSceneId: sceneId,
  }
}

// ── Save / Restore ──

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function save() {
  // Sync active scene data before saving
  useSceneStore.getState().syncActiveSceneData()
  const { scenes, activeSceneId } = useSceneStore.getState()
  const data: BackupDataV2 = { version: 2, scenes, activeSceneId }
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
    const parsed = JSON.parse(raw) as BackupData
    if (!parsed.version) return false

    let data: BackupDataV2
    if (parsed.version === 1) {
      const v1 = parsed as BackupDataV1
      if (!Array.isArray(v1.elements)) return false
      data = migrateV1toV2(v1)
    } else if (parsed.version === 2) {
      data = parsed as BackupDataV2
      if (!Array.isArray(data.scenes) || data.scenes.length === 0) return false
    } else {
      return false
    }

    useSceneStore.getState().loadScenes(data.scenes, data.activeSceneId)
    return true
  } catch {
    return false
  }
}

/** Start auto-save subscriptions. Call once at app init. */
export function initPersistence() {
  useElementStore.subscribe(scheduleSave)
  useAnimationStore.subscribe(scheduleSave)
  useSceneStore.subscribe(scheduleSave)
}

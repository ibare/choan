// Project persistence — IndexedDB-backed project storage.
// Each project is stored independently with its own scenes.
// Auto-saves on store changes with debouncing.

import { openDB, type IDBPDatabase } from 'idb'
import { useElementStore } from './useElementStore'
import { useAnimationStore } from './useAnimationStore'
import { useSceneStore } from './useSceneStore'
import { nanoid } from '../utils/nanoid'
import type { Scene } from './sceneTypes'

// ── DB schema ──

const DB_NAME = 'choan-db'
const DB_VERSION = 1
const PROJECTS_STORE = 'projects'
const META_STORE = 'meta'

export interface ProjectRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  scenes: Scene[]
  activeSceneId: string
}

export interface ProjectListItem {
  id: string
  name: string
  updatedAt: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE)
        }
      },
    })
  }
  return dbPromise
}

// ── Project CRUD ──

export async function saveProject(
  id: string,
  name: string,
  scenes: Scene[],
  activeSceneId: string,
): Promise<void> {
  const db = await getDB()
  const existing = await db.get(PROJECTS_STORE, id) as ProjectRecord | undefined
  const record: ProjectRecord = {
    id,
    name,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    scenes,
    activeSceneId,
  }
  await db.put(PROJECTS_STORE, record)
  await db.put(META_STORE, id, 'lastOpenedProjectId')
}

export async function loadProject(id: string): Promise<ProjectRecord | null> {
  const db = await getDB()
  const record = await db.get(PROJECTS_STORE, id) as ProjectRecord | undefined
  return record ?? null
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(PROJECTS_STORE, id)
  const lastId = await db.get(META_STORE, 'lastOpenedProjectId')
  if (lastId === id) {
    await db.delete(META_STORE, 'lastOpenedProjectId')
  }
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const db = await getDB()
  const all = await db.getAll(PROJECTS_STORE) as ProjectRecord[]
  return all
    .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

// ── Current project state ──

let currentProjectId: string | null = null
let currentProjectName = 'Untitled'

export function getCurrentProjectId(): string | null { return currentProjectId }
export function getCurrentProjectName(): string { return currentProjectName }

export function setCurrentProject(id: string, name: string): void {
  currentProjectId = id
  currentProjectName = name
}

// ── Auto-save ──

const DEBOUNCE_MS = 300
let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function save() {
  if (!currentProjectId) return
  useSceneStore.getState().syncActiveSceneData()
  const { scenes, activeSceneId } = useSceneStore.getState()
  await saveProject(currentProjectId, currentProjectName, scenes, activeSceneId)
}

function scheduleSave() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(save, DEBOUNCE_MS)
}

// ── App lifecycle ──

/** Restore last opened project or create a new one. */
export async function restoreLastProject(): Promise<boolean> {
  const db = await getDB()
  const lastId = await db.get(META_STORE, 'lastOpenedProjectId') as string | undefined

  if (lastId) {
    const record = await loadProject(lastId)
    if (record && Array.isArray(record.scenes) && record.scenes.length > 0) {
      currentProjectId = record.id
      currentProjectName = record.name
      useSceneStore.getState().loadScenes(record.scenes, record.activeSceneId)
      return true
    }
  }

  // No previous project — create a fresh one
  currentProjectId = nanoid()
  currentProjectName = 'Untitled'
  return false
}

/** Start auto-save subscriptions. Call once at app init. */
export function initPersistence() {
  useElementStore.subscribe(scheduleSave)
  useAnimationStore.subscribe(scheduleSave)
  useSceneStore.subscribe(scheduleSave)
}

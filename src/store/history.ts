// Undo/Redo — snapshot-based history stack for elements + animationBundles.
// Snapshots are JSON strings of { elements, animationBundles }.

import { useElementStore } from './useElementStore'
import { useAnimationStore } from './useAnimationStore'

const MAX_SNAPSHOTS = 50
const DEBOUNCE_MS = 500

let snapshots: string[] = []
let undoIndex = -1
let isRestoring = false  // prevent re-snapshotting during undo/redo
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function takeSnapshot(): string {
  const elements = useElementStore.getState().elements
  const animationBundles = useAnimationStore.getState().animationBundles
  return JSON.stringify({ elements, animationBundles })
}

function restoreSnapshot(json: string) {
  isRestoring = true
  try {
    const data = JSON.parse(json)
    useElementStore.getState().loadElements(data.elements)
    useAnimationStore.getState().loadAnimation(undefined, data.animationBundles)
  } catch (err) {
    console.error('Failed to restore snapshot:', err)
  } finally {
    // Allow next frame to re-enable snapshotting
    requestAnimationFrame(() => { isRestoring = false })
  }
}

/** Explicitly push a snapshot (call after significant actions). */
export function pushSnapshot() {
  if (isRestoring) return
  const snap = takeSnapshot()
  // If we're in the middle of the stack (after undo), discard redo history
  if (undoIndex < snapshots.length - 1) {
    snapshots = snapshots.slice(0, undoIndex + 1)
  }
  // Don't push duplicate
  if (snapshots.length > 0 && snapshots[snapshots.length - 1] === snap) return
  snapshots.push(snap)
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift()
  undoIndex = snapshots.length - 1
}

/** Auto-snapshot via debounced store subscription. */
function schedulePush() {
  if (isRestoring) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(pushSnapshot, DEBOUNCE_MS)
}

export function undo() {
  if (undoIndex <= 0) return
  undoIndex--
  restoreSnapshot(snapshots[undoIndex])
}

export function redo() {
  if (undoIndex >= snapshots.length - 1) return
  undoIndex++
  restoreSnapshot(snapshots[undoIndex])
}

export function canUndo(): boolean { return undoIndex > 0 }
export function canRedo(): boolean { return undoIndex < snapshots.length - 1 }

/** Initialize: take initial snapshot + subscribe for auto-snapshots. */
export function initHistory() {
  pushSnapshot()
  useElementStore.subscribe(schedulePush)
  useAnimationStore.subscribe(schedulePush)
}

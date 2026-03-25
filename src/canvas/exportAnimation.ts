// Export animation state — shared between App (trigger) and scene.ts (render).
// Controls the SDF smooth-union metaball merge sequence.

export type ExportAnimPhase = 'idle' | 'merging' | 'blob' | 'restoring'

export interface ExportAnimState {
  phase: ExportAnimPhase
  startTime: number
}

// Timing (ms)
export const MERGE_DURATION = 1500
export const RESTORE_DURATION = 350  // fast snap-back

let state: ExportAnimState = { phase: 'idle', startTime: 0 }
let onStartCallback: (() => void) | null = null

export function getExportAnim(): ExportAnimState { return state }

/** Register a callback that runs when the animation starts (e.g., reset camera) */
export function onExportAnimStart(cb: () => void) { onStartCallback = cb }

export function startExportAnim() {
  onStartCallback?.()
  state = { phase: 'merging', startTime: performance.now() }
}

/** Called when toast closes — triggers the snap-back */
export function startRestore() {
  state = { phase: 'restoring', startTime: performance.now() }
}

export function tickExportAnim(): ExportAnimPhase {
  if (state.phase === 'idle') return 'idle'
  const elapsed = performance.now() - state.startTime

  if (state.phase === 'merging' && elapsed >= MERGE_DURATION) {
    // Hold in blob state — wait for startRestore() call
    state = { phase: 'blob', startTime: performance.now() }
  } else if (state.phase === 'restoring' && elapsed >= RESTORE_DURATION) {
    state = { phase: 'idle', startTime: 0 }
  }
  // blob phase: no auto-transition, waits for startRestore()

  return state.phase
}

/** 0→1 progress within the current phase */
export function phaseProgress(): number {
  if (state.phase === 'idle') return 0
  if (state.phase === 'blob') return 1  // hold at full
  const elapsed = performance.now() - state.startTime
  const dur = state.phase === 'merging' ? MERGE_DURATION : RESTORE_DURATION
  return Math.min(1, elapsed / dur)
}

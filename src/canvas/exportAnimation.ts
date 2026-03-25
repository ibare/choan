// Export animation state — shared between App (trigger) and scene.ts (render).
// Controls the SDF smooth-union metaball merge sequence.

export type ExportAnimPhase = 'idle' | 'merging' | 'blob' | 'restoring'

export interface ExportAnimState {
  phase: ExportAnimPhase
  startTime: number
}

// Timing (ms)
export const MERGE_DURATION = 1500
export const BLOB_DURATION = 1200
export const RESTORE_DURATION = 600

let state: ExportAnimState = { phase: 'idle', startTime: 0 }

export function getExportAnim(): ExportAnimState { return state }

export function startExportAnim() {
  state = { phase: 'merging', startTime: performance.now() }
}

export function tickExportAnim(): ExportAnimPhase {
  if (state.phase === 'idle') return 'idle'
  const elapsed = performance.now() - state.startTime

  if (state.phase === 'merging' && elapsed >= MERGE_DURATION) {
    state = { phase: 'blob', startTime: performance.now() }
  } else if (state.phase === 'blob' && elapsed >= BLOB_DURATION) {
    state = { phase: 'restoring', startTime: performance.now() }
  } else if (state.phase === 'restoring' && elapsed >= RESTORE_DURATION) {
    state = { phase: 'idle', startTime: 0 }
  }

  return state.phase
}

/** 0→1 progress within the current phase */
export function phaseProgress(): number {
  if (state.phase === 'idle') return 0
  const elapsed = performance.now() - state.startTime
  const dur = state.phase === 'merging' ? MERGE_DURATION
    : state.phase === 'blob' ? BLOB_DURATION
    : RESTORE_DURATION
  return Math.min(1, elapsed / dur)
}

// Hotkey registry — declarative keybinding → action mapping.
//
// Uses KeyboardEvent.code (physical key position) so hotkeys work
// regardless of IME state (e.g. Korean input mode).

export interface HotkeyBinding {
  code: string            // KeyboardEvent.code (e.g. 'KeyV', 'Escape')
  ctrl?: boolean          // Ctrl or Meta (Cmd on Mac)
  shift?: boolean
  alt?: boolean
  action: string          // action identifier (e.g. 'delete', 'tool:select')
  label: string           // human-readable description
}

const bindings: HotkeyBinding[] = [
  // ── Global ──
  { code: 'Escape',    action: 'escape',        label: 'Cancel / close' },
  { code: 'Delete',    action: 'delete',         label: 'Delete selected' },
  { code: 'Backspace', action: 'delete',         label: 'Delete selected' },

  // ── Clipboard ──
  { code: 'KeyC', ctrl: true, action: 'copy',    label: 'Copy' },
  { code: 'KeyV', ctrl: true, action: 'paste',   label: 'Paste' },

  // ── Tools ──
  { code: 'KeyV', action: 'tool:select',         label: 'Select tool' },
  // Space reserved for canvas panning (OrbitControls)
  { code: 'KeyR', action: 'tool:rectangle',      label: 'Rectangle tool' },

  // ── Split ──
  { code: 'KeyN', action: 'split:enter',         label: 'Split selected element' },
  { code: 'ShiftLeft', shift: true, action: 'split:toggle-dir', label: 'Toggle split direction' },
  { code: 'ShiftRight', shift: true, action: 'split:toggle-dir', label: 'Toggle split direction' },
  { code: 'Enter', action: 'split:confirm',      label: 'Confirm split' },
]

/** Test whether a keyboard event matches a binding. */
export function matchEvent(e: KeyboardEvent, b: HotkeyBinding): boolean {
  const wantCtrl = b.ctrl ?? false
  const wantShift = b.shift ?? false
  const wantAlt = b.alt ?? false
  const hasCtrl = e.ctrlKey || e.metaKey
  if (hasCtrl !== wantCtrl) return false
  if (e.shiftKey !== wantShift) return false
  if (e.altKey !== wantAlt) return false
  return e.code === b.code
}

/** Find the first matching binding for the event. */
export function resolveHotkey(e: KeyboardEvent): HotkeyBinding | null {
  for (const b of bindings) {
    if (matchEvent(e, b)) return b
  }
  return null
}

/** Register a new hotkey binding at runtime. */
export function registerHotkey(binding: HotkeyBinding): void {
  bindings.push(binding)
}

/** Remove bindings by action. */
export function unregisterHotkey(action: string): void {
  for (let i = bindings.length - 1; i >= 0; i--) {
    if (bindings[i].action === action) bindings.splice(i, 1)
  }
}

/** Get all current bindings (read-only snapshot). */
export function getAllBindings(): readonly HotkeyBinding[] {
  return bindings
}

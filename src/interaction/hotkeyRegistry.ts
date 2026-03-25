// Hotkey registry — declarative keybinding → action mapping.
//
// Actions are string identifiers. The keyboard handler resolves
// them to actual functions via an action map at runtime.

export interface HotkeyBinding {
  key: string            // KeyboardEvent.key (case-insensitive match)
  ctrl?: boolean         // Ctrl or Meta (Cmd on Mac)
  shift?: boolean
  alt?: boolean
  action: string         // action identifier (e.g. 'delete', 'tool:select')
  label: string          // human-readable description
}

const bindings: HotkeyBinding[] = [
  // ── Global ──
  { key: 'Escape',    action: 'escape',        label: 'Cancel / close' },
  { key: 'Delete',    action: 'delete',         label: 'Delete selected' },
  { key: 'Backspace', action: 'delete',         label: 'Delete selected' },

  // ── Clipboard ──
  { key: 'c', ctrl: true, action: 'copy',       label: 'Copy' },
  { key: 'v', ctrl: true, action: 'paste',      label: 'Paste' },

  // ── Tools ──
  { key: 'v', action: 'tool:select',            label: 'Select tool' },
  // Space reserved for canvas panning (OrbitControls)
  { key: 'r', action: 'tool:rectangle',         label: 'Rectangle tool' },

  // ── Split ──
  { key: 'n', action: 'split:enter',            label: 'Split selected element' },
  { key: 'Shift', shift: true, action: 'split:toggle-dir', label: 'Toggle split direction' },
  { key: 'Enter', action: 'split:confirm',      label: 'Confirm split' },
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
  return e.key.toLowerCase() === b.key.toLowerCase()
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

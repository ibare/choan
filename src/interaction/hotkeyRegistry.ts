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
  { key: 'r', action: 'tool:rectangle',         label: 'Rectangle tool' },

  // ── Split ──
  { key: 'n', action: 'split:enter',            label: 'Split selected element' },
  { key: 'Enter', action: 'split:confirm',      label: 'Confirm split' },
  { key: '1', action: 'split:1',                label: 'Split: 1 (cancel)' },
  { key: '2', action: 'split:2',                label: 'Split: 2' },
  { key: '3', action: 'split:3',                label: 'Split: 3' },
  { key: '4', action: 'split:4',                label: 'Split: 4' },
  { key: '5', action: 'split:5',                label: 'Split: 5' },
  { key: '6', action: 'split:6',                label: 'Split: 6' },
  { key: '7', action: 'split:7',                label: 'Split: 7' },
  { key: '8', action: 'split:8',                label: 'Split: 8' },
  { key: '9', action: 'split:9',                label: 'Split: 9' },
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

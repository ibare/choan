import type { ChoanElement } from '../../../store/useElementStore'
import { el, ctr, child } from './_builder'

// ── 1. Skeleton loading state ─────────────────────────────────────────────────

export const skeletonLoading: ChoanElement[] = [
  ctr('sk-root', 'Loading State', { width: 375, height: 400, layoutDirection: 'column', layoutGap: 16, layoutPadding: 16, color: 0xf5f5f5 }),
  // Skeleton card
  { ...ctr('sk-card', 'Skeleton Card', { width: 343, height: 120, layoutDirection: 'column', layoutGap: 8, layoutPadding: 12, radius: 0.06, color: 0xffffff }), parentId: 'sk-root', z: 1 },
  child('sk-header-line', 'Header Line', 'sk-card', { z: 2, width: 200, height: 16, radius: 0.5, opacity: 0.15, color: 0x000000 }),
  child('sk-body-line1', 'Body Line 1', 'sk-card', { z: 2, width: 319, height: 12, radius: 0.5, opacity: 0.1, color: 0x000000 }),
  child('sk-body-line2', 'Body Line 2', 'sk-card', { z: 2, width: 280, height: 12, radius: 0.5, opacity: 0.1, color: 0x000000 }),
  // Table skeleton
  child('sk-table', 'Data Table Skeleton', 'sk-root', { z: 1, width: 343, height: 200, skin: 'table-skeleton', componentState: { columns: 5 } }),
]

// ── 2. Toggle states — all 4 toggle variants ──────────────────────────────────

export const toggleStates: ChoanElement[] = [
  ctr('ts-root', 'Toggle States', { width: 375, height: 280, layoutDirection: 'column', layoutGap: 16, layoutPadding: 16 }),
  // Switches
  { ...ctr('ts-sw-row', 'Switch States', { width: 343, height: 56, layoutDirection: 'row', layoutGap: 24 }), parentId: 'ts-root', z: 1 },
  child('ts-sw-on', 'Switch ON', 'ts-sw-row', { z: 2, width: 51, height: 31, layoutSizing: 'fixed-px', skin: 'switch', componentState: { on: true } }),
  child('ts-sw-off', 'Switch OFF', 'ts-sw-row', { z: 2, width: 51, height: 31, layoutSizing: 'fixed-px', skin: 'switch', componentState: { on: false } }),
  // Checkboxes
  { ...ctr('ts-cb-row', 'Checkbox States', { width: 343, height: 56, layoutDirection: 'row', layoutGap: 24 }), parentId: 'ts-root', z: 1 },
  child('ts-cb-on', 'Checkbox Checked', 'ts-cb-row', { z: 2, width: 20, height: 20, layoutSizing: 'fixed-px', skin: 'checkbox', componentState: { checked: true } }),
  child('ts-cb-off', 'Checkbox Unchecked', 'ts-cb-row', { z: 2, width: 20, height: 20, layoutSizing: 'fixed-px', skin: 'checkbox', componentState: { checked: false } }),
  // Radio
  { ...ctr('ts-rb-row', 'Radio States', { width: 343, height: 56, layoutDirection: 'row', layoutGap: 24 }), parentId: 'ts-root', z: 1 },
  child('ts-rb-on', 'Radio Selected', 'ts-rb-row', { z: 2, width: 20, height: 20, layoutSizing: 'fixed-px', type: 'circle', skin: 'radio', componentState: { selected: true } }),
  child('ts-rb-off', 'Radio Unselected', 'ts-rb-row', { z: 2, width: 20, height: 20, layoutSizing: 'fixed-px', type: 'circle', skin: 'radio', componentState: { selected: false } }),
]

// ── 3. Form validation states — normal / focused / error ─────────────────────

export const formStates: ChoanElement[] = [
  ctr('fs-root', 'Form States', { width: 375, height: 320, layoutDirection: 'column', layoutGap: 12, layoutPadding: 16 }),
  // Normal
  { ...ctr('fs-group1', 'Normal Field Group', { width: 343, height: 72, layoutDirection: 'column', layoutGap: 4 }), parentId: 'fs-root', z: 1 },
  child('fs-lbl1', 'Normal Label', 'fs-group1', { z: 2, width: 343, height: 20, skin: 'text', componentState: { text: 'Email', fontSize: 14 } }),
  child('fs-inp1', 'Normal Input', 'fs-group1', { z: 2, width: 343, height: 48, radius: 0.17, skin: 'text-input', componentState: { placeholder: 'you@example.com' } }),
  // Focused
  { ...ctr('fs-group2', 'Focused Field Group', { width: 343, height: 72, layoutDirection: 'column', layoutGap: 4 }), parentId: 'fs-root', z: 1 },
  child('fs-lbl2', 'Focused Label', 'fs-group2', { z: 2, width: 343, height: 20, skin: 'text', componentState: { text: 'Password', fontSize: 14 } }),
  child('fs-inp2', 'Focused Input', 'fs-group2', { z: 2, width: 343, height: 48, radius: 0.17, skin: 'text-input', componentState: { placeholder: 'Min. 8 characters', focused: true } }),
  // Error state (red border overlay)
  { ...ctr('fs-group3', 'Error Field Group', { width: 343, height: 88, layoutDirection: 'column', layoutGap: 4 }), parentId: 'fs-root', z: 1 },
  child('fs-lbl3', 'Error Label', 'fs-group3', { z: 2, width: 343, height: 20, skin: 'text', componentState: { text: 'Username', fontSize: 14 } }),
  child('fs-inp3', 'Error Input', 'fs-group3', { z: 2, width: 343, height: 48, radius: 0.17, skin: 'text-input', color: 0xfee2e2, componentState: { placeholder: 'Enter username' } }),
  child('fs-err', 'Error Message', 'fs-group3', { z: 2, width: 343, height: 16, skin: 'text', componentState: { text: 'Username already taken', fontSize: 12 }, color: 0xef4444 }),
]

// ── 4. Progress bar variants ──────────────────────────────────────────────────

export const progressVariants: ChoanElement[] = [
  ctr('pv-root', 'Progress Variants', { width: 375, height: 280, layoutDirection: 'column', layoutGap: 20, layoutPadding: 24 }),
  child('pv-0', 'Progress 0%', 'pv-root', { z: 1, width: 327, height: 8, radius: 1, skin: 'progress', componentState: { value: 0 } }),
  child('pv-25', 'Progress 25%', 'pv-root', { z: 1, width: 327, height: 8, radius: 1, skin: 'progress', componentState: { value: 0.25 } }),
  child('pv-50', 'Progress 50%', 'pv-root', { z: 1, width: 327, height: 8, radius: 1, skin: 'progress', componentState: { value: 0.5 } }),
  child('pv-75', 'Progress 75%', 'pv-root', { z: 1, width: 327, height: 8, radius: 1, skin: 'progress', componentState: { value: 0.75 } }),
  child('pv-100', 'Progress 100%', 'pv-root', { z: 1, width: 327, height: 8, radius: 1, skin: 'progress', componentState: { value: 1 } }),
]

// ── 5. Badge counts — 0 / low / high / overflow ───────────────────────────────

export const badgeCounts: ChoanElement[] = [
  ctr('bc-root', 'Badge Counts', { width: 375, height: 100, layoutDirection: 'row', layoutGap: 24, layoutPadding: 16 }),
  child('bc-0', 'Badge Zero', 'bc-root', { z: 1, width: 24, height: 24, layoutSizing: 'fixed-px', type: 'circle', skin: 'badge', componentState: { count: 0 } }),
  child('bc-1', 'Badge One', 'bc-root', { z: 1, width: 24, height: 24, layoutSizing: 'fixed-px', type: 'circle', skin: 'badge', componentState: { count: 1 } }),
  child('bc-5', 'Badge Five', 'bc-root', { z: 1, width: 24, height: 24, layoutSizing: 'fixed-px', type: 'circle', skin: 'badge', componentState: { count: 5 } }),
  child('bc-99', 'Badge 99', 'bc-root', { z: 1, width: 24, height: 24, layoutSizing: 'fixed-px', type: 'circle', skin: 'badge', componentState: { count: 99 } }),
  child('bc-100', 'Badge Overflow', 'bc-root', { z: 1, width: 32, height: 24, layoutSizing: 'fixed-px', type: 'circle', skin: 'badge', componentState: { count: 100 } }),
]

import type { ChoanElement } from '../../../store/useElementStore'
import { ctr, child } from './_builder'

// ── 1. Free layout — absolute-positioned children ────────────────────────────

export const freeLayout: ChoanElement[] = [
  ctr('free-root', 'Screen', { width: 375, height: 812, layoutDirection: 'free' }),
  child('free-bg', 'Background', 'free-root', { x: 0, y: 0, z: 1, width: 375, height: 812, color: 0xf5f5f5 }),
  child('free-card', 'Card', 'free-root', { x: 16, y: 80, z: 2, width: 343, height: 200, radius: 0.08, color: 0xffffff }),
  child('free-btn', 'CTA Button', 'free-root', { x: 16, y: 700, z: 2, width: 343, height: 48, radius: 0.5, color: 0x6366f1 }),
]

// ── 2. Row layout — horizontal flex ──────────────────────────────────────────

export const rowLayout: ChoanElement[] = [
  ctr('row-root', 'Toolbar', { width: 375, height: 56, layoutDirection: 'row', layoutGap: 8, layoutPadding: 12 }),
  child('row-c1', 'Back', 'row-root', { z: 1, width: 40, height: 40, layoutSizing: 'fixed-px' }),
  child('row-c2', 'Title', 'row-root', { z: 1, width: 200, height: 40, layoutSizing: 'fill' }),
  child('row-c3', 'Menu', 'row-root', { z: 1, width: 40, height: 40, layoutSizing: 'fixed-px' }),
]

// ── 3. Column layout — vertical flex ─────────────────────────────────────────

export const columnLayout: ChoanElement[] = [
  ctr('col-root', 'Sidebar', { width: 240, height: 600, layoutDirection: 'column', layoutGap: 4, layoutPadding: 16 }),
  child('col-i1', 'Home', 'col-root', { z: 1, width: 208, height: 44 }),
  child('col-i2', 'Profile', 'col-root', { z: 1, width: 208, height: 44 }),
  child('col-i3', 'Settings', 'col-root', { z: 1, width: 208, height: 44 }),
  child('col-i4', 'Logout', 'col-root', { z: 1, width: 208, height: 44 }),
]

// ── 4. Grid layout — 3-column grid ───────────────────────────────────────────

export const gridLayout: ChoanElement[] = [
  ctr('grid-root', 'Icon Grid', { width: 375, height: 300, layoutDirection: 'grid', layoutColumns: 3, layoutGap: 16, layoutPadding: 16 }),
  child('grid-i1', 'Camera', 'grid-root', { z: 1, width: 100, height: 100 }),
  child('grid-i2', 'Gallery', 'grid-root', { z: 1, width: 100, height: 100 }),
  child('grid-i3', 'Music', 'grid-root', { z: 1, width: 100, height: 100 }),
  child('grid-i4', 'Maps', 'grid-root', { z: 1, width: 100, height: 100 }),
  child('grid-i5', 'Notes', 'grid-root', { z: 1, width: 100, height: 100 }),
  child('grid-i6', 'Calendar', 'grid-root', { z: 1, width: 100, height: 100 }),
]

// ── 5. Nested layout — row inside column ─────────────────────────────────────

export const nestedLayout: ChoanElement[] = [
  ctr('nest-root', 'Form', { width: 375, height: 500, layoutDirection: 'column', layoutGap: 12, layoutPadding: 16 }),
  child('nest-field1', 'Name Field', 'nest-root', { z: 1, width: 343, height: 48 }),
  child('nest-field2', 'Email Field', 'nest-root', { z: 1, width: 343, height: 48 }),
  // Nested row container
  { ...ctr('nest-btns', 'Button Row', { width: 343, height: 48, layoutDirection: 'row', layoutGap: 8 }), parentId: 'nest-root', z: 1 },
  child('nest-cancel', 'Cancel', 'nest-btns', { z: 2, width: 165, height: 48, layoutSizing: 'equal' }),
  child('nest-submit', 'Submit', 'nest-btns', { z: 2, width: 165, height: 48, layoutSizing: 'equal', color: 0x6366f1 }),
]

// ── 6. Mixed sizing — fill / fixed-px / fixed-ratio in a row ─────────────────

export const mixedSizing: ChoanElement[] = [
  ctr('mix-root', 'List Item', { width: 375, height: 64, layoutDirection: 'row', layoutGap: 12, layoutPadding: 16 }),
  child('mix-avatar', 'Avatar', 'mix-root', { z: 1, width: 40, height: 40, layoutSizing: 'fixed-px', type: 'circle' }),
  child('mix-text', 'Title', 'mix-root', { z: 1, width: 200, height: 40, layoutSizing: 'fill' }),
  child('mix-badge', 'Badge', 'mix-root', { z: 1, width: 60, height: 24, layoutSizing: 'fixed-px', skin: 'badge', componentState: { count: 3 } }),
]

// ── 7. Deep hierarchy — 3-level nesting ──────────────────────────────────────

export const deepHierarchy: ChoanElement[] = [
  // Level 0
  ctr('deep-page', 'Page', { x: 0, y: 0, z: 0, width: 375, height: 812, layoutDirection: 'column', layoutGap: 0 }),
  // Level 1
  { ...ctr('deep-header', 'Header', { width: 375, height: 56, layoutDirection: 'row' }), parentId: 'deep-page', z: 1 },
  { ...ctr('deep-content', 'Content', { width: 375, height: 756, layoutDirection: 'column', layoutGap: 8, layoutPadding: 16 }), parentId: 'deep-page', z: 1 },
  // Level 2 — header children
  child('deep-logo', 'Logo', 'deep-header', { z: 2, width: 80, height: 32, layoutSizing: 'fixed-px' }),
  child('deep-nav-title', 'Nav Title', 'deep-header', { z: 2, width: 200, height: 32, layoutSizing: 'fill' }),
  // Level 2 — content children
  { ...ctr('deep-card', 'Card', { width: 343, height: 160, layoutDirection: 'column', layoutGap: 8, layoutPadding: 12, radius: 0.08, color: 0xffffff }), parentId: 'deep-content', z: 2 },
  // Level 3 — card children
  child('deep-card-title', 'Card Title', 'deep-card', { z: 3, width: 319, height: 24 }),
  child('deep-card-body', 'Card Body', 'deep-card', { z: 3, width: 319, height: 64, color: 0xf3f4f6 }),
]

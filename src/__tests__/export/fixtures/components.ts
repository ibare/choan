import type { ChoanElement } from '../../../store/useElementStore'
import { ctr, child } from './_builder'

// ── 1. Toggle controls — switch, checkbox, radio in a settings column ─────────

export const toggleControls: ChoanElement[] = [
  ctr('tc-root', 'Toggle Controls', { width: 375, height: 300, layoutDirection: 'column', layoutGap: 1 }),
  // Switch row
  { ...ctr('tc-row1', 'Notifications Row', { width: 375, height: 56, layoutDirection: 'row', layoutPadding: 16 }), parentId: 'tc-root', z: 1 },
  child('tc-sw-label', 'Notifications', 'tc-row1', { z: 2, width: 200, height: 24, layoutSizing: 'fill', skin: 'text', componentState: { text: 'Notifications' } }),
  child('tc-sw', 'Notifications Toggle', 'tc-row1', { z: 2, width: 51, height: 31, layoutSizing: 'fixed-px', skin: 'switch', componentState: { on: true } }),
  // Checkbox row
  { ...ctr('tc-row2', 'Remember Me Row', { width: 375, height: 56, layoutDirection: 'row', layoutPadding: 16 }), parentId: 'tc-root', z: 1 },
  child('tc-cb-label', 'Remember Me', 'tc-row2', { z: 2, width: 200, height: 24, layoutSizing: 'fill', skin: 'text', componentState: { text: 'Remember Me' } }),
  child('tc-cb', 'Remember Me Checkbox', 'tc-row2', { z: 2, width: 20, height: 20, layoutSizing: 'fixed-px', skin: 'checkbox', componentState: { checked: true } }),
  // Radio row
  { ...ctr('tc-row3', 'Option A Row', { width: 375, height: 56, layoutDirection: 'row', layoutPadding: 16 }), parentId: 'tc-root', z: 1 },
  child('tc-rb-label', 'Option A', 'tc-row3', { z: 2, width: 200, height: 24, layoutSizing: 'fill', skin: 'text', componentState: { text: 'Option A' } }),
  child('tc-rb', 'Option A Radio', 'tc-row3', { z: 2, width: 20, height: 20, layoutSizing: 'fixed-px', skin: 'radio', componentState: { selected: true }, type: 'circle' }),
]

// ── 2. Text inputs — normal, focused, with placeholder ───────────────────────

export const textInputs: ChoanElement[] = [
  ctr('ti-root', 'Login Form Fields', { width: 375, height: 240, layoutDirection: 'column', layoutGap: 12, layoutPadding: 16 }),
  child('ti-email', 'Email Input', 'ti-root', { z: 1, width: 343, height: 48, radius: 0.17, skin: 'text-input', componentState: { placeholder: 'Email address' } }),
  child('ti-pw', 'Password Input', 'ti-root', { z: 1, width: 343, height: 48, radius: 0.17, skin: 'text-input', componentState: { placeholder: 'Password', focused: true } }),
  child('ti-search', 'Search', 'ti-root', { z: 1, width: 343, height: 40, radius: 1, skin: 'search', componentState: { query: '' } }),
]

// ── 3. Slider controls ────────────────────────────────────────────────────────

export const sliderControls: ChoanElement[] = [
  ctr('sl-root', 'Slider Panel', { width: 375, height: 200, layoutDirection: 'column', layoutGap: 20, layoutPadding: 24 }),
  child('sl-vol', 'Volume', 'sl-root', { z: 1, width: 327, height: 24, skin: 'slider', componentState: { value: 0.7 } }),
  child('sl-bright', 'Brightness', 'sl-root', { z: 1, width: 327, height: 24, skin: 'slider', componentState: { value: 0.4 } }),
  child('sl-speed', 'Speed', 'sl-root', { z: 1, width: 327, height: 24, skin: 'slider', componentState: { value: 1.0 } }),
]

// ── 4. Button variants ────────────────────────────────────────────────────────

export const buttonVariants: ChoanElement[] = [
  ctr('btn-root', 'Button Showcase', { width: 375, height: 300, layoutDirection: 'column', layoutGap: 12, layoutPadding: 16 }),
  child('btn-primary', 'Primary Button', 'btn-root', { z: 1, width: 343, height: 48, radius: 0.25, skin: 'button', componentState: { label: 'Get Started' }, color: 0x6366f1 }),
  child('btn-secondary', 'Secondary Button', 'btn-root', { z: 1, width: 343, height: 48, radius: 0.25, skin: 'button', componentState: { label: 'Learn More' }, color: 0xe5e7eb }),
  child('btn-pressed', 'Pressed Button', 'btn-root', { z: 1, width: 343, height: 48, radius: 0.25, skin: 'button', componentState: { label: 'Confirm', pressed: true }, color: 0x4f46e5 }),
  child('btn-danger', 'Danger Button', 'btn-root', { z: 1, width: 343, height: 48, radius: 0.25, skin: 'button', componentState: { label: 'Delete Account' }, color: 0xef4444 }),
]

// ── 5. Dropdown ───────────────────────────────────────────────────────────────

export const dropdownControl: ChoanElement[] = [
  ctr('dd-root', 'Dropdown Section', { width: 375, height: 200, layoutDirection: 'column', layoutGap: 12, layoutPadding: 16 }),
  child('dd-closed', 'Country Dropdown', 'dd-root', { z: 1, width: 343, height: 48, radius: 0.17, skin: 'dropdown', componentState: { label: 'Select Country', open: false } }),
  child('dd-open', 'Language Dropdown', 'dd-root', { z: 1, width: 343, height: 48, radius: 0.17, skin: 'dropdown', componentState: { label: 'English', open: true } }),
]

// ── 6. Star rating ────────────────────────────────────────────────────────────

export const starRating: ChoanElement[] = [
  ctr('sr-root', 'Rating Section', { width: 375, height: 200, layoutDirection: 'column', layoutGap: 16, layoutPadding: 16 }),
  child('sr-5', 'Five Stars', 'sr-root', { z: 1, width: 120, height: 24, skin: 'star-rating', componentState: { rating: 5 } }),
  child('sr-3', 'Three Stars', 'sr-root', { z: 1, width: 120, height: 24, skin: 'star-rating', componentState: { rating: 3 } }),
  child('sr-1', 'One Star', 'sr-root', { z: 1, width: 120, height: 24, skin: 'star-rating', componentState: { rating: 1 } }),
]

// ── 7. Avatar variants ────────────────────────────────────────────────────────

export const avatarVariants: ChoanElement[] = [
  ctr('av-root', 'Avatar Row', { width: 375, height: 100, layoutDirection: 'row', layoutGap: 16, layoutPadding: 16 }),
  child('av-online', 'Online User', 'av-root', { z: 1, width: 48, height: 48, type: 'circle', skin: 'avatar', componentState: { initials: 'JD', online: true } }),
  child('av-offline', 'Offline User', 'av-root', { z: 1, width: 48, height: 48, type: 'circle', skin: 'avatar', componentState: { initials: 'AK', online: false } }),
  child('av-large', 'Profile Avatar', 'av-root', { z: 1, width: 80, height: 80, type: 'circle', skin: 'avatar', componentState: { initials: 'MR', online: true } }),
]

// ── 8. Media & data display — image, icon, badge, table-skeleton ──────────────

export const mediaDisplay: ChoanElement[] = [
  ctr('md-root', 'Media Panel', { width: 375, height: 400, layoutDirection: 'column', layoutGap: 16, layoutPadding: 16 }),
  child('md-img', 'Hero Image', 'md-root', { z: 1, width: 343, height: 180, radius: 0.06, skin: 'image', componentState: { seed: 42 } }),
  child('md-icon', 'Feature Icon', 'md-root', { z: 1, width: 48, height: 48, skin: 'icon', componentState: { icon: 'star' } }),
  child('md-badge', 'Notification Badge', 'md-root', { z: 1, width: 24, height: 24, type: 'circle', skin: 'badge', componentState: { count: 12 } }),
  child('md-table', 'Data Table', 'md-root', { z: 1, width: 343, height: 120, skin: 'table-skeleton', componentState: { columns: 4 } }),
]

import type { ChoanElement } from '../../../store/useElementStore'
import type { AnimationBundle } from '../../../animation/types'
import { el, ctr, child, bundle, clip, tr, kf } from './_builder'

// ── 1. Fade in — opacity 0 → 1 ───────────────────────────────────────────────

export const fadeInElements: ChoanElement[] = [
  ctr('fi-root', 'Fade In Screen', { width: 375, height: 812, layoutDirection: 'column' }),
  child('fi-modal', 'Modal Overlay', 'fi-root', { z: 1, width: 375, height: 812, opacity: 0, color: 0x000000 }),
  child('fi-card', 'Modal Card', 'fi-root', { z: 2, x: 32, y: 200, width: 311, height: 240, radius: 0.1, color: 0xffffff, opacity: 0 }),
]

export const fadeInBundles: AnimationBundle[] = [
  bundle('fi-bundle', 'Fade In', [
    clip('fi-clip-overlay', 'fi-modal', [tr('opacity', [kf(0, 0), kf(300, 0.5)])]),
    clip('fi-clip-card', 'fi-card', [tr('opacity', [kf(0, 0), kf(300, 1)])]),
  ]),
]

// ── 2. Slide in — x translate ─────────────────────────────────────────────────

export const slideInElements: ChoanElement[] = [
  ctr('si-root', 'Slide In Screen', { width: 375, height: 812, layoutDirection: 'free' }),
  child('si-panel', 'Side Panel', 'si-root', { z: 1, x: -320, y: 0, width: 320, height: 812, color: 0x1f2937 }),
  child('si-overlay', 'Overlay', 'si-root', { z: 1, x: 0, y: 0, width: 375, height: 812, opacity: 0, color: 0x000000 }),
]

export const slideInBundles: AnimationBundle[] = [
  bundle('si-bundle', 'Slide In Menu', [
    clip('si-clip-panel', 'si-panel', [tr('x', [kf(0, -320), kf(350, 0)])], 350),
    clip('si-clip-overlay', 'si-overlay', [tr('opacity', [kf(0, 0), kf(350, 0.4)])], 350),
  ]),
]

// ── 3. Multi-track — x + opacity + color simultaneously ──────────────────────

export const multiTrackElements: ChoanElement[] = [
  el('mt-hero', 'Hero Banner', { x: 0, y: 100, width: 375, height: 200, opacity: 0, color: 0x6366f1 }),
]

export const multiTrackBundles: AnimationBundle[] = [
  bundle('mt-bundle', 'Hero Entrance', [
    clip('mt-clip', 'mt-hero', [
      tr('opacity', [kf(0, 0), kf(400, 1)]),
      tr('y', [kf(0, 160), kf(400, 100)]),
      tr('color', [kf(0, 0x818cf8), kf(400, 0x6366f1)]),
    ], 400),
  ]),
]

// ── 4. Color change — background transition ───────────────────────────────────

export const colorChangeElements: ChoanElement[] = [
  ctr('cc-root', 'Theming Screen', { width: 375, height: 812, layoutDirection: 'column' }),
  child('cc-bg', 'Background', 'cc-root', { z: 1, width: 375, height: 812, color: 0xffffff }),
  child('cc-btn', 'Theme Toggle', 'cc-root', { z: 1, x: 147, y: 380, width: 80, height: 36, radius: 0.5, skin: 'button', componentState: { label: 'Toggle' }, color: 0x6366f1 }),
]

export const colorChangeBundles: AnimationBundle[] = [
  bundle('cc-bundle', 'Dark Mode', [
    clip('cc-clip-bg', 'cc-bg', [tr('color', [kf(0, 0xffffff), kf(500, 0x111827)])], 500),
  ]),
]

// ── 5. Staggered list — multiple elements with offset timing ──────────────────

export const staggeredListElements: ChoanElement[] = [
  ctr('sl-root', 'Staggered List', { width: 375, height: 500, layoutDirection: 'column', layoutGap: 8, layoutPadding: 16 }),
  child('sl-item1', 'List Item 1', 'sl-root', { z: 1, width: 343, height: 56, radius: 0.1, color: 0xffffff, opacity: 0 }),
  child('sl-item2', 'List Item 2', 'sl-root', { z: 1, width: 343, height: 56, radius: 0.1, color: 0xffffff, opacity: 0 }),
  child('sl-item3', 'List Item 3', 'sl-root', { z: 1, width: 343, height: 56, radius: 0.1, color: 0xffffff, opacity: 0 }),
  child('sl-item4', 'List Item 4', 'sl-root', { z: 1, width: 343, height: 56, radius: 0.1, color: 0xffffff, opacity: 0 }),
]

export const staggeredListBundles: AnimationBundle[] = [
  bundle('sl-bundle', 'Stagger Entrance', [
    clip('sl-clip1', 'sl-item1', [tr('opacity', [kf(0, 0), kf(200, 1)]), tr('y', [kf(0, 20), kf(200, 0)])], 200),
    clip('sl-clip2', 'sl-item2', [tr('opacity', [kf(80, 0), kf(280, 1)]), tr('y', [kf(80, 20), kf(280, 0)])], 280),
    clip('sl-clip3', 'sl-item3', [tr('opacity', [kf(160, 0), kf(360, 1)]), tr('y', [kf(160, 20), kf(360, 0)])], 360),
    clip('sl-clip4', 'sl-item4', [tr('opacity', [kf(240, 0), kf(440, 1)]), tr('y', [kf(240, 20), kf(440, 0)])], 440),
  ]),
]

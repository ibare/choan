/**
 * Snapshot tests for the export pipeline (toMarkdown).
 *
 * Each test feeds a UI pattern fixture through toMarkdown() and captures the
 * exact markdown output. Future changes to the rendering pipeline that alter
 * the output will cause a snapshot diff, making regressions immediately visible.
 *
 * To update snapshots after an intentional change: `vitest --update-snapshots`
 */
import { describe, it, expect } from 'vitest'
import { toMarkdown } from '../../export/toMarkdown'

// ── Layout fixtures ───────────────────────────────────────────────────────────
import {
  freeLayout, rowLayout, columnLayout, gridLayout,
  nestedLayout, mixedSizing, deepHierarchy,
} from './fixtures/layout'

// ── Component fixtures ────────────────────────────────────────────────────────
import {
  toggleControls, textInputs, sliderControls, buttonVariants,
  dropdownControl, starRating, avatarVariants, mediaDisplay,
} from './fixtures/components'

// ── Screen fixtures ───────────────────────────────────────────────────────────
import {
  feedCard, settingsScreen, loginForm, profileHeader,
  dashboardGrid, navBar, tabBar, productCard, chatBubbles, emptyState,
} from './fixtures/screens'

// ── State fixtures ────────────────────────────────────────────────────────────
import {
  skeletonLoading, toggleStates, formStates,
  progressVariants, badgeCounts,
} from './fixtures/states'

// ── Animation fixtures ────────────────────────────────────────────────────────
import {
  fadeInElements, fadeInBundles,
  slideInElements, slideInBundles,
  multiTrackElements, multiTrackBundles,
  colorChangeElements, colorChangeBundles,
  staggeredListElements, staggeredListBundles,
} from './fixtures/animations'

// ── Layout ────────────────────────────────────────────────────────────────────

describe('Layout snapshots', () => {
  it('free layout', () => {
    expect(toMarkdown(freeLayout)).toMatchSnapshot()
  })

  it('row layout', () => {
    expect(toMarkdown(rowLayout)).toMatchSnapshot()
  })

  it('column layout', () => {
    expect(toMarkdown(columnLayout)).toMatchSnapshot()
  })

  it('grid layout', () => {
    expect(toMarkdown(gridLayout)).toMatchSnapshot()
  })

  it('nested layout (row inside column)', () => {
    expect(toMarkdown(nestedLayout)).toMatchSnapshot()
  })

  it('mixed sizing (fill / fixed-px in a row)', () => {
    expect(toMarkdown(mixedSizing)).toMatchSnapshot()
  })

  it('deep hierarchy (3-level nesting)', () => {
    expect(toMarkdown(deepHierarchy)).toMatchSnapshot()
  })
})

// ── Components ────────────────────────────────────────────────────────────────

describe('Component snapshots', () => {
  it('toggle controls (switch / checkbox / radio)', () => {
    expect(toMarkdown(toggleControls)).toMatchSnapshot()
  })

  it('text inputs (normal / focused / search)', () => {
    expect(toMarkdown(textInputs)).toMatchSnapshot()
  })

  it('slider controls', () => {
    expect(toMarkdown(sliderControls)).toMatchSnapshot()
  })

  it('button variants (primary / secondary / pressed / danger)', () => {
    expect(toMarkdown(buttonVariants)).toMatchSnapshot()
  })

  it('dropdown (closed / open)', () => {
    expect(toMarkdown(dropdownControl)).toMatchSnapshot()
  })

  it('star rating (5 / 3 / 1 stars)', () => {
    expect(toMarkdown(starRating)).toMatchSnapshot()
  })

  it('avatar variants (online / offline / large)', () => {
    expect(toMarkdown(avatarVariants)).toMatchSnapshot()
  })

  it('media & data display (image / icon / badge / table-skeleton)', () => {
    expect(toMarkdown(mediaDisplay)).toMatchSnapshot()
  })
})

// ── Screens ───────────────────────────────────────────────────────────────────

describe('Screen snapshots', () => {
  it('feed card', () => {
    expect(toMarkdown(feedCard)).toMatchSnapshot()
  })

  it('settings screen (toggle list)', () => {
    expect(toMarkdown(settingsScreen)).toMatchSnapshot()
  })

  it('login form', () => {
    expect(toMarkdown(loginForm)).toMatchSnapshot()
  })

  it('profile header', () => {
    expect(toMarkdown(profileHeader)).toMatchSnapshot()
  })

  it('dashboard grid', () => {
    expect(toMarkdown(dashboardGrid)).toMatchSnapshot()
  })

  it('navigation bar', () => {
    expect(toMarkdown(navBar)).toMatchSnapshot()
  })

  it('tab bar', () => {
    expect(toMarkdown(tabBar)).toMatchSnapshot()
  })

  it('product card', () => {
    expect(toMarkdown(productCard)).toMatchSnapshot()
  })

  it('chat bubbles (incoming + outgoing)', () => {
    expect(toMarkdown(chatBubbles)).toMatchSnapshot()
  })

  it('empty state', () => {
    expect(toMarkdown(emptyState)).toMatchSnapshot()
  })
})

// ── States ────────────────────────────────────────────────────────────────────

describe('State variation snapshots', () => {
  it('skeleton loading', () => {
    expect(toMarkdown(skeletonLoading)).toMatchSnapshot()
  })

  it('toggle states (on/off × switch/checkbox/radio)', () => {
    expect(toMarkdown(toggleStates)).toMatchSnapshot()
  })

  it('form validation states (normal / focused / error)', () => {
    expect(toMarkdown(formStates)).toMatchSnapshot()
  })

  it('progress bar variants (0% → 100%)', () => {
    expect(toMarkdown(progressVariants)).toMatchSnapshot()
  })

  it('badge counts (0 / 1 / 5 / 99 / 100)', () => {
    expect(toMarkdown(badgeCounts)).toMatchSnapshot()
  })
})

// ── Animations ────────────────────────────────────────────────────────────────

describe('Animation snapshots', () => {
  it('fade in (opacity 0 → 1)', () => {
    expect(toMarkdown(fadeInElements, fadeInBundles)).toMatchSnapshot()
  })

  it('slide in (x translate + overlay)', () => {
    expect(toMarkdown(slideInElements, slideInBundles)).toMatchSnapshot()
  })

  it('multi-track (opacity + y + color)', () => {
    expect(toMarkdown(multiTrackElements, multiTrackBundles)).toMatchSnapshot()
  })

  it('color change (dark mode)', () => {
    expect(toMarkdown(colorChangeElements, colorChangeBundles)).toMatchSnapshot()
  })

  it('staggered list entrance', () => {
    expect(toMarkdown(staggeredListElements, staggeredListBundles)).toMatchSnapshot()
  })
})

// ── Platform variations ───────────────────────────────────────────────────────

describe('Platform rendering snapshots', () => {
  it('login form — iOS', () => {
    expect(toMarkdown(loginForm, [], 'ios')).toMatchSnapshot()
  })

  it('login form — Android', () => {
    expect(toMarkdown(loginForm, [], 'android')).toMatchSnapshot()
  })

  it('dashboard grid — web (default)', () => {
    expect(toMarkdown(dashboardGrid, [], 'web')).toMatchSnapshot()
  })
})

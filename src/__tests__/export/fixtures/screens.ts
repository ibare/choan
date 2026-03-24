import type { ChoanElement } from '../../../store/useElementStore'
import { ctr, child } from './_builder'

// ── 1. Feed card — image + text + avatar + badge ──────────────────────────────

export const feedCard: ChoanElement[] = [
  ctr('fc-card', 'Feed Card', { width: 375, height: 320, layoutDirection: 'column', layoutGap: 0, radius: 0.05, color: 0xffffff }),
  child('fc-img', 'Cover Image', 'fc-card', { z: 1, width: 375, height: 200, skin: 'image', componentState: { seed: 7 } }),
  { ...ctr('fc-meta', 'Meta Row', { width: 375, height: 56, layoutDirection: 'row', layoutGap: 8, layoutPadding: 16 }), parentId: 'fc-card', z: 1 },
  child('fc-avatar', 'Author Avatar', 'fc-meta', { z: 2, width: 32, height: 32, type: 'circle', layoutSizing: 'fixed-px', skin: 'avatar', componentState: { initials: 'JD', online: false } }),
  child('fc-author', 'Author Name', 'fc-meta', { z: 2, width: 200, height: 32, layoutSizing: 'fill', skin: 'text', componentState: { text: 'Jane Doe', bold: true } }),
  child('fc-badge', 'Category Badge', 'fc-meta', { z: 2, width: 60, height: 24, layoutSizing: 'fixed-px', radius: 1, skin: 'badge', componentState: { count: 0 } }),
  child('fc-title', 'Post Title', 'fc-card', { z: 1, width: 343, height: 44, skin: 'text', componentState: { text: 'How to build better UIs', fontSize: 18, bold: true } }),
]

// ── 2. Settings screen — toggle list ─────────────────────────────────────────

export const settingsScreen: ChoanElement[] = [
  ctr('ss-screen', 'Settings', { width: 375, height: 600, layoutDirection: 'column', layoutGap: 0, color: 0xf2f2f7 }),
  // Section header
  child('ss-header', 'Notifications', 'ss-screen', { z: 1, width: 375, height: 36, skin: 'text', componentState: { text: 'NOTIFICATIONS', fontSize: 13 } }),
  // Row 1
  { ...ctr('ss-r1', 'Push Notifications', { width: 375, height: 56, layoutDirection: 'row', layoutPadding: 16, color: 0xffffff }), parentId: 'ss-screen', z: 1 },
  child('ss-r1-label', 'Push Notifications Label', 'ss-r1', { z: 2, layoutSizing: 'fill', width: 250, height: 24, skin: 'text', componentState: { text: 'Push Notifications' } }),
  child('ss-r1-sw', 'Push Notifications Toggle', 'ss-r1', { z: 2, layoutSizing: 'fixed-px', width: 51, height: 31, skin: 'switch', componentState: { on: true } }),
  // Row 2
  { ...ctr('ss-r2', 'Email Alerts', { width: 375, height: 56, layoutDirection: 'row', layoutPadding: 16, color: 0xffffff }), parentId: 'ss-screen', z: 1 },
  child('ss-r2-label', 'Email Alerts Label', 'ss-r2', { z: 2, layoutSizing: 'fill', width: 250, height: 24, skin: 'text', componentState: { text: 'Email Alerts' } }),
  child('ss-r2-sw', 'Email Alerts Toggle', 'ss-r2', { z: 2, layoutSizing: 'fixed-px', width: 51, height: 31, skin: 'switch', componentState: { on: false } }),
  // Row 3
  { ...ctr('ss-r3', 'Sound', { width: 375, height: 56, layoutDirection: 'row', layoutPadding: 16, color: 0xffffff }), parentId: 'ss-screen', z: 1 },
  child('ss-r3-label', 'Sound Label', 'ss-r3', { z: 2, layoutSizing: 'fill', width: 250, height: 24, skin: 'text', componentState: { text: 'Sound' } }),
  child('ss-r3-sw', 'Sound Toggle', 'ss-r3', { z: 2, layoutSizing: 'fixed-px', width: 51, height: 31, skin: 'switch', componentState: { on: true } }),
]

// ── 3. Login form ─────────────────────────────────────────────────────────────

export const loginForm: ChoanElement[] = [
  ctr('lf-screen', 'Login Screen', { width: 375, height: 812, layoutDirection: 'column', layoutGap: 0, color: 0xffffff }),
  child('lf-logo', 'App Logo', 'lf-screen', { z: 1, width: 120, height: 120, layoutSizing: 'fixed-px', type: 'circle', skin: 'icon', componentState: { icon: 'app' } }),
  child('lf-title', 'Welcome Title', 'lf-screen', { z: 1, width: 343, height: 48, skin: 'text', componentState: { text: 'Welcome Back', fontSize: 32, bold: true, align: 'center' } }),
  child('lf-sub', 'Subtitle', 'lf-screen', { z: 1, width: 343, height: 24, skin: 'text', componentState: { text: 'Sign in to continue', align: 'center' } }),
  child('lf-email', 'Email Field', 'lf-screen', { z: 1, width: 343, height: 48, radius: 0.17, skin: 'text-input', componentState: { placeholder: 'Email address' } }),
  child('lf-pass', 'Password Field', 'lf-screen', { z: 1, width: 343, height: 48, radius: 0.17, skin: 'text-input', componentState: { placeholder: 'Password' } }),
  child('lf-login-btn', 'Login Button', 'lf-screen', { z: 1, width: 343, height: 52, radius: 0.25, skin: 'button', componentState: { label: 'Sign In' }, color: 0x6366f1 }),
  child('lf-forgot', 'Forgot Password', 'lf-screen', { z: 1, width: 343, height: 24, skin: 'text', componentState: { text: 'Forgot Password?', align: 'center' } }),
]

// ── 4. Profile header — avatar, name, stats, follow button ───────────────────

export const profileHeader: ChoanElement[] = [
  ctr('ph-root', 'Profile Header', { width: 375, height: 280, layoutDirection: 'column', layoutGap: 12, layoutPadding: 16, color: 0xffffff }),
  child('ph-cover', 'Cover Photo', 'ph-root', { z: 1, width: 375, height: 120, layoutSizing: 'fixed-px', skin: 'image', componentState: { seed: 15 } }),
  child('ph-avatar', 'Profile Photo', 'ph-root', { z: 1, width: 80, height: 80, layoutSizing: 'fixed-px', type: 'circle', skin: 'avatar', componentState: { initials: 'AK', online: true } }),
  child('ph-name', 'Display Name', 'ph-root', { z: 1, width: 343, height: 28, skin: 'text', componentState: { text: 'Alex Kim', fontSize: 22, bold: true } }),
  // Stats row
  { ...ctr('ph-stats', 'Stats Row', { width: 343, height: 48, layoutDirection: 'row', layoutGap: 8 }), parentId: 'ph-root', z: 1 },
  child('ph-posts', 'Posts Count', 'ph-stats', { z: 2, width: 100, height: 48, skin: 'text', componentState: { text: '142 posts' } }),
  child('ph-followers', 'Followers Count', 'ph-stats', { z: 2, width: 100, height: 48, skin: 'text', componentState: { text: '4.2K followers' } }),
  child('ph-follow-btn', 'Follow Button', 'ph-root', { z: 1, width: 343, height: 40, radius: 0.5, skin: 'button', componentState: { label: 'Follow' }, color: 0x6366f1 }),
]

// ── 5. Dashboard — 2-col card grid with data ──────────────────────────────────

export const dashboardGrid: ChoanElement[] = [
  ctr('dg-root', 'Dashboard', { width: 375, height: 500, layoutDirection: 'column', layoutGap: 8, layoutPadding: 16, color: 0xf5f5f5 }),
  child('dg-title', 'Dashboard Title', 'dg-root', { z: 1, width: 343, height: 32, skin: 'text', componentState: { text: 'Overview', fontSize: 24, bold: true } }),
  { ...ctr('dg-grid', 'Metric Cards', { width: 343, height: 200, layoutDirection: 'grid', layoutColumns: 2, layoutGap: 8 }), parentId: 'dg-root', z: 1 },
  child('dg-c1', 'Revenue Card', 'dg-grid', { z: 2, width: 165, height: 96, radius: 0.08, color: 0xffffff }),
  child('dg-c2', 'Users Card', 'dg-grid', { z: 2, width: 165, height: 96, radius: 0.08, color: 0xffffff }),
  child('dg-c3', 'Orders Card', 'dg-grid', { z: 2, width: 165, height: 96, radius: 0.08, color: 0xffffff }),
  child('dg-c4', 'Conversion Card', 'dg-grid', { z: 2, width: 165, height: 96, radius: 0.08, color: 0xffffff }),
  child('dg-table', 'Recent Orders Table', 'dg-root', { z: 1, width: 343, height: 160, skin: 'table-skeleton', componentState: { columns: 4 } }),
]

// ── 6. Navigation bar ─────────────────────────────────────────────────────────

export const navBar: ChoanElement[] = [
  ctr('nb-root', 'Top Nav Bar', { width: 375, height: 56, layoutDirection: 'row', layoutGap: 0, color: 0x1f2937 }),
  child('nb-logo', 'Brand Logo', 'nb-root', { z: 1, width: 100, height: 40, layoutSizing: 'fixed-px', skin: 'text', componentState: { text: 'Choan', bold: true } }),
  child('nb-spacer', 'Nav Spacer', 'nb-root', { z: 1, width: 100, height: 40, layoutSizing: 'fill' }),
  { ...ctr('nb-links', 'Nav Links', { width: 160, height: 40, layoutDirection: 'row', layoutGap: 8 }), parentId: 'nb-root', z: 1 },
  child('nb-home', 'Home Link', 'nb-links', { z: 2, width: 40, height: 40 }),
  child('nb-explore', 'Explore Link', 'nb-links', { z: 2, width: 40, height: 40 }),
  child('nb-notif', 'Notifications Link', 'nb-links', { z: 2, width: 40, height: 40, skin: 'badge', componentState: { count: 5 } }),
  child('nb-profile', 'Profile Link', 'nb-links', { z: 2, width: 40, height: 40, type: 'circle', skin: 'avatar', componentState: { initials: 'JD' } }),
]

// ── 7. Tab bar — bottom navigation ───────────────────────────────────────────

export const tabBar: ChoanElement[] = [
  ctr('tb-root', 'Bottom Tab Bar', { width: 375, height: 83, layoutDirection: 'row', layoutGap: 0, color: 0xffffff }),
  child('tb-home', 'Home Tab', 'tb-root', { z: 1, width: 75, height: 83, layoutSizing: 'equal', skin: 'icon', componentState: { icon: 'home' } }),
  child('tb-search', 'Search Tab', 'tb-root', { z: 1, width: 75, height: 83, layoutSizing: 'equal', skin: 'icon', componentState: { icon: 'search' } }),
  child('tb-create', 'Create Tab', 'tb-root', { z: 1, width: 75, height: 83, layoutSizing: 'equal', skin: 'icon', componentState: { icon: 'plus' } }),
  child('tb-notifs', 'Notifications Tab', 'tb-root', { z: 1, width: 75, height: 83, layoutSizing: 'equal', skin: 'icon', componentState: { icon: 'bell' } }),
  child('tb-profile', 'Profile Tab', 'tb-root', { z: 1, width: 75, height: 83, layoutSizing: 'equal', skin: 'icon', componentState: { icon: 'user' } }),
]

// ── 8. Product card — e-commerce ──────────────────────────────────────────────

export const productCard: ChoanElement[] = [
  ctr('pc-card', 'Product Card', { width: 180, height: 280, layoutDirection: 'column', layoutGap: 8, layoutPadding: 12, radius: 0.07, color: 0xffffff }),
  child('pc-img', 'Product Image', 'pc-card', { z: 1, width: 156, height: 140, radius: 0.05, skin: 'image', componentState: { seed: 99 } }),
  child('pc-name', 'Product Name', 'pc-card', { z: 1, width: 156, height: 20, skin: 'text', componentState: { text: 'Wireless Headphones', fontSize: 14, bold: true } }),
  child('pc-price', 'Price', 'pc-card', { z: 1, width: 156, height: 20, skin: 'text', componentState: { text: '$89.99', fontSize: 16, bold: true } }),
  child('pc-rating', 'Rating', 'pc-card', { z: 1, width: 100, height: 16, skin: 'star-rating', componentState: { rating: 4 } }),
  child('pc-btn', 'Add to Cart', 'pc-card', { z: 1, width: 156, height: 36, radius: 0.5, skin: 'button', componentState: { label: 'Add to Cart' }, color: 0x6366f1 }),
]

// ── 9. Chat bubbles — outgoing + incoming ─────────────────────────────────────

export const chatBubbles: ChoanElement[] = [
  ctr('cb-screen', 'Chat Screen', { width: 375, height: 500, layoutDirection: 'column', layoutGap: 8, layoutPadding: 16, color: 0xf0f0f0 }),
  // Incoming
  { ...ctr('cb-in', 'Incoming Row', { width: 343, height: 60, layoutDirection: 'row', layoutGap: 8 }), parentId: 'cb-screen', z: 1 },
  child('cb-in-av', 'Sender Avatar', 'cb-in', { z: 2, width: 32, height: 32, layoutSizing: 'fixed-px', type: 'circle', skin: 'avatar', componentState: { initials: 'AK' } }),
  child('cb-in-msg', 'Incoming Message', 'cb-in', { z: 2, width: 220, height: 44, layoutSizing: 'fill', radius: 0.27, color: 0xffffff, skin: 'text', componentState: { text: "Hey, how are you?" } }),
  // Outgoing
  { ...ctr('cb-out', 'Outgoing Row', { width: 343, height: 60, layoutDirection: 'row', layoutGap: 8 }), parentId: 'cb-screen', z: 1 },
  child('cb-out-msg', 'Outgoing Message', 'cb-out', { z: 2, width: 220, height: 44, layoutSizing: 'fill', radius: 0.27, color: 0x6366f1, skin: 'text', componentState: { text: "I'm doing great!" } }),
  // Reply with longer text
  { ...ctr('cb-in2', 'Second Incoming Row', { width: 343, height: 80, layoutDirection: 'row', layoutGap: 8 }), parentId: 'cb-screen', z: 1 },
  child('cb-in2-av', 'Sender Avatar 2', 'cb-in2', { z: 2, width: 32, height: 32, layoutSizing: 'fixed-px', type: 'circle', skin: 'avatar', componentState: { initials: 'AK' } }),
  child('cb-in2-msg', 'Long Incoming Message', 'cb-in2', { z: 2, width: 260, height: 64, layoutSizing: 'fill', radius: 0.2, color: 0xffffff, skin: 'text', componentState: { text: "Let's catch up soon? Maybe this weekend?" } }),
]

// ── 10. Empty state ───────────────────────────────────────────────────────────

export const emptyState: ChoanElement[] = [
  ctr('es-root', 'Empty State', { width: 375, height: 500, layoutDirection: 'column', layoutGap: 16, layoutPadding: 24, color: 0xffffff }),
  child('es-icon', 'Empty Icon', 'es-root', { z: 1, width: 80, height: 80, layoutSizing: 'fixed-px', skin: 'icon', componentState: { icon: 'inbox' } }),
  child('es-title', 'Empty Title', 'es-root', { z: 1, width: 327, height: 28, skin: 'text', componentState: { text: 'Nothing here yet', fontSize: 20, bold: true, align: 'center' } }),
  child('es-body', 'Empty Body', 'es-root', { z: 1, width: 327, height: 44, skin: 'text', componentState: { text: 'Start by creating your first project.', align: 'center' } }),
  child('es-cta', 'CTA Button', 'es-root', { z: 1, width: 200, height: 48, layoutSizing: 'fixed-px', radius: 0.5, skin: 'button', componentState: { label: 'Create Project' }, color: 0x6366f1 }),
]

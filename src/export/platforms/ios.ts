// iOS (SwiftUI) renderer — stub for future implementation
import type { ChoanElement } from '../../store/useChoanStore'
import type { PlatformRenderer } from './base'

export const iosRenderer: PlatformRenderer = {
  platform: 'ios',
  renderLayout: () => null,
  renderSize: (el) => `${Math.round(el.width)} × ${Math.round(el.height)}`,
  renderVisual: () => [],
  renderSkin: () => null,
  renderPosition: (el, parent) =>
    `offset(x: ${Math.round(el.x - parent.x)}, y: ${Math.round(el.y - parent.y)})`,
}

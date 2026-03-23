// Android (Jetpack Compose) renderer — stub for future implementation
import type { ChoanElement } from '../../store/useChoanStore'
import type { PlatformRenderer } from './base'

export const androidRenderer: PlatformRenderer = {
  platform: 'android',
  renderLayout: () => null,
  renderSize: (el) => `${Math.round(el.width)} × ${Math.round(el.height)}`,
  renderVisual: () => [],
  renderSkin: () => null,
  renderPosition: (el, parent) =>
    `absoluteOffset(x = ${Math.round(el.x - parent.x)}.dp, y = ${Math.round(el.y - parent.y)}.dp)`,
}

import type { ChoanElement } from '../../store/useChoanStore'

export type Platform = 'web' | 'ios' | 'android'

/**
 * Platform-specific renderer interface.
 * Each method translates Choan element properties into platform-appropriate
 * descriptions. New platforms implement this interface to extend export support.
 */
export interface PlatformRenderer {
  readonly platform: Platform

  /** Layout system description for a container (flexbox / VStack / Column). */
  renderLayout(el: ChoanElement): string | null

  /** Size description in platform terms, considering parent layout context. */
  renderSize(el: ChoanElement, parent: ChoanElement | null): string

  /** Visual style properties (background, border-radius, etc.). */
  renderVisual(el: ChoanElement): string[]

  /** Component/skin reference description, or null if no skin. */
  renderSkin(el: ChoanElement): string | null

  /** Absolute position description for children in free-layout containers. */
  renderPosition(el: ChoanElement, parent: ChoanElement): string
}

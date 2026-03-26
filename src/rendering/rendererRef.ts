// Module-level renderer singleton — allows cross-component access to the renderer
// (e.g. video export from TimelinePanel needs to call renderer.render() directly).
//
// Set in SDFCanvas on mount, cleared on unmount.

import type { SDFRenderer } from '../engine/renderer'
import type { OrbitControls } from '../engine/controls'

export const rendererSingleton: {
  renderer: SDFRenderer | null
  controls: OrbitControls | null
} = {
  renderer: null,
  controls: null,
}

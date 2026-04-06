// Central constants — single source of truth for all magic numbers and UI colours.
// Import from here instead of hard-coding values in individual files.

// ── Handle hit detection ──
export const HANDLE_HIT_RADIUS = 16    // pixels, corner handle hit-test radius
export const MIN_ELEMENT_SIZE = 10     // pixels, minimum element width/height

// ── Ghost preview ──
export const GHOST_OPACITY_INBETWEEN = 0.5   // opacity for non-keyframe ghost frames
export const GHOST_KEYFRAME_EPSILON = 5      // ms tolerance for snapping to a keyframe time
export const GHOST_FPS_MS = 16               // ~60 fps sampling interval for ghost frames

// ── Overlay colours (RGBA, 0–1 range) ──
export const SELECTION_COLOR: [number, number, number, number] = [0.26, 0.52, 0.96, 1]
export const SNAP_COLOR: [number, number, number, number] = [0.0, 0.82, 0.82, 1]
export const DISTANCE_COLOR: [number, number, number, number] = [0.97, 0.45, 0.09, 1]

// ── Multi-select tint ──
export const MULTI_SELECT_TINT = 0xff2222
export const MULTI_SELECT_OPACITY = 0.8

// ── Color picker geometry (pixel units, before zoom compensation) ──
export const COLOR_PICKER_RING_BASE = 36    // radius of innermost ring center
export const COLOR_PICKER_RING_STEP = 26    // distance between ring centers
export const COLOR_PICKER_DISC_RADIUS = 13  // colour swatch half-size (px)
export const COLOR_PICKER_HIT_RADIUS = 14   // pointer hit-test radius for a swatch (px)

// ── Layout defaults ──
export const DEFAULT_LAYOUT_GAP = 8
export const DEFAULT_LAYOUT_PADDING = 8
export const DEFAULT_LAYOUT_COLUMNS = 2

// ── Director camera target drag ──
export const TARGET_DRAG_MAX_TILT_DEG = 15  // degrees — max tilt from top-down (0°=top, 90°=side) to allow target XY drag

// ── Director camera frustum ──
export const FRUSTUM_DEPTH = 8           // world units forward from camera position
export const FRUSTUM_ASPECT = 0.5625     // 16:9 = 9/16
export const FRUSTUM_TRI_HEIGHT = 0.7    // triangle height as fraction of near-plane half-height
export const FRUSTUM_TRI_HALF_W = 0.8    // triangle half-width as fraction of near-plane half-width
export const FRUSTUM_INNER_TRI_SCALE = 0.4  // inner align-marker triangle scale relative to outer

// ── Overlay geometry (pixel units, before zoom compensation) ──
export const HANDLE_SIZE_PX = 8      // corner handle half-size
export const DISTANCE_TICK_PX = 4    // distance measurement tick mark length

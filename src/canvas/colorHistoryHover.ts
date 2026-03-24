// Shared module-level state for color history hover.
// Written by ColorPicker (on mouseenter/leave), read by useAnimateLoop each frame.

export let hoveredHistoryColor: number | null = null
export function setHoveredHistoryColor(c: number | null) { hoveredHistoryColor = c }

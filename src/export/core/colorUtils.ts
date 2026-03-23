/** Convert numeric hex color (0xRRGGBB) to CSS #RRGGBB string. */
export function hexToCSS(color: number): string {
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`
}

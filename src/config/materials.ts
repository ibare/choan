// Color palette — 11 base colors × 5 shade levels

export interface ColorFamily {
  name: string
  shades: number[] // 5 shades: lightest (pastel) → darkest
}

export const COLOR_FAMILIES: ColorFamily[] = [
  { name: 'Baby Pink',   shades: [0xFDE8F0, 0xF5B0CC, 0xE87AA8, 0xB84878, 0x7A2048] },
  { name: 'Peach',       shades: [0xFFF0E6, 0xFFCCA8, 0xF0A070, 0xC07040, 0x804020] },
  { name: 'Butter',      shades: [0xFFFCE6, 0xFFE888, 0xE8C850, 0xB89828, 0x786010] },
  { name: 'Lime',        shades: [0xF0FAE6, 0xC0E890, 0x90C850, 0x609828, 0x386010] },
  { name: 'Mint',        shades: [0xE6F8F0, 0x90E8C0, 0x50C890, 0x289860, 0x106838] },
  { name: 'Sky',         shades: [0xE6F4FF, 0x90CCFF, 0x50A0F0, 0x2870C0, 0x104880] },
  { name: 'Periwinkle',  shades: [0xECEEFF, 0xA8B0FF, 0x7078F0, 0x4048C0, 0x202880] },
  { name: 'Lavender',    shades: [0xF2ECFF, 0xC0A8FF, 0x9070F0, 0x6040C0, 0x382080] },
  { name: 'Rose Quartz', shades: [0xFFE2EE, 0xFFA8CC, 0xF068A0, 0xC03870, 0x801840] },
  { name: 'Lilac Gray',  shades: [0xECEAF2, 0xC0BAD0, 0x9088A8, 0x605878, 0x383048] },
  { name: 'BW',          shades: [0xFFFFFF, 0xC0C0C0, 0x808080, 0x404040, 0x1A1A1A] },
]

// Flat list for backward compat
export const THEME_COLORS = COLOR_FAMILIES.map(f => ({ name: f.name, hex: f.shades[0] }))
export const PALETTE = COLOR_FAMILIES.map(f => f.shades[0])

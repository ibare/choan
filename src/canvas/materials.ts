// 테마 컬러 팔레트 — 파스텔 + 뉴트럴

export const THEME_COLORS: { name: string; hex: number }[] = [
  // Pastels (medium)
  { name: 'Mint',     hex: 0x7DDCAC },
  { name: 'Sky',      hex: 0x7EC8F8 },
  { name: 'Lavender', hex: 0xA98EF5 },
  { name: 'Lilac',    hex: 0xC090FF },
  { name: 'Rose',     hex: 0xFF8FAF },
  { name: 'Peach',    hex: 0xFFA07A },
  { name: 'Butter',   hex: 0xFFD84A },
  // Neutrals (light)
  { name: 'White',    hex: 0xFFFFFF },
  { name: 'Ivory',    hex: 0xFDFBF5 },
  { name: 'Sand',     hex: 0xF5EFE0 },
  { name: 'Khaki',    hex: 0xEDE4D0 },
  { name: 'Beige',    hex: 0xE4D8C0 },
]

export const PALETTE = THEME_COLORS.map((c) => c.hex)

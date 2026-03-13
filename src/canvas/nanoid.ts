export function nanoid(size = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(size)))
    .map((b) => chars[b % chars.length])
    .join('')
}

// Umami analytics helper — safe no-op when script is not loaded.

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void }
  }
}

export function track(event: string, data?: Record<string, unknown>) {
  window.umami?.track(event, data)
}

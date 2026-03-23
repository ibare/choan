/**
 * Converts a skin's componentState into a human-readable content description.
 * Returns null when there is nothing meaningful to say (empty/default state).
 *
 * Covers all 16 painters.ts skin types.
 */
export function describeComponentState(
  skin: string,
  state: Record<string, unknown> | undefined,
): string | null {
  if (!state) return null

  switch (skin) {
    case 'text': {
      const text     = String(state.text ?? 'Text')
      const size     = state.fontSize ? `${state.fontSize}px` : null
      const align    = typeof state.align === 'string' && state.align !== 'center' ? state.align : null
      const bold     = state.bold ? 'bold' : null
      const attrs    = [size, align, bold].filter(Boolean).join(', ')
      return attrs ? `"${text}" (${attrs})` : `"${text}"`
    }

    case 'icon':
      return `icon: ${state.icon ?? 'heart'}`

    case 'button': {
      const label   = String(state.label ?? 'Button')
      const pressed = state.pressed ? ' (pressed)' : ''
      return `label: "${label}"${pressed}`
    }

    case 'switch':
      return state.on ? 'on' : 'off'

    case 'checkbox':
      return state.checked ? 'checked' : 'unchecked'

    case 'radio':
      return state.selected ? 'selected' : 'unselected'

    case 'slider':
      return `value: ${Math.round(Number(state.value ?? 0) * 100)}%`

    case 'text-input': {
      const placeholder = String(state.placeholder ?? 'Type here...')
      const focused     = state.focused ? ' (focused)' : ''
      return `placeholder: "${placeholder}"${focused}`
    }

    case 'progress':
      return `${Math.round(Number(state.value ?? 0) * 100)}%`

    case 'badge': {
      const count = Number(state.count ?? 0)
      return count === 0 ? null : `count: ${count}`
    }

    case 'star-rating':
      return `rating: ${state.rating ?? 0} / 5`

    case 'avatar': {
      const initials = String(state.initials ?? '?')
      const online   = state.online ? ' (online)' : ''
      return `"${initials}"${online}`
    }

    case 'search': {
      const query = String(state.query ?? '')
      return query ? `query: "${query}"` : null
    }

    case 'dropdown': {
      const label = String(state.label ?? 'Select...')
      const open  = state.open ? ' (open)' : ''
      return `"${label}"${open}`
    }

    case 'table-skeleton':
      return `${state.columns ?? 3} columns`

    case 'image':
      return `seed: ${state.seed ?? 42}`

    default:
      return null
  }
}

// Simple condition expression evaluator
// Supports: key == value, key != value, key > value, key < value, key (truthy)

type StateValues = Record<string, boolean | string | number>

function coerce(raw: string, referenceType?: string): boolean | string | number {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (referenceType === 'number' || (!isNaN(Number(trimmed)) && trimmed !== '')) return Number(trimmed)
  return trimmed
}

export function evaluateCondition(condition: string, stateValues: StateValues): boolean {
  const trimmed = condition.trim()
  if (!trimmed) return true // empty condition always passes

  // Try operators in order of specificity
  for (const op of ['==', '!=', '>=', '<=', '>', '<'] as const) {
    const idx = trimmed.indexOf(op)
    if (idx < 0) continue

    const key = trimmed.slice(0, idx).trim()
    const rawVal = trimmed.slice(idx + op.length).trim()
    const stateVal = stateValues[key]
    if (stateVal === undefined) return false

    const compareVal = coerce(rawVal, typeof stateVal)

    switch (op) {
      case '==': return stateVal == compareVal
      case '!=': return stateVal != compareVal
      case '>=': return Number(stateVal) >= Number(compareVal)
      case '<=': return Number(stateVal) <= Number(compareVal)
      case '>':  return Number(stateVal) > Number(compareVal)
      case '<':  return Number(stateVal) < Number(compareVal)
    }
  }

  // No operator found — treat as boolean truthy check
  const val = stateValues[trimmed]
  return !!val
}

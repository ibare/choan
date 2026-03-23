// Container layout properties section for PropertiesPanel.

import type { ChoanElement } from '../store/useChoanStore'
import { Section } from '../components/ui/Section'
import { PropRow } from '../components/ui/PropRow'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Input } from '../components/ui/Input'

interface Props {
  el: ChoanElement
  childCount: number
  onChange: (patch: Record<string, unknown>) => void
}

const DIR_OPTIONS = [
  { value: 'free',   label: 'Free'   },
  { value: 'row',    label: 'Row'    },
  { value: 'column', label: 'Col'    },
  { value: 'grid',   label: 'Grid'   },
] as const

export default function ContainerLayoutSection({ el, childCount, onChange }: Props) {
  const dir = el.layoutDirection ?? 'free'
  const hasLayout = dir !== 'free'

  return (
    <Section title="Container Layout">
      <SegmentedControl
        options={DIR_OPTIONS as unknown as Array<{ value: string; label: string }>}
        value={dir}
        onChange={(d) => onChange({ layoutDirection: d })}
      />

      {hasLayout && (
        <>
          {dir === 'grid' && (
            <PropRow label="Columns">
              <Input
                type="number" min={1} max={12}
                value={String(el.layoutColumns ?? 2)}
                onChange={(e) => onChange({ layoutColumns: Math.max(1, Number(e.target.value)) })}
              />
            </PropRow>
          )}
          <PropRow label="Gap">
            <div className="ui-row-gap-2">
              <Input
                type="number" min={0}
                value={String(el.layoutGap ?? 8)}
                onChange={(e) => onChange({ layoutGap: Math.max(0, Number(e.target.value)) })}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>px</span>
            </div>
          </PropRow>
          <PropRow label="Padding">
            <div className="ui-row-gap-2">
              <Input
                type="number" min={0}
                value={String(el.layoutPadding ?? 8)}
                onChange={(e) => onChange({ layoutPadding: Math.max(0, Number(e.target.value)) })}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>px</span>
            </div>
          </PropRow>
        </>
      )}

      <PropRow label="Children">
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>{childCount} elements</span>
      </PropRow>
    </Section>
  )
}

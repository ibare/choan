import type { ChoanElement } from '../store/useChoanStore'
import { Section } from '../components/ui/Section'
import { PropRow } from '../components/ui/PropRow'
import { Input } from '../components/ui/Input'

interface Props {
  el: ChoanElement
  onUpdate: (patch: Record<string, unknown>) => void
}

export default function ElementSection({ el, onUpdate }: Props) {
  return (
    <Section title="Element">
      <PropRow label="Label">
        <Input
          value={el.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </PropRow>
      <PropRow label="Type">
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>{el.type}</span>
      </PropRow>
      {el.frame && (
        <PropRow label="Frame">
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{el.frame}</span>
        </PropRow>
      )}
    </Section>
  )
}

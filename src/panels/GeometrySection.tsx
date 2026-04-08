import type { ChoanElement, LineStyle } from '../store/useChoanStore'
import type { AnimatableProperty } from '../animation/types'
import { pixelToWorld } from '../coords/coordinateSystem'
import { Section } from '../components/ui/Section'
import { PropRow } from '../components/ui/PropRow'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Slider } from '../components/ui/Slider'
import { Checkbox } from '../components/ui/Checkbox'
import { KeyframeButton } from '../components/panels/KeyframeButton'

interface Props {
  el: ChoanElement
  isChild: boolean
  isManaged: boolean
  isContainer: boolean
  onUpdate: (patch: Record<string, unknown>) => void
  onUpdateAnimatable: (prop: AnimatableProperty, value: number) => void
  onRunLayout: () => void
}

const LINE_STYLE_OPTIONS = [
  { value: 'solid',  label: 'Solid'  },
  { value: 'dashed', label: 'Dashed' },
]

export default function GeometrySection({ el, isChild, isManaged, isContainer, onUpdate, onUpdateAnimatable, onRunLayout }: Props) {
  const maxRadius = Math.min(el.width, el.height) / 2
  const [wx, wy] = pixelToWorld(el.x + el.width / 2, el.y + el.height / 2)

  return (
    <Section title="Geometry">
      <PropRow label="World">
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
          {wx.toFixed(1)}, {wy.toFixed(1)}, {el.z.toFixed(1)}
        </span>
      </PropRow>
      {el.type === 'rectangle' && (
        <PropRow label="Radius">
          <div className="ui-row-gap-2" style={{ alignItems: 'center' }}>
            <Slider
              value={Math.round((el.radius ?? 0) * maxRadius)}
              min={0} max={maxRadius} step={1}
              formatValue={(v) => `${v}px`}
              onChange={(v) => onUpdateAnimatable('radius', maxRadius > 0 ? v / maxRadius : 0)}
            />
            <KeyframeButton elementId={el.id} property="radius" value={el.radius ?? 0} />
          </div>
        </PropRow>
      )}

      {el.type === 'line' && (
        <>
          <PropRow label="Style">
            <Select
              options={LINE_STYLE_OPTIONS}
              value={el.lineStyle ?? 'solid'}
              onChange={(v) => onUpdate({ lineStyle: v as LineStyle })}
            />
          </PropRow>
          <PropRow label="Arrow">
            <Checkbox
              checked={el.hasArrow ?? false}
              onChange={(checked) => onUpdate({ hasArrow: checked })}
            />
          </PropRow>
        </>
      )}

      <PropRow label={`Z${isChild ? ' (auto)' : ''}`}>
        <div className="ui-row-gap-2">
          <Input
            type="number" inputSize="sm"
            value={String(el.z)} disabled={isChild}
            onChange={(e) => {
              onUpdateAnimatable('z', Number(e.target.value))
              if (isContainer) queueMicrotask(onRunLayout)
            }}
          />
          <KeyframeButton elementId={el.id} property="z" value={el.z} />
        </div>
      </PropRow>

      <PropRow label={`Position${isManaged ? ' (auto)' : ''}`}>
        <div className="ui-row-gap-2">
          <Input
            type="number" inputSize="sm" placeholder="X"
            value={String(Math.round(el.x))} disabled={isManaged}
            onChange={(e) => onUpdateAnimatable('x', Number(e.target.value))}
          />
          <KeyframeButton elementId={el.id} property="x" value={el.x} />
          <Input
            type="number" inputSize="sm" placeholder="Y"
            value={String(Math.round(el.y))} disabled={isManaged}
            onChange={(e) => onUpdateAnimatable('y', Number(e.target.value))}
          />
          <KeyframeButton elementId={el.id} property="y" value={el.y} />
        </div>
      </PropRow>

      <PropRow label={`Size${isManaged ? ' (auto)' : ''}`}>
        <div className="ui-row-gap-2">
          <Input
            type="number" inputSize="sm" placeholder="W"
            value={String(Math.round(el.width))} disabled={isManaged}
            onChange={(e) => onUpdateAnimatable('width', Number(e.target.value))}
          />
          <KeyframeButton elementId={el.id} property="width" value={el.width} />
          <Input
            type="number" inputSize="sm" placeholder="H"
            value={String(Math.round(el.height))} disabled={isManaged}
            onChange={(e) => onUpdateAnimatable('height', Number(e.target.value))}
          />
          <KeyframeButton elementId={el.id} property="height" value={el.height} />
        </div>
      </PropRow>
    </Section>
  )
}

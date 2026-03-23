import * as RadixSlider from '@radix-ui/react-slider'
import { cn } from '../../design-system'

interface SliderProps {
  label?: string
  value: number
  min?: number
  max?: number
  step?: number
  showValue?: boolean
  formatValue?: (v: number) => string
  onChange: (v: number) => void
  className?: string
}

export function Slider({
  label, value, min = 0, max = 1, step = 0.01,
  showValue = true, formatValue, onChange, className,
}: SliderProps) {
  const display = formatValue ? formatValue(value) : String(Math.round(value * 100) / 100)
  return (
    <div className={cn('ui-slider', className)}>
      {label && <span className="ui-slider__label">{label}</span>}
      <RadixSlider.Root
        className="ui-slider__root"
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={([v]) => onChange(v)}
      >
        <RadixSlider.Track className="ui-slider__track">
          <RadixSlider.Range className="ui-slider__range" />
        </RadixSlider.Track>
        <RadixSlider.Thumb className="ui-slider__thumb" />
      </RadixSlider.Root>
      {showValue && <span className="ui-slider__value">{display}</span>}
    </div>
  )
}

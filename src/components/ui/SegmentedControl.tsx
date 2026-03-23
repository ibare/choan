import { cn } from '../../design-system'

interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  options, value, onChange, className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('ui-segmented', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cn('ui-segmented__item', opt.value === value && 'ui-segmented__item--active')}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon && <span className="ui-segmented__icon">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

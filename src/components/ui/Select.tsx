import * as RadixSelect from '@radix-ui/react-select'
import { CaretDown, Check } from '@phosphor-icons/react'
import { cn } from '../../design-system'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
}

export function Select({ options, value, onChange, placeholder, size = 'md', className, disabled }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger className={cn('ui-select', size === 'sm' && 'ui-select--sm', className)}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="ui-select__icon">
          <CaretDown size={10} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="ui-select__content" position="popper" sideOffset={4}>
          <RadixSelect.Viewport className="ui-select__viewport">
            {options.map((opt) => (
              <RadixSelect.Item key={opt.value} value={opt.value} className="ui-select__item">
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ui-select__indicator">
                  <Check size={10} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

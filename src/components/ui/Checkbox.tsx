import * as RadixCheckbox from '@radix-ui/react-checkbox'
import { Check } from '@phosphor-icons/react'
import { cn } from '../../design-system'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function Checkbox({ checked, onChange, className }: CheckboxProps) {
  return (
    <RadixCheckbox.Root
      className={cn('ui-checkbox', className)}
      checked={checked}
      onCheckedChange={onChange}
    >
      <RadixCheckbox.Indicator className="ui-checkbox__indicator">
        <Check size={10} weight="bold" />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}

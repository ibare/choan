import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '../../design-system'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function Switch({ checked, onChange, className }: SwitchProps) {
  return (
    <RadixSwitch.Root
      className={cn('ui-switch', className)}
      checked={checked}
      onCheckedChange={onChange}
    >
      <RadixSwitch.Thumb className="ui-switch__thumb" />
    </RadixSwitch.Root>
  )
}

import * as RadixPopover from '@radix-ui/react-popover'
import type { ReactNode } from 'react'
import { cn } from '../../design-system'

interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
  className?: string
}

export function Popover({
  trigger, children, open, onOpenChange,
  side = 'bottom', sideOffset = 4, align = 'start', className,
}: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className={cn('ui-popover', className)}
          side={side}
          sideOffset={sideOffset}
          align={align}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}

export { RadixPopover as PopoverPrimitive }

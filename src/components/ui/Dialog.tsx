import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '../../design-system'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}

export function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ui-dialog__overlay" />
        <RadixDialog.Content className={cn('ui-dialog__content', className)}>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export { RadixDialog as DialogPrimitive }

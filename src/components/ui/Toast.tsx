import * as RadixToast from '@radix-ui/react-toast'
import type { ReactNode } from 'react'
import { cn } from '../../design-system'

interface ToastProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  duration?: number
}

export function Toast({ open, onOpenChange, children, duration = 4000 }: ToastProps) {
  return (
    <RadixToast.Root className={cn('ui-toast')} open={open} onOpenChange={onOpenChange} duration={duration}>
      <RadixToast.Description className="ui-toast__msg">
        {children}
      </RadixToast.Description>
    </RadixToast.Root>
  )
}

export function ToastViewport() {
  return <RadixToast.Viewport className="ui-toast__viewport" />
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return <RadixToast.Provider swipeDirection="up">{children}</RadixToast.Provider>
}

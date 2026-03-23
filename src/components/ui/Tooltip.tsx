import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { cn } from '../../design-system'

interface TooltipProps {
  content: string
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
}

export function Tooltip({ content, children, side = 'right', delay = 400 }: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={delay}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className={cn('ui-tooltip')} side={side} sideOffset={6}>
          {content}
          <RadixTooltip.Arrow className="ui-tooltip__arrow" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider>{children}</RadixTooltip.Provider>
}

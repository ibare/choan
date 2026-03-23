import type { ReactNode } from 'react'
import { cn } from '../../design-system'

interface PropRowProps {
  label: string
  children: ReactNode
  columns?: '1-1' | '1-2' | 'label-only'
  className?: string
}

export function PropRow({ label, children, columns = '1-1', className }: PropRowProps) {
  return (
    <div className={cn('ui-prop-row', `ui-prop-row--${columns}`, className)}>
      <span className="ui-prop-row__label">{label}</span>
      {children}
    </div>
  )
}

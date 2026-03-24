import type { ReactNode } from 'react'
import { cn } from '../../design-system'

interface SectionProps {
  title?: string
  actions?: ReactNode
  className?: string
  children?: ReactNode
}

export function Section({ title, actions, className, children }: SectionProps) {
  return (
    <div className={cn('ui-section', className)}>
      {title && (
        <div className="ui-section__header">
          <span className="ui-section__title">{title}</span>
          {actions && <div className="ui-section__actions">{actions}</div>}
        </div>
      )}
      {children && <div className="ui-section__body">{children}</div>}
    </div>
  )
}

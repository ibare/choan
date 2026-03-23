import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../design-system'

const buttonVariants = cva('ui-btn', {
  variants: {
    variant: {
      default: 'ui-btn--default',
      primary: 'ui-btn--primary',
      ghost:   'ui-btn--ghost',
      danger:  'ui-btn--danger',
    },
    size: {
      md:   'ui-btn--md',
      sm:   'ui-btn--sm',
      icon: 'ui-btn--icon',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  active?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, active, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), active && 'ui-btn--active', className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'

import { forwardRef } from 'react'
import { cn } from '../../design-system'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: 'sm' | 'md'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize = 'md', ...props }, ref) => (
    <input
      ref={ref}
      className={cn('ui-input', inputSize === 'sm' && 'ui-input--sm', className)}
      {...props}
    />
  )
)
Input.displayName = 'Input'

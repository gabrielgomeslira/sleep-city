import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground flex h-12 w-full min-w-0 rounded-xl border-2 border-input bg-muted px-4 text-base font-bold text-card-foreground transition-[color,box-shadow,border-color] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20',
        'aria-invalid:ring-destructive/30 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

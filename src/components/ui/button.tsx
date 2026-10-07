import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Botões "gordinhos" com sombra sólida embaixo, que afundam ao clicar.
const pressable = 'active:translate-y-[3px] active:shadow-none hover:brightness-105'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-display font-semibold tracking-wide transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-4 focus-visible:ring-ring/50 select-none",
  {
    variants: {
      variant: {
        default: cn('bg-primary text-primary-foreground shadow-[0_4px_0_var(--color-primary-dark)]', pressable),
        play: cn('bg-sun text-sun-foreground shadow-[0_4px_0_var(--color-sun-dark)]', pressable),
        success: cn('bg-grass text-white shadow-[0_4px_0_var(--color-grass-dark)]', pressable),
        destructive: cn('bg-destructive text-white shadow-[0_4px_0_var(--color-destructive-dark)]', pressable),
        secondary: cn(
          'bg-secondary text-secondary-foreground shadow-[0_3px_0_var(--color-secondary-dark)]',
          pressable,
        ),
        outline: cn('border-2 border-input bg-white text-primary shadow-[0_3px_0_var(--color-input)]', pressable),
        ghost: 'text-secondary-foreground hover:bg-secondary',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-base',
        sm: 'h-9 rounded-lg px-3 text-sm',
        lg: 'h-14 rounded-2xl px-6 text-lg uppercase',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }

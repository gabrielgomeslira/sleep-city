import { Moon } from 'lucide-react'
import type { ReactNode } from 'react'

export function MoonBadge({ className = 'size-10', iconClassName = 'size-5' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl bg-sun shadow-[0_3px_0_var(--color-sun-dark)] ${className}`}
    >
      <Moon className={`fill-current text-sun-foreground ${iconClassName}`} />
    </span>
  )
}

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <a href="/" className="flex items-center gap-2.5">
        <MoonBadge />
        <span className="game-title font-display text-2xl font-bold text-white">Sleep City</span>
      </a>
      {children}
    </header>
  )
}

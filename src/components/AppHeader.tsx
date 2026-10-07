import { Moon } from 'lucide-react'
import type { ReactNode } from 'react'

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <Moon className="size-5 text-muted-foreground" />
        Cidade Dorme
      </a>
      {children}
    </header>
  )
}

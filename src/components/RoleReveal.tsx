import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { ROLE_INFO, type Role } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * A função só aparece enquanto o botão estiver pressionado e some sozinha ao soltar,
 * trocar de aba ou bloquear a tela. Todas as funções usam as mesmas cores e ícones,
 * então não dá para adivinhar de longe pela aparência.
 */
export function RoleReveal({ role, round }: { role: Role | null; round: number }) {
  const [revealed, setRevealed] = useState(false)
  const lastRound = useRef(round)

  useEffect(() => {
    setRevealed(false)
    if (round !== lastRound.current) {
      lastRound.current = round
      toast('Nova rodada sorteada', { description: 'Segure o botão para ver sua função.' })
    }
  }, [round])

  useEffect(() => {
    const hide = () => setRevealed(false)
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('blur', hide)
    window.addEventListener('pagehide', hide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('blur', hide)
      window.removeEventListener('pagehide', hide)
    }
  }, [])

  if (!role) {
    return (
      <Card>
        <CardContent className="py-4 text-center text-sm text-muted-foreground">
          Você entrou depois do sorteio. Aguarde o dono da sala sortear a próxima rodada.
        </CardContent>
      </Card>
    )
  }

  const info = ROLE_INFO[role]
  const onKey = (e: KeyboardEvent, value: boolean) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      setRevealed(value)
    }
  }

  return (
    <Card className="gap-4 py-5">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Sua função</span>
          <span>Rodada {round}</span>
        </div>

        <div
          aria-live="polite"
          className="flex h-40 items-center justify-center rounded-xl border border-dashed bg-background/60 px-4 text-center"
        >
          {revealed ? (
            <div>
              <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Você é</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{info.label}</p>
              <p className="mx-auto mt-2 max-w-64 text-xs text-muted-foreground">{info.description}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <EyeOff className="size-6" />
              <span className="text-sm">Função oculta</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setRevealed(true)
          }}
          onPointerUp={() => setRevealed(false)}
          onPointerCancel={() => setRevealed(false)}
          onLostPointerCapture={() => setRevealed(false)}
          onKeyDown={(e) => onKey(e, true)}
          onKeyUp={(e) => onKey(e, false)}
          onBlur={() => setRevealed(false)}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            'flex h-16 w-full touch-none items-center justify-center gap-2 rounded-xl border bg-secondary text-sm font-medium select-none [-webkit-touch-callout:none] [-webkit-user-select:none]',
            'transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            revealed && 'bg-accent',
          )}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {revealed ? 'Solte para esconder' : 'Segure para revelar'}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Dica: incline o celular para você e cubra a tela com a outra mão.
        </p>
      </CardContent>
    </Card>
  )
}

import { useEffect, useState, type KeyboardEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'

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

  // O aviso de nova rodada é o Announcement em tela cheia; aqui só escondemos a função antiga.
  useEffect(() => setRevealed(false), [round])

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
        <CardContent className="py-2 text-center font-bold text-muted-foreground">
          Você entrou depois do sorteio. Aguarde o narrador sortear a próxima rodada.
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
    <Card id="sua-funcao" className="scroll-mt-4 gap-4 py-5">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-primary-deep">Sua função</span>
          <span className="rounded-full bg-secondary px-3 py-1 font-display text-xs font-semibold text-secondary-foreground uppercase">
            Rodada {round}
          </span>
        </div>

        <div
          aria-live="polite"
          className="card-back flex h-48 items-center justify-center rounded-2xl border-4 border-white px-4 text-center text-white shadow-[0_0_0_3px_var(--color-primary)]"
        >
          {revealed ? (
            <div className="animate-pop">
              <p className="font-display text-xs font-semibold tracking-[0.25em] text-white/80 uppercase">Você é</p>
              <p className="game-title mt-1 font-display text-4xl font-bold">{info.label}</p>
              <p className="mx-auto mt-3 max-w-64 text-sm font-bold text-white/90">{info.description}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="game-title font-display text-6xl font-bold">?</span>
              <span className="font-display text-sm font-semibold tracking-wide text-white/85 uppercase">
                Função oculta
              </span>
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
            'flex h-16 w-full touch-none items-center justify-center gap-2 rounded-2xl bg-sun font-display text-lg font-semibold text-sun-foreground uppercase select-none [-webkit-touch-callout:none] [-webkit-user-select:none]',
            'shadow-[0_5px_0_var(--color-sun-dark)] transition-all outline-none focus-visible:ring-4 focus-visible:ring-ring/50',
            revealed && 'translate-y-[4px] shadow-[0_1px_0_var(--color-sun-dark)]',
          )}
        >
          {revealed ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          {revealed ? 'Solte para esconder' : 'Segure para revelar'}
        </button>

        <p className="text-center text-xs font-bold text-muted-foreground">
          🤫 Dica: incline o celular para você e cubra a tela com a outra mão.
        </p>
      </CardContent>
    </Card>
  )
}

import { useState, type ReactNode } from 'react'
import { Check, Loader2, Moon, Sun, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { names, phaseNumber, ROLE_BADGE, type PlayerView, type RoomView } from '@/lib/types'
import { cn, errorMessage } from '@/lib/utils'

interface Props {
  room: RoomView
  onChange: (room: RoomView) => void
}

/**
 * Painel do narrador durante a rodada: à noite marca quem foi atacado e quem o SAMU salvou,
 * de dia marca quem a cidade eliminou na votação. Cada passo é anunciado na tela de todos.
 * O componente é remontado a cada fase (key no RoomPage), então as seleções começam vazias.
 */
export function TurnPanel({ room, onChange }: Props) {
  const [attacked, setAttacked] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [voted, setVoted] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const night = room.phase === 'night'
  const number = phaseNumber(room)
  const alive = room.players.filter((p) => p.role && !p.dead)
  const byPid = new Map(alive.map((p) => [p.pid, p]))
  const pick = (pids: string[]) => pids.flatMap((pid) => byPid.get(pid) ?? [])

  const killed = pick(attacked.filter((pid) => !saved.includes(pid)))
  const rescued = pick(attacked.filter((pid) => saved.includes(pid)))
  const out = pick(voted)
  const last = room.turns[room.turns.length - 1]

  async function run(action: () => Promise<RoomView>) {
    setBusy(true)
    try {
      onChange(await action())
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function dawn() {
    const ok = await confirmDialog({
      emoji: '☀️',
      title: `Amanhecer o Dia ${number}?`,
      description: `Todos vão ver: ${killed.length ? `${names(killed)} ${killed.length > 1 ? 'morreram' : 'morreu'}.` : 'ninguém morreu esta noite.'}`,
      confirmText: 'Amanhecer',
      variant: 'success',
    })
    if (ok) run(() => api.dawn(room.code, attacked, saved))
  }

  async function dusk() {
    const ok = await confirmDialog({
      emoji: '🌙',
      title: `Anoitecer a Noite ${number + 1}?`,
      description: `Todos vão ver: ${out.length ? `${names(out)} ${out.length > 1 ? 'saíram' : 'saiu'} na votação.` : 'ninguém foi eliminado.'}`,
      confirmText: 'Anoitecer',
    })
    if (ok) run(() => api.dusk(room.code, voted))
  }

  async function undo() {
    const ok = await confirmDialog({
      emoji: '↩️',
      title: night ? `Voltar para o Dia ${number - 1}?` : `Voltar para a Noite ${number}?`,
      description: night
        ? 'A votação do dia é desfeita e você pode marcar de novo.'
        : 'O amanhecer é desfeito: quem morreu nesta noite volta a ficar vivo.',
      confirmText: 'Desfazer',
      variant: 'destructive',
    })
    if (ok) run(() => api.undo(room.code))
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          {night ? '🌙' : '☀️'} {night ? `Noite ${number}` : `Dia ${number}`}
        </CardTitle>
        <CardDescription>
          {night
            ? 'Toque nos nomes conforme os jogadores apontam. Só você vê isso.'
            : 'A cidade debate e vota. Marque quem foi eliminado, se alguém foi.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Winner room={room} alive={alive} />

        {night ? (
          <>
            <PlayerPicker
              emoji="🔪"
              label="Os assassinos atacaram"
              tone="red"
              players={alive}
              selected={attacked}
              onChange={setAttacked}
            />
            <PlayerPicker
              emoji="🚑"
              label="O SAMU salvou"
              tone="green"
              players={alive}
              selected={saved}
              onChange={setSaved}
            />
            <Outcome>
              {killed.length ? (
                <p>
                  💀 {names(killed)} {killed.length > 1 ? 'morrem' : 'morre'}
                </p>
              ) : (
                <p>✨ Ninguém morre esta noite</p>
              )}
              {rescued.length > 0 && (
                <p>
                  🚑 {names(rescued)} {rescued.length > 1 ? 'são salvos' : 'é salvo(a)'}
                </p>
              )}
            </Outcome>
            <Button variant="success" size="lg" onClick={dawn} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Sun />}
              Amanhecer
            </Button>
          </>
        ) : (
          <>
            {last && (
              <div className="rounded-2xl bg-muted px-3 py-2 text-sm font-bold text-muted-foreground">
                Esta noite: {last.killed.length ? `💀 ${names(last.killed)}` : 'ninguém morreu'}
                {last.saved && last.saved.length > 0 && ` · 🚑 salvou ${names(last.saved)}`}
              </div>
            )}
            <PlayerPicker
              emoji="⚖️"
              label="Eliminado na votação"
              tone="purple"
              players={alive}
              selected={voted}
              onChange={setVoted}
            />
            <Outcome>{out.length ? <p>💀 {names(out)} sai do jogo</p> : <p>🤝 Ninguém é eliminado</p>}</Outcome>
            <Button size="lg" onClick={dusk} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Moon className="fill-current" />}
              Anoitecer
            </Button>
          </>
        )}

        {room.turns.length > 0 && (
          <Button variant="ghost" size="sm" className="self-center" onClick={undo} disabled={busy}>
            <Undo2 /> {night ? `Desfazer o Dia ${number - 1}` : `Desfazer o amanhecer`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

const TONES = {
  red: 'bg-destructive text-white shadow-[0_3px_0_var(--color-destructive-dark)]',
  green: 'bg-grass text-white shadow-[0_3px_0_var(--color-grass-dark)]',
  purple: 'bg-primary text-white shadow-[0_3px_0_var(--color-primary-dark)]',
}

interface PickerProps {
  emoji: string
  label: string
  tone: keyof typeof TONES
  players: PlayerView[]
  selected: string[]
  onChange: (pids: string[]) => void
}

function PlayerPicker({ emoji, label, tone, players, selected, onChange }: PickerProps) {
  const toggle = (pid: string) =>
    onChange(selected.includes(pid) ? selected.filter((id) => id !== pid) : [...selected, pid])

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex w-full items-center justify-between gap-2">
        <span className="font-display text-lg font-semibold text-primary-deep">
          {emoji} {label}
        </span>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 font-display text-xs font-semibold whitespace-nowrap text-secondary-foreground">
          {selected.length ? `${selected.length} marcado${selected.length > 1 ? 's' : ''}` : 'ninguém'}
        </span>
      </legend>
      {players.length === 0 ? (
        <p className="text-sm font-bold text-muted-foreground">Ninguém vivo nesta rodada.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => {
            const on = selected.includes(p.pid)
            return (
              <button
                key={p.pid}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.pid)}
                className={cn(
                  'flex min-h-12 items-center gap-2 rounded-2xl px-2 py-1.5 text-left font-display font-semibold transition-all outline-none select-none focus-visible:ring-4 focus-visible:ring-ring/50 active:translate-y-[2px] active:shadow-none',
                  on ? TONES[tone] : 'bg-muted text-primary-deep shadow-[0_3px_0_var(--color-input)]',
                )}
              >
                <Avatar name={p.name} className="size-8 border-2 text-sm" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {on ? (
                  <Check className="size-5 shrink-0" strokeWidth={3} />
                ) : (
                  p.role && <span className="shrink-0 text-sm">{ROLE_BADGE[p.role].emoji}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

function Outcome({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-secondary-dark px-3 py-2 font-display font-semibold text-primary-deep">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Resultado</p>
      {children}
    </div>
  )
}

/** Dica só para o narrador: avisa quando um dos lados já ganhou. */
function Winner({ room, alive }: { room: RoomView; alive: PlayerView[] }) {
  if (room.turns.length === 0 || !room.counts?.assassinos) return null
  const assassins = alive.filter((p) => p.role === 'assassino').length
  const others = alive.length - assassins

  if (assassins === 0) {
    return (
      <div className="animate-pop rounded-2xl bg-grass px-3 py-2 font-display font-semibold text-white">
        🏆 A cidade venceu! Todos os assassinos foram eliminados.
      </div>
    )
  }
  if (assassins >= others) {
    return (
      <div className="animate-pop rounded-2xl bg-destructive px-3 py-2 font-display font-semibold text-white">
        🔪 Os assassinos venceram! Já são maioria na cidade.
      </div>
    )
  }
  return null
}

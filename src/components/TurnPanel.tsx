import { useEffect, useState, type ReactNode } from 'react'
import { Check, Loader2, Moon, Sun, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import { resolveNight, usedMirrors, winner, type NightPlayer } from '@shared/night'
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
 * Painel do narrador durante a rodada: à noite marca quem foi atacado, quem o SAMU salvou e,
 * quando ele tem vez, em quem o Justiceiro atirou; de dia marca quem a cidade eliminou na votação.
 * O resultado (Espelho, SAMU, culpa do Justiceiro) é calculado com as mesmas regras do servidor.
 * O componente é remontado a cada fase (key no RoomPage), então as seleções começam vazias.
 */
export function TurnPanel({ room, onChange }: Props) {
  const [attacked, setAttacked] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [shots, setShots] = useState<Record<string, string>>({})
  const [voted, setVoted] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const night = room.phase === 'night'
  const number = phaseNumber(room)
  const alive = room.players.filter((p): p is PlayerView & NightPlayer => !!p.role && !p.dead)
  // Assassinos não atacam uns aos outros; o SAMU e a votação podem escolher qualquer um.
  const targets = alive.filter((p) => p.role !== 'assassino')
  const byPid = new Map(alive.map((p) => [p.pid, p]))
  const pick = (pids: string[]) => pids.flatMap((pid) => byPid.get(pid) ?? [])
  const mirrorsUsed = usedMirrors(room.turns)

  // Justiceiros sorteados para agir nesta noite (o servidor sorteia quando a noite começa).
  const shooters = night ? alive.filter((p) => room.night?.justiceiros.includes(p.pid)) : []
  const shotList = shooters.flatMap((p) => (shots[p.pid] ? [{ by: p.pid, target: shots[p.pid] }] : []))

  const result = resolveNight({
    alive,
    attacked,
    saved,
    shots: shotList,
    usedMirrors: mirrorsUsed,
    seed: room.night?.seed ?? 0,
  })
  const killed = result.killed
  const out = pick(voted)
  const last = room.turns[room.turns.length - 1]

  // Aviso em pop-up uma vez por noite, quando o Justiceiro tem vez.
  const shooterNames = names(shooters)
  useEffect(() => {
    if (!shooterNames) return
    const key = `sleep-city:justiceiro:${room.code}:${room.round}:${number}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      // armazenamento indisponível: o aviso aparece mesmo assim
    }
    confirmDialog({
      notice: true,
      emoji: '🔫',
      title: 'O Justiceiro tem vez nesta noite!',
      description: `Acorde ${shooterNames} e pergunte se quer atirar em alguém. Marque o alvo no fim do painel.`,
      confirmText: 'Entendi',
    }).then(() => document.getElementById('justiceiro')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }, [shooterNames, room.code, room.round, number])

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
    if (ok) run(() => api.dawn(room.code, attacked, saved, shotList))
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
        <Winner room={room} alive={alive} mirrorsUsed={mirrorsUsed} />

        {night ? (
          <>
            <PlayerPicker
              emoji="🔪"
              label="Os assassinos atacaram"
              tone="red"
              players={targets}
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
            {shooters.map((p, i) => (
              <PlayerPicker
                key={p.pid}
                id={i === 0 ? 'justiceiro' : undefined}
                emoji="🔫"
                label={`${p.name} (Justiceiro) atirou em`}
                tone="sun"
                single
                players={alive.filter((t) => t.pid !== p.pid)}
                selected={shots[p.pid] ? [shots[p.pid]] : []}
                onChange={([target]) =>
                  setShots((current) => {
                    const next = { ...current }
                    if (target) next[p.pid] = target
                    else delete next[p.pid]
                    return next
                  })
                }
              />
            ))}
            <Outcome>
              {result.reflected.map((r) => (
                <p key={r.mirror.pid}>
                  🪞 {r.mirror.name} é o Espelho! O ataque volta para {r.assassin.name}
                </p>
              ))}
              {killed.length ? (
                <p>
                  💀 {names(killed)} {killed.length > 1 ? 'morrem' : 'morre'}
                </p>
              ) : (
                <p>✨ Ninguém morre esta noite</p>
              )}
              {result.rescued.length > 0 && (
                <p>
                  🚑 {names(result.rescued)} {result.rescued.length > 1 ? 'são salvos' : 'é salvo(a)'}
                </p>
              )}
              {result.guilty.length > 0 && (
                <p>
                  🔫 {names(result.guilty)} acertou um inocente e morre de culpa
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
                {last.reflected?.map((r) => ` · 🪞 ${r.mirror.name} devolveu para ${r.assassin.name}`)}
                {last.shots?.map((s) => ` · 🔫 ${s.by.name} atirou em ${s.target.name}`)}
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
  sun: 'bg-sun text-sun-foreground shadow-[0_3px_0_var(--color-sun-dark)]',
}

interface PickerProps {
  id?: string
  emoji: string
  label: string
  tone: keyof typeof TONES
  /** Só uma pessoa: tocar em outra troca a escolha. */
  single?: boolean
  players: PlayerView[]
  selected: string[]
  onChange: (pids: string[]) => void
}

function PlayerPicker({ id, emoji, label, tone, single, players, selected, onChange }: PickerProps) {
  const toggle = (pid: string) => {
    if (selected.includes(pid)) onChange(selected.filter((other) => other !== pid))
    else onChange(single ? [pid] : [...selected, pid])
  }

  return (
    <fieldset id={id} className="flex scroll-mt-4 flex-col gap-2">
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

/** Dica só para o narrador: avisa quando um dos lados já ganhou (regras em shared/night.ts). */
function Winner({ room, alive, mirrorsUsed }: { room: RoomView; alive: NightPlayer[]; mirrorsUsed: Set<string> }) {
  if (room.turns.length === 0 || !room.counts?.assassinos) return null
  const side = winner(alive, mirrorsUsed)

  if (side === 'cidade') {
    return (
      <div className="animate-pop rounded-2xl bg-grass px-3 py-2 font-display font-semibold text-white">
        🏆 A cidade venceu! Todos os assassinos foram eliminados.
      </div>
    )
  }
  if (side === 'assassinos') {
    return (
      <div className="animate-pop rounded-2xl bg-destructive px-3 py-2 font-display font-semibold text-white">
        🔪 Os assassinos venceram! A cidade não consegue mais pará-los.
      </div>
    )
  }
  return null
}

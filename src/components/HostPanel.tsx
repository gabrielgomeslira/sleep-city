import { useState } from 'react'
import { Loader2, Minus, Play, Plus, RotateCcw, Shuffle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Counts, RoomView } from '@/lib/types'
import { cn, errorMessage } from '@/lib/utils'

const FIELDS: { key: keyof Counts; label: string; emoji: string }[] = [
  { key: 'assassinos', label: 'Assassinos', emoji: '🔪' },
  { key: 'detetives', label: 'Detetives', emoji: '🔍' },
  { key: 'samu', label: 'SAMU', emoji: '🚑' },
]

interface Props {
  room: RoomView
  onChange: (room: RoomView) => void
}

export function HostPanel({ room, onChange }: Props) {
  const [counts, setCounts] = useState<Counts>(room.counts)
  const [busy, setBusy] = useState(false)

  const total = room.players.length
  const special = counts.assassinos + counts.detetives + counts.samu
  const citizens = total - special
  const playing = room.status === 'playing'

  async function run(action: () => Promise<RoomView>, success?: string) {
    setBusy(true)
    try {
      onChange(await action())
      if (success) toast.success(success)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    if (
      playing &&
      !(await confirmDialog({
        emoji: '🔀',
        title: 'Sortear nova rodada?',
        description: 'Todos recebem funções novas. A rodada atual será substituída.',
        confirmText: 'Sortear',
        variant: 'success',
      }))
    )
      return
    run(() => api.start(room.code, counts), playing ? 'Novas funções sorteadas!' : 'Funções sorteadas! 🌙')
  }

  async function reset() {
    const ok = await confirmDialog({
      emoji: '🌅',
      title: 'Encerrar a rodada?',
      description: 'As funções somem e todos voltam para o lobby.',
      confirmText: 'Encerrar',
    })
    if (!ok) return
    run(() => api.reset(room.code))
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>🎙️ Painel do narrador</CardTitle>
        <CardDescription>
          Quem não tirar uma função especial vira cidadão. Depois do sorteio, a função de cada um aparece na
          lista de jogadores. Só você vê.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {FIELDS.map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-2xl bg-muted py-2 pr-2 pl-3">
              <span className="flex items-center gap-2 font-display text-lg font-semibold text-primary-deep">
                <span className="text-xl">{emoji}</span>
                {label}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  disabled={counts[key] === 0}
                  onClick={() => setCounts((c) => ({ ...c, [key]: c[key] - 1 }))}
                  aria-label={`Menos ${label}`}
                >
                  <Minus />
                </Button>
                <span className="w-7 text-center font-display text-2xl font-bold text-primary tabular-nums">
                  {counts[key]}
                </span>
                <Button
                  size="icon"
                  className="rounded-full"
                  onClick={() => setCounts((c) => ({ ...c, [key]: c[key] + 1 }))}
                  aria-label={`Mais ${label}`}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-secondary-dark py-2 pr-2 pl-3">
            <span className="flex items-center gap-2 font-display text-lg font-semibold text-muted-foreground">
              <span className="text-xl">🏠</span>
              Cidadãos
            </span>
            <span
              className={cn(
                'w-[7.75rem] text-center font-display text-2xl font-bold text-muted-foreground tabular-nums',
                citizens < 0 && 'text-destructive',
              )}
            >
              {citizens}
            </span>
          </div>
        </div>

        {citizens < 0 && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
            Há mais funções especiais ({special}) do que jogadores ({total}).
          </p>
        )}

        <Button variant="success" size="lg" onClick={start} disabled={busy || total === 0 || citizens < 0}>
          {busy ? <Loader2 className="animate-spin" /> : playing ? <Shuffle /> : <Play className="fill-current" />}
          {playing ? 'Sortear nova rodada' : 'Sortear e começar'}
        </Button>

        {playing && (
          <Button variant="outline" onClick={reset} disabled={busy}>
            <RotateCcw /> Encerrar e voltar ao lobby
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

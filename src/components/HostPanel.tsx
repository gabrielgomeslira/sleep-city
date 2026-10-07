import { useState } from 'react'
import { Loader2, Minus, Play, Plus, RotateCcw, Shuffle, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Counts, RoomView } from '@/lib/types'
import { cn, errorMessage } from '@/lib/utils'

const FIELDS: { key: keyof Counts; label: string }[] = [
  { key: 'assassinos', label: 'Assassinos' },
  { key: 'detetives', label: 'Detetives' },
  { key: 'samu', label: 'SAMU' },
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

  function start() {
    if (playing && !confirm('Sortear novas funções para todos? A rodada atual será substituída.')) return
    run(() => api.start(room.code, counts), playing ? 'Novas funções sorteadas' : 'Funções sorteadas!')
  }

  function reset() {
    if (!confirm('Encerrar a rodada e voltar para o lobby?')) return
    run(() => api.reset(room.code))
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Funções da rodada</CardTitle>
        <CardDescription>
          Quem não receber uma função especial será cidadão. O sorteio é aleatório e ninguém (nem você) vê a
          função dos outros.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col divide-y rounded-lg border">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm">{label}</span>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={counts[key] === 0}
                  onClick={() => setCounts((c) => ({ ...c, [key]: c[key] - 1 }))}
                  aria-label={`Menos ${label}`}
                >
                  <Minus />
                </Button>
                <span className="w-5 text-center font-mono text-base tabular-nums">{counts[key]}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setCounts((c) => ({ ...c, [key]: c[key] + 1 }))}
                  aria-label={`Mais ${label}`}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground">
            <span>Cidadãos</span>
            <span className={cn('w-[6.75rem] text-center font-mono tabular-nums', citizens < 0 && 'text-destructive')}>
              {citizens}
            </span>
          </div>
        </div>

        {citizens < 0 && (
          <p className="text-sm text-destructive">
            Há mais funções especiais ({special}) do que jogadores ({total}).
          </p>
        )}

        <Button size="lg" onClick={start} disabled={busy || total === 0 || citizens < 0}>
          {busy ? <Loader2 className="animate-spin" /> : playing ? <Shuffle /> : <Play />}
          {playing ? 'Sortear nova rodada' : 'Sortear funções e iniciar'}
        </Button>

        {playing && (
          <Button variant="outline" onClick={reset} disabled={busy}>
            <RotateCcw /> Encerrar e voltar ao lobby
          </Button>
        )}

        {!room.me && (
          <Button
            variant="ghost"
            onClick={() => run(() => api.join(room.code, room.hostName), 'Você entrou no sorteio')}
            disabled={busy}
          >
            <UserPlus /> Também quero jogar
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

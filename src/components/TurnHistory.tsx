import { ScrollText } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { names, type RoomView } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Linha do tempo da rodada. Todos veem quem morreu; quem foi atacado e quem o SAMU
 * salvou só vem da API para o narrador.
 */
export function TurnHistory({ room }: { room: RoomView }) {
  if (room.status !== 'playing' || room.turns.length === 0) return null

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="size-5 text-primary" />
          Histórico da rodada {room.round}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3">
          {room.turns.map((turn, i) => (
            <li key={i} className="flex flex-col gap-3">
              <Entry emoji="🌙" title={`Noite ${i + 1}`}>
                {turn.attacked && (
                  <p>
                    🔪 Atacaram: {turn.attacked.length ? names(turn.attacked) : 'ninguém'}
                    {turn.saved && turn.saved.length > 0 && <> · 🚑 Salvou: {names(turn.saved)}</>}
                  </p>
                )}
                <p className={cn(turn.killed.length > 0 && 'text-destructive')}>
                  {turn.killed.length
                    ? `💀 ${names(turn.killed)} ${turn.killed.length > 1 ? 'morreram' : 'morreu'}`
                    : '✨ Ninguém morreu'}
                </p>
              </Entry>
              {turn.voted && (
                <Entry emoji="☀️" title={`Dia ${i + 1}`}>
                  <p className={cn(turn.voted.length > 0 && 'text-destructive')}>
                    {turn.voted.length
                      ? `⚖️ ${names(turn.voted)} ${turn.voted.length > 1 ? 'saíram' : 'saiu'} na votação`
                      : '🤝 Ninguém foi eliminado'}
                  </p>
                </Entry>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function Entry({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-lg">{emoji}</span>
      <div className="min-w-0 pt-1 text-sm font-bold text-muted-foreground">
        <p className="font-display text-base font-semibold text-primary-deep">{title}</p>
        {children}
      </div>
    </div>
  )
}

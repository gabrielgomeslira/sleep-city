import { Crown, Users, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlayerView } from '@/lib/types'

interface Props {
  players: PlayerView[]
  canKick: boolean
  onKick: (player: PlayerView) => void
}

export function PlayerList({ players, canKick, onKick }: Props) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          Jogadores ({players.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém entrou ainda. Compartilhe o link!</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {players.map((p) => (
              <li key={p.pid} className="flex min-h-11 items-center gap-2 py-1.5">
                <span className="truncate">{p.name}</span>
                {p.isHost && <Crown className="size-3.5 shrink-0 text-muted-foreground" aria-label="Dono da sala" />}
                {p.isMe && (
                  <Badge variant="secondary" className="shrink-0">
                    você
                  </Badge>
                )}
                {canKick && !p.isMe && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-8 text-muted-foreground"
                    onClick={() => onKick(p)}
                    aria-label={`Remover ${p.name}`}
                  >
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

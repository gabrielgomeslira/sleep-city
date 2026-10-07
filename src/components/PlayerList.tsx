import { Crown, Users, X } from 'lucide-react'

import { Avatar } from '@/components/Avatar'
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
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          Jogadores
          <span className="ml-auto rounded-full bg-primary px-2.5 py-0.5 font-display text-sm text-white">
            {players.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-center font-bold text-muted-foreground">Ninguém entrou ainda. Chame a galera!</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {players.map((p) => (
              <li
                key={p.pid}
                className="flex min-h-14 animate-pop items-center gap-3 rounded-2xl bg-muted px-2.5 py-2"
              >
                <Avatar name={p.name} />
                <span className="truncate font-display text-lg font-semibold text-primary-deep">{p.name}</span>
                {p.isHost && (
                  <Crown className="size-4 shrink-0 fill-sun text-sun-dark" aria-label="Dono da sala" />
                )}
                {p.isMe && <Badge className="shrink-0">você</Badge>}
                {canKick && !p.isMe && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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

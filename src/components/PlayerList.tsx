import { Users, X } from 'lucide-react'

import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROLE_BADGE, ROLE_INFO, type PlayerView } from '@/lib/types'
import { cn } from '@/lib/utils'

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
                <span className="min-w-0 truncate font-display text-lg font-semibold text-primary-deep">{p.name}</span>
                {p.isMe && <Badge className="shrink-0">você</Badge>}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  {p.role !== undefined && <RoleChip role={p.role} />}
                  {canKick && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onKick(p)}
                      aria-label={`Remover ${p.name}`}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function RoleChip({ role }: { role: PlayerView['role'] }) {
  if (!role) {
    return (
      <span className="rounded-full bg-white px-2.5 py-1 font-display text-xs font-semibold text-muted-foreground">
        Sem função
      </span>
    )
  }
  const badge = ROLE_BADGE[role]
  return (
    <span
      className={cn('rounded-full px-2.5 py-1 font-display text-sm font-semibold whitespace-nowrap', badge.className)}
    >
      {badge.emoji} {ROLE_INFO[role].label}
    </span>
  )
}

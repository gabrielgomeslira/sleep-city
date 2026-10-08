import { Mic, Users, X } from 'lucide-react'

import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROLE_BADGE, ROLE_INFO, type PlayerView } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  players: PlayerView[]
  /** Só o narrador pode remover jogadores e passar a narração. */
  canManage: boolean
  onKick: (player: PlayerView) => void
  onMakeNarrator: (player: PlayerView) => void
}

export function PlayerList({ players, canManage, onKick, onMakeNarrator }: Props) {
  const dead = players.filter((p) => p.dead).length
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          Jogadores
          <span className="ml-auto rounded-full bg-primary px-2.5 py-0.5 font-display text-sm text-white">
            {dead > 0 ? `${players.length - dead} vivos de ${players.length}` : players.length}
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
                className={cn(
                  'flex min-h-14 animate-pop items-center gap-3 rounded-2xl bg-muted px-2.5 py-2',
                  p.dead && 'bg-secondary/60',
                )}
              >
                {p.dead ? (
                  <span
                    aria-label="eliminado"
                    className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-white bg-secondary-dark text-xl"
                  >
                    💀
                  </span>
                ) : (
                  <Avatar name={p.name} />
                )}
                <span
                  className={cn(
                    'min-w-0 truncate font-display text-lg font-semibold text-primary-deep',
                    p.dead && 'text-muted-foreground line-through',
                  )}
                >
                  {p.name}
                </span>
                {p.isMe && <Badge className="shrink-0">você</Badge>}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  {p.role !== undefined && <RoleChip role={p.role} />}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      onClick={() => onMakeNarrator(p)}
                      aria-label={`Passar a narração para ${p.name}`}
                      title="Tornar narrador"
                    >
                      <Mic />
                    </Button>
                  )}
                  {canManage && (
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

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { navigate } from '@/lib/router'
import type { RecentRoom } from '@/lib/types'

const REFRESH_MS = 15000

function ago(time: number) {
  const minutes = Math.floor((Date.now() - time) / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  return `há ${Math.floor(minutes / 60)} h`
}

/** Salas com atividade nas últimas 2 horas; as paradas há mais tempo são apagadas pelo servidor. */
export function RecentRooms() {
  const [rooms, setRooms] = useState<RecentRoom[]>([])

  useEffect(() => {
    let active = true
    const load = () => {
      if (document.hidden) return
      api
        .recentRooms()
        .then((list) => active && setRooms(list))
        .catch(() => {})
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', load)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [])

  if (rooms.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salas recentes</CardTitle>
        <CardDescription>Salas com movimento nas últimas 2 horas.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {rooms.map((room) => (
            <li key={room.code} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-display text-lg tracking-[0.2em]">{room.code}</span>
                <span className="truncate text-sm font-semibold text-muted-foreground">
                  🎙️ {room.hostName} · <Users className="inline size-3.5 align-[-2px]" /> {room.players} ·{' '}
                  {room.status === 'playing' ? `rodada ${room.round}` : 'no lobby'} · {ago(room.updatedAt)}
                </span>
              </div>
              <Button size="sm" onClick={() => navigate(`/sala/${room.code}`)}>
                Entrar
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { toast } from 'sonner'

import { AppHeader } from '@/components/AppHeader'
import { HostPanel } from '@/components/HostPanel'
import { JoinForm } from '@/components/JoinForm'
import { PlayerList } from '@/components/PlayerList'
import { RoleReveal } from '@/components/RoleReveal'
import { SharePanel } from '@/components/SharePanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import { lastRoom } from '@/lib/session'
import type { PlayerView, RoomView } from '@/lib/types'
import { errorMessage } from '@/lib/utils'

const POLL_MS = 2500

function useRoom(code: string) {
  const [room, setRoom] = useState<RoomView | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setRoom(await api.getRoom(code))
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setError(errorMessage(err))
    }
  }, [code])

  useEffect(() => {
    if (notFound) return
    refresh()
    const timer = setInterval(() => {
      if (!document.hidden) refresh()
    }, POLL_MS)
    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, notFound])

  return { room, setRoom, notFound, error }
}

export function RoomPage({ code }: { code: string }) {
  const { room, setRoom, notFound, error } = useRoom(code)
  const joined = !!room && (room.isHost || !!room.me)

  useEffect(() => {
    if (joined) lastRoom.set(code)
  }, [joined, code])

  if (notFound) {
    return (
      <>
        <AppHeader />
        <Card>
          <CardHeader>
            <CardTitle>😴 Sala não encontrada</CardTitle>
            <CardDescription>
              O código {code} não existe ou a sala expirou. Confira o link com quem criou a sala.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="play" size="lg" className="w-full" onClick={() => navigate('/')}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  if (!room) {
    return (
      <>
        <AppHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 font-display text-lg font-semibold text-white/85">
          <Loader2 className="size-8 animate-spin" />
          {error ?? 'Carregando sala…'}
        </div>
      </>
    )
  }

  async function kick(player: PlayerView) {
    if (!confirm(`Remover ${player.name} da sala?`)) return
    try {
      setRoom(await api.kick(code, player.pid))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function leave() {
    if (!confirm('Sair da sala?')) return
    try {
      await api.leave(code)
      lastRoom.set('')
      navigate('/')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const playing = room.status === 'playing'

  return (
    <>
      <AppHeader>
        <div className="flex items-center gap-2">
          {error && <span className="size-2.5 rounded-full bg-destructive ring-2 ring-white" title={error} />}
          <Badge className="border-0 bg-white px-3 py-1 text-sm tracking-[0.2em] text-primary shadow-[0_3px_0_rgb(46_16_101/0.35)]">
            {room.code}
          </Badge>
        </div>
      </AppHeader>

      {!joined ? (
        <JoinForm room={room} onJoined={setRoom} />
      ) : (
        <>
          {playing && room.me && <RoleReveal role={room.me.role} round={room.round} />}

          {!playing && !room.isHost && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-2 text-center">
                <span className="animate-float text-5xl">😴</span>
                <p className="font-display text-xl font-semibold text-primary-deep">Você está na sala!</p>
                <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  Aguardando {room.hostName} sortear as funções…
                </p>
              </CardContent>
            </Card>
          )}

          {playing && !room.isHost && (
            <p className="text-center text-sm font-bold text-white/80">
              🎙️ Narrador: {room.hostName} · Nesta rodada: {room.counts.assassinos} assassino(s), {room.counts.detetives} detetive(s),{' '}
              {room.counts.samu} SAMU
            </p>
          )}

          {room.isHost && <HostPanel room={room} onChange={setRoom} />}
          {(room.isHost || !playing) && <SharePanel code={room.code} />}
          <PlayerList players={room.players} canKick={room.isHost} onKick={kick} />

          {!room.isHost && (
            <Button variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={leave}>
              <LogOut /> Sair da sala
            </Button>
          )}
        </>
      )}
    </>
  )
}

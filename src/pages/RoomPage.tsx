import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { toast } from 'sonner'

import { Announcement, useAnnouncement } from '@/components/Announcement'
import { AppHeader } from '@/components/AppHeader'
import { HostPanel } from '@/components/HostPanel'
import { JoinForm } from '@/components/JoinForm'
import { PhaseBar } from '@/components/PhaseBar'
import { PlayerList } from '@/components/PlayerList'
import { RoleReveal } from '@/components/RoleReveal'
import { SharePanel } from '@/components/SharePanel'
import { TurnHistory } from '@/components/TurnHistory'
import { TurnPanel } from '@/components/TurnPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm-dialog'
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

  // Avisa todo mundo na sala quando a narração passa para outra pessoa.
  const hostName = room?.hostName
  const isHost = room?.isHost
  const lastHostName = useRef(hostName)
  useEffect(() => {
    const previous = lastHostName.current
    lastHostName.current = hostName
    if (!previous || !hostName || previous === hostName || !joined) return
    if (isHost) {
      toast('🎙️ Agora você é o narrador!', { description: 'Escolha as funções e sorteie a próxima rodada.' })
    } else {
      toast(`🎙️ ${hostName} agora é o narrador`)
    }
  }, [hostName, isHost, joined])

  // Nova rodada, amanhecer e anoitecer aparecem em tela cheia para os jogadores.
  const { announcement, dismiss } = useAnnouncement(room, joined && !room?.isHost)

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
    const ok = await confirmDialog({
      emoji: '👋',
      title: `Remover ${player.name}?`,
      description: 'Essa pessoa sai da lista de jogadores da sala.',
      confirmText: 'Remover',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      setRoom(await api.kick(code, player.pid))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function makeNarrator(player: PlayerView) {
    const ok = await confirmDialog({
      emoji: '🎙️',
      title: `Passar a narração para ${player.name}?`,
      description:
        `${player.name} vira o narrador e você entra na sala como jogador comum.` +
        (room?.status === 'playing' ? ' A rodada atual é encerrada e todos voltam para o lobby.' : ''),
      confirmText: 'Passar',
    })
    if (!ok) return
    try {
      setRoom(await api.transfer(code, player.pid))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function leave() {
    const ok = await confirmDialog({
      emoji: '🚪',
      title: 'Sair da sala?',
      description: 'Você sai da lista de jogadores desta sala.',
      confirmText: 'Sair',
      variant: 'destructive',
    })
    if (!ok) return
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
      ) : room.isHost ? (
        <>
          <PhaseBar room={room} />
          {playing && (
            <TurnPanel key={`${room.round}-${room.phase}-${room.turns.length}`} room={room} onChange={setRoom} />
          )}
          {playing && <PlayerList players={room.players} canManage onKick={kick} onMakeNarrator={makeNarrator} />}
          <TurnHistory room={room} />
          <HostPanel room={room} onChange={setRoom} />
          <SharePanel code={room.code} />
          {!playing && <PlayerList players={room.players} canManage onKick={kick} onMakeNarrator={makeNarrator} />}
        </>
      ) : (
        <>
          <PhaseBar room={room} />

          {playing && room.me?.dead && (
            <div className="flex animate-pop items-center gap-3 rounded-3xl bg-primary-deep px-4 py-3 text-white shadow-[0_6px_0_rgb(0_0_0/0.25)]">
              <span className="text-4xl">💀</span>
              <div>
                <p className="font-display text-lg font-semibold">Você está fora desta rodada</p>
                <p className="text-sm font-bold text-white/80">Fique em silêncio até o próximo sorteio.</p>
              </div>
            </div>
          )}

          {playing && room.me && <RoleReveal role={room.me.role} round={room.round} />}

          {!playing && (
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

          {playing && <p className="text-center text-sm font-bold text-white/80">🎙️ Narrador: {room.hostName}</p>}

          <TurnHistory room={room} />
          {!playing && <SharePanel code={room.code} />}
          <PlayerList players={room.players} canManage={false} onKick={kick} onMakeNarrator={makeNarrator} />

          <Button variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={leave}>
            <LogOut /> Sair da sala
          </Button>
        </>
      )}

      <Announcement data={announcement} onClose={dismiss} />
    </>
  )
}

import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { savedName } from '@/lib/session'
import type { RoomView } from '@/lib/types'
import { errorMessage } from '@/lib/utils'

interface Props {
  room: RoomView
  onJoined: (room: RoomView) => void
}

export function JoinForm({ room, onJoined }: Props) {
  const [name, setName] = useState(savedName.get)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const updated = await api.join(room.code, name)
      savedName.set(name.trim())
      onJoined(updated)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="pt-4 text-center">
        <p className="font-display text-lg font-semibold text-white/80">Você foi convidado para a sala de</p>
        <h1 className="game-title font-display text-4xl font-bold text-white">{room.hostName}</h1>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Entrar na sala {room.code}</CardTitle>
          <CardDescription>{room.players.length} jogador(es) esperando por você</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="player-name" className="font-display text-base">
                Como quer ser chamado?
              </Label>
              <Input
                id="player-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                maxLength={24}
                autoComplete="off"
                autoFocus
                required
              />
            </div>
            <Button type="submit" variant="play" size="lg" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="animate-spin" />}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

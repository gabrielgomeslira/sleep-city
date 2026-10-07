import { useState, type FormEvent } from 'react'
import { ArrowRight, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { navigate } from '@/lib/router'
import { lastRoom, savedName } from '@/lib/session'
import { errorMessage } from '@/lib/utils'

export function HomePage() {
  const [name, setName] = useState(savedName.get)
  const [plays, setPlays] = useState(true)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const previousRoom = lastRoom.get()

  async function createRoom(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const room = await api.createRoom(name, plays)
      savedName.set(name.trim())
      lastRoom.set(room.code)
      navigate(`/sala/${room.code}`)
    } catch (err) {
      toast.error(errorMessage(err))
      setLoading(false)
    }
  }

  function joinRoom(e: FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean) navigate(`/sala/${clean}`)
  }

  return (
    <>
      <AppHeader />

      <section className="py-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">A cidade vai dormir…</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie uma sala, compartilhe o link e deixe o sorteio das funções com a gente. Cada pessoa vê apenas a
          própria função, no próprio celular.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Criar sala</CardTitle>
          <CardDescription>Você será o dono da sala e escolherá as funções.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createRoom} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="host-name">Seu nome</Label>
              <Input
                id="host-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Ana"
                maxLength={24}
                autoComplete="off"
                required
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <Label htmlFor="host-plays" className="flex-col items-start gap-1">
                Também vou jogar
                <span className="text-xs font-normal text-muted-foreground">
                  Desligue se você for apenas o narrador.
                </span>
              </Label>
              <Switch id="host-plays" checked={plays} onCheckedChange={setPlays} />
            </div>
            <Button type="submit" size="lg" disabled={loading || !name.trim()}>
              {loading ? <Loader2 className="animate-spin" /> : <Plus />}
              Criar sala
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entrar em uma sala</CardTitle>
          <CardDescription>Recebeu um código? Digite aqui ou abra o link enviado.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={joinRoom} className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              className="font-mono tracking-widest uppercase"
              aria-label="Código da sala"
            />
            <Button type="submit" variant="secondary" disabled={!code.trim()}>
              Entrar <ArrowRight />
            </Button>
          </form>
          {previousRoom && (
            <Button variant="link" className="mt-2 px-0" onClick={() => navigate(`/sala/${previousRoom}`)}>
              Voltar para a última sala ({previousRoom})
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  )
}

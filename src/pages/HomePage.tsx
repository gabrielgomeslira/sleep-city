import { useState, type FormEvent } from 'react'
import { ArrowRight, Loader2, Moon, Sparkles, Star } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { navigate } from '@/lib/router'
import { lastRoom, savedName } from '@/lib/session'
import { errorMessage } from '@/lib/utils'

export function HomePage() {
  const [name, setName] = useState(savedName.get)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const previousRoom = lastRoom.get()

  async function createRoom(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const room = await api.createRoom(name)
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
      <section className="flex flex-col items-center pt-4 pb-2 text-center">
        <div className="relative mb-4">
          <Star className="absolute -top-2 -left-8 size-5 fill-white text-white opacity-80" />
          <Sparkles className="absolute -right-9 top-1 size-6 text-sun" />
          <Star className="absolute -bottom-1 -right-6 size-3.5 fill-white text-white opacity-60" />
          <div className="grid size-24 animate-float place-items-center rounded-full bg-sun shadow-[0_6px_0_var(--color-sun-dark)]">
            <Moon className="size-12 fill-current text-sun-foreground" />
          </div>
        </div>
        <h1 className="game-title font-display text-5xl font-bold tracking-tight text-white">Sleep City</h1>
        <p className="mt-3 max-w-xs font-bold text-white/85">
          A cidade dorme… e cada celular guarda um segredo. Crie a sala, chame a galera e deixe o sorteio com a
          gente!
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Criar sala</CardTitle>
          <CardDescription>
            Você será o narrador: escolhe as funções, sorteia e vê o papel de cada jogador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createRoom} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="host-name" className="font-display text-base">
                Nome do narrador
              </Label>
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
            <Button type="submit" variant="play" size="lg" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="animate-spin" />}
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
              className="font-display text-lg tracking-[0.25em] uppercase"
              aria-label="Código da sala"
            />
            <Button type="submit" className="h-12" disabled={!code.trim()} aria-label="Entrar">
              <ArrowRight />
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

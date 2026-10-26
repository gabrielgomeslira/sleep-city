import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import type { RoomView } from '@/lib/types'
import { cn, errorMessage } from '@/lib/utils'

const MAX_LENGTH = 300

const time = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Conversa de quem já morreu nesta rodada. O narrador lê e pode responder; os vivos não veem. */
export function DeadChat({ room, onChange }: { room: RoomView; onChange: (room: RoomView) => void }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const messages = room.chat ?? []
  const count = messages.length

  // Desce para a última mensagem quando chega uma nova.
  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [count])

  // O chat fica no fim do painel do narrador, então ele recebe um aviso de mensagem nova.
  const seen = useRef(count)
  const last = messages[count - 1]
  useEffect(() => {
    if (room.isHost && count > seen.current && last && !last.host) {
      toast(`💀 ${last.name} no chat dos mortos`, { description: last.text })
    }
    seen.current = count
  }, [count, last, room.isHost])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      onChange(await api.chat(room.code, text))
      setText('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const mine = (m: (typeof messages)[number]) => (room.isHost ? !!m.host : m.pid === room.me?.pid)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>💀 Chat dos mortos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div ref={list} className="flex max-h-80 min-h-24 flex-col gap-2 overflow-y-auto rounded-2xl bg-muted p-3">
          {count === 0 ? (
            <p className="m-auto text-center text-sm font-bold text-muted-foreground">
              Nenhuma mensagem ainda 👻
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn('flex items-end gap-2', mine(m) && 'flex-row-reverse')}>
                {!mine(m) && (
                  <Avatar name={m.name} className="size-7 shrink-0 border-2 text-xs" />
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm font-semibold break-words',
                    mine(m) ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-white text-primary-deep',
                  )}
                >
                  {!mine(m) && (
                    <p className="font-display text-xs font-bold text-primary">
                      {m.host ? `🎙️ ${m.name} (narrador)` : m.name}
                    </p>
                  )}
                  <p>{m.text}</p>
                  <p className={cn('mt-0.5 text-right text-[10px]', mine(m) ? 'text-white/70' : 'text-muted-foreground')}>
                    {time(m.at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <form onSubmit={send} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mensagem"
            maxLength={MAX_LENGTH}
            autoComplete="off"
            aria-label="Mensagem"
          />
          <Button type="submit" className="h-12" disabled={sending || !text.trim()} aria-label="Enviar">
            {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

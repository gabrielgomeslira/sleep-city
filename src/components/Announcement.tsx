import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { names, PHASE_INFO, phaseNumber, type Mark, type RoomView } from '@/lib/types'
import { cn } from '@/lib/utils'

// Aviso em tela cheia quando a rodada, a noite ou o dia mudam. O pop-up pequeno passava
// despercebido; este só some quando o jogador toca em "Entendi".

export interface AnnouncementData {
  emoji: string
  kicker: string
  title: string
  description: string
  tone: 'night' | 'day' | 'dead'
  confirmText: string
  /** Rola a tela até a carta da função ao fechar. */
  showRole?: boolean
}

/** Em que ponto da rodada a sala está: -1 no lobby, depois 0 (noite 1), 1 (dia 1), 2 (noite 2)… */
interface Stage {
  round: number
  step: number
}

function stageOf(room: RoomView): Stage {
  if (room.status !== 'playing') return { round: room.round, step: -1 }
  const n = room.turns.length
  return { round: room.round, step: room.phase === 'day' ? 2 * n - 1 : 2 * n }
}

const seenKey = (code: string) => `sleep-city:seen:${code}`

function readSeen(code: string): Stage | null {
  try {
    const value = JSON.parse(localStorage.getItem(seenKey(code)) ?? 'null')
    return typeof value?.round === 'number' && typeof value?.step === 'number' ? value : null
  } catch {
    return null
  }
}

function writeSeen(code: string, stage: Stage) {
  try {
    localStorage.setItem(seenKey(code), JSON.stringify(stage))
  } catch {
    // armazenamento indisponível: o aviso ainda aparece enquanto a página estiver aberta
  }
}

const was = (marks: Mark[], singular: string, plural: string) =>
  `${names(marks)} ${marks.length > 1 ? plural : singular}`

function announcementFor(room: RoomView, seen: Stage): AnnouncementData | null {
  if (room.status !== 'playing' || !room.phase) return null
  const now = stageOf(room)
  const kicker = `Rodada ${room.round}`

  if (now.round > seen.round) {
    return {
      emoji: '🌙',
      kicker: 'Nova rodada',
      title: `Rodada ${room.round} começou!`,
      description: room.me?.role
        ? 'As funções foram sorteadas de novo. Confira a sua: ela pode ter mudado.'
        : 'Você entrou depois do sorteio e vai jogar a partir da próxima rodada.',
      tone: 'night',
      confirmText: room.me?.role ? 'Ver minha função' : 'Entendi',
      showRole: !!room.me?.role,
    }
  }
  if (now.round !== seen.round || now.step <= seen.step) return null

  const last = room.turns[room.turns.length - 1]
  const number = phaseNumber(room)
  const title = `${PHASE_INFO[room.phase].label} ${number}`
  const me = room.me?.pid

  if (room.phase === 'day') {
    if (last.killed.some((m) => m.pid === me)) {
      return {
        emoji: '💀',
        kicker,
        title: 'Você foi assassinado!',
        description: 'Os assassinos te pegaram esta noite. Fique em silêncio até o fim da rodada.',
        tone: 'dead',
        confirmText: 'Entendi',
      }
    }
    return {
      emoji: '☀️',
      kicker: `Amanheceu · ${kicker}`,
      title,
      description: last.killed.length
        ? `${was(last.killed, 'foi assassinado(a)', 'foram assassinados')} esta noite.`
        : 'Ninguém morreu esta noite!',
      tone: 'day',
      confirmText: 'Entendi',
    }
  }

  const voted = last.voted ?? []
  if (voted.some((m) => m.pid === me)) {
    return {
      emoji: '💀',
      kicker,
      title: 'A cidade te eliminou!',
      description: 'Você saiu na votação. Fique em silêncio até o fim da rodada.',
      tone: 'dead',
      confirmText: 'Entendi',
    }
  }
  return {
    emoji: '🌙',
    kicker: `Anoiteceu · ${kicker}`,
    title,
    description:
      (voted.length
        ? `${was(voted, 'foi eliminado(a)', 'foram eliminados')} na votação. `
        : 'Ninguém foi eliminado na votação. ') + 'Fechem os olhos!',
    tone: 'night',
    confirmText: 'Entendi',
  }
}

/** Mostra o aviso quando a sala avança desde a última vez que este navegador a viu. */
export function useAnnouncement(room: RoomView | null, enabled: boolean) {
  const [current, setCurrent] = useState<AnnouncementData | null>(null)
  const latest = useRef(room)
  latest.current = room

  const stage = room ? stageOf(room) : null
  const key = room && stage ? `${room.code}:${stage.round}:${stage.step}` : null

  useEffect(() => {
    const room = latest.current
    if (!room || !enabled) return
    const seen = readSeen(room.code)
    writeSeen(room.code, stageOf(room))
    // Primeira visita neste navegador: nada a avisar, a tela já mostra o estado atual.
    const data = seen && announcementFor(room, seen)
    if (!data) return
    setCurrent(data)
    try {
      navigator.vibrate?.([180, 80, 180])
    } catch {
      // vibração não suportada
    }
  }, [key, enabled])

  return { announcement: current, dismiss: () => setCurrent(null) }
}

const TONES = {
  night: 'card-back text-white',
  day: 'bg-sun text-sun-foreground',
  dead: 'bg-primary-deep text-white',
}

export function Announcement({ data, onClose }: { data: AnnouncementData | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  // Mantém o conteúdo na tela enquanto o aviso fecha.
  const last = useRef(data)
  if (data) last.current = data
  const view = data ?? last.current

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (data && !dialog.open) dialog.showModal()
    if (!data && dialog.open) dialog.close()
  }, [data])

  function close() {
    onClose()
    if (view?.showRole) {
      document.getElementById('sua-funcao')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => data && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-visible bg-transparent p-0 backdrop:bg-primary-deep/85 backdrop:backdrop-blur-md open:animate-pop"
    >
      {view && (
        <div
          className={cn(
            'flex flex-col items-center gap-3 rounded-3xl border-4 border-white px-6 py-8 text-center shadow-[0_8px_0_rgb(46_16_101/0.5)]',
            TONES[view.tone],
          )}
        >
          <span className="animate-float text-7xl">{view.emoji}</span>
          <p className="font-display text-xs font-semibold tracking-[0.25em] uppercase opacity-80">{view.kicker}</p>
          <h2
            id={titleId}
            className={cn('font-display text-4xl leading-tight font-bold', view.tone !== 'day' && 'game-title')}
          >
            {view.title}
          </h2>
          <p className="text-base font-bold opacity-90">{view.description}</p>
          <Button
            variant={view.tone === 'day' ? 'default' : 'play'}
            size="lg"
            className="mt-2 w-full"
            autoFocus
            onClick={close}
          >
            {view.confirmText}
          </Button>
        </div>
      )}
    </dialog>
  )
}

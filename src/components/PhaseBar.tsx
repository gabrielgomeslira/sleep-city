import { PHASE_INFO, phaseNumber, type RoomView } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Faixa fixa no topo da sala: mostra a rodada e se é noite ou dia, para ninguém se perder. */
export function PhaseBar({ room }: { room: RoomView }) {
  if (room.status !== 'playing' || !room.phase) return null
  const night = room.phase === 'night'
  const info = PHASE_INFO[room.phase]

  return (
    <div
      key={`${room.round}-${room.phase}-${room.turns.length}`}
      className={cn(
        'flex animate-pop items-center gap-3 rounded-3xl border-4 border-white px-4 py-3 shadow-[0_6px_0_rgb(46_16_101/0.35)]',
        night ? 'card-back text-white' : 'bg-sun text-sun-foreground',
      )}
    >
      <span className="text-4xl leading-none">{info.emoji}</span>
      <div className="min-w-0">
        <p
          className={cn(
            'font-display text-xs font-semibold tracking-widest uppercase',
            night ? 'text-white/80' : 'text-sun-foreground/70',
          )}
        >
          Rodada {room.round}
        </p>
        <p className={cn('font-display text-3xl leading-none font-bold', night && 'game-title')}>
          {info.label} {phaseNumber(room)}
        </p>
      </div>
      <p
        className={cn(
          'ml-auto max-w-32 text-right text-xs font-bold',
          night ? 'text-white/85' : 'text-sun-foreground/80',
        )}
      >
        {night ? 'A cidade dorme… olhos fechados.' : 'A cidade acorda e debate.'}
      </p>
    </div>
  )
}

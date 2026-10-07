import { cn } from '@/lib/utils'

const COLORS = ['#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#38bdf8', '#a78bfa', '#f87171']

// A cor vem do nome (nunca da função), então não entrega nada sobre o jogo.
function colorFor(name: string) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: colorFor(name) }}
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-white font-display text-lg font-bold text-primary-deep uppercase shadow-[0_3px_0_rgb(46_16_101/0.2)]',
        className,
      )}
    >
      {name.trim().charAt(0)}
    </span>
  )
}

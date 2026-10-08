export type Role = 'assassino' | 'detetive' | 'samu' | 'cidadao'

export interface Counts {
  assassinos: number
  detetives: number
  samu: number
}

export type Phase = 'night' | 'day'

export interface Mark {
  pid: string
  name: string
}

/** Noite N e o dia que vem depois dela. */
export interface TurnView {
  killed: Mark[]
  /** null enquanto o dia ainda não acabou. */
  voted: Mark[] | null
  /** Só o narrador recebe quem foi atacado e quem o SAMU salvou. */
  attacked?: Mark[]
  saved?: Mark[]
}

export interface PlayerView {
  pid: string
  name: string
  isMe: boolean
  dead: boolean
  /** Só vem preenchido para o narrador, durante uma rodada. */
  role?: Role | null
}

export interface RoomView {
  code: string
  status: 'lobby' | 'playing'
  round: number
  /** Só durante uma rodada. */
  phase: Phase | null
  turns: TurnView[]
  /** Só o narrador recebe a quantidade de cada função. */
  counts?: Counts
  hostName: string
  isHost: boolean
  players: PlayerView[]
  me: { pid: string; name: string; role: Role | null; dead: boolean } | null
}

/** Noite 1 → Dia 1 → Noite 2… O dia N vem depois da noite N. */
export function phaseNumber(room: Pick<RoomView, 'phase' | 'turns'>) {
  return room.phase === 'day' ? room.turns.length : room.turns.length + 1
}

export const PHASE_INFO: Record<Phase, { emoji: string; label: string }> = {
  night: { emoji: '🌙', label: 'Noite' },
  day: { emoji: '☀️', label: 'Dia' },
}

export function names(marks: Mark[]) {
  const list = marks.map((m) => m.name)
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`
}

// Emojis e cores só aparecem na tela do narrador; a tela dos jogadores é igual para todas as funções.
export const ROLE_BADGE: Record<Role, { emoji: string; className: string }> = {
  assassino: { emoji: '🔪', className: 'bg-red-100 text-red-700' },
  detetive: { emoji: '🔍', className: 'bg-sky-100 text-sky-700' },
  samu: { emoji: '🚑', className: 'bg-emerald-100 text-emerald-700' },
  cidadao: { emoji: '🏠', className: 'bg-secondary text-secondary-foreground' },
}

// Textos de tamanho parecido de propósito: o tamanho do bloco não deve entregar a função.
export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  assassino: {
    label: 'Assassino',
    description: 'À noite, escolha em silêncio alguém para eliminar. Não se entregue.',
  },
  detetive: {
    label: 'Detetive',
    description: 'À noite, aponte um suspeito ao narrador e descubra se ele é assassino.',
  },
  samu: {
    label: 'SAMU',
    description: 'À noite, escolha alguém para salvar caso essa pessoa seja atacada.',
  },
  cidadao: {
    label: 'Cidadão',
    description: 'Você não tem poder especial. Observe, debata e ache os assassinos.',
  },
}

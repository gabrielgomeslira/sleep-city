export type Role = 'assassino' | 'detetive' | 'samu' | 'cidadao'

export interface Counts {
  assassinos: number
  detetives: number
  samu: number
}

export interface PlayerView {
  pid: string
  name: string
  isHost: boolean
  isMe: boolean
}

export interface RoomView {
  code: string
  status: 'lobby' | 'playing'
  round: number
  counts: Counts
  hostName: string
  isHost: boolean
  players: PlayerView[]
  me: { pid: string; name: string; role: Role | null } | null
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

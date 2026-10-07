import { randomBytes, randomInt } from 'node:crypto'

export type Role = 'assassino' | 'detetive' | 'samu' | 'cidadao'

export interface Counts {
  assassinos: number
  detetives: number
  samu: number
}

export interface Room {
  code: string
  hostId: string
  hostName: string
  createdAt: number
  status: 'lobby' | 'playing'
  round: number
  counts: Counts
}

export interface Player {
  /** Public id, safe to show to other players (the clientId is a secret). */
  pid: string
  name: string
  joinedAt: number
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export const MAX_PLAYERS = 60
export const DEFAULT_COUNTS: Counts = { assassinos: 1, detetives: 1, samu: 1 }

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomCode(length = 5): string {
  let code = ''
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

export function randomId(): string {
  return randomBytes(9).toString('base64url')
}

/** Fisher–Yates with a cryptographically secure RNG. */
export function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function parseCode(value: string): string {
  const code = value.toUpperCase()
  if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new HttpError(404, 'Sala não encontrada')
  return code
}

export function parseName(value: unknown): string {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  if (!name) throw new HttpError(400, 'Informe seu nome')
  if (name.length > 24) throw new HttpError(400, 'Nome muito longo (máx. 24 caracteres)')
  return name
}

export function parseCounts(value: unknown): Counts {
  const obj = (value ?? {}) as Record<string, unknown>
  const count = (v: unknown) => {
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > MAX_PLAYERS) throw new HttpError(400, 'Quantidade inválida')
    return n
  }
  return { assassinos: count(obj.assassinos), detetives: count(obj.detetives), samu: count(obj.samu) }
}

export function drawRoles(clientIds: string[], counts: Counts): Record<string, Role> {
  const special = counts.assassinos + counts.detetives + counts.samu
  if (clientIds.length === 0) throw new HttpError(400, 'Ninguém entrou na sala ainda')
  if (special > clientIds.length) {
    throw new HttpError(400, `São ${special} funções especiais para apenas ${clientIds.length} jogador(es)`)
  }

  const pool: Role[] = [
    ...Array<Role>(counts.assassinos).fill('assassino'),
    ...Array<Role>(counts.detetives).fill('detetive'),
    ...Array<Role>(counts.samu).fill('samu'),
  ]
  while (pool.length < clientIds.length) pool.push('cidadao')

  const roles = shuffle(pool)
  return Object.fromEntries(clientIds.map((id, i) => [id, roles[i]]))
}

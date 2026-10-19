import { randomBytes, randomInt } from 'node:crypto'
import type { Mark, Reflection, Role, Shot } from '../shared/night.js'

export type { Mark, Role } from '../shared/night.js'

export interface Counts {
  assassinos: number
  detetives: number
  samu: number
  espelhos: number
  justiceiros: number
}

export type Phase = 'night' | 'day'

/** Night N (who was attacked/saved) and the day that follows it (who the town voted out). */
export interface Turn {
  attacked: Mark[]
  saved: Mark[]
  /** Optional so turns saved before the Espelho/Justiceiro existed still load. */
  shots?: Shot[]
  reflected?: Reflection[]
  /** Who died that night, as resolved at dawn. */
  killed?: Mark[]
  /** null while the day is still going on. */
  voted: Mark[] | null
}

/** Drawn when a night starts, so the narrator's preview and the dawn agree. */
export interface NightSetup {
  /** Picks which assassin an Espelho sends the attack back to. */
  seed: number
  /** pids of the Justiceiros who get to act this night. */
  justiceiros: string[]
}

export interface Room {
  code: string
  hostId: string
  hostName: string
  /** Player id/entry time kept while someone narrates, so they get them back when they hand it over. */
  hostPid?: string
  hostJoinedAt?: number
  createdAt: number
  status: 'lobby' | 'playing'
  round: number
  counts: Counts
  /** Only while playing; optional so rooms saved before this existed still load. */
  phase?: Phase
  turns?: Turn[]
  /** Last roles of each player (by pid), used to make the draw fairer. Never sent to clients. */
  history?: History
  /** Index N-1 is night N of the current round; kept through undo so redoing a night doesn't re-roll it. */
  nights?: NightSetup[]
}

/** pid → that player's roles in the last rounds they played, oldest first. */
export type History = Record<string, Role[]>

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
export const DEFAULT_COUNTS: Counts = { assassinos: 1, detetives: 1, samu: 1, espelhos: 0, justiceiros: 0 }
/** Chance of each Justiceiro getting to act on a given night. */
export const JUSTICEIRO_CHANCE = 1 / 3

/** Rooms saved before a role existed have no count for it. */
export function withAllCounts(counts: Partial<Counts>): Counts {
  return { ...DEFAULT_COUNTS, ...counts }
}

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
  return {
    assassinos: count(obj.assassinos),
    detetives: count(obj.detetives),
    samu: count(obj.samu),
    // Older clients don't send these.
    espelhos: count(obj.espelhos ?? 0),
    justiceiros: count(obj.justiceiros ?? 0),
  }
}

export function specialCount(counts: Counts) {
  return counts.assassinos + counts.detetives + counts.samu + counts.espelhos + counts.justiceiros
}

/** How many past rounds of each player the draw remembers. */
export const HISTORY_ROUNDS = 2
/** Getting the same role for the third time in a row is this many times less likely. */
const REPEAT_PENALTY = 10

/** The role a player has had in each of their last HISTORY_ROUNDS rounds, if it was always the same. */
export function streakRole(past: Role[] | undefined): Role | null {
  if (!past || past.length < HISTORY_ROUNDS) return null
  const recent = past.slice(-HISTORY_ROUNDS)
  return recent.every((r) => r === recent[0]) ? recent[0] : null
}

/** Picks an index with probability proportional to its (integer) weight. */
function weightedIndex(weights: number[]): number {
  let r = randomInt(weights.reduce((a, b) => a + b, 0))
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i
  }
  return weights.length - 1
}

/**
 * Hands out the special roles one at a time (in random order) and everyone left
 * becomes a citizen. Without history every player is equally likely to get each
 * role; whoever had the same role in their last two rounds is REPEAT_PENALTY times
 * less likely to get it a third time (for citizens: more likely to get a special one).
 */
export function drawRoles(
  players: Record<string, Player>,
  counts: Counts,
  history: History = {},
): Record<string, Role> {
  const ids = Object.keys(players)
  const special = specialCount(counts)
  if (ids.length === 0) throw new HttpError(400, 'Ninguém entrou na sala ainda')
  if (special > ids.length) {
    throw new HttpError(400, `São ${special} funções especiais para apenas ${ids.length} jogador(es)`)
  }

  const slots = shuffle<Role>([
    ...Array<Role>(counts.assassinos).fill('assassino'),
    ...Array<Role>(counts.detetives).fill('detetive'),
    ...Array<Role>(counts.samu).fill('samu'),
    ...Array<Role>(counts.espelhos).fill('espelho'),
    ...Array<Role>(counts.justiceiros).fill('justiceiro'),
  ])
  const free = shuffle(ids)
  const roles: Record<string, Role> = {}

  for (const role of slots) {
    const weights = free.map((id) => {
      const streak = streakRole(history[players[id].pid])
      if (streak === role) return 1
      if (streak === 'cidadao') return REPEAT_PENALTY * REPEAT_PENALTY
      return REPEAT_PENALTY
    })
    const [id] = free.splice(weightedIndex(weights), 1)
    roles[id] = role
  }
  for (const id of free) roles[id] = 'cidadao'
  return roles
}

/** Adds this round's roles to the history, keeping the last HISTORY_ROUNDS of each player. */
export function rememberRoles(history: History = {}, players: Record<string, Player>, roles: Record<string, Role>) {
  const next = { ...history }
  for (const [id, role] of Object.entries(roles)) {
    const pid = players[id].pid
    next[pid] = [...(next[pid] ?? []), role].slice(-HISTORY_ROUNDS)
  }
  return next
}

/** Each Justiceiro in the round (alive or not, since undo can bring them back) rolls for this night. */
export function newNight(roles: Record<string, Role>, players: Record<string, Player>): NightSetup {
  const justiceiros = Object.entries(roles)
    .filter(([id, role]) => role === 'justiceiro' && players[id] && randomInt(1_000_000) < JUSTICEIRO_CHANCE * 1_000_000)
    .map(([id]) => players[id].pid)
  return { seed: randomInt(1_000_000), justiceiros }
}

export function killedIn(turn: Turn): Mark[] {
  if (turn.killed) return turn.killed
  // Turns saved before the night was resolved at dawn: attacked and not saved by the SAMU.
  const saved = new Set(turn.saved.map((m) => m.pid))
  return turn.attacked.filter((m) => !saved.has(m.pid))
}

export function deadPids(turns: Turn[]): Set<string> {
  const dead = new Set<string>()
  for (const turn of turns) {
    for (const m of killedIn(turn)) dead.add(m.pid)
    for (const m of turn.voted ?? []) dead.add(m.pid)
  }
  return dead
}

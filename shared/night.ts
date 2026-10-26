// Regras da noite e da vitória, usadas pelo servidor (para valer) e pela tela do narrador
// (para mostrar o resultado enquanto ele marca, antes de tocar em Amanhecer).

export type Role = 'assassino' | 'detetive' | 'samu' | 'espelho' | 'justiceiro' | 'cidadao'

export interface Mark {
  pid: string
  name: string
}

export interface NightPlayer extends Mark {
  role: Role
}

/** The Justiceiro `by` shot `target`. */
export interface Shot {
  by: Mark
  target: Mark
}

/** The Espelho was attacked and the attack went back to `assassin`. */
export interface Reflection {
  mirror: Mark
  assassin: Mark
}

export interface NightInput {
  /** Alive players with a role in the round. */
  alive: NightPlayer[]
  attacked: string[]
  saved: string[]
  shots: { by: string; target: string }[]
  /** Espelhos that already sent an attack back this round (it only works once). */
  usedMirrors: Set<string>
  /** Drawn when the night starts; picks which assassin a reflected attack goes back to. */
  seed: number
}

export interface NightResult {
  killed: Mark[]
  reflected: Reflection[]
  /** Who the SAMU kept from dying. */
  rescued: Mark[]
  /** Justiceiros who killed an innocent and die of guilt. */
  guilty: Mark[]
}

const mark = (p: Mark): Mark => ({ pid: p.pid, name: p.name })

/**
 * 1. Each attacked player dies, unless they are an Espelho that hasn't been used: then
 *    one of the assassins (picked by the night's seed) dies instead.
 * 2. Each Justiceiro shot kills its target.
 * 3. The SAMU saves whoever they picked from any of the deaths above.
 * 4. A Justiceiro whose target was innocent and really died dies of guilt (no saving that).
 */
export function resolveNight({ alive, attacked, saved, shots, usedMirrors, seed }: NightInput): NightResult {
  const byPid = new Map(alive.map((p) => [p.pid, p]))
  const assassins = alive.filter((p) => p.role === 'assassino').sort((a, b) => a.pid.localeCompare(b.pid))
  const dying = new Map<string, Mark>()
  const reflected: Reflection[] = []

  for (const pid of new Set(attacked)) {
    const p = byPid.get(pid)
    if (!p) continue
    if (p.role === 'espelho' && !usedMirrors.has(p.pid) && assassins.length > 0) {
      const assassin = assassins[(seed + reflected.length) % assassins.length]
      reflected.push({ mirror: mark(p), assassin: mark(assassin) })
      dying.set(assassin.pid, mark(assassin))
    } else {
      dying.set(p.pid, mark(p))
    }
  }

  for (const shot of shots) {
    const target = byPid.get(shot.target)
    if (target) dying.set(target.pid, mark(target))
  }

  const savedPids = new Set(saved)
  const rescued = [...dying.values()].filter((m) => savedPids.has(m.pid))
  for (const m of rescued) dying.delete(m.pid)

  const guilty: Mark[] = []
  for (const shot of shots) {
    const by = byPid.get(shot.by)
    const target = byPid.get(shot.target)
    if (by && target && target.role !== 'assassino' && dying.has(target.pid)) {
      guilty.push(mark(by))
      dying.set(by.pid, mark(by))
    }
  }

  return { killed: [...dying.values()], reflected, rescued, guilty }
}

/** Espelhos that already sent an attack back in these turns. */
export function usedMirrors(turns: { reflected?: Reflection[] }[]): Set<string> {
  return new Set(turns.flatMap((t) => t.reflected ?? []).map((r) => r.mirror.pid))
}

/**
 * The town wins when every assassin is gone. The assassins win when the town can't turn
 * the game around: they are the majority (they decide any vote), or they are tied (the vote
 * can't take them out) and the next night someone will surely die. Each assassin attacks
 * someone, so that is the case unless there are as many SAMU as assassins to save them all,
 * or someone can still kill an assassin (a Justiceiro, or an Espelho that wasn't used).
 */
export function winner(alive: { pid: string; role: Role }[], mirrorsUsed: Set<string>): 'cidade' | 'assassinos' | null {
  const assassins = alive.filter((p) => p.role === 'assassino').length
  const others = alive.length - assassins
  if (assassins === 0) return 'cidade'
  if (assassins > others) return 'assassinos'
  if (assassins < others) return null
  const samu = alive.filter((p) => p.role === 'samu').length
  const canKillAssassin = alive.some(
    (p) => p.role === 'justiceiro' || (p.role === 'espelho' && !mirrorsUsed.has(p.pid)),
  )
  return samu >= assassins || canKillAssassin ? null : 'assassinos'
}

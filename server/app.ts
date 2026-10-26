import express, { type NextFunction, type Request, type Response } from 'express'
import { resolveNight, usedMirrors, winner, type NightPlayer, type NightResult, type Shot } from '../shared/night.js'
import {
  DEFAULT_COUNTS,
  HttpError,
  MAX_PLAYERS,
  deadPids,
  drawRoles,
  killedIn,
  newNight,
  parseChatText,
  parseCode,
  parseCounts,
  parseName,
  randomCode,
  randomId,
  rememberRoles,
  streakRole,
  withAllCounts,
  type Mark,
  type NightSetup,
  type Phase,
  type Player,
  type Role,
  type Room,
  type Turn,
} from './game.js'
import { getStore } from './store.js'

/** Rooms with nobody doing anything for this long are cleaned up (soft delete). */
export const IDLE_MS = 2 * 60 * 60 * 1000
/** How many rooms the home page lists. */
const RECENT_ROOMS = 10

export const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '10kb' }))
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

/** Random id generated and kept by each browser; it is the only "login" there is. */
function getClientId(req: Request): string {
  const id = req.get('x-client-id')
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    throw new HttpError(401, 'Sessão inválida, recarregue a página')
  }
  return id
}

const ROLE_LABEL: Record<Role, string> = {
  assassino: '🔪 assassino',
  detetive: '🔍 detetive',
  samu: '🚑 samu',
  espelho: '🪞 espelho',
  justiceiro: '🔫 justiceiro',
  cidadao: '🏠 cidadão',
}

const list = (marks: Mark[]) => (marks.length ? marks.map((m) => m.name).join(', ') : 'ninguém')

/** One line per game event; search the room code in the Vercel project's Logs tab. */
function log(room: Room, message: string) {
  console.log(`[sala ${room.code}] ${message}`)
}

function logDraw(room: Room, players: Record<string, Player>, roles: Record<string, Role>) {
  const byRole = (Object.keys(ROLE_LABEL) as Role[])
    .map((role) => {
      const who = Object.entries(roles).filter(([, r]) => r === role).map(([id]) => players[id].name)
      return who.length ? `${ROLE_LABEL[role]}: ${who.join(', ')}` : null
    })
    .filter(Boolean)
  log(room, `rodada ${room.round} sorteada por ${room.hostName} · ${byRole.join(' | ')}`)

  // Who had the same role in their last two rounds, and whether they got it a third time anyway.
  const streaks = Object.entries(roles).flatMap(([id, role]) => {
    const streak = streakRole(room.history?.[players[id].pid])
    if (!streak) return []
    return [`${players[id].name} (${ROLE_LABEL[streak]} 2x → ${streak === role ? 'repetiu 3ª vez' : ROLE_LABEL[role]})`]
  })
  if (streaks.length) log(room, `rodada ${room.round} · sequências: ${streaks.join('; ')}`)
}

function logNight(room: Room, turn: Turn, result: NightResult) {
  const n = room.turns?.length ?? 0
  const parts = [`atacados ${list(turn.attacked)}`, `salvos ${list(turn.saved)}`]
  for (const r of result.reflected) parts.push(`🪞 ${r.mirror.name} devolveu o ataque para ${r.assassin.name}`)
  for (const s of turn.shots ?? []) parts.push(`🔫 ${s.by.name} atirou em ${s.target.name}`)
  if (result.guilty.length) parts.push(`morreu de culpa ${list(result.guilty)}`)
  parts.push(`morreram ${list(result.killed)}`)
  log(room, `rodada ${room.round} · noite ${n}: ${parts.join(' · ')}`)
}

function logDay(room: Room, turn: Turn) {
  log(room, `rodada ${room.round} · dia ${room.turns?.length ?? 0}: votação eliminou ${list(turn.voted ?? [])}`)
}

function logNightStart(room: Room, night: NightSetup, number: number, alive: NightPlayer[]) {
  const shooters = alive.filter((p) => night.justiceiros.includes(p.pid))
  if (shooters.length) log(room, `rodada ${room.round} · noite ${number}: 🔫 tem vez ${list(shooters)}`)
}

function logWinner(room: Room, alive: NightPlayer[]) {
  const side = winner(alive, usedMirrors(room.turns ?? []))
  if (side) log(room, `rodada ${room.round}: ${side === 'cidade' ? '🏆 a cidade venceu' : '🔪 os assassinos venceram'}`)
}

/** Rooms saved before `updatedAt` existed count as active until their next save stamps it. */
const isIdle = (room: Room, now = Date.now()) => room.updatedAt !== undefined && now - room.updatedAt > IDLE_MS

async function loadRoom(code: string): Promise<Room> {
  const room = await getStore().getRoom(parseCode(code))
  if (!room || room.deletedAt) throw new HttpError(404, 'Sala não encontrada')
  if (isIdle(room)) {
    await getStore().deleteRoom(room.code)
    log(room, 'apagada por ficar mais de 2 horas parada')
    throw new HttpError(404, 'Sala não encontrada')
  }
  return room
}

/** Soft deletes every room idle for more than IDLE_MS. Runs before the recent rooms are listed. */
export async function cleanupIdleRooms() {
  const store = getStore()
  const now = Date.now()
  for (const code of await store.idleRooms(now - IDLE_MS)) {
    const room = await store.deleteRoom(code)
    if (room && !room.deletedAt) log(room, 'apagada por ficar mais de 2 horas parada')
  }
}

function requireHost(room: Room, clientId: string) {
  if (room.hostId !== clientId) throw new HttpError(403, 'Apenas o narrador pode fazer isso')
}

/** The narrator (the room creator, or whoever they handed it to) is never part of the draw. */
async function getPlayers(room: Room) {
  const players = await getStore().getPlayers(room.code)
  delete players[room.hostId]
  return players
}

/**
 * What a given client is allowed to see: the narrator sees everyone's role and
 * how many of each role were drawn, each player sees only their own.
 * Deaths are public; what happened at night (attacks, SAMU, Espelho, Justiceiro)
 * and the setup of the current night only the narrator sees.
 */
async function roomView(room: Room, clientId: string) {
  const store = getStore()
  const isHost = room.hostId === clientId
  const playing = room.status === 'playing'
  const [players, roles, ownRole] = await Promise.all([
    getPlayers(room),
    playing && isHost ? store.getRoles(room.code) : null,
    playing && !isHost ? store.getRole(room.code, clientId) : null,
  ])
  const me = players[clientId]
  const turns = playing ? (room.turns ?? []) : []
  const dead = deadPids(turns)
  const phase = playing ? (room.phase ?? 'night') : null
  const night = phase === 'night' ? room.nights?.[turns.length] : null
  // The chat of the dead: only who already died this round, and the narrator, can read it.
  const chat = playing && (isHost || (me && dead.has(me.pid))) ? await store.getChat(room.code, room.round) : null

  return {
    code: room.code,
    status: room.status,
    round: room.round,
    phase,
    turns: turns.map((t) => ({
      killed: killedIn(t),
      voted: t.voted,
      ...(isHost && { attacked: t.attacked, saved: t.saved, shots: t.shots ?? [], reflected: t.reflected ?? [] }),
    })),
    ...(isHost && { counts: withAllCounts(room.counts), night: night ?? null }),
    hostName: room.hostName,
    isHost,
    players: Object.entries(players)
      .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
      .map(([id, p]) => ({
        pid: p.pid,
        name: p.name,
        isMe: id === clientId,
        dead: dead.has(p.pid),
        ...(roles && { role: roles[id] ?? null }),
      })),
    me: me ? { pid: me.pid, name: me.name, role: ownRole ?? null, dead: dead.has(me.pid) } : null,
    ...(chat && { chat }),
  }
}

async function addPlayer(room: Room, clientId: string, name: string) {
  if (clientId === room.hostId) throw new HttpError(400, 'Você é o narrador desta sala')
  const players = await getPlayers(room)
  const existing = players[clientId]

  const same = (a: string) => a.toLocaleLowerCase() === name.toLocaleLowerCase()
  // The narrator's name stays taken: they become a player again when they hand over the role.
  if (same(room.hostName)) throw new HttpError(409, 'Esse é o nome do narrador desta sala')

  // Someone already has this name: most likely the same person on another phone or browser,
  // so this session takes their place (same player, same role, alive or dead) and the old one is dropped.
  const sameName = Object.entries(players).find(([id, p]) => id !== clientId && same(p.name))
  if (sameName) {
    const [oldId, old] = sameName
    await getStore().replacePlayer(room.code, oldId, clientId, { ...old, name })
    log(room, `${name} entrou de novo por outra sessão; a anterior foi removida`)
    return
  }

  if (!existing && Object.keys(players).length >= MAX_PLAYERS) throw new HttpError(409, 'A sala está cheia')

  await getStore().setPlayer(room.code, clientId, {
    pid: existing?.pid ?? randomId(),
    name,
    joinedAt: existing?.joinedAt ?? Date.now(),
  })
  if (!existing) log(room, `${name} entrou`)
  else if (existing.name !== name) log(room, `${existing.name} agora se chama ${name}`)
}

app.post('/api/rooms', async (req, res) => {
  const clientId = getClientId(req)
  const name = parseName(req.body?.name)
  const store = getStore()

  let code = ''
  for (let attempt = 0; attempt < 10 && !code; attempt++) {
    const candidate = randomCode()
    if (!(await store.getRoom(candidate))) code = candidate
  }
  if (!code) throw new HttpError(503, 'Não foi possível criar a sala, tente novamente')

  const room: Room = {
    code,
    hostId: clientId,
    hostName: name,
    createdAt: Date.now(),
    status: 'lobby',
    round: 0,
    counts: DEFAULT_COUNTS,
  }
  await store.saveRoom(room)
  log(room, `sala criada por ${name}`)

  res.status(201).json(await roomView(room, clientId))
})

/** Rooms with recent activity, for the home page. */
app.get('/api/rooms', async (_req, res) => {
  await cleanupIdleRooms()
  const now = Date.now()
  const rooms = await getStore().recentRooms(RECENT_ROOMS)
  res.json(
    rooms
      .filter(({ room }) => !isIdle(room, now))
      .map(({ room, players }) => ({
        code: room.code,
        hostName: room.hostName,
        players,
        status: room.status,
        round: room.round,
        updatedAt: room.updatedAt ?? room.createdAt,
      })),
  )
})

app.get('/api/rooms/:code', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  res.json(await roomView(room, clientId))
})

app.post('/api/rooms/:code/join', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  await addPlayer(room, clientId, parseName(req.body?.name))
  await getStore().saveRoom(room)
  res.json(await roomView(room, clientId))
})

app.post('/api/rooms/:code/leave', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  const player = (await getPlayers(room))[clientId]
  await getStore().removePlayer(room.code, clientId)
  await getStore().saveRoom(room)
  if (player) log(room, `${player.name} saiu`)
  res.json({ ok: true })
})

app.post('/api/rooms/:code/kick', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)

  const players = await getPlayers(room)
  const target = Object.entries(players).find(([, p]) => p.pid === req.body?.pid)
  if (target) {
    await getStore().removePlayer(room.code, target[0])
    await getStore().saveRoom(room)
    log(room, `${room.hostName} removeu ${target[1].name}`)
  }

  res.json(await roomView(room, clientId))
})

/**
 * Hands the narration to another player: they leave the player list and the
 * current narrator joins it as a regular player. The narrator knows everyone's
 * role, so an ongoing round is ended and everyone goes back to the lobby.
 */
app.post('/api/rooms/:code/transfer', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)

  const store = getStore()
  const players = await getPlayers(room)
  const target = Object.entries(players).find(([, p]) => p.pid === req.body?.pid)
  if (!target) throw new HttpError(404, 'Jogador não encontrado na sala')
  const [newHostId, newHost] = target

  const nameTaken = Object.entries(players).some(
    ([id, p]) => id !== newHostId && p.name.toLocaleLowerCase() === room.hostName.toLocaleLowerCase(),
  )
  if (nameTaken) throw new HttpError(409, `Já tem um jogador chamado ${room.hostName} na sala`)

  await store.removePlayer(room.code, newHostId)
  await store.setPlayer(room.code, room.hostId, {
    pid: room.hostPid ?? randomId(),
    name: room.hostName,
    joinedAt: room.hostJoinedAt ?? room.createdAt,
  })
  if (room.status === 'playing') await store.clearRoles(room.code)

  const updated: Room = {
    ...room,
    hostId: newHostId,
    hostName: newHost.name,
    hostPid: newHost.pid,
    hostJoinedAt: newHost.joinedAt,
    status: 'lobby',
    phase: undefined,
    turns: [],
    nights: [],
  }
  await store.saveRoom(updated)
  log(room, `narração passou de ${room.hostName} para ${newHost.name}${room.status === 'playing' ? ' (rodada encerrada)' : ''}`)

  res.json(await roomView(updated, clientId))
})

app.post('/api/rooms/:code/start', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)

  const counts = parseCounts(req.body?.counts)
  const store = getStore()
  const players = await getPlayers(room)
  const roles = drawRoles(players, counts, room.history)

  await store.setRoles(room.code, roles)
  const night = newNight(roles, players)
  const updated: Room = {
    ...room,
    status: 'playing',
    round: room.round + 1,
    counts,
    phase: 'night',
    turns: [],
    nights: [night],
    history: rememberRoles(room.history, players, roles),
  }
  await store.saveRoom(updated)
  logDraw({ ...updated, history: room.history }, players, roles)
  logNightStart(updated, night, 1, alivePlayers(players, roles, []))

  res.json(await roomView(updated, clientId))
})

app.post('/api/rooms/:code/reset', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)

  await getStore().clearRoles(room.code)
  const updated: Room = { ...room, status: 'lobby', phase: undefined, turns: [], nights: [] }
  await getStore().saveRoom(updated)
  log(room, `rodada ${room.round} encerrada, de volta ao lobby`)

  res.json(await roomView(updated, clientId))
})

function requirePhase(room: Room, phase: Phase) {
  if (room.status !== 'playing') throw new HttpError(409, 'Sorteie as funções primeiro')
  if ((room.phase ?? 'night') !== phase) throw new HttpError(409, 'A rodada já mudou, atualize a tela')
}

const mark = (p: Mark): Mark => ({ pid: p.pid, name: p.name })

/** Players with a role in the current round who haven't died yet. */
function alivePlayers(players: Record<string, Player>, roles: Record<string, Role>, turns: Turn[]): NightPlayer[] {
  const dead = deadPids(turns)
  return Object.entries(players).flatMap(([id, p]) =>
    roles[id] && !dead.has(p.pid) ? [{ pid: p.pid, name: p.name, role: roles[id] }] : [],
  )
}

async function loadRound(room: Room) {
  const [players, roles] = await Promise.all([getPlayers(room), getStore().getRoles(room.code)])
  return { players, roles, alive: alivePlayers(players, roles, room.turns ?? []) }
}

/** Turns a list of pids into alive players that are part of the current round. */
function pickAlive(alive: NightPlayer[], value: unknown, { exclude }: { exclude?: Role } = {}): Mark[] {
  if (!Array.isArray(value) || value.length > MAX_PLAYERS) throw new HttpError(400, 'Seleção inválida')
  const byPid = new Map(alive.filter((p) => p.role !== exclude).map((p) => [p.pid, p]))
  return [...new Set(value)].map((pid) => {
    const p = typeof pid === 'string' ? byPid.get(pid) : undefined
    if (!p) throw new HttpError(400, 'Escolha apenas jogadores vivos desta rodada')
    return mark(p)
  })
}

/** At most one shot per Justiceiro who got to act this night, at someone alive other than themselves. */
function pickShots(alive: NightPlayer[], value: unknown, night: NightSetup | null | undefined): Shot[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_PLAYERS) throw new HttpError(400, 'Seleção inválida')
  const byPid = new Map(alive.map((p) => [p.pid, p]))
  const shooters = new Set<string>()
  return value.map((shot) => {
    const by = byPid.get(shot?.by)
    const target = byPid.get(shot?.target)
    if (!by || by.role !== 'justiceiro' || !night?.justiceiros.includes(by.pid) || shooters.has(by.pid)) {
      throw new HttpError(400, 'O Justiceiro não tem vez nesta noite')
    }
    if (!target || target.pid === by.pid) throw new HttpError(400, 'Escolha um alvo vivo para o Justiceiro')
    shooters.add(by.pid)
    return { by: mark(by), target: mark(target) }
  })
}

/** Sends a message to the chat of the dead: players who died this round, and the narrator. */
app.post('/api/rooms/:code/chat', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  if (room.status !== 'playing') throw new HttpError(409, 'O chat dos mortos só existe durante a rodada')
  const text = parseChatText(req.body?.text)

  const isHost = room.hostId === clientId
  const me = (await getPlayers(room))[clientId]
  if (!isHost && !(me && deadPids(room.turns ?? []).has(me.pid))) {
    throw new HttpError(403, 'Só quem já morreu nesta rodada pode usar este chat')
  }

  const store = getStore()
  await store.addChat(room.code, room.round, {
    id: randomId(),
    pid: isHost ? '' : me.pid,
    name: isHost ? room.hostName : me.name,
    ...(isHost && { host: true }),
    text,
    at: Date.now(),
  })
  const updated = await store.saveRoom(room)
  res.json(await roomView(updated, clientId))
})

/** Ends the night: see resolveNight for who dies (attacks, Espelho, SAMU, Justiceiro). */
app.post('/api/rooms/:code/dawn', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)
  requirePhase(room, 'night')

  const turns = room.turns ?? []
  const night = room.nights?.[turns.length]
  const { alive } = await loadRound(room)
  const attacked = pickAlive(alive, req.body?.attacked, { exclude: 'assassino' })
  const saved = pickAlive(alive, req.body?.saved)
  const shots = pickShots(alive, req.body?.shots, night)
  const result = resolveNight({
    alive,
    attacked: attacked.map((m) => m.pid),
    saved: saved.map((m) => m.pid),
    shots: shots.map((s) => ({ by: s.by.pid, target: s.target.pid })),
    usedMirrors: usedMirrors(turns),
    seed: night?.seed ?? 0,
  })

  const turn: Turn = { attacked, saved, shots, reflected: result.reflected, killed: result.killed, voted: null }
  const updated: Room = { ...room, phase: 'day', turns: [...turns, turn] }
  await getStore().saveRoom(updated)
  logNight(updated, turn, result)
  const killed = new Set(result.killed.map((m) => m.pid))
  logWinner(updated, alive.filter((p) => !killed.has(p.pid)))

  res.json(await roomView(updated, clientId))
})

/** Ends the day: whoever the town voted out dies, and the next night starts. */
app.post('/api/rooms/:code/dusk', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)
  requirePhase(room, 'day')

  const { players, roles, alive } = await loadRound(room)
  const voted = pickAlive(alive, req.body?.voted)
  const turns = [...(room.turns ?? [])]
  turns[turns.length - 1] = { ...turns[turns.length - 1], voted }

  // Night N+1 is drawn once: undoing this dusk and doing it again keeps the same night.
  const nights = [...(room.nights ?? [])]
  const fresh = !nights[turns.length]
  if (fresh) nights[turns.length] = newNight(roles, players)
  const updated: Room = { ...room, phase: 'night', turns, nights }
  await getStore().saveRoom(updated)

  logDay(updated, turns[turns.length - 1])
  const out = new Set(voted.map((m) => m.pid))
  const stillAlive = alive.filter((p) => !out.has(p.pid))
  logWinner(updated, stillAlive)
  if (fresh) logNightStart(updated, nights[turns.length], turns.length + 1, stillAlive)

  res.json(await roomView(updated, clientId))
})

/** Takes back the last dawn or dusk, so the narrator can fix a wrong tap. */
app.post('/api/rooms/:code/undo', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)
  if (room.status !== 'playing') throw new HttpError(409, 'Sorteie as funções primeiro')

  const turns = [...(room.turns ?? [])]
  if (turns.length === 0) throw new HttpError(409, 'Nada para desfazer')
  let phase: Phase
  if ((room.phase ?? 'night') === 'day') {
    turns.pop()
    phase = 'night'
  } else {
    turns[turns.length - 1] = { ...turns[turns.length - 1], voted: null }
    phase = 'day'
  }
  const updated: Room = { ...room, phase, turns }
  await getStore().saveRoom(updated)
  log(room, `${room.hostName} desfez ${phase === 'night' ? 'o amanhecer' : 'a votação'}`)

  res.json(await roomView(updated, clientId))
})

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    // 401/404 happen all the time (expired rooms, old links); the rest help explain a complaint.
    if (err.status !== 401 && err.status !== 404) console.warn(`${req.method} ${req.path} → ${err.status} ${err.message}`)
    res.status(err.status).json({ error: err.message })
    return
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'Requisição inválida' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Erro interno, tente novamente' })
})

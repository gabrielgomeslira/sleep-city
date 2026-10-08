import express, { type NextFunction, type Request, type Response } from 'express'
import {
  DEFAULT_COUNTS,
  HttpError,
  MAX_PLAYERS,
  deadPids,
  drawRoles,
  killedIn,
  parseCode,
  parseCounts,
  parseName,
  randomCode,
  randomId,
  type Mark,
  type Phase,
  type Room,
} from './game.js'
import { getStore } from './store.js'

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

async function loadRoom(code: string): Promise<Room> {
  const room = await getStore().getRoom(parseCode(code))
  if (!room) throw new HttpError(404, 'Sala não encontrada')
  return room
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
 * Deaths are public; who was attacked/saved at night only the narrator sees.
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

  return {
    code: room.code,
    status: room.status,
    round: room.round,
    phase: playing ? (room.phase ?? 'night') : null,
    turns: turns.map((t) => ({
      killed: killedIn(t),
      voted: t.voted,
      ...(isHost && { attacked: t.attacked, saved: t.saved }),
    })),
    ...(isHost && { counts: room.counts }),
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
  }
}

async function addPlayer(room: Room, clientId: string, name: string) {
  if (clientId === room.hostId) throw new HttpError(400, 'Você é o narrador desta sala')
  const players = await getPlayers(room)
  const existing = players[clientId]

  // The narrator counts too: they can become a player again when they hand over the role.
  const taken =
    room.hostName.toLocaleLowerCase() === name.toLocaleLowerCase() ||
    Object.entries(players).some(
      ([id, p]) => id !== clientId && p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  if (taken) throw new HttpError(409, 'Já tem alguém com esse nome na sala')
  if (!existing && Object.keys(players).length >= MAX_PLAYERS) throw new HttpError(409, 'A sala está cheia')

  await getStore().setPlayer(room.code, clientId, {
    pid: existing?.pid ?? randomId(),
    name,
    joinedAt: existing?.joinedAt ?? Date.now(),
  })
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

  res.status(201).json(await roomView(room, clientId))
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
  res.json(await roomView(room, clientId))
})

app.post('/api/rooms/:code/leave', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  await getStore().removePlayer(room.code, clientId)
  res.json({ ok: true })
})

app.post('/api/rooms/:code/kick', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)

  const players = await getPlayers(room)
  const target = Object.entries(players).find(([, p]) => p.pid === req.body?.pid)
  if (target) await getStore().removePlayer(room.code, target[0])

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
  }
  await store.saveRoom(updated)

  res.json(await roomView(updated, clientId))
})

app.post('/api/rooms/:code/start', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)

  const counts = parseCounts(req.body?.counts)
  const store = getStore()
  const players = await getPlayers(room)
  const roles = drawRoles(Object.keys(players), counts)

  await store.setRoles(room.code, roles)
  const updated: Room = { ...room, status: 'playing', round: room.round + 1, counts, phase: 'night', turns: [] }
  await store.saveRoom(updated)

  res.json(await roomView(updated, clientId))
})

app.post('/api/rooms/:code/reset', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)

  await getStore().clearRoles(room.code)
  const updated: Room = { ...room, status: 'lobby', phase: undefined, turns: [] }
  await getStore().saveRoom(updated)

  res.json(await roomView(updated, clientId))
})

function requirePhase(room: Room, phase: Phase) {
  if (room.status !== 'playing') throw new HttpError(409, 'Sorteie as funções primeiro')
  if ((room.phase ?? 'night') !== phase) throw new HttpError(409, 'A rodada já mudou, atualize a tela')
}

/** Turns a list of pids into alive players that are part of the current round. */
async function pickAlive(room: Room, value: unknown): Promise<Mark[]> {
  if (!Array.isArray(value) || value.length > MAX_PLAYERS) throw new HttpError(400, 'Seleção inválida')
  const [players, roles] = await Promise.all([getPlayers(room), getStore().getRoles(room.code)])
  const dead = deadPids(room.turns ?? [])
  const inRound = new Map(
    Object.entries(players)
      .filter(([id]) => roles[id])
      .map(([, p]) => [p.pid, p]),
  )
  return [...new Set(value)].map((pid) => {
    const p = typeof pid === 'string' ? inRound.get(pid) : undefined
    if (!p || dead.has(p.pid)) throw new HttpError(400, 'Escolha apenas jogadores vivos desta rodada')
    return { pid: p.pid, name: p.name }
  })
}

/** Ends the night: whoever was attacked and not saved dies. */
app.post('/api/rooms/:code/dawn', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)
  requirePhase(room, 'night')

  const attacked = await pickAlive(room, req.body?.attacked)
  const saved = await pickAlive(room, req.body?.saved)
  const updated: Room = { ...room, phase: 'day', turns: [...(room.turns ?? []), { attacked, saved, voted: null }] }
  await getStore().saveRoom(updated)

  res.json(await roomView(updated, clientId))
})

/** Ends the day: whoever the town voted out dies, and the next night starts. */
app.post('/api/rooms/:code/dusk', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)
  requirePhase(room, 'day')

  const voted = await pickAlive(room, req.body?.voted)
  const turns = [...(room.turns ?? [])]
  turns[turns.length - 1] = { ...turns[turns.length - 1], voted }
  const updated: Room = { ...room, phase: 'night', turns }
  await getStore().saveRoom(updated)

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

  res.json(await roomView(updated, clientId))
})

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
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

import express, { type NextFunction, type Request, type Response } from 'express'
import {
  DEFAULT_COUNTS,
  HttpError,
  MAX_PLAYERS,
  drawRoles,
  parseCode,
  parseCounts,
  parseName,
  randomCode,
  randomId,
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
  if (room.hostId !== clientId) throw new HttpError(403, 'Apenas quem criou a sala pode fazer isso')
}

/** What a given client is allowed to see: everyone's names, but only their own role. */
async function roomView(room: Room, clientId: string) {
  const store = getStore()
  const [players, role] = await Promise.all([
    store.getPlayers(room.code),
    room.status === 'playing' ? store.getRole(room.code, clientId) : null,
  ])
  const me = players[clientId]

  return {
    code: room.code,
    status: room.status,
    round: room.round,
    counts: room.counts,
    hostName: room.hostName,
    isHost: room.hostId === clientId,
    players: Object.entries(players)
      .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
      .map(([id, p]) => ({ pid: p.pid, name: p.name, isHost: id === room.hostId, isMe: id === clientId })),
    me: me ? { pid: me.pid, name: me.name, role: role ?? null } : null,
  }
}

async function addPlayer(room: Room, clientId: string, name: string) {
  const store = getStore()
  const players = await store.getPlayers(room.code)
  const existing = players[clientId]

  const taken = Object.entries(players).some(
    ([id, p]) => id !== clientId && p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  )
  if (taken) throw new HttpError(409, 'Já tem alguém com esse nome na sala')
  if (!existing && Object.keys(players).length >= MAX_PLAYERS) throw new HttpError(409, 'A sala está cheia')

  await store.setPlayer(room.code, clientId, {
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
  if (req.body?.plays !== false) await addPlayer(room, clientId, name)

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

  const players = await getStore().getPlayers(room.code)
  const target = Object.entries(players).find(([, p]) => p.pid === req.body?.pid)
  if (target) await getStore().removePlayer(room.code, target[0])

  res.json(await roomView(room, clientId))
})

app.post('/api/rooms/:code/start', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)

  const counts = parseCounts(req.body?.counts)
  const store = getStore()
  const players = await store.getPlayers(room.code)
  const roles = drawRoles(Object.keys(players), counts)

  await store.setRoles(room.code, roles)
  const updated: Room = { ...room, status: 'playing', round: room.round + 1, counts }
  await store.saveRoom(updated)

  res.json(await roomView(updated, clientId))
})

app.post('/api/rooms/:code/reset', async (req, res) => {
  const clientId = getClientId(req)
  const room = await loadRoom(req.params.code)
  requireHost(room, clientId)

  await getStore().clearRoles(room.code)
  const updated: Room = { ...room, status: 'lobby' }
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

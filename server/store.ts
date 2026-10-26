import { Redis } from '@upstash/redis'
import { CHAT_MAX_MESSAGES, type ChatMessage, type Player, type Role, type Room } from './game.js'

/** Rooms expire after 12h without changes. */
const TTL_SECONDS = 60 * 60 * 12

/** A room seen in the list of recent rooms. */
export interface RoomSummary {
  room: Room
  players: number
}

export interface Store {
  getRoom(code: string): Promise<Room | null>
  /** Saves the room and stamps `updatedAt`, which is what keeps it from being cleaned up. */
  saveRoom(room: Room): Promise<Room>
  /** Rooms not deleted yet, most recently active first. */
  recentRooms(limit: number): Promise<RoomSummary[]>
  /** Codes of the rooms not deleted yet whose last activity was before `before`. */
  idleRooms(before: number): Promise<string[]>
  /**
   * Soft delete: the room stays stored (until it expires) with `deletedAt`, and leaves the recent list.
   * Returns the room, or null if it had already expired.
   */
  deleteRoom(code: string): Promise<Room | null>
  getPlayers(code: string): Promise<Record<string, Player>>
  setPlayer(code: string, clientId: string, player: Player): Promise<void>
  removePlayer(code: string, clientId: string): Promise<void>
  /** Moves a player (and their role, if any) from one session to another. */
  replacePlayer(code: string, oldId: string, newId: string, player: Player): Promise<void>
  getRole(code: string, clientId: string): Promise<Role | null>
  /** Chat of the dead players of a round, oldest first. */
  getChat(code: string, round: number): Promise<ChatMessage[]>
  addChat(code: string, round: number, message: ChatMessage): Promise<void>
  getRoles(code: string): Promise<Record<string, Role>>
  setRoles(code: string, roles: Record<string, Role>): Promise<void>
  clearRoles(code: string): Promise<void>
}

const keys = {
  /** Sorted set of the codes of rooms not deleted, scored by their last activity. */
  active: 'sc:rooms:active',
  room: (code: string) => `sc:room:${code}`,
  players: (code: string) => `sc:room:${code}:players`,
  roles: (code: string) => `sc:room:${code}:roles`,
  chat: (code: string, round: number) => `sc:room:${code}:chat:${round}`,
}

const parse = <T>(value: unknown): T => (typeof value === 'string' ? JSON.parse(value) : value) as T

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async getRoom(code: string) {
    return parse<Room | null>(await this.redis.get(keys.room(code)))
  }

  async saveRoom(room: Room) {
    const saved = { ...room, updatedAt: Date.now() }
    const p = this.redis.pipeline()
    p.set(keys.room(room.code), JSON.stringify(saved), { ex: TTL_SECONDS })
    if (!saved.deletedAt) p.zadd(keys.active, { score: saved.updatedAt, member: room.code })
    await p.exec()
    return saved
  }

  async recentRooms(limit: number) {
    const codes = await this.redis.zrange<string[]>(keys.active, 0, limit - 1, { rev: true })
    if (codes.length === 0) return []
    const p = this.redis.pipeline()
    for (const code of codes) {
      p.get(keys.room(code))
      p.hlen(keys.players(code))
    }
    const results = await p.exec<unknown[]>()
    return codes.flatMap((_, i) => {
      const room = parse<Room | null>(results[i * 2])
      return room && !room.deletedAt ? [{ room, players: Number(results[i * 2 + 1]) || 0 }] : []
    })
  }

  async idleRooms(before: number) {
    return this.redis.zrange<string[]>(keys.active, '-inf', `(${before}`, { byScore: true })
  }

  async deleteRoom(code: string) {
    const room = await this.getRoom(code)
    const p = this.redis.pipeline()
    if (room && !room.deletedAt) p.set(keys.room(code), JSON.stringify({ ...room, deletedAt: Date.now() }), { ex: TTL_SECONDS })
    p.zrem(keys.active, code)
    await p.exec()
    return room
  }

  async getPlayers(code: string) {
    const hash = await this.redis.hgetall<Record<string, unknown>>(keys.players(code))
    return Object.fromEntries(Object.entries(hash ?? {}).map(([id, p]) => [id, parse<Player>(p)]))
  }

  async setPlayer(code: string, clientId: string, player: Player) {
    const p = this.redis.pipeline()
    p.hset(keys.players(code), { [clientId]: JSON.stringify(player) })
    p.expire(keys.players(code), TTL_SECONDS)
    await p.exec()
  }

  async removePlayer(code: string, clientId: string) {
    const p = this.redis.pipeline()
    p.hdel(keys.players(code), clientId)
    p.hdel(keys.roles(code), clientId)
    await p.exec()
  }

  async replacePlayer(code: string, oldId: string, newId: string, player: Player) {
    const role = await this.getRole(code, oldId)
    const p = this.redis.pipeline()
    p.hdel(keys.players(code), oldId)
    p.hset(keys.players(code), { [newId]: JSON.stringify(player) })
    p.expire(keys.players(code), TTL_SECONDS)
    p.hdel(keys.roles(code), oldId, newId)
    if (role) p.hset(keys.roles(code), { [newId]: role })
    await p.exec()
  }

  async getRole(code: string, clientId: string) {
    return ((await this.redis.hget<Role>(keys.roles(code), clientId)) ?? null) as Role | null
  }

  async getChat(code: string, round: number) {
    const list = await this.redis.lrange<unknown>(keys.chat(code, round), 0, -1)
    return list.map((m) => parse<ChatMessage>(m))
  }

  async addChat(code: string, round: number, message: ChatMessage) {
    const p = this.redis.pipeline()
    p.rpush(keys.chat(code, round), JSON.stringify(message))
    p.ltrim(keys.chat(code, round), -CHAT_MAX_MESSAGES, -1)
    p.expire(keys.chat(code, round), TTL_SECONDS)
    await p.exec()
  }

  async getRoles(code: string) {
    return (await this.redis.hgetall<Record<string, Role>>(keys.roles(code))) ?? {}
  }

  async setRoles(code: string, roles: Record<string, Role>) {
    const p = this.redis.pipeline()
    p.del(keys.roles(code))
    p.hset(keys.roles(code), roles)
    p.expire(keys.roles(code), TTL_SECONDS)
    await p.exec()
  }

  async clearRoles(code: string) {
    await this.redis.del(keys.roles(code))
  }
}

/** Local development only: serverless instances on Vercel don't share memory. */
class MemoryStore implements Store {
  private rooms = new Map<string, Room>()
  private players = new Map<string, Map<string, Player>>()
  private roles = new Map<string, Map<string, Role>>()
  private chats = new Map<string, ChatMessage[]>()

  private hash<T>(map: Map<string, Map<string, T>>, code: string) {
    let h = map.get(code)
    if (!h) map.set(code, (h = new Map()))
    return h
  }

  async getRoom(code: string) {
    return structuredClone(this.rooms.get(code) ?? null)
  }
  async saveRoom(room: Room) {
    const saved = { ...room, updatedAt: Date.now() }
    this.rooms.set(room.code, structuredClone(saved))
    return saved
  }
  private alive() {
    return [...this.rooms.values()].filter((r) => !r.deletedAt)
  }
  async recentRooms(limit: number) {
    return this.alive()
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, limit)
      .map((room) => ({ room: structuredClone(room), players: this.hash(this.players, room.code).size }))
  }
  async idleRooms(before: number) {
    return this.alive()
      .filter((r) => (r.updatedAt ?? r.createdAt) < before)
      .map((r) => r.code)
  }
  async deleteRoom(code: string) {
    const room = this.rooms.get(code)
    if (!room) return null
    const before = structuredClone(room)
    room.deletedAt ??= Date.now()
    return before
  }
  async getPlayers(code: string) {
    return Object.fromEntries(structuredClone(this.hash(this.players, code)))
  }
  async setPlayer(code: string, clientId: string, player: Player) {
    this.hash(this.players, code).set(clientId, { ...player })
  }
  async removePlayer(code: string, clientId: string) {
    this.hash(this.players, code).delete(clientId)
    this.hash(this.roles, code).delete(clientId)
  }
  async replacePlayer(code: string, oldId: string, newId: string, player: Player) {
    const players = this.hash(this.players, code)
    const roles = this.hash(this.roles, code)
    const role = roles.get(oldId)
    players.delete(oldId)
    players.set(newId, { ...player })
    roles.delete(oldId)
    roles.delete(newId)
    if (role) roles.set(newId, role)
  }
  async getRole(code: string, clientId: string) {
    return this.hash(this.roles, code).get(clientId) ?? null
  }
  async getRoles(code: string) {
    return Object.fromEntries(this.hash(this.roles, code))
  }
  async getChat(code: string, round: number) {
    return structuredClone(this.chats.get(`${code}:${round}`) ?? [])
  }
  async addChat(code: string, round: number, message: ChatMessage) {
    const key = `${code}:${round}`
    this.chats.set(key, [...(this.chats.get(key) ?? []), { ...message }].slice(-CHAT_MAX_MESSAGES))
  }
  async setRoles(code: string, roles: Record<string, Role>) {
    this.roles.set(code, new Map(Object.entries(roles)))
  }
  async clearRoles(code: string) {
    this.roles.delete(code)
  }
}

let store: Store | undefined

export function getStore(): Store {
  if (store) return store

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

  if (url && token) {
    store = new RedisStore(new Redis({ url, token }))
  } else {
    if (process.env.VERCEL) {
      console.warn(
        '[sleep-city] Nenhum Redis configurado: usando memória. As salas vão sumir/falhar entre instâncias. ' +
          'Conecte um banco Upstash Redis ao projeto na Vercel.',
      )
    }
    store = new MemoryStore()
  }
  return store
}

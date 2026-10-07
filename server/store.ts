import { Redis } from '@upstash/redis'
import type { Player, Role, Room } from './game.js'

/** Rooms expire after 12h without changes. */
const TTL_SECONDS = 60 * 60 * 12

export interface Store {
  getRoom(code: string): Promise<Room | null>
  saveRoom(room: Room): Promise<void>
  getPlayers(code: string): Promise<Record<string, Player>>
  setPlayer(code: string, clientId: string, player: Player): Promise<void>
  removePlayer(code: string, clientId: string): Promise<void>
  getRole(code: string, clientId: string): Promise<Role | null>
  setRoles(code: string, roles: Record<string, Role>): Promise<void>
  clearRoles(code: string): Promise<void>
}

const keys = {
  room: (code: string) => `cd:room:${code}`,
  players: (code: string) => `cd:room:${code}:players`,
  roles: (code: string) => `cd:room:${code}:roles`,
}

const parse = <T>(value: unknown): T => (typeof value === 'string' ? JSON.parse(value) : value) as T

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async getRoom(code: string) {
    return parse<Room | null>(await this.redis.get(keys.room(code)))
  }

  async saveRoom(room: Room) {
    await this.redis.set(keys.room(room.code), JSON.stringify(room), { ex: TTL_SECONDS })
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

  async getRole(code: string, clientId: string) {
    return ((await this.redis.hget<Role>(keys.roles(code), clientId)) ?? null) as Role | null
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

  private hash<T>(map: Map<string, Map<string, T>>, code: string) {
    let h = map.get(code)
    if (!h) map.set(code, (h = new Map()))
    return h
  }

  async getRoom(code: string) {
    return structuredClone(this.rooms.get(code) ?? null)
  }
  async saveRoom(room: Room) {
    this.rooms.set(room.code, structuredClone(room))
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
  async getRole(code: string, clientId: string) {
    return this.hash(this.roles, code).get(clientId) ?? null
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
        '[cidade-dorme] Nenhum Redis configurado: usando memória. As salas vão sumir/falhar entre instâncias. ' +
          'Conecte um banco Upstash Redis ao projeto na Vercel.',
      )
    }
    store = new MemoryStore()
  }
  return store
}

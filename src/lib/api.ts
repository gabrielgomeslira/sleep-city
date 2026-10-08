import { getClientId } from './session'
import type { Counts, RoomView } from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-client-id': getClientId() },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Algo deu errado')
  return data as T
}

export const api = {
  createRoom: (name: string) => request<RoomView>('POST', '/rooms', { name }),
  getRoom: (code: string) => request<RoomView>('GET', `/rooms/${code}`),
  join: (code: string, name: string) => request<RoomView>('POST', `/rooms/${code}/join`, { name }),
  leave: (code: string) => request<{ ok: true }>('POST', `/rooms/${code}/leave`),
  kick: (code: string, pid: string) => request<RoomView>('POST', `/rooms/${code}/kick`, { pid }),
  transfer: (code: string, pid: string) => request<RoomView>('POST', `/rooms/${code}/transfer`, { pid }),
  start: (code: string, counts: Counts) => request<RoomView>('POST', `/rooms/${code}/start`, { counts }),
  dawn: (code: string, attacked: string[], saved: string[]) =>
    request<RoomView>('POST', `/rooms/${code}/dawn`, { attacked, saved }),
  dusk: (code: string, voted: string[]) => request<RoomView>('POST', `/rooms/${code}/dusk`, { voted }),
  undo: (code: string) => request<RoomView>('POST', `/rooms/${code}/undo`),
  reset: (code: string) => request<RoomView>('POST', `/rooms/${code}/reset`),
}

const ID_KEY = 'sleep-city:client-id'
const NAME_KEY = 'sleep-city:name'
const ROOM_KEY = 'sleep-city:last-room'

let memoryId: string | null = null

// crypto.randomUUID só existe em contexto seguro (https/localhost); getRandomValues funciona em http na rede local.
function randomId() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Identificador único deste navegador: é a "sessão" do jogador. */
export function getClientId(): string {
  try {
    let id = localStorage.getItem(ID_KEY)
    if (!id) {
      id = randomId()
      localStorage.setItem(ID_KEY, id)
    }
    return id
  } catch {
    return (memoryId ??= randomId())
  }
}

function stored(key: string) {
  return {
    get: () => {
      try {
        return localStorage.getItem(key) ?? ''
      } catch {
        return ''
      }
    },
    set: (value: string) => {
      try {
        localStorage.setItem(key, value)
      } catch {
        // armazenamento indisponível (aba anônima, etc.)
      }
    },
  }
}

export const savedName = stored(NAME_KEY)
export const lastRoom = stored(ROOM_KEY)

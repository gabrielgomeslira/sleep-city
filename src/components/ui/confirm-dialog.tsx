import { useEffect, useId, useRef, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Substitui o confirm() do navegador por um modal no visual do jogo.
// Uso: if (!(await confirmDialog({ title: 'Sair da sala?' }))) return

export interface ConfirmOptions {
  title: string
  description?: string
  emoji?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'success' | 'destructive'
}

type Request = ConfirmOptions & { resolve: (ok: boolean) => void }

let current: Request | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function settle(ok: boolean) {
  const request = current
  current = null
  listeners.forEach((l) => l())
  request?.resolve(ok)
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // Um pedido novo cancela o que estiver aberto.
  current?.resolve(false)
  return new Promise((resolve) => {
    current = { ...options, resolve }
    listeners.forEach((l) => l())
  })
}

export function ConfirmDialog() {
  const request = useSyncExternalStore(subscribe, () => current)
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  // Mantém o conteúdo na tela enquanto o modal fecha.
  const last = useRef(request)
  if (request) last.current = request
  const view = request ?? last.current

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (request && !dialog.open) dialog.showModal()
    if (!request && dialog.open) dialog.close()
  }, [request])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={view?.description ? descriptionId : undefined}
      // Esc fecha o <dialog> nativo; tratamos como "cancelar".
      onClose={() => current && settle(false)}
      // Clique no fundo escuro (fora do cartão) também cancela.
      onClick={(e) => e.target === e.currentTarget && settle(false)}
      className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-visible bg-transparent p-0 text-card-foreground backdrop:bg-primary-deep/70 backdrop:backdrop-blur-sm open:animate-pop"
    >
      {view && (
        <Card className="items-center gap-4 px-6 text-center">
          {view.emoji && <span className="text-5xl">{view.emoji}</span>}
          <div className="flex flex-col gap-2">
            <h2 id={titleId} className="font-display text-2xl leading-tight font-semibold text-primary-deep">
              {view.title}
            </h2>
            {view.description && (
              <p id={descriptionId} className="text-sm font-semibold text-muted-foreground">
                {view.description}
              </p>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-3 pt-1">
            <Button variant="outline" autoFocus onClick={() => settle(false)}>
              {view.cancelText ?? 'Cancelar'}
            </Button>
            <Button variant={view.variant ?? 'default'} onClick={() => settle(true)}>
              {view.confirmText ?? 'Confirmar'}
            </Button>
          </div>
        </Card>
      )}
    </dialog>
  )
}

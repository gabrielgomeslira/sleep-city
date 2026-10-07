import { useState } from 'react'
import { Copy, QrCode, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SharePanel({ code }: { code: string }) {
  const [showQr, setShowQr] = useState(false)
  const link = `${window.location.origin}/sala/${code}`
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado!')
    } catch {
      toast.error('Não foi possível copiar, envie o código da sala')
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Sleep City', text: `Entre na sala ${code} do Sleep City!`, url: link })
    } catch {
      // usuário cancelou o compartilhamento
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Convide a galera</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-2xl border-[3px] border-dashed border-secondary-dark bg-muted py-3 text-center">
          <p className="font-display text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Código da sala
          </p>
          <p className="font-display text-4xl font-bold tracking-[0.3em] text-primary">{code}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={copy}>
            <Copy /> Copiar
          </Button>
          <Button variant="secondary" onClick={share} disabled={!canShare}>
            <Share2 /> Enviar
          </Button>
          <Button variant="secondary" onClick={() => setShowQr((v) => !v)}>
            <QrCode /> QR
          </Button>
        </div>
        {showQr && (
          <div className="mx-auto animate-pop rounded-2xl border-4 border-secondary bg-white p-3">
            <QRCodeSVG value={link} size={196} fgColor="#2e1065" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

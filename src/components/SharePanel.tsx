import { useState } from 'react'
import { Copy, QrCode, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function SharePanel({ code }: { code: string }) {
  const [showQr, setShowQr] = useState(false)
  const link = `${window.location.origin}/sala/${code}`
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar, selecione o link manualmente')
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Sleep City', text: `Entre na sala ${code}`, url: link })
    } catch {
      // usuário cancelou o compartilhamento
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Convide a galera</CardTitle>
        <CardDescription>
          Código da sala: <span className="font-mono text-base font-semibold tracking-widest text-foreground">{code}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
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
          <div className="mx-auto rounded-xl bg-white p-3">
            <QRCodeSVG value={link} size={196} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

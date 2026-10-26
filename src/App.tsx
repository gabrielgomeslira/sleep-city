import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Toaster } from '@/components/ui/sonner'
import { usePathname } from '@/lib/router'
import { HomePage } from '@/pages/HomePage'
import { RoomPage } from '@/pages/RoomPage'

export default function App() {
  const pathname = usePathname()
  const match = pathname.match(/^\/sala\/([A-Za-z0-9]+)\/?$/)
  const code = match?.[1].toUpperCase()

  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-6 pb-10">
        {code ? <RoomPage key={code} code={code} /> : <HomePage />}
        <footer className="mt-auto pt-6 text-center text-xs text-white/35">
          desenvolvido por gomes.dev © 2026
        </footer>
      </main>
      <Toaster />
      <ConfirmDialog />
    </>
  )
}

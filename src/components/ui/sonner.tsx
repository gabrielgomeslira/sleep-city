import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      className="toaster group"
      toastOptions={{
        className: '!rounded-2xl !font-sans !font-bold !shadow-[0_5px_0_rgb(46_16_101/0.3)]',
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'transparent',
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

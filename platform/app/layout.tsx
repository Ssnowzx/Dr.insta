import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SCRIPT_TEMA } from '@/lib/tema'
import './base.css'

/* Metadata strings are pt-BR: they show up in the browser tab and in link
   previews, both of which a person reads. */
export const metadata: Metadata = {
  title: 'Plataforma — My Favorite',
  description: 'Entregas, demandas e métricas da consultoria.',
  robots: { index: false, follow: false, nocache: true }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#16110f' }
  ]
}

export default function RootLayout ({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Applies the saved theme before the first paint. Without it the page
            renders in the OS theme and corrects itself on hydration, which is a
            white flash on every navigation for anyone who chose dark. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  )
}

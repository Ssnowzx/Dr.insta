import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './base.css'

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
    { media: '(prefers-color-scheme: light)', color: '#fbf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#13110f' }
  ]
}

export default function LayoutRaiz ({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}

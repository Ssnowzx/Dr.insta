import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SCRIPT_TEMA } from '@/lib/tema'
import './base.css'

/* Metadata strings are pt-BR: they show up in the browser tab and in link
   previews, both of which a person reads.

   No brand here on purpose. This title covers the screens reached WITHOUT a
   session — sign in, invite, recovery — where the platform does not yet know
   who is knocking and has no client to name. The client's brand belongs to the
   authenticated area, and `app/(app)/layout.tsx` reads it from the database. */
export const metadata: Metadata = {
  title: 'Plataforma',
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
    /* `suppressHydrationWarning` is required by the script below, not optional
       tidying: it writes `data-tema` on this very element before React loads,
       so the server markup and the client DOM disagree by design. Without it
       React logs a hydration mismatch on every single page load — which is how
       a real mismatch stays hidden, buried under one that was intended.
       It suppresses the warning for THIS element's attributes only; children
       are still checked. */
    <html lang="pt-BR" suppressHydrationWarning>
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

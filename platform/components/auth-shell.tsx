import type { ReactNode } from 'react'

/**
 * The shell every credential screen sits in: an animated field on the left, the
 * form on the right, stacked on a phone.
 *
 * WHY THERE IS NO BRAND ON THIS SCREEN
 *
 * It used to say "My Favorite", which is the CLIENT's brand. This is the door
 * to the consultancy's platform, reached before anyone has signed in — there is
 * no client to name yet, and naming hers made the product look like it belonged
 * to her. Inside, the brand comes from the database and is hers everywhere.
 *
 * WHAT THE ANIMATION IS MADE OF
 *
 * Four layers, no images and no JavaScript:
 *
 *   · two blurred blobs drifting behind everything, for slow ambient movement
 *   · three static rings, barely visible, that give the composition its bones
 *   · three more rings carrying a `conic-gradient` arc, masked down to their own
 *     stroke and spun at different speeds and directions — that is the light
 *     travelling around the circle
 *   · two ripples expanding outward on a long delay, so the field breathes
 *     instead of only rotating
 *
 * The mask is what makes the arc a ring and not a filled pie: it punches out
 * everything except the outer two pixels. Without it the conic gradient renders
 * as a rotating wedge.
 *
 * `prefers-reduced-motion` is honoured — `app/base.css` stops every animation
 * globally for anyone who asked for less movement, and this composition is built
 * to still look composed standing still.
 */
export function AuthShell ({ children }: { children: ReactNode }) {
  return (
    <div className="auth-split">
      <div className="auth-campo" aria-hidden="true">
        <span className="auth-blob auth-blob-a" />
        <span className="auth-blob auth-blob-b" />

        <span className="auth-arco auth-arco-1" />
        <span className="auth-arco auth-arco-2" />
        <span className="auth-arco auth-arco-3" />

        <span className="auth-anel auth-anel-1" />
        <span className="auth-anel auth-anel-2" />
        <span className="auth-anel auth-anel-3" />

        <span className="auth-onda" />
        <span className="auth-onda auth-onda-2" />

        <div className="auth-centro">
          {/* The chain, in order: the evidence leads to the decision that leads
              to the result. Each word is `nowrap` so a break, when it comes,
              lands between words and never inside one. */}
          <p className="auth-assinatura">
            <span>Evidência</span>
            <i className="auth-ponto" />
            <span>Decisão</span>
            <i className="auth-ponto" />
            <span>Resultado</span>
          </p>
          <span className="auth-fio" />
        </div>
      </div>

      <main className="auth-lado">
        <div className="auth-card">{children}</div>

        {/* Outside the card, deliberately. The card is the client's business —
            signing inside it would put the builder's name on her door. Out here
            it reads as what it is: a credit at the bottom of the page. */}
        <p className="auth-credito">Desenvolvido por Xiax</p>
      </main>
    </div>
  )
}

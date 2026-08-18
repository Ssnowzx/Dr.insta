'use client'

import { useState } from 'react'

/**
 * A string she has to paste somewhere else, handed over instead of described.
 *
 * WHY THIS EXISTS
 *
 * Step `a1` asked her to swap the bio link for a tagged one and explained why it
 * mattered, and then left her to build the URL. She pasted something: measured
 * on her profile, the bio now carries `utm_source` and `utm_medium` with no
 * trace of her handle in either — which credits the visit to "Instagram, bio",
 * the same bucket the brand's own account lands in. Near miss, and invisible
 * from her side: the link works, the store opens, nothing looks broken.
 *
 * THE VALUE IS ALWAYS ON SCREEN, NOT ONLY ON THE CLIPBOARD
 *
 * `navigator.clipboard` needs a secure context and does nothing at all over
 * plain HTTP — it fails silently, with no exception in some browsers. A control
 * whose only output is a clipboard write is a control that can quietly do
 * nothing. So the string is rendered, selectable, and the copy is the shortcut.
 * `AccessLink` learned this the same way.
 *
 * `readonly` rather than plain text: on a phone, `select()` on an input reliably
 * selects the whole value, and long-pressing text does not.
 *
 * A MULTI-LINE VALUE NEEDS A TEXTAREA, AND THIS COST A NEAR MISS
 *
 * `<input>` strips newlines from its value — silently, at the DOM level. The
 * three-line bio shipped on 18/08/2026 rendered as
 * "acho chic dizer o que eu achomoda, beleza e o que eu ando usando…", with the
 * words welded together. The copy button was still correct, because it writes
 * the prop rather than the field, so the bug was invisible to anyone who tested
 * by clicking it — and would have hit whoever selected the text by hand, which
 * is exactly what the error message below tells her to do when the clipboard
 * fails. Found by reading the rendered DOM in production, not the code.
 */
export function CopyValue ({
  valor,
  rotulo,
  nota
}: {
  valor: string
  rotulo: string
  /** What to know about the value — why it looks odd, what not to do with it. */
  nota?: string
}) {
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState(false)

  /* Sized to the content: a fixed height would either scroll a three-line bio
     or leave a hole under a one-line link. */
  const linhas = valor.split('\n').length
  const multilinha = linhas > 1

  async function copiar (): Promise<void> {
    setErro(false)
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
      /* Back to the default after a moment: a button stuck on "copiado" is a
         button that stops telling you whether THIS tap worked. */
      setTimeout(() => { setCopiado(false) }, 2500)
    } catch {
      setErro(true)
    }
  }

  return (
    <div className="copiar">
      <p className="copiar-rot">{rotulo}</p>

      <div className="copiar-linha">
        {multilinha
          ? (
            <textarea
              className="copiar-valor copiar-valor-multi"
              value={valor}
              readOnly
              spellCheck={false}
              rows={linhas}
              aria-label={rotulo}
              onFocus={e => { e.currentTarget.select() }}
            />
            )
          : (
            <input
              className="copiar-valor"
              value={valor}
              readOnly
              spellCheck={false}
              aria-label={rotulo}
              onFocus={e => { e.currentTarget.select() }}
            />
            )}
        <button type="button" className="copiar-btn" onClick={() => { void copiar() }}>
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      {erro && (
        <p className="copiar-erro" role="alert">
          Não consegui copiar por aqui. Toque no texto acima para selecionar tudo.
        </p>
      )}

      {/* Below the value and not above it: this answers a question that only
          occurs to her once she is looking at the string. Split on blank lines
          so the note can hold more than one thought without becoming a wall —
          `white-space: pre-line` would keep the breaks but not the spacing
          between paragraphs. */}
      {nota !== undefined && nota !== '' && (
        <div className="copiar-nota">
          {nota.split('\n\n').map((paragrafo, i) => (
            <p key={i}>{paragrafo}</p>
          ))}
        </div>
      )}
    </div>
  )
}

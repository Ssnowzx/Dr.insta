import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Two CSS habits that only break on the narrowest screen — which is the screen
 * the client actually uses.
 *
 * Both were found on 13/08/2026 by measuring the rendered page at every width
 * from 320px to 520px, after she sent a screenshot of a panel with text cut off
 * at the right edge. `tsc`, the unit tests and reading the code all passed
 * while the page was visibly broken on her phone.
 *
 * WHAT THIS CATCHES
 *
 * A bare `1fr` grid track. Grid items default to `min-width: auto`, so a long
 * unbreakable label pushes its own track wider than the container rather than
 * wrapping. At 320px two metric cards spilled 15px past the page.
 *
 * `white-space: nowrap` with no way to shrink. `.colapso-taxa` carried nowrap
 * while its flex parent sized it below the text's natural width, so between
 * 430px and 445px — the iPhone Pro Max and Plus, and nowhere else — the label
 * ran past the plate.
 *
 * WHAT THIS DOES NOT CATCH
 *
 * Everything else. It is a lint for two known shapes, not a layout test: it
 * cannot see a rendered page, so it cannot tell whether anything overflows. The
 * real check is still opening the screens and measuring. This only stops these
 * two from coming back.
 */

const RAIZ = join(import.meta.dirname, '..')
const FOLHAS = ['app/(app)/app.css', 'app/auth.css', 'app/base.css']

/** An explicit, reviewed exemption. Visible in the diff, unlike its absence. */
const DISPENSA = /nowrap-ok:?/

interface Regra {
  seletor: string
  corpo: string
  linha: number
  dentroDeMinWidth: boolean
}

/**
 * Blanks out comments so brace counting is safe, keeping the waiver token.
 *
 * Length is preserved so every offset still maps to the original line number.
 */
function semComentarios (css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, bloco => {
    /* Every character becomes a space EXCEPT the newlines, which stay where
       they were. Padding with spaces alone swallowed the line breaks inside a
       multi-line comment, and every line number reported after the first long
       comment in the file was wrong by however many lines it spanned. */
    const vazio = bloco.replace(/[^\n]/g, ' ')
    if (!DISPENSA.test(bloco)) return vazio

    const marca = '/*nowrap-ok*/'
    return marca + vazio.slice(marca.length)
  })
}

/** Character ranges covered by a `min-width` media query. */
function faixasMinWidth (css: string): Array<[number, number]> {
  const faixas: Array<[number, number]> = []
  const abre = /@media[^{]*min-width[^{]*\{/g
  let m: RegExpExecArray | null

  while ((m = abre.exec(css)) !== null) {
    let profundidade = 1
    let i = m.index + m[0].length
    while (i < css.length && profundidade > 0) {
      if (css[i] === '{') profundidade++
      else if (css[i] === '}') profundidade--
      i++
    }
    faixas.push([m.index, i])
  }

  return faixas
}

/**
 * Leaf rules, with whether each sits inside a min-width query.
 *
 * Offset-based rather than line-by-line: the first version of this walked
 * braces while streaming lines and silently missed `.selo`, which is the exact
 * failure mode that makes a lint worse than none — it reports clean while the
 * thing it exists to catch sits three hundred lines up.
 */
function lerRegras (cssOriginal: string): Regra[] {
  const css = semComentarios(cssOriginal)
  const faixas = faixasMinWidth(css)
  const regras: Regra[] = []

  /* Leaf rules only: a body with no nested braces. At-rule wrappers are skipped
     because their "body" contains braces and never matches. */
  const rule = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null

  while ((m = rule.exec(css)) !== null) {
    const cru = m[1] ?? ''
    const seletor = cru.trim()
    if (seletor === '' || seletor.startsWith('@')) continue

    /* The match starts right after the previous `}`, so it swallows the blank
       line between rules. Reporting that offset points one line above the
       selector — and a lint that names the wrong line costs the reader the time
       it was supposed to save. */
    const inicio = m.index + (cru.length - cru.trimStart().length)

    regras.push({
      seletor,
      corpo: m[2] ?? '',
      linha: css.slice(0, inicio).split('\n').length,
      dentroDeMinWidth: faixas.some(([a, b]) => inicio > a && inicio < b)
    })
  }

  return regras
}

function folhas (): Array<{ arquivo: string; regras: Regra[]; css: string }> {
  return FOLHAS.map(arquivo => {
    const css = readFileSync(join(RAIZ, arquivo), 'utf8')
    return { arquivo, regras: lerRegras(css), css }
  })
}

describe('grid não empurra a própria coluna', () => {
  it('should never declare a bare 1fr track', () => {
    // ARRANGE — `1fr` alone leaves the item at `min-width: auto`, so its content
    // sets the floor for the track. `minmax(0, 1fr)` lets it shrink and wrap.
    const faltas: string[] = []

    for (const { arquivo, css } of folhas()) {
      for (const [i, linha] of css.split('\n').entries()) {
        if (!linha.includes('grid-template-columns')) continue
        const semComentario = linha.split('/*')[0] ?? linha
        const trilhas = semComentario.replace(/minmax\([^)]*\)/g, '')

        // ACT / ASSERT
        if (/\b1fr\b/.test(trilhas)) {
          faltas.push(`${arquivo}:${i + 1} — ${linha.trim()}`)
        }
      }
    }

    expect(faltas, `use minmax(0, 1fr):\n${faltas.join('\n')}`).toEqual([])
  })
})

describe('nowrap tem por onde encolher', () => {
  it('should pair every mobile-first nowrap with an escape', () => {
    // ARRANGE — nowrap is fine when the element may overflow visibly, may be
    // clipped, or refuses to shrink. It is a bug when the element is a flex
    // child that the parent squeezes below its own text.
    const escapes = [
      /overflow\s*:/, /overflow-x\s*:/, /text-overflow\s*:/,
      /flex-shrink\s*:\s*0/, /clip-path\s*:/, /position\s*:\s*absolute/
    ]

    const faltas: string[] = []

    for (const { arquivo, regras } of folhas()) {
      for (const r of regras) {
        if (!/white-space\s*:\s*nowrap/.test(r.corpo)) continue
        // Above a min-width breakpoint the row already has the space it needs.
        if (r.dentroDeMinWidth) continue
        if (DISPENSA.test(r.corpo)) continue

        // ACT / ASSERT
        if (!escapes.some(e => e.test(r.corpo))) {
          faltas.push(`${arquivo}:${r.linha} — ${r.seletor.split('\n').pop()?.trim()}`)
        }
      }
    }

    expect(
      faltas,
      'nowrap sem escape (use overflow, text-overflow, flex-shrink: 0, ' +
      'mova para dentro de um @media (min-width:) ou escreva /* nowrap-ok: razão */):\n' +
      faltas.join('\n')
    ).toEqual([])
  })
})

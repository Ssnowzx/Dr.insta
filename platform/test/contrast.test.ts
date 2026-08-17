import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * WCAG contrast, measured rather than eyeballed.
 *
 * This exists because eyeballing failed before: a programmatic audit of the
 * July delivery found `--suave` at 2.90:1 against paper when the minimum is
 * 4.5, and half the supporting typography was failing without anyone noticing.
 *
 * It parses `app/base.css` instead of holding its own copy of the palette, so
 * changing a hex there is what runs this check. A second copy would drift, and
 * a drifted check is worse than no check.
 *
 * Thresholds: 4.5:1 for body text, 3:1 for large text and for non-text UI
 * (borders, chart fills) — WCAG 2.2 AA, 1.4.3 and 1.4.11.
 */

const CSS = readFileSync(join(import.meta.dirname, '..', 'app', 'base.css'), 'utf8')

/**
 * Reads the palette for one theme out of the stylesheet.
 *
 * There is no second palette to read any more. Both values live on one line,
 * inside `light-dark(light, dark)`, which is the point: a token cannot drift
 * between themes when its two halves are three characters apart. A token
 * written as a plain hex is theme-independent by definition — the plate, whose
 * surface is dark in both — and reads the same for either side.
 */
function readTokens (theme: 'light' | 'dark'): Record<string, string> {
  const root = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('\n}\n'))
  const pick = theme === 'light' ? 0 : 1

  const tokens: Record<string, string> = {}
  for (const match of root.matchAll(
    /--([a-z0-9-]+):\s*(?:light-dark\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)|(#[0-9a-fA-F]{3,8}))\s*;/g
  )) {
    const name = match[1]
    if (name === undefined) continue
    /* Either the pair or the single value matched, never both. */
    const value = match[4] ?? [match[2], match[3]][pick]
    if (value !== undefined) tokens[name] = value
  }
  return tokens
}

function channel (hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  return [0, 2, 4].map(i => Number.parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** Relative luminance, WCAG 2.x definition. */
function luminance (hex: string): number {
  const [r, g, b] = channel(hex)
  const lin = (c: number): number => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast (a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

interface Pair {
  fg: string
  bg: string
  min: number
  why: string
}

/** Every pair the interface actually renders. Adding a pair to the UI means adding it here. */
const PAIRS: Pair[] = [
  // body text
  { fg: 'tinta', bg: 'papel', min: 4.5, why: 'texto principal na página' },
  { fg: 'tinta', bg: 'cartao', min: 4.5, why: 'texto principal no cartão' },
  { fg: 'tinta2', bg: 'papel', min: 4.5, why: 'texto de apoio na página' },
  { fg: 'tinta2', bg: 'cartao', min: 4.5, why: 'texto de apoio no cartão' },
  { fg: 'suave', bg: 'papel', min: 4.5, why: 'sobrancelha e rótulo — o par que reprovou em julho' },
  { fg: 'suave', bg: 'cartao', min: 4.5, why: 'rótulo dentro do cartão' },
  /* `--papel2` is the third surface, and the one that was missing here. It is
     the ground under `.tag` and `.selo-neutro` — the state word on every metric
     card and the duration on every post — and `--suave` measured 4.35 on it in
     light while passing on both surfaces this list did know about. */
  { fg: 'suave', bg: 'papel2', min: 4.5, why: 'etiqueta e selo neutro sobre a segunda superfície' },

  // accent and status text
  { fg: 'caramelo', bg: 'papel', min: 4.5, why: 'link' },
  { fg: 'caramelo', bg: 'cartao', min: 4.5, why: 'link no cartão' },
  { fg: 'tijolo', bg: 'papel', min: 4.5, why: 'estado crítico' },
  { fg: 'tijolo', bg: 'cartao', min: 4.5, why: 'estado crítico sobre o cartão' },
  { fg: 'tijolo', bg: 'urg-bg', min: 4.5, why: 'aviso de erro sobre o próprio fundo' },
  { fg: 'ok', bg: 'papel', min: 4.5, why: 'estado saudável' },
  { fg: 'ok', bg: 'ok-bg', min: 4.5, why: 'aviso de sucesso sobre o próprio fundo' },
  { fg: 'atencao', bg: 'papel', min: 4.5, why: 'estado de atenção' },
  { fg: 'atencao', bg: 'atencao-bg', min: 4.5, why: 'atenção sobre o próprio fundo' },

  /* Status text ON A CARD. Two of these were already rendering and had never
     been measured: `.segmento-ativo.segmento-done` puts `--ok` on `--cartao`
     and has since the plan screen shipped, and the list above only ever knew
     the `--papel` version. The card is the LIGHTER surface in light and the
     lighter one in dark too, so it is not the same reading — which is exactly
     the shape of the `--dado`-as-text failure this file was extended for once
     already. Added with the pauta states, which use all four. */
  { fg: 'ok', bg: 'cartao', min: 4.5, why: 'segmento ativo de feito e de publicada' },
  { fg: 'atencao', bg: 'cartao', min: 4.5, why: 'segmento ativo de gravada' },

  /* `--papel2` as a panel ground, with real ink on it rather than a label.
     `.pedido-porque` has set `--tinta2` there since the requests screen
     shipped, and the hook block now sets `--tinta`. The list knew `--suave` on
     this surface and nothing else. */
  { fg: 'tinta', bg: 'papel2', min: 4.5, why: 'o gancho da pauta sobre o painel' },
  { fg: 'tinta2', bg: 'papel2', min: 4.5, why: '"por que importa" e a chamada da pauta' },

  // inverted
  /* The primary button inverts by theme: dark surface with light text in light
     mode, light surface with dark text in dark mode. Either way the pair is
     --sobre-tinta on --tinta, which is why this is not tested against --bloco. */
  { fg: 'sobre-tinta', bg: 'tinta', min: 4.5, why: 'texto sobre o botão principal' },
  /* The badge on a nav item. It sat on `--dado` and measured 3.62 in light —
     a bar's threshold applied to a figure someone has to read. */
  { fg: 'sobre-tinta', bg: 'dado-texto', min: 4.5, why: 'contador de pedidos e de novidades' },
  { fg: 'sobre-bloco2', bg: 'bloco', min: 4.5, why: 'texto secundário sobre bloco escuro' },

  /* The funnel plate. It is dark in BOTH themes, so these two tokens do not
     invert — which is exactly why they need their own pairs: reusing
     `--sobre-tinta` here would pass in light and go black-on-black in dark. */
  { fg: 'sobre-bloco', bg: 'bloco', min: 4.5, why: 'texto forte sobre a placa do funil' },

  /* The credential screens' well. It is the plate in light and near-black in
     dark, because two dark surfaces cannot be told apart by tone — see the
     header of `app/auth.css`. */
  { fg: 'sobre-bloco', bg: 'poco', min: 4.5, why: 'a assinatura sobre o campo animado' },
  { fg: 'dado-bloco', bg: 'poco', min: 3, why: 'a luz que percorre os anéis' },

  /* A field is a control, and WCAG 1.4.11 asks 3:1 of the boundary that
     identifies one. `--linha` was doing this job at 1.53 on white and 1.47 on
     the dark card — a field you had to hunt for, in both themes. */
  { fg: 'linha-campo', bg: 'campo-fundo', min: 3, why: 'borda do campo contra o próprio fundo' },
  { fg: 'linha-campo', bg: 'cartao', min: 3, why: 'borda do campo contra o cartão em volta' },
  { fg: 'tinta', bg: 'campo-fundo', min: 4.5, why: 'o que ela digita' },
  { fg: 'suave', bg: 'campo-fundo', min: 4.5, why: 'texto de exemplo dentro do campo' },
  /* The plate's eyebrow and percentages. NOT `--caramelo`: that token is the
     brand hue at TEXT weight, which is dark, and dark on a dark plate is
     unreadable. The plate uses the brand nude as the store itself uses it. */
  { fg: 'dado-bloco', bg: 'bloco', min: 4.5, why: 'sobrancelha e percentagens sobre a placa' },

  /* The measure, as TEXT.
     `--dado` is on this list twice below at 3:1, which is the right threshold
     for a bar and the wrong one for a word — and the stylesheet was using it as
     `color` in six places (active nav item, active bell, evidence figure on a
     step, the emphasis in a request footer, the reopen button, the "≤20s" tag).
     In light those read between 2.95 and 3.85. `--dado-texto` exists for those
     six; these three pairs are the surfaces they sit on. */
  { fg: 'dado-texto', bg: 'papel', min: 4.5, why: 'item ativo da navegação e sino' },
  { fg: 'dado-texto', bg: 'cartao', min: 4.5, why: 'número da evidência e botão de reabrir' },
  { fg: 'dado-texto', bg: 'dado-fraco', min: 4.5, why: 'etiqueta de até 20s — o corte que o ciclo testa' },

  // non-text (WCAG 1.4.11)
  { fg: 'dado', bg: 'cartao', min: 3, why: 'preenchimento de gráfico no cartão' },
  { fg: 'dado', bg: 'papel', min: 3, why: 'preenchimento de gráfico na página' },
  { fg: 'dado-bloco', bg: 'bloco', min: 3, why: 'barra do funil sobre a placa escura' },
  { fg: 'linha', bg: 'cartao', min: 1.4, why: 'borda de cartão — se some, os cartões viram um bloco só' }
]

describe('the parser itself', () => {
  it('should read two different palettes, not the same one twice', () => {
    // ARRANGE — if `readTokens` picked the same side of `light-dark()` for both
    // themes, every pair below would still pass while measuring one theme
    // twice. That is the failure this file exists to prevent, so it is checked
    // rather than assumed.
    const light = readTokens('light')
    const dark = readTokens('dark')

    // ACT / ASSERT
    expect(light.papel).not.toBe(dark.papel)
    expect(light.tinta).not.toBe(dark.tinta)
    expect(light.caramelo).not.toBe(dark.caramelo)
  })

  it('should read a theme-independent token identically for both', () => {
    // ARRANGE — the plate is a dark field in BOTH themes, so its tokens are
    // written as a plain hex and must come back the same either way
    // ACT / ASSERT
    expect(readTokens('light')['sobre-bloco']).toBe(readTokens('dark')['sobre-bloco'])
    expect(readTokens('light')['sobre-bloco']).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

for (const theme of ['light', 'dark'] as const) {
  const tokens = readTokens(theme)

  describe(`contrast — ${theme}`, () => {
    it('should have parsed the tokens out of base.css', () => {
      // ARRANGE / ACT / ASSERT — a silent parse failure would make every
      // pair below skip, and the suite would pass while measuring nothing
      expect(Object.keys(tokens).length).toBeGreaterThan(15)
      expect(tokens.tinta).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(tokens.papel).toMatch(/^#[0-9a-fA-F]{6}$/)
    })

    it.each(PAIRS)('should keep $fg on $bg above $min:1 ($why)', ({ fg, bg, min }) => {
      // ARRANGE
      const foreground = tokens[fg]
      const background = tokens[bg]

      // ACT
      expect(foreground, `token --${fg} missing in ${theme}`).toBeDefined()
      expect(background, `token --${bg} missing in ${theme}`).toBeDefined()
      const ratio = contrast(foreground ?? '#000000', background ?? '#ffffff')

      // ASSERT
      expect(
        Number(ratio.toFixed(2)),
        `--${fg} on --${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1`
      ).toBeGreaterThanOrEqual(min)
    })
  })
}

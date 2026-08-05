/**
 * Number formatting for the screen, in pt-BR.
 *
 * The database hands back DECIMAL as a string, on purpose (see db/connection.ts).
 * Parsing happens here, at the edge, once — and only to render. Nothing upstream
 * of this file ever holds a rate as a float.
 *
 * Ratios are stored as ratios: 0.002300 renders as "0,23%". The ×100 lives here
 * and nowhere else, because a codebase that multiplies by 100 in two places
 * eventually multiplies twice.
 */

export type Unit = 'ratio' | 'count' | 'currency' | 'seconds'

const count = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
})

function ratio (value: number, decimals: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals
  }).format(value * 100) + '%'
}

/** Parses a DECIMAL column. Returns `null` rather than NaN, so a bad row shows a dash, not "NaN%". */
export function toNumber (raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const n = typeof raw === 'number' ? raw : Number.parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

export function format (
  raw: string | number | null | undefined,
  unit: Unit,
  decimals = 2
): string {
  const n = toNumber(raw)
  if (n === null) return '—'

  switch (unit) {
    case 'currency': return money.format(n)
    case 'count': return count.format(n)
    case 'seconds': {
      const total = Math.round(n)
      const m = Math.floor(total / 60)
      const s = total % 60
      return m === 0 ? `${s}s` : `${m}min${String(s).padStart(2, '0')}`
    }
    case 'ratio': return ratio(n, decimals)
  }
}

/**
 * A ratio with enough decimals to stop being zero.
 *
 * The funnel ends at 23 purchases out of 5.4 million reached — 0.00042%.
 * Rendering that with two decimals produces "0,00%", which reads as "no data"
 * instead of "almost nobody". The number is small; saying so is the point.
 */
export function smallRatio (value: number): string {
  if (value === 0) return '0%'
  const pct = value * 100
  const decimals = pct >= 1 ? 1 : pct >= 0.1 ? 2 : pct >= 0.01 ? 3 : 4
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals
  }).format(pct) + '%'
}

/** "4 de agosto de 2026". Rendered in the client's timezone, never in the server's. */
export function longDate (value: Date | string, timeZone = 'America/Sao_Paulo'): string {
  const d = typeof value === 'string'
    /* A DATE column arrives as "2026-08-04" with no time. Appending midday UTC
       keeps it on the same calendar day in any Brazilian timezone — parsing it
       bare would give UTC midnight, which is the day before in São Paulo. */
    ? new Date(`${value}T12:00:00Z`)
    : value

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone
  }).format(d)
}

/** "4 ago" — for tight spaces like a table column. */
export function shortDate (value: Date | string, timeZone = 'America/Sao_Paulo'): string {
  const d = typeof value === 'string' ? new Date(`${value}T12:00:00Z`) : value
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone })
    .format(d)
    .replace('.', '')
}

/** "julho de 2026", from a period column. */
export function monthLabel (value: string, timeZone = 'America/Sao_Paulo'): string {
  const d = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone }).format(d)
}

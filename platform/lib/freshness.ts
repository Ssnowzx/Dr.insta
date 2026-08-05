/**
 * How old the data on screen is.
 *
 * Nothing in this product updates by itself: metrics are typed from Insights
 * screenshots and the archive arrives by import. The risk that creates is not
 * technical — it is that she opens the panel in October, reads a July number,
 * and decides something on it.
 *
 * Pure and clock-injected, so the thresholds are testable and the domain never
 * reaches for the time implicitly.
 */

export type Freshness = 'fresh' | 'aging' | 'stale'

export interface Age {
  days: number
  level: Freshness
  /** pt-BR, ready to render. */
  label: string
}

/** Below this, a month-old number is simply the current month's number. */
const AGING_AFTER_DAYS = 35
/** Past this, a monthly metric has skipped a whole cycle and cannot be current. */
const STALE_AFTER_DAYS = 65

const DAY = 24 * 60 * 60 * 1000

/**
 * @param measuredAt When the data describes, not when it was imported. A
 *                   snapshot of July imported in September is two months old,
 *                   whatever its row timestamp says.
 */
export function ageOf (measuredAt: Date | string, now: Date = new Date()): Age {
  const at = typeof measuredAt === 'string'
    /* A bare DATE is a calendar day. Midday UTC keeps it on its own day in any
       Brazilian timezone. Only the first ten characters are used, so a full
       DATETIME string works here too. */
    ? new Date(`${measuredAt.slice(0, 10)}T12:00:00Z`)
    : measuredAt

  /* An unparseable date must not become NaN days and then a blank warning. */
  if (Number.isNaN(at.getTime())) {
    return { days: 0, level: 'fresh', label: 'sem data' }
  }

  const days = Math.max(0, Math.floor((now.getTime() - at.getTime()) / DAY))

  const level: Freshness = days >= STALE_AFTER_DAYS
    ? 'stale'
    : days >= AGING_AFTER_DAYS ? 'aging' : 'fresh'

  return { days, level, label: describe(days) }
}

function describe (days: number): string {
  if (days === 0) return 'de hoje'
  if (days === 1) return 'de ontem'
  if (days < 30) return `de ${days} dias atrás`
  const months = Math.floor(days / 30)
  if (months === 1) return 'de um mês atrás'
  return `de ${months} meses atrás`
}

/**
 * The end of the window a monthly period covers.
 *
 * A metric filed under 2026-07-01 describes the whole of July, so on 4 August it
 * is four days old — not thirty-four. Measuring from the first of the month
 * would show every fresh monthly number as already a month behind, and a
 * warning that cries wolf gets ignored exactly when it is right.
 */
export function endOfMonth (period: string): Date {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  /* Day 0 of the next month is the last day of this one. */
  return new Date(Date.UTC(year, month, 0, 12, 0, 0))
}

/**
 * Where each pauta sits on the calendar.
 *
 * Pure — dates in, groups out, no database and no implicit clock. `today` is a
 * parameter for the same reason it is one in `latestPeriod`: a boundary that
 * reads the clock is a boundary nobody can test without waiting for Sunday.
 *
 * DATES ARE STRINGS AND STAY STRINGS
 *
 * `scheduled_for` is a DATE column and comes back as "2026-08-19". Turning that
 * into a `Date` is the off-by-one-day bug the schema comments already warn
 * about: `new Date('2026-08-19')` is UTC midnight, which is 18 August in
 * São Paulo. Comparing "YYYY-MM-DD" as text is exact, needs no zone, and sorts
 * correctly — which is the whole reason the format is written that way.
 */

export type IdeaState = 'proposed' | 'scheduled' | 'recorded' | 'published' | 'dropped'

/** What a group is for, in the order the screen renders them. */
export type Grupo = 'atrasada' | 'hoje' | 'semana' | 'depois' | 'banco' | 'publicada' | 'descartada'

export interface Agendavel {
  scheduledFor: string | null
  state: IdeaState
}

/** Today in São Paulo, as the same "YYYY-MM-DD" the column holds. */
export function hojeEm (now: Date, timeZone = 'America/Sao_Paulo'): string {
  /* `en-CA` is the shortest way to get ISO order out of Intl without assembling
     the parts by hand — it formats as "2026-08-17". `sv-SE` does the same and is
     the more common trick; either is a locale chosen for its format, which is
     worth stating so nobody "fixes" it to pt-BR and reverses the field order. */
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone
  }).format(now)
}

/** The date `days` after `iso`, still as a string. */
export function somarDias (iso: string, days: number): string {
  /* Midday UTC, so adding days never crosses a boundary through a DST shift.
     Brazil has no DST today and had one until 2019; a helper that breaks if it
     comes back is a helper that breaks silently, years later. */
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Which group a pauta belongs to.
 *
 * State outranks the date, and that is the rule this whole change is about: a
 * pauta she already published does not go on sitting in "esta semana" because
 * its date has not passed. It leaves the working list the moment it is done.
 *
 * `atrasada` is deliberately its own group rather than folded into "hoje". A
 * script that missed its day needs a decision — record it late, or drop it — and
 * a list that quietly re-dates it is a list that grows for ever.
 */
export function grupoDe (item: Agendavel, hoje: string, ateOSabado: string): Grupo {
  if (item.state === 'published') return 'publicada'
  if (item.state === 'dropped') return 'descartada'
  if (item.scheduledFor === null) return 'banco'
  if (item.scheduledFor < hoje) return 'atrasada'
  if (item.scheduledFor === hoje) return 'hoje'
  return item.scheduledFor <= ateOSabado ? 'semana' : 'depois'
}

export interface Agenda<T> {
  atrasada: T[]
  hoje: T[]
  semana: T[]
  depois: T[]
  banco: T[]
  publicada: T[]
  descartada: T[]
  /** Everything still waiting on them — the number the heading uses. */
  aFazer: number
}

/**
 * Splits a list of pautas into the groups the screen renders.
 *
 * The week window is the next seven days INCLUSIVE of today, not "until
 * Sunday". A calendar week is the wrong unit here: opening the app on a Saturday
 * would show an almost empty week and hide Monday's shoot in "depois", which is
 * the one thing she needs to have already read.
 */
export function agendar<T extends Agendavel> (itens: T[], hoje: string): Agenda<T> {
  const ateOSabado = somarDias(hoje, 7)

  const agenda: Agenda<T> = {
    atrasada: [], hoje: [], semana: [], depois: [],
    banco: [], publicada: [], descartada: [], aFazer: 0
  }

  for (const item of itens) agenda[grupoDe(item, hoje, ateOSabado)].push(item)

  agenda.aFazer = agenda.atrasada.length + agenda.hoje.length +
    agenda.semana.length + agenda.depois.length

  return agenda
}

/** "seg, 18 ago" — the day a pauta is due, in the shape a schedule is read in. */
export function diaDaSemana (iso: string, timeZone = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone
  })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace(/\./g, '')
    .replace(' de ', ' ')
}

/** How late a pauta is, in whole days. Used only on the `atrasada` group. */
export function diasDeAtraso (iso: string, hoje: string): number {
  const a = Date.parse(`${iso}T12:00:00Z`)
  const b = Date.parse(`${hoje}T12:00:00Z`)
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

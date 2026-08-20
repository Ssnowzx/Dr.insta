import { format } from './format.ts'

/**
 * The distance between the follower count she has and the one she asked for.
 *
 * WHY THIS IS PROSE AND NOT A CARD
 *
 * The panel already renders a bar for any metric with a target, and a bar
 * answers "how far along". It cannot answer the question she actually asked,
 * which has a date in it: a million by December. That needs the gap, the days
 * left and the pace those two imply, and a pace is only meaningful next to the
 * pace she is on — otherwise it is a number with no scale.
 *
 * WHY IT IS NOT IN THE JSX
 *
 * It branches: on whether the goal is already met, on whether the deadline has
 * passed, on one day against many, on a month that has not been measured yet.
 * Every branch is a sentence someone reads and believes. The last piece of
 * prose in this codebase that branched inside a component shipped "As última
 * são finas demais" to production.
 *
 * It states arithmetic and never a verdict. "Isso é 64 mil por mês, e em julho
 * foram 20.824" is two facts; "você está muito atrás" is an opinion, and the
 * opinion belongs in a conversation with her, not on a screen she opens alone.
 */

export interface GoalInput {
  /** Followers right now, from the account node. Null when it was not read. */
  total: number | null
  /** What she asked for. Null when the cycle has no follower goal. */
  goal: number | null
  /** Last day of the cycle, `YYYY-MM-DD`. */
  deadline: string | null
  /** Injected, never `new Date()` here — the sentence has to be testable. */
  today: Date
  /**
   * Net followers of the last closed month, for scale. Null before the first
   * one closes, and the sentence simply stops earlier when it is missing —
   * a required pace with nothing to compare it against reads as a demand.
   */
  lastMonthNet: number | null
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Whole days from today to the deadline, never negative.
 *
 * BOTH SIDES ARE ANCHORED TO A CALENDAR DAY, not to the instant of the call.
 * Counting from the timestamp makes the answer depend on the hour: the same
 * Thursday reads 133 days at nine in the morning and 134 at midnight, because
 * a partial day has to round somewhere. A person counting on a calendar gets
 * one answer all day, and this is the number that goes on her screen.
 *
 * Midday UTC on both ends keeps each date on its own day in any Brazilian
 * timezone — the same trick `ageOf` uses, and for the same reason.
 */
export function daysLeft (deadline: string, today: Date): number {
  const end = new Date(`${deadline.slice(0, 10)}T12:00:00Z`)
  const start = new Date(`${today.toISOString().slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY))
}

const inteiro = (n: number): string => format(n, 'count', 0)

/**
 * One or two sentences, or null when there is nothing true to say.
 *
 * Null rather than a placeholder: a line that says "sem dados" every day is a
 * line she learns to skip, and it would sit at the top of the panel.
 */
export function goalLine (input: GoalInput): string | null {
  const { total, goal, deadline, today, lastMonthNet } = input
  if (total === null) return null

  const tenho = `Hoje você tem ${inteiro(total)} seguidores.`
  if (goal === null || deadline === null) return tenho

  const falta = goal - total
  if (falta <= 0) return `${tenho} Você passou de ${inteiro(goal)}.`

  const dias = daysLeft(deadline, today)
  /* The deadline is gone and the goal was not met. Saying "faltam 0 dias" is
     arithmetic nobody needs; what is left true is the gap. */
  if (dias === 0) return `${tenho} Faltaram ${inteiro(falta)} para ${inteiro(goal)}.`

  const prazo = dias === 1 ? 'e resta 1 dia' : `e restam ${inteiro(dias)} dias`
  const distancia = `${tenho} Faltam ${inteiro(falta)} para ${inteiro(goal)}, ${prazo}.`

  if (lastMonthNet === null || lastMonthNet <= 0) return distancia

  /* A monthly pace needs a month to be about. With eleven days left, dividing
     the gap by eleven and multiplying by thirty projects past the deadline and
     prints a number in the millions — arithmetically consistent and useless,
     which is the worst kind of wrong on a screen. Below thirty days the
     sentence stops at the gap, and the gap is still true. */
  if (dias < 30) return distancia

  /* Per month, because that is the unit of every other follower figure here and
     of the target she was given. Rounded to a thousand: a required pace stated
     to the unit claims a precision that a 133-day projection does not have. */
  const porMes = Math.round((falta / dias) * 30 / 1000) * 1000
  return `${distancia} Isso é ${inteiro(porMes)} por mês, e no último mês fechado foram ${inteiro(lastMonthNet)}.`
}

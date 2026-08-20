import { describe, expect, it } from 'vitest'
import { daysLeft, goalLine } from '../lib/goal.ts'

/**
 * The line at the top of the panel that answers "a million by December".
 *
 * Every branch here is a sentence she reads and believes, and the one that
 * matters most is the one nobody plans for: the day the deadline arrives.
 */
const base = {
  total: 715519,
  goal: 1000000,
  deadline: '2026-12-31',
  today: new Date('2026-08-20T03:00:00Z'),
  lastMonthNet: 20824
}

describe('daysLeft', () => {
  it('should count whole days to the deadline', () => {
    // ARRANGE / ACT
    const dias = daysLeft('2026-12-31', new Date('2026-08-20T03:00:00Z'))

    // ASSERT
    expect(dias).toBe(133)
  })

  it('should never go negative once the deadline has passed', () => {
    // ARRANGE / ACT
    const dias = daysLeft('2026-08-01', new Date('2026-12-31T03:00:00Z'))

    // ASSERT — a negative pace would print as a goal that grows backwards
    expect(dias).toBe(0)
  })

  it('should not fall over on an unparseable date', () => {
    // ARRANGE / ACT / ASSERT
    expect(daysLeft('nunca', new Date('2026-08-20T03:00:00Z'))).toBe(0)
  })
})

describe('goalLine', () => {
  it('should say nothing at all when the total was not read', () => {
    // ARRANGE / ACT
    const linha = goalLine({ ...base, total: null })

    // ASSERT — a placeholder at the top of the panel is a line she learns to skip
    expect(linha).toBeNull()
  })

  it('should state the gap, the deadline and the pace it implies', () => {
    // ARRANGE / ACT
    const linha = goalLine(base)

    // ASSERT
    expect(linha).toBe(
      'Hoje você tem 715.519 seguidores. Faltam 284.481 para 1.000.000, ' +
      'e restam 133 dias. Isso é 64.000 por mês, e no último mês fechado foram 20.824.'
    )
  })

  it('should stop before the pace when no month has closed yet', () => {
    // ARRANGE / ACT
    const linha = goalLine({ ...base, lastMonthNet: null })

    // ASSERT — a required pace with nothing beside it reads as a demand
    expect(linha).toBe(
      'Hoje você tem 715.519 seguidores. Faltam 284.481 para 1.000.000, e restam 133 dias.'
    )
  })

  it('should say one day in the singular', () => {
    // ARRANGE / ACT
    const linha = goalLine({ ...base, today: new Date('2026-12-30T03:00:00Z') })

    // ASSERT — the plural bug this project already shipped once
    expect(linha).toContain('e resta 1 dia.')
  })

  it('should drop the monthly pace when under a month is left', () => {
    // ARRANGE / ACT — 11 days would project 775.000 a month, past the deadline
    const linha = goalLine({ ...base, today: new Date('2026-12-20T03:00:00Z') })

    // ASSERT
    expect(linha).not.toContain('por mês')
    expect(linha).toContain('e restam 11 dias.')
  })

  it('should drop the deadline once it has passed and keep the gap', () => {
    // ARRANGE / ACT
    const linha = goalLine({ ...base, today: new Date('2027-01-15T03:00:00Z') })

    // ASSERT
    expect(linha).toBe('Hoje você tem 715.519 seguidores. Faltaram 284.481 para 1.000.000.')
  })

  it('should congratulate rather than compute when the goal is met', () => {
    // ARRANGE / ACT
    const linha = goalLine({ ...base, total: 1000001 })

    // ASSERT
    expect(linha).toBe('Hoje você tem 1.000.001 seguidores. Você passou de 1.000.000.')
  })

  it('should state only the total when the cycle has no follower goal', () => {
    // ARRANGE / ACT
    const linha = goalLine({ ...base, goal: null })

    // ASSERT
    expect(linha).toBe('Hoje você tem 715.519 seguidores.')
  })
})

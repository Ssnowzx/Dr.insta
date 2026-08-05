import { describe, expect, it } from 'vitest'
import { canReach } from '../lib/scope.ts'
import type { Identity } from '../lib/session.ts'

/**
 * The pure half of the access rule.
 *
 * `requireSession` and `clientScope` read cookies, so they need a Next request
 * context and are exercised end to end through the browser. `canReach` is the
 * rule itself, and it is worth pinning down on its own: it is the single
 * predicate standing between one client's revenue figures and another client's
 * screen.
 */

const consultant: Identity = {
  userId: 1, clientId: null, role: 'consultant',
  name: 'Consultor', email: 'consultor@example.invalid'
}

const clientUser: Identity = {
  userId: 2, clientId: 7, role: 'client',
  name: 'Cliente Sete', email: 'sete@example.invalid'
}

describe('canReach', () => {
  it('should let a consultant reach any client', () => {
    // ARRANGE / ACT / ASSERT — a null clientId is what makes someone a consultant
    expect(canReach(consultant, 7)).toBe(true)
    expect(canReach(consultant, 99)).toBe(true)
  })

  it('should let a client user reach their own client', () => {
    // ARRANGE / ACT / ASSERT
    expect(canReach(clientUser, 7)).toBe(true)
  })

  it('should stop a client user from reaching another client', () => {
    // ARRANGE / ACT / ASSERT — the whole point: client 7 must never see client 8
    expect(canReach(clientUser, 8)).toBe(false)
    expect(canReach(clientUser, 0)).toBe(false)
  })

  it('should not treat client id zero as a consultant', () => {
    // ARRANGE — a `clientId` of 0 is falsy; a check written as `if (!clientId)`
    // would read it as "no scope" and hand over every client
    const suspicious: Identity = { ...clientUser, clientId: 0 }

    // ACT / ASSERT
    expect(canReach(suspicious, 7)).toBe(false)
    expect(canReach(suspicious, 0)).toBe(true)
  })
})

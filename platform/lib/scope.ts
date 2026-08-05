import type { Identity } from './session.ts'

/**
 * The access rule, on its own and free of the framework.
 *
 * It lives apart from `lib/dal.ts` because that module imports `redirect` from
 * `next/navigation`, which drags in React client context. The rule itself is a
 * comparison of two numbers, and the single predicate standing between one
 * client's revenue figures and another client's screen deserves to be testable
 * without booting half of Next.
 */

/**
 * Whether an identity may reach a resource belonging to a given client.
 *
 * A null `clientId` is what makes someone a consultant — note that the check is
 * `=== null` and not falsiness: a client with id `0` would pass a `!clientId`
 * test and be handed every client in the database.
 *
 * Callers must treat `false` as NOT FOUND, never as forbidden. An
 * access-denied response confirms the resource exists, and that is how a
 * consultancy's client list gets mapped by guessing.
 */
export function canReach (identity: Identity, clientId: number): boolean {
  return identity.clientId === null || identity.clientId === clientId
}

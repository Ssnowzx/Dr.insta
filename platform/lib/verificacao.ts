/**
 * What state a chore is REALLY in.
 *
 * Pure — no database, no clock, no Next imports — so the rule that decides
 * whether the plan goes on asking her for something can be pinned by a test.
 * That rule was the defect: `step_status` is keyed by (step, user), every query
 * joined it on the reader's own id, and nothing ever consulted the facts the
 * platform could already see.
 *
 * THREE INPUTS, IN THIS ORDER OF AUTHORITY
 *
 *   1. Proof — the platform watched it happen. A request that left `open`
 *      because she answered it; an Instagram connection that is active.
 *   2. The team's own answer — the newest one from anyone on the client side.
 *   3. Nothing, which is `pending`.
 *
 * PROOF ONLY EVER MOVES A STEP TO `done`, NEVER AWAY FROM IT
 *
 * This is the rule worth stating out loud. If she connects, marks it done and
 * later disconnects, the step does not go back to "a fazer": a verifier is
 * evidence of completion, not evidence of incompletion. Letting it revert would
 * make her plan flicker with the health of an API credential, and a connection
 * that breaks is already announced on its own screen and in the digest. The same
 * holds for a request that reopens.
 *
 * PROOF DOES OUTRANK `blocked`
 *
 * "Travei" plus "the platform can see it happened" means the block is stale. The
 * note she wrote stays on screen and already reached him through the digest on
 * the day she wrote it; what changes is that the chore stops being asked for.
 */

export type StepState = 'pending' | 'done' | 'blocked'

/** The states a request can be in, as far as this module cares. */
export type RequestState = 'open' | 'answered' | 'analyzing' | 'concluded' | 'dropped'

/** One answer given by someone on the client's team. */
export interface TeamAnswer {
  stepId: number
  userId: number
  userName: string
  state: StepState
  comment: string | null
  updatedAt: Date
}

/**
 * This reader's OWN answers, by step.
 *
 * Separate from the team's, and the separation is load-bearing. `step_status`
 * is one row per person, so the note a control EDITS must be that person's — a
 * textarea pre-filled with a teammate's sentence writes the teammate's words
 * into the reader's row, under the reader's name, on the next save. Worse than
 * losing a note: it fabricates one.
 *
 * That is not hypothetical. It shipped on 17/08/2026, in the same change that
 * made the STATE shared: the display note and the editable note became one
 * value, and `marcar()` sends the textarea on every state change — so merely
 * tapping "feito" would have copied the other person's note across.
 */
export function ownAnswers (
  answers: TeamAnswer[],
  userId: number
): Map<number, TeamAnswer> {
  const map = new Map<number, TeamAnswer>()
  for (const a of answers) if (a.userId === userId) map.set(a.stepId, a)
  return map
}

/**
 * Facts the platform observes on its own, by `verify_key`.
 *
 * A map and not a set of booleans: the screen says WHEN it happened, and "já
 * estava feito" with no date is the kind of claim that gets distrusted the first
 * time it is wrong.
 */
export type ObservedFacts = Record<string, Date | null>

/** The one verifier that exists today. Named here so a typo in the seed is findable. */
export const VERIFY_INSTAGRAM = 'instagram_connected'

/** A step, reduced to what deciding its state needs. */
export interface Verifiable {
  id: number
  verifyKey: string | null
  requestId: number | null
  /** Of the linked request. Null when there is none, or when it no longer exists. */
  requestState: RequestState | null
  requestCode: string | null
}

/**
 * Who is reading, because the same fact is two different sentences.
 *
 * "você já respondeu isso em Pedidos" is right on her screen and wrong on his —
 * he did not answer it, she did. The product already keeps two voices in the
 * digest and in the requests screen for exactly this reason; a proof written in
 * one voice and served to both would be the third place they drift apart.
 */
export type Voz = 'cliente' | 'consultor'

/** Why a step counts as done without anyone having pressed anything. */
export interface Proof {
  kind: 'connection' | 'request'
  /** Read on screen, in the reader's own second person. */
  label: string
  /** Where to go and see it, when there is somewhere. */
  href: string | null
  at: Date | null
}

export interface Resolved {
  state: StepState
  /** Who answered. Null when the platform decided it, or when nobody has. */
  by: string | null
  /** That person's id, so a screen can tell "mine" from "my teammate's". */
  byId: number | null
  at: Date | null
  /** The newest note from anyone on the team. For DISPLAY — see `ownAnswers`. */
  comment: string | null
  /** Present exactly when the platform proved it. */
  proof: Proof | null
}

/**
 * A request has been delivered once it leaves `open`.
 *
 * Not "concluded": concluding is HIS act, and waiting for it would keep asking
 * her for something she sent a week ago. `dropped` counts too — the chore is
 * off her plate either way, and the reason it was dropped belongs on the request,
 * not in a checkbox she is still staring at.
 */
export function requestDelivered (state: RequestState | null): boolean {
  return state !== null && state !== 'open'
}

/**
 * The newest answer per step, from a list ordered any which way.
 *
 * Built here rather than by the caller because getting it wrong is silent and
 * specific: `new Map(pairs)` keeps the LAST pair for a repeated key, so building
 * it straight from a list sorted newest-first hands back the OLDEST answer for
 * every step two people have both touched. That bug shipped once already, on the
 * consultant's side of the plan screen.
 */
export function newestPerStep (answers: TeamAnswer[]): Map<number, TeamAnswer> {
  const map = new Map<number, TeamAnswer>()
  for (const a of answers) {
    const current = map.get(a.stepId)
    if (current === undefined || a.updatedAt.getTime() > current.updatedAt.getTime()) {
      map.set(a.stepId, a)
    }
  }
  return map
}

/** What the connection proof says on screen, given when it was made. */
function connectionProof (at: Date | null, voz: Voz): Proof {
  return {
    kind: 'connection',
    label: voz === 'cliente'
      ? 'sua conta já está conectada'
      : 'a conta dela já está conectada',
    href: '/conta',
    at
  }
}

function requestProof (code: string | null, voz: Voz): Proof {
  return {
    kind: 'request',
    label: voz === 'cliente'
      ? 'você já respondeu isso em Pedidos'
      : 'ela já respondeu isso em Pedidos',
    href: code === null ? '/pedidos' : `/pedidos/${code}`,
    at: null
  }
}

/**
 * The proof for a step, when the platform has one.
 *
 * Returns null when the step declares no verifier, when the verifier is unknown,
 * or when the fact simply has not happened. An unknown key is deliberately not
 * an error: a seed that names a verifier this build does not have should leave
 * the step behaving exactly as it did before, not break the plan screen.
 */
export function proofFor (
  step: Verifiable,
  facts: ObservedFacts,
  voz: Voz = 'cliente'
): Proof | null {
  if (step.verifyKey === VERIFY_INSTAGRAM) {
    const at = facts[VERIFY_INSTAGRAM]
    if (at !== undefined) return connectionProof(at, voz)
  }

  if (step.requestId !== null && requestDelivered(step.requestState)) {
    return requestProof(step.requestCode, voz)
  }

  return null
}

/**
 * The state of one step, for everyone who looks at it.
 *
 * One answer for both roles, which is the other half of the fix. The plan screen
 * used to compute her state one way and his another, and the two disagreed on
 * screen: the headline said "Faltam 3" while the blocks under it listed,
 * correctly, what she had already marked done.
 */
export function resolveStep (
  step: Verifiable,
  answers: Map<number, TeamAnswer>,
  facts: ObservedFacts,
  voz: Voz = 'cliente'
): Resolved {
  const answer = answers.get(step.id) ?? null
  const proof = proofFor(step, facts, voz)

  if (proof !== null) {
    return {
      state: 'done',
      /* The person keeps the credit when she also pressed it. A screen that
         answers "quem marcou?" with the platform, on a step she marked herself,
         is a screen taking her work. */
      by: answer?.state === 'done' ? answer.userName : null,
      byId: answer?.state === 'done' ? answer.userId : null,
      at: answer?.state === 'done' ? answer.updatedAt : proof.at,
      comment: answer?.comment ?? null,
      proof
    }
  }

  if (answer === null) {
    return { state: 'pending', by: null, byId: null, at: null, comment: null, proof: null }
  }

  return {
    state: answer.state,
    by: answer.userName,
    byId: answer.userId,
    at: answer.updatedAt,
    comment: answer.comment,
    proof: null
  }
}

/**
 * How many chores are still waiting on the team.
 *
 * `blocked` does NOT count. It is not waiting on her — she already said it
 * stopped, and the next move is his. Counting it would keep the headline asking
 * for something she has finished asking about.
 */
export function stillPending (resolved: Resolved[]): number {
  return resolved.filter(r => r.state === 'pending').length
}

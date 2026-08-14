/**
 * The request chain, as pure data rules.
 *
 * Separate from `request-actions.ts` because that file is `'use server'`, and a
 * `'use server'` module may only export async functions — a constant or a sync
 * helper there is a build error, not a style preference. Importing it from
 * anywhere non-server also drags `next/cache` and `next/headers` along, which
 * is what made the digest tests fail to even load.
 *
 * Nothing here touches the database or the request. That is what lets the
 * screens, the digest and the tests all agree on one definition of whose turn
 * it is.
 */

export type RequestState = 'open' | 'answered' | 'analyzing' | 'concluded' | 'dropped'

export type Side = 'consultant' | 'client'

export const STATES: readonly RequestState[] =
  ['open', 'answered', 'analyzing', 'concluded', 'dropped']

/** After this long in `answered`, an untouched request is a debt, not silence. */
export const DIAS_ATE_COBRAR = 3

/**
 * How long something has been sitting, in whole days, never below zero.
 *
 * The clamp is not defensive noise. `created_at` is a DATETIME with no
 * fractional part, and MySQL ROUNDS on insert rather than truncating — so a row
 * written at 06:20:30.700 comes back as 06:20:31, up to half a second in the
 * future. The screen that renders immediately after opening a request therefore
 * computed a small negative number, and `Math.floor(-0.000004)` is -1, not 0.
 * A request opened seconds ago listed itself as "-1d", which corrected itself
 * on the next load — visible exactly once, at the moment the person is looking.
 *
 * `agora` is a parameter because this is domain logic and reading the clock
 * inside it would make the function untestable, which is how the bug got in.
 */
export function diasParados (desde: Date, agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - desde.getTime()) / 86_400_000))
}

/**
 * Whose turn it is, derived rather than stored.
 *
 * Storing it would create a second thing to keep in sync with `state`, and the
 * two would disagree the first time a transition forgot to update both.
 *
 * The side that raised the request is never hardcoded to the consultant: a
 * request she opened waits on him, and the same chain has to read correctly
 * backwards. `concluded` and `dropped` return null — nobody's turn, which is
 * not the same as either person's.
 */
/**
 * The visible label for each state, in one place.
 *
 * It lived twice — once in the list screen and once in the detail screen — and
 * the migration updated one of them. The detail screen resolved the missing key
 * through a `?? ESTADO.open` fallback, so a concluded request rendered the badge
 * "em aberto": no crash, no failing test, just a screen stating the opposite of
 * the truth. Typed by `RequestState` so the next state added has to be labelled
 * here or the build stops.
 */
export const LABEL: Record<RequestState, { rot: string; classe: string }> = {
  open: { rot: 'em aberto', classe: 'selo-atencao' },
  answered: { rot: 'respondido', classe: 'selo-neutro' },
  analyzing: { rot: 'em análise', classe: 'selo-neutro' },
  concluded: { rot: 'concluído', classe: 'selo-ok' },
  dropped: { rot: 'dispensado', classe: 'selo-neutro' }
}

/** The state change, written the way a person would say it out loud. */
export function narrate (from: string | null, to: string | null): string {
  if (to === 'answered') return 'mandou o que dava'
  if (to === 'analyzing') return 'começou a olhar'
  if (to === 'concluded') return 'concluiu, com resposta'
  if (to === 'dropped') return 'dispensou este pedido'
  if (to === 'open') return from === null ? 'abriu o pedido' : 'reabriu o pedido'
  return 'mudou o estado'
}

/**
 * A conclusion needs words, and three spaces are not words.
 *
 * Trimmed before it is judged because a field holding whitespace passes every
 * "is it filled in" check and reads, to the person who sent the material,
 * exactly like no answer at all.
 */
export function hasOutcome (text: string | null | undefined): boolean {
  return typeof text === 'string' && text.trim() !== ''
}

export function turnOf (state: RequestState, raisedBy: Side): Side | null {
  const asker: Side = raisedBy
  const responder: Side = raisedBy === 'consultant' ? 'client' : 'consultant'

  if (state === 'open') return responder
  if (state === 'answered' || state === 'analyzing') return asker
  return null
}

/**
 * Whether this actor may make this move.
 *
 * The chain had a guard on the automatic path — `promoteOnDelivery` only
 * promotes when the person acting is the one who owed the answer — and none at
 * all on the manual one. Two buttons could therefore hand the turn to the wrong
 * side:
 *
 * "Mandei tudo que dava" was offered to the client on any open request,
 * including one SHE raised. Pressing it moved a request that was waiting on the
 * consultant into `answered`, whose turn is the asker's — so it left his queue
 * and stopped counting as a debt, while the timeline narrated "mandou o que
 * dava" for material nobody sent.
 *
 * "Comecei a olhar" was offered from `open`, where nothing has arrived yet.
 * From a request he raised it removed the item from her pending list without
 * her doing anything.
 *
 * Kept here, next to `turnOf`, so the screen and the CLI cannot disagree about
 * what is legal — the same reason the outcome rule lives in the store.
 */
export function canMove (
  from: RequestState,
  to: RequestState,
  raisedBy: Side,
  actor: Side
): boolean {
  /* Dropping and reopening are either side's, at any point: both are ways of
     saying "this is not going to happen as framed", and neither claims anyone
     did any work. */
  if (to === 'dropped' || to === 'open') return from !== to

  const asker = raisedBy
  const responder: Side = raisedBy === 'consultant' ? 'client' : 'consultant'

  /* The material arriving. Only the side that owed it, and only from open. */
  if (to === 'answered') return from === 'open' && actor === responder

  /* Reading it. Only the side that asked, and only once it has arrived. */
  if (to === 'analyzing') return from === 'answered' && actor === asker

  /* Closing it with an answer. The asker is the only one who knows whether the
     material served, and `hasOutcome` already forces them to say so. */
  if (to === 'concluded') return from !== 'concluded' && actor === asker

  return false
}

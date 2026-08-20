import 'server-only'
import { and, desc, eq, gte, inArray, isNotNull, lt, ne } from 'drizzle-orm'
import { orm } from '@/db/client'
import {
  auditLog, client, delivery, file, instagramConnection, request, requestEvent,
  step, stepStatus, user
} from '@/db/schema'
import { shortDate } from './format.ts'
import { staleRequests } from './dashboard.ts'
import { ideaNotesSince, ideasMovedSince, ideasPublishedSince } from './pautas.ts'
import { DIAS_ATE_COBRAR, hasOutcome } from './pedido.ts'

/** What each pauta state means to whoever reads about it, in one word. */
const ESTADO_PAUTA: Record<string, string> = {
  scheduled: 'entrou na fila',
  recorded: 'gravou',
  published: 'publicou',
  dropped: 'descartou'
}

/**
 * What a client did in a window, for the daily summary.
 *
 * The consultant is not notified of anything today: if she marks "travou" at
 * 11pm on a Sunday, he finds out by opening the page. This closes that.
 *
 * The window is a parameter, never derived from the clock here, so the caller
 * decides the cadence and the query is testable.
 */

export interface DigestItem {
  title: string
  detail: string | null
  at: Date
  who: string
  /** How many events this one line stands for. Absent means one. */
  count?: number
  /** What the line is about, for merging. The title is not unique. */
  key?: string | number
}

/**
 * The opening of a long text, cut at a word.
 *
 * A digest that reprints nine full outcomes is not a digest — it is the other
 * screen, twice. The whole text lives in `/pedidos`, under "o que voltou pra
 * você", and that is where it should be read; here it only has to be
 * recognisable enough to decide whether to go and read it.
 */
function abertura (texto: string, limite = 130): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= limite) return limpo

  const corte = limpo.slice(0, limite)
  const ultimoEspaco = corte.lastIndexOf(' ')
  return `${(ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trimEnd()}…`
}

/**
 * Collapses repetition, because a summary that lists every event is a log.
 *
 * On 13/08/2026 she uploaded sixteen files across three requests and the
 * screen rendered sixteen lines, fourteen of which said the same thing. The
 * reader's job became scrolling, and the two items that actually needed a
 * decision were buried among identical rows.
 *
 * Merged by title, so "she sent eight files to the retention request" is one
 * line carrying a count — the information is not lost, it is stated once.
 */
function condensar (itens: DigestItem[]): DigestItem[] {
  const porTitulo = new Map<string | number, DigestItem[]>()

  for (const i of itens) {
    /* By the request, not by its title. Two requests can carry the same words
       and merging them would report one upload session that never happened. */
    const chave = i.key ?? i.title
    const lista = porTitulo.get(chave)
    if (lista === undefined) porTitulo.set(chave, [i])
    else lista.push(i)
  }

  return [...porTitulo.values()].map(lista => {
    const primeiro = lista[0] as DigestItem
    if (lista.length === 1) return primeiro

    /* The first detail plus a count, rather than all of them joined: the point
       of collapsing is not to move the wall of text one level down. */
    const resto = lista.length - 1
    return {
      ...primeiro,
      count: lista.length,
      detail: primeiro.detail === null
        ? null
        : `${primeiro.detail} e mais ${resto}`
    }
  })
}

export interface Digest {
  clientId: number
  clientName: string
  since: Date
  until: Date
  /** Blocked first, because it is the only one that changes what he does today. */
  blocked: DigestItem[]
  done: DigestItem[]
  files: DigestItem[]
  comments: DigestItem[]
  delivered: DigestItem[]
  /** Someone tried to sign in and could not. There is no reset email, so this is how he finds out. */
  askedForAccess: DigestItem[]
  /** Requests she opened. Until now nothing here ever looked at the request table. */
  raisedByHer: DigestItem[]
  /**
   * What they wrote on a pauta.
   *
   * The loop the scripts depend on. A batch of roteiros that arrives and is
   * never argued with is a batch that gets ignored by week three — so "ficou
   * longo demais" reaching him the day it is written is the difference between
   * this feature working and this feature being a calendar.
   */
  ideaTalk: DigestItem[]
  /** A pauta that was recorded, published or refused. */
  ideaMoved: DigestItem[]
  /**
   * Material she sent that he never opened.
   *
   * Not bounded by the window, like `connection` and for the same reason: this
   * is a state, not an event. A request that has been sitting for nine days
   * should not stop being reported because the day it arrived scrolled away —
   * that is precisely when it most needs saying.
   */
  stale: DigestItem[]
  /**
   * The Instagram connection stopped working.
   *
   * Not bounded by the window, unlike everything else here: a broken connection
   * is a state, not an event. Reporting it only on the day it broke would mean
   * the one notice scrolls away and the numbers go on not arriving — which is
   * the failure this whole feature has to avoid, because it looks identical to
   * a quiet month.
   */
  connection: DigestItem[]
  total: number
}

/**
 * Blank when there is nothing to say.
 *
 * A digest that arrives every day whether or not anything happened is a digest
 * that gets filtered, and then the one that mattered is filtered too. The
 * caller must check `total` before sending.
 */
export async function digestFor (
  clientId: number,
  since: Date,
  until: Date
): Promise<Digest | null> {
  const [c] = await orm()
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.id, clientId))
    .limit(1)

  if (c === undefined) return null

  // ------------------------------------------------------------- steps
  const stepRows = await orm()
    .select({
      state: stepStatus.state,
      comment: stepStatus.comment,
      at: stepStatus.updatedAt,
      who: user.name,
      title: step.title,
      delivery: delivery.title
    })
    .from(stepStatus)
    .innerJoin(step, eq(step.id, stepStatus.stepId))
    .innerJoin(delivery, eq(delivery.id, step.deliveryId))
    .innerJoin(user, eq(user.id, stepStatus.userId))
    .where(and(
      eq(step.clientId, clientId),
      gte(stepStatus.updatedAt, since),
      lt(stepStatus.updatedAt, until),
      /* Only what the client herself answered. The consultant's own edits
         should not arrive as news about the client. */
      eq(user.role, 'client')
    ))
    .orderBy(desc(stepStatus.updatedAt))

  const blocked: DigestItem[] = []
  const done: DigestItem[] = []

  for (const r of stepRows) {
    const item: DigestItem = { title: r.title, detail: r.comment, at: r.at, who: r.who }
    if (r.state === 'blocked') blocked.push(item)
    else if (r.state === 'done') done.push(item)
  }

  // ------------------------------------------------- request activity
  const eventRows = await orm()
    .select({
      kind: requestEvent.kind,
      body: requestEvent.body,
      toState: requestEvent.toState,
      at: requestEvent.createdAt,
      who: user.name,
      requestId: request.id,
      requestTitle: request.title,
      outcome: request.outcome,
      fileName: file.originalName
    })
    .from(requestEvent)
    .innerJoin(request, eq(request.id, requestEvent.requestId))
    .innerJoin(user, eq(user.id, requestEvent.userId))
    .leftJoin(file, eq(file.id, requestEvent.fileId))
    .where(and(
      eq(request.clientId, clientId),
      gte(requestEvent.createdAt, since),
      lt(requestEvent.createdAt, until),
      eq(user.role, 'client')
    ))
    .orderBy(desc(requestEvent.createdAt))

  const files: DigestItem[] = []
  const comments: DigestItem[] = []
  const delivered: DigestItem[] = []

  for (const r of eventRows) {
    const base = { title: r.requestTitle, at: r.at, who: r.who, key: r.requestId }
    if (r.kind === 'file') {
      files.push({ ...base, detail: r.fileName ?? r.body })
    } else if (r.kind === 'comment') {
      comments.push({ ...base, detail: r.body })
    } else if (r.kind === 'state_change' && r.toState === 'concluded') {
      /* The outcome here too. The fix landed only on her side, and his was
         throwing away a text that cannot be absent — concluding without one is
         refused in `pedido-store.ts`. */
      delivered.push({ ...base, detail: hasOutcome(r.outcome) ? r.outcome : null })
    }
    /* `answered` transitions are deliberately dropped: they fire automatically
       on the first upload or comment, so reporting them would double-count the
       very event that caused them. */
  }

  // ------------------------------------------------ asked for access
  /* With no reset email, a client who cannot get in has no self-service path.
     The sign-in screen records the attempt and it surfaces here — otherwise the
     only signal would be her remembering to message him. */
  const accessRows = await orm()
    .select({ at: auditLog.createdAt, who: user.name })
    .from(auditLog)
    .innerJoin(user, eq(user.id, auditLog.userId))
    .where(and(
      eq(auditLog.clientId, clientId),
      eq(auditLog.action, 'asked_for_access'),
      gte(auditLog.createdAt, since),
      lt(auditLog.createdAt, until)
    ))
    .orderBy(desc(auditLog.createdAt))

  const askedForAccess: DigestItem[] = accessRows.map(r => ({
    title: 'não conseguiu entrar',
    detail: 'Ela pediu um link novo. Gere um em Conta e mande.',
    at: r.at,
    who: r.who
  }))

  // ----------------------------------------------------- raised by her
  /* Nothing in this digest ever consulted the `request` table itself, because
     until now only the seed could create a row and every request was his. With
     both sides able to open one, a request she raises would otherwise reach him
     only if she also commented on it. */
  const dela = await orm()
    .select({ title: request.title, detail: request.description, at: request.createdAt })
    .from(request)
    .where(and(
      eq(request.clientId, clientId),
      eq(request.raisedBySide, 'client'),
      gte(request.createdAt, since),
      lt(request.createdAt, until)
    ))
    .orderBy(desc(request.createdAt))

  const raisedByHer: DigestItem[] = dela.map(r => ({
    title: r.title,
    detail: r.detail,
    at: r.at,
    who: c.name
  }))

  // ------------------------------------------------------------- pautas
  const [falas, movidas] = await Promise.all([
    ideaNotesSince(clientId, since, until, 'client'),
    ideasMovedSince(clientId, since, until)
  ])

  const ideaTalk: DigestItem[] = falas.map(f => ({
    title: f.title,
    detail: abertura(f.body),
    at: f.at,
    who: f.who,
    key: `idea-fala-${f.code}`
  }))

  const ideaMoved: DigestItem[] = movidas.map(m => ({
    title: m.title,
    detail: ESTADO_PAUTA[m.state] ?? m.state,
    at: m.at,
    /* The person, now that the query reads the audit log and can prove it.
       This used to name the account, because `idea.state` is one column for the
       whole team — and while the events came from a row timestamp, some of them
       had no person behind them at all. */
    who: m.who ?? c.name,
    key: `idea-estado-${m.code}`
  }))

  // ------------------------------------------------------------- stale
  const stale = await staleRequests(clientId, new Date(
    until.getTime() - DIAS_ATE_COBRAR * 24 * 60 * 60 * 1000
  ))

  const paradas: DigestItem[] = stale.map(r => {
    const dias = Math.floor((until.getTime() - r.updatedAt.getTime()) / (24 * 60 * 60 * 1000))
    return {
      title: r.title,
      detail: `há ${dias} dias`,
      at: r.updatedAt,
      who: c.name
    }
  })

  // ------------------------------------------------------ connection
  const connection = await connectionTrouble(clientId, until)

  /* Condensed BEFORE counting. The headline number and the list under it have
     to be the same thing: saying "25 novidades" above twelve lines teaches the
     reader that the number is decoration. */
  const arquivos = condensar(files)

  const total = blocked.length + done.length + arquivos.length +
    comments.length + delivered.length + askedForAccess.length +
    raisedByHer.length + paradas.length + connection.length +
    ideaTalk.length + ideaMoved.length

  return {
    clientId: c.id,
    clientName: c.name,
    since,
    until,
    blocked,
    done,
    ideaTalk,
    ideaMoved,
    /* Files are the one group that reliably repeats: one upload session is many
       events on the same request. Comments are NOT condensed — each one carries
       different words, and merging them would throw away what she wrote. */
    files: arquivos,
    comments,
    delivered,
    askedForAccess,
    raisedByHer,
    stale: paradas,
    connection,
    total
  }
}

/**
 * What SHE has to catch up on.
 *
 * Deliberately not the same list as his, and not a filtered copy of it: his
 * digest answers "what did she do", and a mirror of that would tell her what
 * she already knows. Hers answers "what changed here that I did not do".
 *
 * The asymmetry that made this necessary: the platform notified him about her
 * and never her about him. Publishing a delivery, opening a request or
 * answering one all landed silently, and she found out by opening the screen —
 * which is the same "depends on someone remembering" this product removed
 * everywhere else. Adding the connection made it sharper, because a broken
 * credential is a state only SHE can fix.
 */
export interface ClientDigest {
  /**
   * The connection, when it needs her. Its own group and not lumped with the
   * requests: they are resolved on different screens, and a single group with
   * one "resolve here" link would send her to the wrong one for most of its
   * items.
   */
  connection: DigestItem[]
  /** Requests he opened, waiting on her. */
  requests: DigestItem[]
  /** New deliveries she has not read. */
  published: DigestItem[]
  /** He answered something she was waiting on. */
  answered: DigestItem[]
  /**
   * What the OTHER person on her own team did.
   *
   * This digest was built when "the client" meant one person, so every group in
   * it is about HIM. With Bianca and her assistant both working the profile,
   * that left the two of them invisible to each other: Cris could mark three
   * chores and upload five files and Bianca's Novidades would say nothing.
   *
   * They talk outside the product, of course — and that is exactly the problem
   * this closes. Two people acting on shared state with no shared record is how
   * the same request gets answered twice and a chore gets marked done by
   * someone who did not do it.
   *
   * The reader's OWN actions are excluded, the rule every other group here
   * follows: telling someone what they just did is noise, and noise is what
   * teaches a person to stop opening the screen.
   */
  team: DigestItem[]
  /**
   * New pautas and what he wrote back on the ones they were talking about.
   *
   * Its own group and not folded into `published`: a delivery is read once, a
   * pauta is worked from, and the link at the bottom of a group has to lead to
   * the screen where its items are resolved.
   */
  ideas: DigestItem[]
  total: number
}

export async function clientDigestFor (
  clientId: number,
  since: Date,
  until: Date,
  /**
   * Who is reading, so their own actions can be left out.
   *
   * REQUIRED, and it was optional for about ten minutes. This function answers
   * "what changed here that I did not do", and that question has no meaning
   * without knowing who "I" am — a default would have to guess, and the guess
   * that fails open reports a person's own work back to them, which is exactly
   * what every other group here refuses to do. `test/digest.test.ts` caught it
   * on the first run.
   */
  readerId: number
): Promise<ClientDigest> {
  const connection: DigestItem[] = []

  // ----------------------------------------- connection that only she can fix
  /* `failing` is absent on purpose. The credential is fine and there is nothing
     for her to press — telling her would hand over worry without an action, and
     a notice she cannot act on is the one that teaches her to ignore the bell.
     That state stays on his screen, where it belongs. */
  const conexao = await orm()
    .select({ state: instagramConnection.state, lastSyncAt: instagramConnection.lastSyncAt })
    .from(instagramConnection)
    .where(and(
      eq(instagramConnection.clientId, clientId),
      inArray(instagramConnection.state, ['expired', 'revoked'])
    ))
    .limit(1)

  const quebrada = conexao[0]
  if (quebrada !== undefined) {
    connection.push({
      title: 'Seu Instagram desconectou',
      detail: quebrada.state === 'revoked'
        ? 'A conexão foi desligada. Enquanto isso, os números não atualizam.'
        : 'A autorização venceu — acontece de tempos em tempos. São dois cliques em Conta.',
      at: quebrada.lastSyncAt ?? until,
      who: 'Instagram'
    })
  }

  // ------------------------------------------------- requests waiting on her
  const abertos = await orm()
    .select({ title: request.title, at: request.createdAt, kind: request.kind })
    .from(request)
    .where(and(
      eq(request.clientId, clientId),
      /* Only what he asked of her. A request she raised herself is not news to
         her, and `dropped` is not waiting on anyone. */
      eq(request.raisedBySide, 'consultant'),
      /* `open` alone, now that the chain says whose turn it is. Once she has
         answered, the ball is his — and listing it here as "novo pedido para
         você" would ask her again for something she already sent. */
      eq(request.state, 'open'),
      gte(request.createdAt, since),
      lt(request.createdAt, until)
    ))
    .orderBy(desc(request.createdAt))

  const requests: DigestItem[] = abertos.map(r => ({
    title: r.title,
    detail: 'Novo pedido para você.',
    at: r.at,
    who: 'Rodrigo'
  }))

  // --------------------------------------------------------- new deliveries
  const entregas = await orm()
    .select({ title: delivery.title, subtitle: delivery.subtitle, at: delivery.publishedAt })
    .from(delivery)
    .where(and(
      eq(delivery.clientId, clientId),
      isNotNull(delivery.publishedAt),
      gte(delivery.publishedAt, since),
      lt(delivery.publishedAt, until)
    ))
    .orderBy(desc(delivery.publishedAt))

  const published: DigestItem[] = entregas.map(d => ({
    title: d.title,
    detail: d.subtitle,
    at: d.at ?? until,
    who: 'Rodrigo'
  }))

  // ---------------------------------------------------- his answers to her
  const respostas = await orm()
    .select({
      title: request.title,
      body: requestEvent.body,
      at: requestEvent.createdAt,
      kind: requestEvent.kind,
      toState: requestEvent.toState,
      outcome: request.outcome
    })
    .from(requestEvent)
    .innerJoin(request, eq(request.id, requestEvent.requestId))
    .innerJoin(user, eq(user.id, requestEvent.userId))
    .where(and(
      eq(request.clientId, clientId),
      /* The mirror of his rule: what she did is not news to her. */
      eq(user.role, 'consultant'),
      inArray(requestEvent.kind, ['comment', 'state_change']),
      gte(requestEvent.createdAt, since),
      lt(requestEvent.createdAt, until)
    ))
    .orderBy(desc(requestEvent.createdAt))

  const answered: DigestItem[] = []
  for (const r of respostas) {
    if (r.kind === 'comment') {
      answered.push({ title: r.title, detail: r.body, at: r.at, who: 'Rodrigo' })
    } else if (r.toState === 'concluded') {
      /* The outcome, not the word "Fechado.". Concluding now requires writing
         what came out of the request, and announcing the close while throwing
         that text away would tell her something happened and hide the only
         part she asked for. */
      answered.push({
        title: r.title,
        detail: hasOutcome(r.outcome) ? abertura(r.outcome ?? '') : 'Fechado.',
        at: r.at,
        who: 'Rodrigo'
      })
    }
  }

  // --------------------------------------------------------------- pautas
  const [novas, resposta] = await Promise.all([
    ideasPublishedSince(clientId, since, until),
    ideaNotesSince(clientId, since, until, 'consultant')
  ])

  const ideas: DigestItem[] = [
    ...novas.map(p => ({
      title: p.title,
      detail: 'Roteiro novo, com gancho e blocos.',
      at: p.at,
      who: 'Rodrigo'
    })),
    ...resposta.map(n => ({
      title: n.title,
      detail: abertura(n.body),
      at: n.at,
      who: n.who,
      key: `idea-${n.code}`
    }))
  ]

  // ------------------------------------------------- her own teammate
  const team = await teamActivity(clientId, since, until, readerId)

  return {
    connection,
    requests,
    published,
    answered,
    ideas,
    team,
    total: connection.length + requests.length + published.length +
      answered.length + ideas.length + team.length
  }
}

/**
 * What the other people on this client's team did.
 *
 * Three sources, because three things change shared state: marking a chore,
 * writing or uploading on a request, and moving a pauta. Each is scoped to
 * client-side users other than the reader.
 *
 * `ne(user.id, readerId)` and NOT a filter applied afterwards: pulling the
 * reader's own rows out in JavaScript would still have read them, and the
 * moment someone adds a `limit` the reader's own activity starts pushing the
 * teammate's off the list.
 */
async function teamActivity (
  clientId: number,
  since: Date,
  until: Date,
  readerId: number
): Promise<DigestItem[]> {
  const [passos, eventos, pautas] = await Promise.all([
    orm()
      .select({
        title: step.title,
        state: stepStatus.state,
        comment: stepStatus.comment,
        at: stepStatus.updatedAt,
        who: user.name
      })
      .from(stepStatus)
      .innerJoin(step, eq(step.id, stepStatus.stepId))
      .innerJoin(user, eq(user.id, stepStatus.userId))
      .where(and(
        eq(step.clientId, clientId),
        eq(user.clientId, clientId),
        ne(user.id, readerId),
        gte(stepStatus.updatedAt, since),
        lt(stepStatus.updatedAt, until)
      ))
      .orderBy(desc(stepStatus.updatedAt)),

    orm()
      .select({
        title: request.title,
        kind: requestEvent.kind,
        body: requestEvent.body,
        fileName: file.originalName,
        at: requestEvent.createdAt,
        who: user.name,
        requestId: request.id
      })
      .from(requestEvent)
      .innerJoin(request, eq(request.id, requestEvent.requestId))
      .innerJoin(user, eq(user.id, requestEvent.userId))
      .leftJoin(file, eq(file.id, requestEvent.fileId))
      .where(and(
        eq(request.clientId, clientId),
        eq(user.clientId, clientId),
        ne(user.id, readerId),
        inArray(requestEvent.kind, ['comment', 'file']),
        gte(requestEvent.createdAt, since),
        lt(requestEvent.createdAt, until)
      ))
      .orderBy(desc(requestEvent.createdAt)),

    ideaNotesSince(clientId, since, until, 'client', readerId)
  ])

  const itens: DigestItem[] = [
    ...passos.map(p => ({
      title: p.title,
      detail: p.state === 'blocked'
        ? `${p.who} marcou que travou${p.comment === null ? '' : `: ${abertura(p.comment, 90)}`}`
        : p.state === 'done'
          ? `${p.who} marcou como feito`
          : `${p.who} reabriu`,
      at: p.at,
      who: p.who
    })),
    ...eventos.map(e => ({
      title: e.title,
      detail: e.kind === 'file'
        ? `${e.who} anexou ${e.fileName ?? 'um arquivo'}`
        : `${e.who} escreveu: ${abertura(e.body ?? '', 90)}`,
      at: e.at,
      who: e.who,
      /* By the request, so an upload session of eight files collapses to one
         line instead of eight identical ones. */
      key: `equipe-${e.requestId}-${e.kind}`
    })),
    ...pautas.map(n => ({
        title: n.title,
      detail: `${n.who} comentou: ${abertura(n.body, 90)}`,
      at: n.at,
      who: n.who,
      key: `equipe-pauta-${n.code}`
    }))
  ]

  return condensar(itens).sort((a, b) => b.at.getTime() - a.at.getTime())
}

/** What each broken state means for him, in one line. */
const ESTADO: Record<string, string> = {
  expired: 'A autorização venceu. Ela precisa reconectar em Conta.',
  revoked: 'Ela desconectou a conta. Os números pararam de entrar.',
  failing: 'A coleta está falhando. A autorização segue válida — é outra coisa.'
}

/**
 * A connection that is not working, if there is one.
 *
 * Deliberately outside the time window. Everything else in this digest is
 * something that happened; this is something that is still true, and it stays
 * on the screen until it stops being true.
 */
async function connectionTrouble (clientId: number, until: Date): Promise<DigestItem[]> {
  const rows = await orm()
    .select({
      state: instagramConnection.state,
      lastSyncAt: instagramConnection.lastSyncAt,
      lastErrorAt: instagramConnection.lastErrorAt
    })
    .from(instagramConnection)
    .where(eq(instagramConnection.clientId, clientId))
    .limit(1)

  const row = rows[0]
  if (row === undefined || row.state === 'active') return []

  const detail = ESTADO[row.state] ?? 'A conexão com o Instagram não está funcionando.'

  return [{
    title: 'a conexão do Instagram parou',
    /* How stale the numbers are is the part that decides what he does today.
       Formatted, not ISO: this is read on a screen, in Brazil. */
    detail: row.lastSyncAt === null
      ? `${detail} Nenhum número chegou por ela ainda.`
      : `${detail} O último número entrou em ${shortDate(row.lastSyncAt)}.`,
    at: row.lastErrorAt ?? row.lastSyncAt ?? until,
    who: 'Instagram'
  }]
}

/**
 * Since when this user has not read the news.
 *
 * `newsSeenAt` and not `lastSeenAt`: the latter advances on every sign-in, so
 * opening the app would mark everything read without anyone having looked.
 * Never having opened the screen falls back to a week, which is long enough to
 * be useful on a first visit and short enough not to dump months of history.
 */
export async function newsSince (userId: number, fallbackDays = 7): Promise<Date> {
  const [row] = await orm()
    .select({ seenAt: user.newsSeenAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return row?.seenAt ?? new Date(Date.now() - fallbackDays * 24 * 60 * 60 * 1000)
}

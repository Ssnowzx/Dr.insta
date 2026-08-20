import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { auditLog, client, idea, ideaBeat, ideaNote, user } from '../db/schema.ts'
import { bankSize, ideaDetail, ideas, ideasMovedSince, pendingIdeaCount } from '../lib/pautas.ts'
import { ulid } from '../lib/ulid.ts'

/**
 * The pautas, against the real database.
 *
 * Two things here can only fail against MySQL, and both fail quietly:
 *
 *   · the beat and note counts are correlated subqueries. Written as JOINs they
 *     would multiply the pauta by its beats and inflate the note count by the
 *     same factor — nine copies of one row, each claiming nine notes.
 *   · every COUNT comes back as a STRING. `sql<number>` is an assertion and not
 *     a conversion, so `"0" > 0` is false while `"0"` is truthy, and a screen
 *     branching on either reads the opposite of the truth. That mismatch has
 *     already hidden one finding in this codebase.
 */

const MARK = 'pautas-test'
let clientId = 0
let outroClientId = 0
let userId = 0
let comRoteiro = 0
let noBanco = 0
let publicada = 0

const alcanca = (c: number): boolean => c === clientId

beforeAll(async () => {
  const now = new Date()

  const criarCliente = async (slug: string): Promise<number> => {
    const [row] = await orm().insert(client).values({
      publicCode: ulid(), slug, name: slug, createdAt: now, updatedAt: now
    }).$returningId()
    return row?.id ?? 0
  }

  clientId = await criarCliente(`${MARK}-a`)
  outroClientId = await criarCliente(`${MARK}-b`)

  const [u] = await orm().insert(user).values({
    publicCode: ulid(), clientId, email: `${MARK}@example.invalid`,
    name: 'Bianca', jobTitle: 'dona da conta', role: 'client',
    createdAt: now, updatedAt: now
  }).$returningId()
  userId = u?.id ?? 0

  const criar = async (
    title: string,
    state: 'proposed' | 'scheduled' | 'published',
    scheduledFor: string | null
  ): Promise<number> => {
    const [row] = await orm().insert(idea).values({
      publicCode: ulid(), clientId, title, hook: `gancho de ${title}`,
      state, scheduledFor, createdAt: now, updatedAt: now
    }).$returningId()
    return row?.id ?? 0
  }

  comRoteiro = await criar('Pauta com roteiro', 'scheduled', '2026-08-20')
  noBanco = await criar('Pauta no banco', 'proposed', null)
  publicada = await criar('Pauta publicada', 'published', '2026-08-10')

  /* Three beats and two notes on the SAME pauta. This is the shape a JOIN gets
     wrong: 3 × 2 = 6 rows, one pauta reported six times. */
  for (const [i, fala] of ['primeiro', 'segundo', 'terceiro'].entries()) {
    await orm().insert(ideaBeat).values({
      ideaId: comRoteiro, position: i + 1, timeLabel: `${i * 10}s`, says: fala
    })
  }
  for (const corpo of ['ficou longo', 'refiz e melhorou']) {
    await orm().insert(ideaNote).values({
      ideaId: comRoteiro, userId, body: corpo, createdAt: now
    })
  }
})

afterAll(async () => {
  await orm().delete(auditLog).where(eq(auditLog.clientId, clientId))
  for (const id of [comRoteiro, noBanco, publicada]) {
    await orm().delete(ideaNote).where(eq(ideaNote.ideaId, id))
    await orm().delete(ideaBeat).where(eq(ideaBeat.ideaId, id))
    await orm().delete(idea).where(eq(idea.id, id))
  }
  await orm().delete(user).where(eq(user.id, userId))
  await orm().delete(client).where(eq(client.id, clientId))
  await orm().delete(client).where(eq(client.id, outroClientId))
  await db().end()
})

describe('ideas', () => {
  it('should return one row per pauta however many beats it has', async () => {
    // ARRANGE — three beats and two notes on one pauta is 3 × 2 = 6 rows for a
    // JOIN, and one for a subquery
    // ACT
    const lista = await ideas(clientId)

    // ASSERT
    expect(lista.filter(p => p.id === comRoteiro)).toHaveLength(1)
    expect(lista).toHaveLength(3)
  })

  it('should count beats and notes as numbers, not as strings', async () => {
    // ARRANGE — MySQL hands COUNT back as a string and `sql<number>` does not
    // convert. The screen branches on `beats === 0`, which "0" fails.
    // ACT
    const pauta = (await ideas(clientId)).find(p => p.id === comRoteiro)

    // ASSERT
    expect(pauta?.beats).toBe(3)
    expect(pauta?.notes).toBe(2)
    expect(typeof pauta?.beats).toBe('number')
  })

  it('should report zero beats for a pauta with no script', async () => {
    // ARRANGE — the bank is exactly this, and the card says "pauta sem roteiro
    // ainda" rather than pretending it is ready to film
    // ACT
    const pauta = (await ideas(clientId)).find(p => p.id === noBanco)

    // ASSERT
    expect(pauta?.beats).toBe(0)
    expect(pauta?.notes).toBe(0)
  })

  it('should put the undated pauta last', async () => {
    // ARRANGE — MySQL sorts NULL first ascending, so a plain ORDER BY would open
    // the screen with the bank. The bank is the overflow, not the headline.
    // ACT
    const lista = await ideas(clientId)

    // ASSERT
    expect(lista[lista.length - 1]?.id).toBe(noBanco)
  })

  it('should not reach another client', async () => {
    // ARRANGE / ACT / ASSERT — every domain query here filters by client
    expect(await ideas(outroClientId)).toEqual([])
  })
})

describe('ideaDetail', () => {
  it('should return the script in position order with the conversation', async () => {
    // ARRANGE
    const lista = await ideas(clientId)
    const code = lista.find(p => p.id === comRoteiro)?.publicCode ?? ''

    // ACT
    const detalhe = await ideaDetail(code, alcanca)

    // ASSERT
    expect(detalhe?.script.map(b => b.says)).toEqual(['primeiro', 'segundo', 'terceiro'])
    expect(detalhe?.conversa.map(n => n.body)).toEqual(['ficou longo', 'refiz e melhorou'])
  })

  it('should mark a note written by the client side as hers', async () => {
    // ARRANGE — the screen tells the two voices apart, and `user.client_id` is
    // the only thing that distinguishes them
    const code = (await ideas(clientId)).find(p => p.id === comRoteiro)?.publicCode ?? ''

    // ACT
    const detalhe = await ideaDetail(code, alcanca)

    // ASSERT
    expect(detalhe?.conversa[0]?.fromClient).toBe(true)
    expect(detalhe?.conversa[0]?.userName).toBe('Bianca')
  })

  it('should answer null for an unreachable pauta', async () => {
    // ARRANGE — absent and out-of-scope must be indistinguishable, or the URL
    // becomes a way to test whether a pauta exists
    const code = (await ideas(clientId)).find(p => p.id === comRoteiro)?.publicCode ?? ''

    // ACT / ASSERT
    expect(await ideaDetail(code, () => false)).toBeNull()
    expect(await ideaDetail('NAO-EXISTE', alcanca)).toBeNull()
  })
})

describe('pendingIdeaCount', () => {
  it('should leave out what is already published', async () => {
    // ARRANGE — a badge that counted published pautas would never reach zero,
    // and a number that never drops is a number nobody reads
    // ACT / ASSERT
    expect(await pendingIdeaCount(clientId)).toBe(2)
  })
})

describe('bankSize', () => {
  it('should count only the undated ones', async () => {
    // ARRANGE / ACT / ASSERT
    expect(await bankSize(clientId)).toBe(1)
  })
})

/**
 * The digest reports what a person did — and used to report the seed run.
 *
 * `ideasMovedSince` read `idea.updatedAt`, and `db/seed.ts` upserts every pauta
 * with `updatedAt: now`. Every re-seed manufactured one "entrou na fila" per
 * scheduled pauta, under her name, at that minute. The events were
 * indistinguishable from real ones, in the exact screen we read to find out
 * whether anyone is using the product.
 */
describe('ideasMovedSince', () => {
  const janela = (): { since: Date; until: Date } => {
    const agora = new Date()
    return {
      since: new Date(agora.getTime() - 60 * 60 * 1000),
      until: new Date(agora.getTime() + 60 * 60 * 1000)
    }
  }

  it('should not report a pauta whose row was only touched', async () => {
    // ARRANGE — exactly what a re-seed does: bump the timestamp, audit nothing
    await orm().update(idea).set({ updatedAt: new Date() }).where(eq(idea.id, comRoteiro))
    const { since, until } = janela()

    // ACT
    const movidas = await ideasMovedSince(clientId, since, until)

    // ASSERT
    expect(movidas).toEqual([])
  })

  it('should report a transition a person performed, and name that person', async () => {
    // ARRANGE
    await orm().insert(auditLog).values({
      clientId, userId, action: 'idea_recorded', entity: 'idea', entityId: comRoteiro,
      createdAt: new Date()
    })
    const { since, until } = janela()

    // ACT
    const movidas = await ideasMovedSince(clientId, since, until)

    // ASSERT
    expect(movidas).toHaveLength(1)
    expect(movidas[0]?.state).toBe('recorded')
    expect(movidas[0]?.title).toBe('Pauta com roteiro')
    expect(movidas[0]?.who).toBe('Bianca')
  })

  it('should drop an audited action it has no word for', async () => {
    // ARRANGE — a state added later must vanish, not print its column name
    await orm().insert(auditLog).values({
      clientId, userId, action: 'idea_arquivada', entity: 'idea', entityId: noBanco,
      createdAt: new Date()
    })
    const { since, until } = janela()

    // ACT
    const movidas = await ideasMovedSince(clientId, since, until)

    // ASSERT — still only the recorded one from the test above
    expect(movidas.map(m => m.title)).toEqual(['Pauta com roteiro'])
  })
})

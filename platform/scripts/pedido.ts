import { eq } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db, waitForDatabase } from '../db/connection.ts'
import { client, request, user } from '../db/schema.ts'
import {
  createRequest, findRequest, moveRequest
} from '../lib/pedido-store.ts'
import type { Actor } from '../lib/pedido-store.ts'
import { turnOf } from '../lib/pedido.ts'
import type { RequestState } from '../lib/pedido.ts'

/**
 * Opening, moving and concluding requests from the terminal.
 *
 * This exists because of who writes. The consultant does not compose the asks,
 * the reasons or the outcomes — the assistant does, and then he reviews them on
 * screen. A product where the only way in is a form is a product where that
 * text has to be retyped by hand into a textarea, which is how it stops
 * happening.
 *
 * It goes through `lib/pedido-store.ts`, the same module the screen uses, so
 * the rules are not duplicated: concluding still needs an outcome, every move
 * still writes an event with an author, and a request closed here is
 * indistinguishable in the history from one closed on screen. That last part is
 * on purpose — the authorship that matters is the consultant's, not the
 * keyboard's.
 *
 * Usage:
 *   npm run pedido -- --listar
 *   npm run pedido -- --abrir --titulo "..." [--descricao "..."]
 *   npm run pedido -- --analisar <codigo>
 *   npm run pedido -- --concluir <codigo> --desfecho "..."
 *   npm run pedido -- --buscar "parte do titulo" --desfecho "..."   # conclui
 *   npm run pedido -- --dispensar <codigo> [--desfecho "..."]
 *
 * The e-mail of the acting consultant comes from --como or CONSULTANT_EMAIL.
 */

function arg (flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1) return undefined
  const value = process.argv[i + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

function has (flag: string): boolean {
  return process.argv.includes(flag)
}

function fail (message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

const ROTULO: Record<RequestState, string> = {
  open: 'em aberto',
  answered: 'respondido',
  analyzing: 'em análise',
  concluded: 'concluído',
  dropped: 'dispensado'
}

async function consultor (): Promise<Actor & { clientId: number }> {
  const email = arg('--como') ?? process.env.CONSULTANT_EMAIL

  const rows = await orm()
    .select({ id: user.id, role: user.role, name: user.name })
    .from(user)
    .where(email === undefined ? eq(user.role, 'consultant') : eq(user.email, email))
    .limit(2)

  if (rows.length === 0) fail('Não achei esse consultor. Passe --como <email>.')
  if (rows.length > 1) {
    fail('Há mais de um consultor. Diga qual com --como <email>.')
  }

  const found = rows[0]
  if (found === undefined || found.role !== 'consultant') {
    fail('Essa conta não é de consultor.')
  }

  /* One client per instance, by design — `clientScope()` on the web side makes
     the same assumption. Reading it rather than taking a flag keeps the script
     from being able to write into the wrong account. */
  const [c] = await orm().select({ id: client.id }).from(client).limit(1)
  if (c === undefined) fail('Não há cliente nesta instância.')

  return { userId: found.id, role: 'consultant', clientId: c.id }
}

async function listar (clientId: number): Promise<void> {
  const rows = await orm()
    .select({
      publicCode: request.publicCode,
      title: request.title,
      state: request.state,
      raisedBySide: request.raisedBySide,
      updatedAt: request.updatedAt
    })
    .from(request)
    .where(eq(request.clientId, clientId))
    .orderBy(request.updatedAt)

  if (rows.length === 0) {
    console.log('\nNenhum pedido.\n')
    return
  }

  console.log('')
  for (const r of rows) {
    const vez = turnOf(r.state, r.raisedBySide)
    const dono = vez === null ? '—' : vez === 'consultant' ? 'comigo' : 'com ela'
    const dias = Math.floor((Date.now() - r.updatedAt.getTime()) / 86_400_000)
    console.log(
      `${r.publicCode}  ${ROTULO[r.state].padEnd(11)} ${dono.padEnd(8)} ${String(dias).padStart(3)}d  ${r.title}`
    )
  }
  console.log('')
}

async function main (): Promise<void> {
  await waitForDatabase()

  const eu = await consultor()

  if (has('--listar')) {
    await listar(eu.clientId)
    return
  }

  if (has('--abrir')) {
    const titulo = arg('--titulo')
    if (titulo === undefined) fail('Falta --titulo.')

    const r = await createRequest(eu.clientId, eu, titulo, arg('--descricao'))
    if (!r.ok) fail(r.error ?? 'Não consegui abrir.')

    console.log(`\nAberto: ${r.publicCode}\n${titulo}\n`)
    return
  }

  /* Matching by title, because the code is a ULID and nobody types one. The
     match must be unique: two hits stop rather than guess, since concluding the
     wrong request writes an answer under a question it does not answer. */
  const porTitulo = arg('--buscar')
  if (porTitulo !== undefined) {
    const rows = await orm()
      .select({ publicCode: request.publicCode, title: request.title })
      .from(request)
      .where(eq(request.clientId, eu.clientId))

    const achados = rows.filter(r =>
      r.title.toLowerCase().includes(porTitulo.toLowerCase())
    )

    if (achados.length === 0) fail(`Nenhum pedido com "${porTitulo}" no título.`)
    if (achados.length > 1) {
      fail(
        `"${porTitulo}" casa com ${achados.length} pedidos:\n` +
        achados.map(a => `  ${a.publicCode}  ${a.title}`).join('\n')
      )
    }

    const alvo = achados[0]
    if (alvo !== undefined) process.argv.push('--concluir', alvo.publicCode)
  }

  const alvos: Array<[string, RequestState]> = [
    ['--analisar', 'analyzing'],
    ['--concluir', 'concluded'],
    ['--dispensar', 'dropped'],
    ['--reabrir', 'open']
  ]

  for (const [flag, state] of alvos) {
    const codigo = arg(flag)
    if (codigo === undefined) continue

    const target = await findRequest(codigo)
    if (target === null) fail(`Não achei o pedido ${codigo}.`)

    const r = await moveRequest(target, state, eu, arg('--desfecho'))
    if (!r.ok) fail(r.error ?? 'Não consegui mover.')

    console.log(`\n${codigo} → ${ROTULO[state]}\n`)
    return
  }

  fail('Nada a fazer. Veja o cabeçalho do arquivo para o uso.')
}

main()
  .then(async () => { await db().end() })
  .catch(async (e: unknown) => {
    console.error(e)
    await db().end()
    process.exit(1)
  })

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { auditLog, file, request as requestTable, requestEvent } from '@/db/schema'
import { requireSession } from '@/lib/dal'
import { canReach } from '@/lib/scope'
import {
  ACCEPTED_LABEL, buildPath, decodeName, isAccepted, MAX_BYTES, storeStream
} from '@/lib/files'
import { ulid } from '@/lib/ulid'

/**
 * Receives an upload, streaming it to disk.
 *
 * A Route Handler and not a Server Action: action requests are capped at 1 MB
 * by default and her Insights exports reach 7 MB.
 *
 * The body is raw bytes rather than multipart, and the metadata rides in
 * headers. That removes a multipart parser from the path — and a parser is a
 * lot of surface for the sake of carrying two strings.
 *
 * Usage:
 *   POST /api/arquivo?pedido=<public_code>
 *   content-type: <mime>
 *   x-nome-arquivo: <encodeURIComponent(name)>
 *   body: the bytes
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function fail (message: string, status: number): NextResponse {
  return NextResponse.json({ erro: message }, { status, headers: { 'cache-control': 'no-store' } })
}

export async function POST (req: NextRequest): Promise<NextResponse> {
  const identity = await requireSession()

  const mime = (req.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
  if (!isAccepted(mime)) {
    return fail(`Esse tipo de arquivo eu não recebo. Mande ${ACCEPTED_LABEL}.`, 415)
  }

  const publicCode = req.nextUrl.searchParams.get('pedido')
  if (publicCode === null || publicCode === '') {
    return fail('Pedido não informado.', 400)
  }

  /* Resolve the request from its public code and read ITS client, rather than
     trusting a client id from the caller. */
  const rows = await orm()
    .select({ id: requestTable.id, clientId: requestTable.clientId, state: requestTable.state })
    .from(requestTable)
    .where(eq(requestTable.publicCode, publicCode))
    .limit(1)

  const target = rows[0]

  /* Absent and out-of-scope answer identically. A distinct 403 would confirm the
     request exists, and a public code is guessable enough to probe with. */
  if (target === undefined || !canReach(identity, target.clientId)) {
    return fail('Esse pedido não está mais aqui.', 404)
  }

  if (req.body === null) return fail('Nada foi enviado.', 400)

  /* Content-Length is a claim, so it only buys us an early rejection. The real
     limit is enforced against the bytes seen while streaming. */
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) {
    return fail(`Arquivo maior que ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`, 413)
  }

  const originalName = decodeName(req.headers.get('x-nome-arquivo'))
  const now = new Date()
  const relativePath = buildPath(target.clientId, mime, now)

  let stored
  try {
    stored = await storeStream(req.body, relativePath)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Falha ao gravar.'
    return fail(reason, reason.includes('maior que') ? 413 : 500)
  }

  const publicFileCode = ulid(now.getTime())

  const [inserted] = await orm().insert(file).values({
    publicCode: publicFileCode,
    clientId: target.clientId,
    requestId: target.id,
    originalName,
    path: stored.relativePath,
    mime,
    bytes: stored.bytes,
    sha256: stored.sha256,
    uploadedBy: identity.userId,
    createdAt: now
  }).$returningId()

  const fileId = inserted?.id

  await orm().insert(requestEvent).values({
    requestId: target.id,
    userId: identity.userId,
    kind: 'file',
    body: originalName,
    createdAt: now,
    ...(fileId === undefined ? {} : { fileId })
  })

  /* An open request moves to in_progress on its first file. Marking it
     `delivered` automatically would decide on her behalf that this was
     everything I asked for. */
  if (target.state === 'open') {
    await orm()
      .update(requestTable)
      .set({ state: 'in_progress', updatedAt: now })
      .where(and(eq(requestTable.id, target.id), eq(requestTable.state, 'open')))

    await orm().insert(requestEvent).values({
      requestId: target.id,
      userId: identity.userId,
      kind: 'state_change',
      fromState: 'open',
      toState: 'in_progress',
      createdAt: now
    })
  }

  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  await orm().insert(auditLog).values({
    action: 'uploaded_file',
    entity: 'file',
    userId: identity.userId,
    clientId: target.clientId,
    createdAt: now,
    ...(fileId === undefined ? {} : { entityId: fileId }),
    ...(forwarded === undefined || forwarded === '' ? {} : { ip: forwarded })
  })

  return NextResponse.json(
    { codigo: publicFileCode, nome: originalName, bytes: stored.bytes },
    { headers: { 'cache-control': 'no-store' } }
  )
}

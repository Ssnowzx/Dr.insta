import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { orm } from '@/db/client'
import { auditLog, file } from '@/db/schema'
import { requireSession } from '@/lib/dal'
import { canReach } from '@/lib/scope'
import { absolutePath, sizeOnDisk } from '@/lib/files'

/**
 * Serves one stored file, after checking the session and the client scope.
 *
 * Nothing under the storage root is served statically. An Nginx `alias` over
 * that folder would put the client's revenue and demographics on a guessable
 * URL — every byte leaves through here, or not at all.
 */
export const dynamic = 'force-dynamic'

export async function GET (
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
): Promise<NextResponse> {
  const identity = await requireSession()
  const { codigo } = await params

  const rows = await orm()
    .select({
      id: file.id,
      clientId: file.clientId,
      path: file.path,
      mime: file.mime,
      bytes: file.bytes,
      originalName: file.originalName
    })
    .from(file)
    .where(eq(file.publicCode, codigo))
    .limit(1)

  const found = rows[0]

  /* Not-found and not-yours are the same answer. A 403 here would confirm the
     file exists, and confirming existence is how someone maps what a
     consultancy holds. */
  if (found === undefined || !canReach(identity, found.clientId)) {
    return NextResponse.json({ erro: 'Arquivo não encontrado.' }, { status: 404 })
  }

  const onDisk = await sizeOnDisk(found.path)
  if (onDisk === null) {
    /* The row exists and the bytes do not. Saying so plainly beats a broken
       download that looks like a network problem. */
    return NextResponse.json(
      { erro: 'O arquivo está registrado mas não está no disco. Me avise.' },
      { status: 410 }
    )
  }

  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  await orm().insert(auditLog).values({
    action: 'downloaded_file',
    entity: 'file',
    entityId: found.id,
    userId: identity.userId,
    clientId: found.clientId,
    createdAt: new Date(),
    ...(forwarded === undefined || forwarded === '' ? {} : { ip: forwarded })
  })

  const stream = Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ absolutePath(found.path)))

  /* `attachment` and not `inline`: an uploaded HTML or SVG rendered in this
     origin would run with the session cookie in scope. Downloading it cannot.
     The filename goes out RFC 5987-encoded so accents survive. */
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'content-type': found.mime,
      'content-length': String(onDisk),
      'content-disposition':
        `attachment; filename*=UTF-8''${encodeURIComponent(found.originalName)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff'
    }
  })
}

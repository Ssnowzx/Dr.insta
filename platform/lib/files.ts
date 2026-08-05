import 'server-only'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { ulid } from './ulid.ts'

/**
 * File storage on the VPS disk.
 *
 * The bytes live on disk; the identity lives in the database. Nothing here is
 * served statically — an Nginx `alias` over this folder would put the client's
 * revenue and demographics on a guessable URL.
 *
 * Uploads go through a Route Handler and never through a Server Action: action
 * requests are capped at 1 MB by default, and her Insights screenshots reach
 * 7 MB. That cap is the reason this file exists at all.
 */

/** 64 MB, matching `client_max_body_size` in the Nginx block. */
export const MAX_BYTES = 64 * 1024 * 1024

/**
 * Accepted types, and the extension each one gets.
 *
 * The extension comes from the declared type, never from the uploaded
 * filename — `relatorio.csv.html` must not become an .html file on a disk that
 * some future misconfiguration decides to serve.
 */
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/plain': 'txt',
  'application/pdf': 'pdf',
  'application/json': 'json',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
}

export function isAccepted (mime: string): boolean {
  return Object.hasOwn(TYPES, mime.toLowerCase().split(';')[0]?.trim() ?? '')
}

export function extensionFor (mime: string): string {
  return TYPES[mime.toLowerCase().split(';')[0]?.trim() ?? ''] ?? 'bin'
}

/** Human list for the error message, so "type not accepted" says which are. */
export const ACCEPTED_LABEL = 'planilha, CSV, PDF, imagem ou texto'

/**
 * The storage root, from the environment.
 *
 * `turbopackIgnore` on the resolve: the bundler's static analysis sees a path
 * built from a runtime value and concludes it must trace the entire project
 * into the standalone output — every source file and the whole public folder.
 * The path is genuinely dynamic (it is an operator's choice, and later a
 * database column), and `absolutePath` re-checks that nothing escapes the root.
 */
export function storageRoot (): string {
  const root = process.env.FILES_ROOT
  if (root === undefined || root.trim() === '') {
    throw new Error('FILES_ROOT is not set. See .env.exemplo.')
  }

  /* Absolute only. A relative path resolves against the process working
     directory, and the standalone server runs from `.next/standalone` — so
     `./arquivos` silently stores uploads inside the build output, which the
     next `npm run build` deletes along with every file a client sent. Found by
     uploading a file and going looking for it. */
  if (!isAbsolute(root)) {
    throw new Error(
      `FILES_ROOT must be an absolute path; got "${root}". A relative one lands ` +
      'inside the build output and is deleted on the next build.'
    )
  }

  return resolve(/*turbopackIgnore: true*/ root)
}

/**
 * Where a file goes. Generated entirely by the server.
 *
 * Partitioned by client and month so one directory never accumulates every file
 * ever uploaded — and so a client's files can be moved or archived as a unit.
 */
export function buildPath (clientId: number, mime: string, now = new Date()): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  /* `turbopackIgnore` even though this join never touches the disk — it only
     builds a relative string. The analyser cannot tell the difference, and
     without the marker it traces every source file into the standalone output. */
  return join(
    /*turbopackIgnore: true*/ String(clientId),
    String(year), month, `${ulid(now.getTime())}.${extensionFor(mime)}`
  )
}

export interface StoredFile {
  relativePath: string
  bytes: number
  sha256: string
}

/**
 * Streams a request body to disk, hashing as it goes.
 *
 * Written to a `.parcial` name and renamed on success, so an interrupted upload
 * never leaves a file that looks complete. The rename is atomic within a
 * filesystem, which is why the temporary sits beside the target rather than in
 * a system temp directory.
 *
 * The size limit is enforced against the bytes actually seen, not against
 * `Content-Length` — a header is a claim, and a client that lies about it would
 * otherwise fill the disk.
 */
export async function storeStream (
  body: ReadableStream<Uint8Array>,
  relativePath: string,
  maxBytes = MAX_BYTES
): Promise<StoredFile> {
  const target = join(/*turbopackIgnore: true*/ storageRoot(), relativePath)
  const temporary = `${target}.parcial`

  await mkdir(/*turbopackIgnore: true*/ dirname(target), { recursive: true })

  const hash = createHash('sha256')
  let bytes = 0
  let tooBig = false

  const counting = async function * (source: AsyncIterable<Uint8Array>) {
    for await (const chunk of source) {
      bytes += chunk.byteLength
      if (bytes > maxBytes) {
        tooBig = true
        /* Stop reading instead of consuming the rest to discover a size we
           already know is over the limit. */
        throw new Error('LIMITE')
      }
      hash.update(chunk)
      yield chunk
    }
  }

  try {
    await pipeline(
      Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]),
      counting,
      createWriteStream(/*turbopackIgnore: true*/ temporary)
    )
  } catch (error) {
    await unlink(/*turbopackIgnore: true*/ temporary).catch(() => undefined)
    if (tooBig) throw new Error(`Arquivo maior que ${Math.round(maxBytes / 1024 / 1024)} MB.`)
    throw error
  }

  if (bytes === 0) {
    await unlink(/*turbopackIgnore: true*/ temporary).catch(() => undefined)
    throw new Error('Arquivo vazio.')
  }

  await rename(/*turbopackIgnore: true*/ temporary, target)

  return { relativePath, bytes, sha256: hash.digest('hex') }
}

/**
 * Resolves a stored path to an absolute one, refusing anything outside the root.
 *
 * The path comes from our own database, so this should never trigger — which is
 * exactly why it is here. A traversal that only becomes possible after some
 * future bug is still a traversal, and this check costs nothing.
 */
export function absolutePath (relativePath: string): string {
  const root = storageRoot()
  const full = resolve(/*turbopackIgnore: true*/ root, relativePath)
  if (full !== root && !full.startsWith(root + '/')) {
    throw new Error('Caminho fora da raiz de armazenamento.')
  }
  return full
}

export async function sizeOnDisk (relativePath: string): Promise<number | null> {
  try {
    return (await stat(/*turbopackIgnore: true*/ absolutePath(relativePath))).size
  } catch {
    return null
  }
}

/**
 * Decodes the filename the browser sent.
 *
 * It travels percent-encoded in a header because headers are latin-1 and her
 * filenames carry accents. Kept as a display label only — it never touches the
 * filesystem.
 */
export function decodeName (raw: string | null): string {
  if (raw === null || raw.trim() === '') return 'arquivo'
  try {
    return decodeURIComponent(raw).split(/[\\/]/).pop()?.slice(0, 255) ?? 'arquivo'
  } catch {
    return raw.slice(0, 255)
  }
}

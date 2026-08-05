import { createHash, randomBytes } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  absolutePath, buildPath, decodeName, extensionFor, isAccepted, storeStream
} from '../lib/files.ts'

/**
 * File storage, against a real temporary directory.
 *
 * The hashing and the size limit are the parts that fail silently: a wrong hash
 * still produces a downloadable file, and a limit checked against
 * `Content-Length` still passes every honest client. Both are exercised with
 * actual bytes rather than mocks.
 */

let root = ''

/** A ReadableStream over the given bytes, in chunks, like a real upload. */
function streamOf (data: Buffer, chunkSize = 64 * 1024): ReadableStream<Uint8Array> {
  let offset = 0
  return new ReadableStream({
    pull (controller) {
      if (offset >= data.length) { controller.close(); return }
      controller.enqueue(new Uint8Array(data.subarray(offset, offset + chunkSize)))
      offset += chunkSize
    }
  })
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'myfavorite-files-'))
  process.env.FILES_ROOT = root
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('accepted types', () => {
  it('should accept the formats her exports actually come in', () => {
    // ARRANGE / ACT / ASSERT
    expect(isAccepted('text/csv')).toBe(true)
    expect(isAccepted('application/pdf')).toBe(true)
    expect(isAccepted('image/png')).toBe(true)
    expect(isAccepted(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )).toBe(true)
  })

  it('should accept a type carrying a charset parameter', () => {
    // ARRANGE — browsers send `text/csv;charset=utf-8`, and rejecting that
    // would refuse the exact file this whole feature exists for
    expect(isAccepted('text/csv;charset=utf-8')).toBe(true)
  })

  it('should refuse a type that could execute in our origin', () => {
    // ARRANGE / ACT / ASSERT
    expect(isAccepted('text/html')).toBe(false)
    expect(isAccepted('image/svg+xml')).toBe(false)
    expect(isAccepted('application/x-sh')).toBe(false)
  })

  it('should take the extension from the declared type, never from the name', () => {
    // ARRANGE / ACT / ASSERT — `relatorio.csv.html` must not land as .html
    expect(extensionFor('text/csv')).toBe('csv')
    expect(extensionFor('text/html')).toBe('bin')
  })
})

describe('buildPath', () => {
  it('should partition by client and month', () => {
    // ARRANGE
    const when = new Date('2026-08-05T12:00:00Z')

    // ACT
    const path = buildPath(7, 'text/csv', when)

    // ASSERT
    expect(path.startsWith('7/2026/08/')).toBe(true)
    expect(path.endsWith('.csv')).toBe(true)
  })

  it('should never repeat a path for the same client and instant', () => {
    // ARRANGE
    const when = new Date('2026-08-05T12:00:00Z')

    // ACT
    const paths = new Set(Array.from({ length: 200 }, () => buildPath(1, 'application/pdf', when)))

    // ASSERT — two uploads in the same millisecond must not overwrite each other
    expect(paths.size).toBe(200)
  })
})

describe('storeStream', () => {
  it('should write the bytes and return their sha256', async () => {
    // ARRANGE
    const data = randomBytes(200 * 1024)
    const expected = createHash('sha256').update(data).digest('hex')
    const path = buildPath(1, 'application/pdf')

    // ACT
    const stored = await storeStream(streamOf(data), path)

    // ASSERT
    expect(stored.bytes).toBe(data.length)
    expect(stored.sha256).toBe(expected)
    expect(await readFile(absolutePath(path))).toEqual(data)
  })

  it('should handle a 7 MB file, which is the size her Insights exports reach', async () => {
    // ARRANGE — the size that motivated a Route Handler instead of a Server
    // Action, whose default cap is 1 MB
    const data = randomBytes(7 * 1024 * 1024)
    const path = buildPath(1, 'text/csv')

    // ACT
    const stored = await storeStream(streamOf(data), path)

    // ASSERT
    expect(stored.bytes).toBe(7 * 1024 * 1024)
    expect((await stat(absolutePath(path))).size).toBe(7 * 1024 * 1024)
  })

  it('should refuse a file over the limit and leave nothing behind', async () => {
    // ARRANGE
    const data = randomBytes(300 * 1024)
    const path = buildPath(2, 'text/csv')

    // ACT / ASSERT — the limit is enforced against bytes seen, not against a
    // Content-Length header, which is a claim
    await expect(storeStream(streamOf(data), path, 100 * 1024)).rejects.toThrow(/maior que/)

    // ASSERT — no leftovers: neither the target nor the .parcial
    const dir = absolutePath(path).replace(/\/[^/]+$/, '')
    const left = await readdir(dir).catch(() => [])
    expect(left.filter(f => f.includes('parcial'))).toEqual([])
  })

  it('should refuse an empty file', async () => {
    // ARRANGE — an empty upload is almost always a picker that returned nothing
    const path = buildPath(3, 'text/csv')

    // ACT / ASSERT
    await expect(storeStream(streamOf(Buffer.alloc(0)), path)).rejects.toThrow(/vazio/)
  })

  it('should give the same hash to the same content, so a re-upload is detectable', async () => {
    // ARRANGE
    const data = randomBytes(50 * 1024)

    // ACT
    const a = await storeStream(streamOf(data), buildPath(4, 'text/csv'))
    const b = await storeStream(streamOf(data), buildPath(4, 'text/csv'))

    // ASSERT
    expect(a.sha256).toBe(b.sha256)
    expect(a.relativePath).not.toBe(b.relativePath)
  })
})

describe('absolutePath', () => {
  it('should resolve a stored path inside the root', () => {
    // ARRANGE / ACT / ASSERT
    expect(absolutePath('1/2026/08/abc.csv').startsWith(root)).toBe(true)
  })

  it('should refuse a path that climbs out of the root', () => {
    // ARRANGE — the path comes from our own database, so this should never
    // fire; it is here because a traversal that only becomes reachable after a
    // future bug is still a traversal
    // ACT / ASSERT
    expect(() => absolutePath('../../etc/passwd')).toThrow(/fora da raiz/)
    expect(() => absolutePath('/etc/passwd')).toThrow(/fora da raiz/)
  })
})

describe('decodeName', () => {
  it('should decode an accented name sent percent-encoded', () => {
    // ARRANGE — headers are latin-1, so the browser sends it encoded
    // ACT / ASSERT
    expect(decodeName(encodeURIComponent('relatório de julho.csv')))
      .toBe('relatório de julho.csv')
  })

  it('should drop any directory part', () => {
    // ARRANGE / ACT / ASSERT — the name is a label, never a path
    expect(decodeName(encodeURIComponent('../../etc/passwd'))).toBe('passwd')
    expect(decodeName(encodeURIComponent('C:\\Users\\bia\\dados.csv'))).toBe('dados.csv')
  })

  it('should survive a malformed encoding instead of throwing', () => {
    // ARRANGE — a truncated percent escape must not 500 the upload
    // ACT / ASSERT
    expect(decodeName('%E0%A4%A')).toBe('%E0%A4%A')
  })

  it('should fall back when no name arrives', () => {
    // ARRANGE / ACT / ASSERT
    expect(decodeName(null)).toBe('arquivo')
    expect(decodeName('  ')).toBe('arquivo')
  })
})

describe('storageRoot', () => {
  it('should refuse a relative root', async () => {
    // ARRANGE — the standalone server runs from `.next/standalone`, so a
    // relative root stores uploads inside the build output and the next build
    // deletes them. Found by uploading a file and going looking for it.
    const { storageRoot } = await import('../lib/files.ts')
    const before = process.env.FILES_ROOT
    process.env.FILES_ROOT = './arquivos'

    // ACT / ASSERT
    expect(() => storageRoot()).toThrow(/absolute path/)
    process.env.FILES_ROOT = before
  })

  it('should refuse an empty root', async () => {
    // ARRANGE
    const { storageRoot } = await import('../lib/files.ts')
    const before = process.env.FILES_ROOT
    process.env.FILES_ROOT = ''

    // ACT / ASSERT
    expect(() => storageRoot()).toThrow(/not set/)
    process.env.FILES_ROOT = before
  })
})

import { describe, expect, it } from 'vitest'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { orm } from '../db/client.ts'
import { db } from '../db/connection.ts'
import { post } from '../db/schema.ts'
import { num, parseCsv } from '../lib/csv.ts'

/**
 * The CSV reader, and the one invariant the importer must never break.
 *
 * That invariant: a post whose provenance is `public` has no `reach`.
 *
 * The public export carries `views`, and a view counts every loop of the video.
 * Reach is a different measurement that only Insights has. Every rate in this
 * project is normalised by reach, so a `reach` copied from `views` would not be
 * slightly wrong — it would be a wrong denominator for every rate computed
 * afterwards, and nothing downstream would look broken.
 */

describe('parseCsv', () => {
  it('should keep a quoted field containing commas in one piece', () => {
    // ARRANGE — her captions are full of commas; a split(',') would shred them
    // and the row count would still look right
    const csv = 'id,legenda\nABC,"top 5 tendências, e a favorita de vcs?"\n'

    // ACT
    const rows = parseCsv(csv)

    // ASSERT
    expect(rows).toHaveLength(1)
    expect(rows[0]?.legenda).toBe('top 5 tendências, e a favorita de vcs?')
  })

  it('should read a doubled quote as one quote', () => {
    // ARRANGE
    const csv = 'id,legenda\nABC,"ela disse ""oxi"" e foi embora"\n'

    // ACT / ASSERT
    expect(parseCsv(csv)[0]?.legenda).toBe('ela disse "oxi" e foi embora')
  })

  it('should keep a newline inside a quoted field', () => {
    // ARRANGE — a caption with a line break must not become two rows
    const csv = 'id,legenda\nABC,"primeira linha\nsegunda linha"\n'

    // ACT
    const rows = parseCsv(csv)

    // ASSERT
    expect(rows).toHaveLength(1)
    expect(rows[0]?.legenda).toContain('\n')
  })

  it('should not emit a blank row for a trailing newline', () => {
    // ARRANGE / ACT / ASSERT
    expect(parseCsv('id,x\nA,1\nB,2\n')).toHaveLength(2)
  })

  it('should accept CRLF as well as LF', () => {
    // ARRANGE — the file may have come out of Excel on Windows
    // ACT / ASSERT
    expect(parseCsv('id,x\r\nA,1\r\nB,2\r\n')).toHaveLength(2)
  })

  it('should reach the first column even behind a BOM', () => {
    // ARRANGE — Excel writes one, and it makes the first header unreachable by
    // its own name
    const csv = '﻿id,x\nA,1\n'

    // ACT / ASSERT
    expect(parseCsv(csv)[0]?.id).toBe('A')
  })
})

describe('num', () => {
  it('should return null for an empty cell, never zero', () => {
    // ARRANGE — a missing measurement is not a measurement of zero, and the
    // difference decides whether a rate is computed at all
    // ACT / ASSERT
    expect(num('')).toBeNull()
    expect(num('  ')).toBeNull()
    expect(num(undefined)).toBeNull()
    expect(num('0')).toBe(0)
  })

  it('should read a plain integer', () => {
    // ARRANGE / ACT / ASSERT
    expect(num('152825')).toBe(152825)
  })

  it('should return null rather than NaN for text', () => {
    // ARRANGE / ACT / ASSERT
    expect(num('nao')).toBeNull()
  })
})

describe('imported posts', () => {
  it('should have no reach on any public-provenance post', async () => {
    // ARRANGE / ACT — the invariant, checked against whatever is in the
    // database rather than against a mock of the importer
    const [row] = await orm()
      .select({
        publicos: sql<string>`COUNT(*)`,
        comAlcance: sql<string>`SUM(${post.reach} IS NOT NULL)`,
        comSalvamentos: sql<string>`SUM(${post.saves} IS NOT NULL)`,
        comRetencao: sql<string>`SUM(${post.retentionPct} IS NOT NULL)`
      })
      .from(post)
      .where(eq(post.provenance, 'public'))

    // ASSERT
    expect(Number(row?.comAlcance ?? 0)).toBe(0)
    expect(Number(row?.comSalvamentos ?? 0)).toBe(0)
    expect(Number(row?.comRetencao ?? 0)).toBe(0)
  })

  it('should never carry a reach equal to its views', async () => {
    // ARRANGE / ACT — the specific mistake: copying views into reach. Checked
    // as a value comparison, so it would catch the copy even if provenance were
    // mislabelled
    const suspicious = await orm()
      .select({ id: post.id })
      .from(post)
      .where(and(isNotNull(post.reach), sql`${post.reach} = ${post.views}`))

    // ASSERT
    expect(suspicious).toEqual([])
  })

  it('should close the pool', async () => {
    // ARRANGE / ACT / ASSERT — keeps the suite from hanging on an open handle
    await db().end()
    expect(true).toBe(true)
  })
})

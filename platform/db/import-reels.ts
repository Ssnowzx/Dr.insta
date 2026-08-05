import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { orm } from './client.ts'
import { db, waitForDatabase } from './connection.ts'
import { client, metricDef, metricValue, post } from './schema.ts'
import { num, parseCsv } from '../lib/csv.ts'
import type { Row } from '../lib/csv.ts'

/**
 * Imports the public Reels export into `post`, and derives a monthly series.
 *
 * The single most important rule here: this file NEVER writes `reach`.
 *
 * The public export carries `views`, and a view counts every time the video
 * rolls — a short Reel loops, so views are not distinct people. Reach is a
 * different measurement that only Instagram Insights has. Every rate in this
 * project is normalised by reach, so a `reach` filled in from `views` would not
 * produce a slightly wrong number: it would produce a wrong denominator for
 * every rate computed afterwards, and nothing downstream would look broken.
 *
 * Everything written here is marked `provenance: 'public'` and, for the derived
 * series, `source: 'public'`. The funnel and the metric cards read only
 * `insights`, `ga4` and `store`, so these rows can never be mistaken for
 * measured ones.
 *
 * Usage: npm run db:import-reels -- <caminho.csv> [--cliente bianca-olivo]
 */

/** Columns of the public export, as exported. */
interface ReelRow extends Row {
  id: string
  data: string
  duracao_s: string
  views: string
  curtidas: string
  comentarios: string
  reposts: string
  colab: string
  publi: string
  legenda: string
}

/**
 * Whether a caption speaks about the brand.
 *
 * A deliberately narrow rule: it mentions the brand handle or the brand name.
 * The deeper findings of the Reels analysis — which posts name a garment and
 * which carry a purchase call — came from reading 203 captions, and a keyword
 * guess here would silently replace that reading with something weaker while
 * looking like the same number. Those two columns stay NULL until the real
 * classification is imported.
 */
function mentionsBrand (caption: string): boolean {
  const text = caption.toLowerCase()
  return text.includes('myfavorite') || text.includes('my favorite')
}

function firstOfMonth (isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`
}

function arg (flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1) return undefined
  const value = process.argv[i + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

async function main (): Promise<void> {
  const path = process.argv[2]
  if (path === undefined || path.startsWith('--')) {
    console.error('\nUsage: npm run db:import-reels -- <caminho.csv> [--cliente <slug>]\n')
    process.exit(1)
  }

  const slug = arg('--cliente') ?? 'bianca-olivo'

  await waitForDatabase()

  const [c] = await orm()
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.slug, slug))
    .limit(1)

  if (c === undefined) {
    console.error(`\nNo client with slug "${slug}". Run the seed first.\n`)
    process.exit(1)
  }

  const text = await readFile(resolve(path), 'utf8')
  const rows = parseCsv(text) as ReelRow[]

  if (rows.length === 0) {
    console.error('\nThe file has no rows.\n')
    process.exit(1)
  }

  const now = new Date()
  let written = 0
  let skipped = 0

  for (const row of rows) {
    const code = row.id?.trim() ?? ''
    const date = row.data?.trim() ?? ''

    /* A row without an id or a date cannot be deduplicated or placed in time.
       Counting it as skipped and saying so beats importing a row that will
       duplicate on the next run. */
    if (code === '' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; continue }

    const caption = row.legenda ?? ''
    const duration = num(row.duracao_s)

    await orm().insert(post).values({
      clientId: c.id,
      igCode: code,
      kind: 'reel',
      publishedAt: new Date(`${date}T12:00:00Z`),
      url: `https://www.instagram.com/reel/${code}/`,
      caption,
      mentionsBrand: mentionsBrand(caption) ? 1 : 0,
      /* `reach`, `saves`, `sends`, `retentionPct` and `avgWatchSec` are left
         out entirely. See the note at the top of this file. */
      provenance: 'public',
      createdAt: now,
      updatedAt: now,
      ...(duration === null ? {} : { durationSec: duration }),
      ...(num(row.views) === null ? {} : { views: num(row.views) as number }),
      ...(num(row.curtidas) === null ? {} : { likes: num(row.curtidas) as number }),
      ...(num(row.comentarios) === null ? {} : { comments: num(row.comentarios) as number }),
      ...(num(row.reposts) === null ? {} : { reposts: num(row.reposts) as number })
    }).onDuplicateKeyUpdate({
      set: {
        views: num(row.views),
        likes: num(row.curtidas),
        comments: num(row.comentarios),
        reposts: num(row.reposts),
        caption,
        mentionsBrand: mentionsBrand(caption) ? 1 : 0,
        updatedAt: now
      }
    })

    written++
  }

  // ------------------------------------------------------- monthly series
  /* Aggregated in SQL from what was just written, rather than from the parsed
     rows, so the series always matches the table it claims to summarise. */
  const monthly = await orm()
    .select({
      period: sql<string>`DATE_FORMAT(${post.publishedAt}, '%Y-%m-01')`,
      views: sql<string>`SUM(${post.views})`,
      posts: sql<string>`COUNT(*)`
    })
    .from(post)
    .where(eq(post.clientId, c.id))
    .groupBy(sql`DATE_FORMAT(${post.publishedAt}, '%Y-%m-01')`)

  const defs = await orm()
    .select({ id: metricDef.id, key: metricDef.metricKey })
    .from(metricDef)
  const defId = new Map(defs.map(d => [d.key, d.id]))

  let series = 0
  for (const month of monthly) {
    for (const [key, value] of [['views', month.views], ['posts_published', month.posts]] as const) {
      const id = defId.get(key)
      if (id === undefined || value === null) continue

      await orm().insert(metricValue).values({
        clientId: c.id,
        metricDefId: id,
        period: month.period,
        granularity: 'month',
        value: String(value),
        /* `public`, never `insights`. The funnel and the metric cards read only
           measured sources, so these can never be mistaken for them. */
        source: 'public',
        note: 'Derivado da exportação pública de Reels. Visualização conta looping — não é gente diferente.',
        createdAt: now,
        updatedAt: now
      }).onDuplicateKeyUpdate({ set: { value: String(value), updatedAt: now } })

      series++
    }
  }

  console.log(`Imported ${written} posts for ${c.name} (${skipped} skipped).`)
  console.log(`Derived ${series} monthly values across ${monthly.length} months.`)
  console.log('reach, saves, sends and retention were left NULL — the public export does not have them.')
}

main()
  .catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`\nImport failed: ${reason}`)
    process.exitCode = 1
  })
  .finally(() => { void db().end() })

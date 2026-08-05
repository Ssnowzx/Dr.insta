/**
 * Reels collector — runs in the browser, on instagram.com, with the account's
 * own session.
 *
 * WHY IT RUNS THERE AND NOT ON THE SERVER
 *
 * These are Instagram's internal endpoints, not a contracted API. They answer
 * to a logged-in session and to a browser fingerprint; a request from a
 * datacenter IP with no session is refused. So there is no cron on the VPS that
 * could do this — the collection has to happen where the session already is.
 *
 * WHY IT DOWNLOADS A FILE INSTEAD OF POSTING TO THE PLATFORM
 *
 * Instagram's Content-Security-Policy blocks `connect-src` to any other origin,
 * measured on 2026-08-05: a POST to the platform fails with "Failed to fetch"
 * before it leaves the page. Downloading a file and importing it is not a
 * workaround for laziness, it is the only path the browser allows.
 *
 * WHAT IT CANNOT GET, AND THIS IS THE IMPORTANT PART
 *
 * Reach, saves, DM shares, video retention, profile visits and link clicks do
 * not exist in public data. They are exactly the metrics the cycle is decided
 * on. This collector automates the cheap half; the half that matters still
 * arrives by Insights export.
 *
 * And `media_repost_count` is a REPOST count, not a share count — measured
 * against July's screenshots, the public field said 1,986 where Insights said
 * 48,000 shares. It is written to its own column and never treated as a share.
 *
 * HOW TO USE
 *
 *   1. Open instagram.com logged in as the account, on the profile page.
 *   2. Open the console (Cmd+Option+J) and paste this whole file.
 *   3. Run:  await coletar('bianca.olivo')
 *   4. A CSV downloads. Then, in the platform:
 *      npm run db:import-reels -- ~/Downloads/reels-<user>-<data>.csv
 *
 * Re-running the import is safe: rows are keyed by the Instagram shortcode and
 * updated in place.
 */

/* eslint-disable */
// @ts-nocheck

const APP_ID = '936619743392459'

/** The endpoint ignores `count` and returns 12 per page — measured 2026-08-05. */
const PER_PAGE = 12

async function perfil (username) {
  const r = await fetch(
    `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    { headers: { 'x-ig-app-id': APP_ID }, credentials: 'include' }
  )
  if (!r.ok) throw new Error(`Perfil respondeu ${r.status}. Você está logado nessa conta?`)
  const j = await r.json()
  const u = j?.data?.user
  if (!u) throw new Error('Não achei esse perfil.')
  return { id: u.id, username: u.username, seguidores: u.edge_followed_by?.count ?? null }
}

async function pagina (userId, cursor) {
  const url = `/api/v1/feed/user/${userId}/?count=${PER_PAGE}` +
    (cursor ? `&max_id=${encodeURIComponent(cursor)}` : '')
  const r = await fetch(url, { headers: { 'x-ig-app-id': APP_ID }, credentials: 'include' })
  if (!r.ok) throw new Error(`Feed respondeu ${r.status}.`)
  return await r.json()
}

function csvEscape (value) {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * @param username  o @ da conta, sem arroba
 * @param opcoes.desde  'AAAA-MM-DD' — para de paginar antes disso
 * @param opcoes.maxPaginas  trava de segurança
 */
async function coletar (username, opcoes = {}) {
  const { desde = '2026-01-01', maxPaginas = 40 } = opcoes

  const p = await perfil(username)
  console.log(`Perfil ${p.username} (#${p.id})${p.seguidores ? `, ${p.seguidores.toLocaleString('pt-BR')} seguidores` : ''}`)

  const itens = new Map()
  let cursor = null
  let paginas = 0
  let parar = false

  while (!parar && paginas < maxPaginas) {
    const j = await pagina(p.id, cursor)
    const lote = j.items ?? []
    paginas++

    for (const item of lote) {
      /* Only reels. A carousel has no play_count, and mixing formats would put
         a blank in the column every rate is computed from. */
      if (item.product_type !== 'clips') continue

      const code = item.code
      if (!code || itens.has(code)) continue

      const iso = new Date(item.taken_at * 1000).toISOString().slice(0, 10)

      itens.set(code, {
        id: code,
        data: iso,
        duracao_s: Math.round(item.video_duration ?? 0),
        views: item.play_count ?? item.ig_play_count ?? '',
        curtidas: item.like_count ?? '',
        comentarios: item.comment_count ?? '',
        /* REPOST, not share. Kept under its own name so nothing downstream can
           mistake it for the strong signal. */
        reposts: item.media_repost_count ?? '',
        colab: (item.coauthor_producers ?? []).map(c => c.username).join(' '),
        publi: item.is_paid_partnership ? 'sim' : 'nao',
        legenda: item.caption?.text ?? ''
      })
    }

    /* The first three items of the FIRST page are pinned and out of chronological
       order. Stopping on their date would cut the collection short, so the date
       check only applies from the second page on. */
    if (paginas > 1) {
      const maisAntigo = lote
        .map(i => new Date(i.taken_at * 1000).toISOString().slice(0, 10))
        .sort()[0]
      if (maisAntigo && maisAntigo < desde) parar = true
    }

    cursor = j.next_max_id ?? null
    if (!j.more_available || !cursor) parar = true

    console.log(`página ${paginas} · ${itens.size} reels`)
    /* A short pause between pages. Hammering the endpoint is how a session gets
       rate-limited, and a half-finished collection is worse than a slow one. */
    await new Promise(r => setTimeout(r, 700))
  }

  const linhas = [...itens.values()]
    .filter(r => r.data >= desde)
    .sort((a, b) => a.data.localeCompare(b.data))

  const cabecalho = ['id', 'data', 'duracao_s', 'views', 'curtidas', 'comentarios', 'reposts', 'colab', 'publi', 'legenda']
  const csv = [
    cabecalho.join(','),
    ...linhas.map(r => cabecalho.map(k => csvEscape(r[k])).join(','))
  ].join('\n')

  const hoje = new Date().toISOString().slice(0, 10)
  const nome = `reels-${p.username}-${hoje}.csv`

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()

  console.log(`\n${linhas.length} reels de ${desde} para cá, em ${paginas} páginas.`)
  console.log(`Baixado: ${nome}`)
  console.log('Importe com:  npm run db:import-reels -- ~/Downloads/' + nome)
  console.log('\nLembrete: alcance, salvamentos, compartilhamentos em DM e retenção NÃO vêm aqui.')

  return { reels: linhas.length, arquivo: nome }
}

/* Exposed on window so it survives being pasted once and called several times. */
globalThis.coletar = coletar
console.log('Coletor pronto. Rode:  await coletar("bianca.olivo")')

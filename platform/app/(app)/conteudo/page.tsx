import type { Metadata } from 'next'
import Link from 'next/link'
import { ArchiveAge } from '@/components/freshness'
import { archiveAge, archiveMedian, postCounts, posts } from '@/lib/dashboard'
import { compararComMediana, porMilViews } from '@/lib/acervo'
import type { PostFilter } from '@/lib/dashboard'
import { clientScope } from '@/lib/dal'
import { format, shortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Conteúdo — My Favorite' }
export const dynamic = 'force-dynamic'

/**
 * The archive.
 *
 * Filterable by duration and by whether the caption mentions the brand, because
 * those are the two axes the Reels analysis found the story in: brand content
 * never shipped in 20 seconds or less, and the long product format is the one
 * that underperformed.
 *
 * Every number here is from the public export, and the screen says so. Views
 * count loops, so they are not distinct people — presenting them next to
 * Insights figures without that label would invite exactly the wrong comparison.
 */
export default async function Conteudo ({
  searchParams
}: {
  searchParams: Promise<{ duracao?: string; marca?: string }>
}) {
  const clientId = await clientScope()
  const { duracao, marca } = await searchParams

  const filtro: PostFilter = {
    ...(duracao === 'curto' || duracao === 'longo' ? { duration: duracao } : {}),
    ...(marca === 'marca' || marca === 'pessoal' ? { brand: marca } : {})
  }

  const [lista, contas, idade, medianaViews] = await Promise.all([
    posts(clientId, filtro),
    postCounts(clientId),
    archiveAge(clientId),
    archiveMedian(clientId)
  ])

  const chip = (params: string, ativo: boolean, rotulo: string, n: number) => (
    <Link
      key={rotulo}
      href={`/conteudo?${params}`}
      className={ativo ? 'chip chip-ativo' : 'chip'}
      aria-current={ativo ? 'true' : undefined}
    >
      {rotulo} <span className="numero chip-n">{n}</span>
    </Link>
  )

  if (contas.total === 0) {
    return (
      <header className="pagina-cab">
        <p className="sobrancelha">Conteúdo</p>
        <h1 className="display">Acervo vazio.</h1>
        <p className="lead">
          Os posts entram por importação da exportação de Reels.
        </p>
      </header>
    )
  }

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">Tudo que você publicou</p>
        <h1 className="display">Seu conteúdo</h1>
        <p className="lead">
          {contas.total} Reels de janeiro para cá. Os números aqui são os
          públicos — visualização conta quando o vídeo roda de novo, então não é
          o mesmo que gente diferente.
        </p>
        {idade !== null && (
          <ArchiveAge importedAt={idade.importedAt} lastPostAt={idade.lastPostAt} />
        )}
      </header>

      {/* The finding, stated before the list rather than left to be discovered:
          brand content has never shipped short. */}
      {contas.marcaCurto === 0 && contas.marca > 0 && (
        <p className="achado">
          <strong>Uma casa vazia:</strong> nenhum dos {contas.marca} Reels que
          falam da marca tem 20 segundos ou menos. Não é que o formato curto de
          peça tenha ido mal — ele nunca foi testado.
        </p>
      )}

      <div className="chips">
        {chip('', duracao === undefined && marca === undefined, 'tudo', contas.total)}
        {chip('duracao=curto', duracao === 'curto', 'até 20s', contas.curtos)}
        {chip('duracao=longo', duracao === 'longo', 'mais de 20s', contas.longos)}
        {chip('marca=marca', marca === 'marca', 'fala da marca', contas.marca)}
        {chip('marca=pessoal', marca === 'pessoal', 'não fala', contas.pessoal)}
      </div>

      {lista.length === 0
        ? <p className="rodape-nota">Nenhum post com esse recorte.</p>
        : (
          <ul className="acervo">
            {lista.map(p => (
              <li className="peca" key={p.id}>
                <div className="peca-cab">
                  <span className="peca-data">{shortDate(p.publishedAt)}</span>
                  <span className="peca-tags">
                    {/* Seconds below a minute, minutes above. The 20-second
                        line is the cycle's rule for product content, so it has
                        to be legible at a glance — "0min09" turns that into
                        arithmetic. Above a minute nobody says "121 seconds". */}
                    {p.durationSec !== null && (
                      <span className={p.durationSec <= 20 ? 'tag tag-curto' : 'tag'}>
                        {format(p.durationSec, 'seconds')}
                      </span>
                    )}
                    {p.mentionsBrand === true && <span className="tag tag-marca">marca</span>}
                  </span>
                </div>

                {p.caption !== null && p.caption !== '' && (
                  <p className="peca-legenda">{p.caption.slice(0, 160)}{p.caption.length > 160 ? '…' : ''}</p>
                )}

                <dl className="peca-numeros">
                  <div>
                    <dt>views</dt>
                    <dd className="numero">{format(p.views, 'count')}</dd>
                  </div>
                  <div>
                    <dt>curtidas</dt>
                    <dd className="numero">{format(p.likes, 'count')}</dd>
                  </div>
                  <div>
                    <dt>comentários</dt>
                    <dd className="numero">{format(p.comments, 'count')}</dd>
                  </div>
                  {/* Collected on every run and thrown away until now. It is a
                      REPOST count and never a share count — measured against
                      July's Insights the public field read 1.986 where Insights
                      said 48.000 shares, so the label carries the weaker word. */}
                  <div>
                    <dt>reposts</dt>
                    <dd className="numero">{format(p.reposts, 'count')}</dd>
                  </div>
                  {/* Reach is deliberately absent from the public export. Showing
                      a dash is the truth; showing views in its place would
                      fabricate the denominator every rate here depends on. */}
                  <div>
                    <dt>alcance</dt>
                    <dd className="numero peca-sem">{p.reach === null ? '—' : format(p.reach, 'count')}</dd>
                  </div>
                </dl>

                {/* The reading. Four raw numbers with no ruler beside them
                    cannot answer the only question she has — "was this one
                    good?" — and she has 205 posts to compare against. Both
                    figures are against HER OWN archive: views are inflated by
                    looping, and the inflation is roughly constant inside one
                    account and meaningless across two. */}
                {(() => {
                  const contra = compararComMediana(p.views, medianaViews)
                  const densidade = porMilViews(p.comments, p.views)
                  if (contra === null && densidade === null) return null

                  return (
                    <p className="peca-leitura">
                      {contra !== null && (
                        <span className={`peca-marca peca-marca-${contra.nivel}`}>
                          <span className="numero">{contra.texto}</span> em views
                        </span>
                      )}
                      {densidade !== null && (
                        <span className="peca-densidade">
                          <span className="numero">
                            {densidade.toFixed(1).replace('.', ',')}
                          </span>{' '}
                          comentário por mil views
                        </span>
                      )}
                    </p>
                  )
                })()}

                {p.url !== null && (
                  <a className="peca-link" href={p.url} target="_blank" rel="noreferrer noopener">
                    ver no Instagram
                  </a>
                )}
              </li>
            ))}
          </ul>
          )}

      {lista.length === 60 && (
        <p className="rodape-nota">
          Mostrando os 60 mais recentes desse recorte. Use os filtros acima para
          chegar no que você procura.
        </p>
      )}
    </>
  )
}

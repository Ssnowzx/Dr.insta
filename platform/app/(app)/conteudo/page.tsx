import type { Metadata } from 'next'
import Link from 'next/link'
import { ArchiveAge } from '@/components/freshness'
import { archiveAge, archiveMedian, postCounts, posts } from '@/lib/dashboard'
import { compararComMediana, porMilViews } from '@/lib/acervo'
import type { PostFilter } from '@/lib/dashboard'
import { clientScope } from '@/lib/dal'
import { format, shortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Conteúdo' }
export const dynamic = 'force-dynamic'

/**
 * The archive.
 *
 * Filterable by duration and by whether the caption mentions the brand, because
 * those are the two axes the Reels analysis found the story in: brand content
 * never shipped in 20 seconds or less, and the long product format is the one
 * that underperformed.
 *
 * THE TWO AXES CROSS, AND THAT IS THE POINT
 *
 * The chips used to replace the whole query string, so choosing "fala da marca"
 * dropped "até 20s" — the screen opened by stating that no brand Reel had ever
 * shipped short and then refused to let anyone check it. Each chip now toggles
 * its own axis and leaves the other alone, and the counts on the chips are
 * computed inside the current cut, so with "até 20s" on, "fala da marca" reads
 * a plain 0. The empty cell is on the control, not only in the sentence.
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
    postCounts(clientId, filtro),
    archiveAge(clientId),
    archiveMedian(clientId)
  ])

  /* Toggling: tapping the chip that is already on turns that axis off, which is
     the only way back out of a cut without hunting for "tudo". The other axis is
     carried through untouched — that carrying is the whole fix. */
  const destino = (eixo: 'duracao' | 'marca', valor: string): string => {
    const proximo = {
      duracao: eixo === 'duracao' ? (duracao === valor ? undefined : valor) : duracao,
      marca: eixo === 'marca' ? (marca === valor ? undefined : valor) : marca
    }
    const params = new URLSearchParams()
    if (proximo.duracao !== undefined) params.set('duracao', proximo.duracao)
    if (proximo.marca !== undefined) params.set('marca', proximo.marca)
    const busca = params.toString()
    return busca === '' ? '/conteudo' : `/conteudo?${busca}`
  }

  const chip = (
    eixo: 'duracao' | 'marca',
    valor: string,
    ativo: boolean,
    rotulo: string,
    n: number
  ) => (
    <Link
      key={rotulo}
      href={destino(eixo, valor)}
      className={ativo ? 'chip chip-ativo' : 'chip'}
      aria-pressed={ativo}
      /* The count is part of the name, not decoration: "fala da marca, 0 posts"
         is what a screen reader has to say when the cut is empty. */
      aria-label={`${rotulo}, ${n} ${n === 1 ? 'post' : 'posts'}`}
    >
      {rotulo} <span className="numero chip-n">{n}</span>
    </Link>
  )

  const filtrando = duracao !== undefined || marca !== undefined

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

      {/* The "empty house" note used to live here: brand content had never
          shipped short, so short-form product was worth testing. Removed on
          13/08/2026 for two reasons, either of which is enough.

          It belonged to the conversion cycle, and the perfil→loja relationship
          left this product's scope on 12/08 — it is the brand team's now.

          And the data since then contradicts it. Across 376 posts, content
          whose subject is the brand converts to followers at 0,025% against a
          0,079% average, and the 1–10s bucket is the WORST converter in the
          set (0,061% against 0,146% for 90s+). The note was pointing her at
          the two things the numbers now argue against. */}

      {/* What replaced it. Measured on 376 posts from the two exports she sent
          on 13/08, and phrased as two of her own Reels rather than as a rate:
          "0,025% against 1,026%" is true and unusable, "one brought 45 people
          and the other brought 3.131" is the same fact she can act on. */}
      <p className="achado">
        <strong>O mesmo tamanho, 41× de diferença:</strong> os quatro episódios de
        “por dentro da sua peça favorita” somaram 179 mil pessoas alcançadas e
        trouxeram <strong>45 seguidores</strong>. O “meus top 5 perfumes”, com
        quase a mesma duração, alcançou 305 mil e trouxe{' '}
        <strong>3.131</strong>. Não é o formato nem o tamanho — é sobre o quê o
        vídeo fala.
      </p>

      {/* Two groups, labelled, because the controls are two questions and not
          one list of five answers. Unlabelled they read as mutually exclusive,
          which is exactly the reading that made combining them look impossible. */}
      <div className="filtros">
        <div className="filtro-eixo">
          <p className="filtro-rot" id="filtro-duracao">duração</p>
          <div className="chips" role="group" aria-labelledby="filtro-duracao">
            {chip('duracao', 'curto', duracao === 'curto', 'até 20s', contas.curtos)}
            {chip('duracao', 'longo', duracao === 'longo', 'mais de 20s', contas.longos)}
          </div>
        </div>

        <div className="filtro-eixo">
          <p className="filtro-rot" id="filtro-marca">legenda</p>
          <div className="chips" role="group" aria-labelledby="filtro-marca">
            {chip('marca', 'marca', marca === 'marca', 'fala da marca', contas.marca)}
            {chip('marca', 'pessoal', marca === 'pessoal', 'não fala', contas.pessoal)}
          </div>
        </div>
      </div>

      {/* `contas.noRecorte` and not `lista.length`: the list stops at 60, and
          saying "60 Reels neste recorte" of a cut that holds 117 would turn a
          page limit into a fact about her archive. */}
      <p className="filtro-estado" aria-live="polite">
        {filtrando
          ? (
            <>
              <span className="numero">{contas.noRecorte}</span>{' '}
              {contas.noRecorte === 1 ? 'Reel neste recorte' : 'Reels neste recorte'}
              {' · '}
              <Link href="/conteudo">ver os {contas.total}</Link>
            </>
            )
          : <>Todos os <span className="numero">{contas.total}</span> Reels.</>}
      </p>

      {/* The empty-cut text used to say "uma casa vazia... nunca foi testado",
          which read as an invitation to try it. The only empty crossing in the
          archive is short × brand, and both halves are what the 376 posts argue
          against: short is the worst follower converter, and brand-subject
          content leaves the personal feed this cycle. The thesis was removed
          from the top of this screen on 13/08 and had survived two clicks
          below it. */}
      {lista.length === 0
        ? <p className="achado">Nenhum Reel com esse recorte.</p>
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
          Mostrando os <span className="numero">60</span> mais recentes dos{' '}
          <span className="numero">{contas.noRecorte}</span> deste recorte. Use os
          filtros acima para chegar no que você procura.
        </p>
      )}
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopyValue } from '@/components/copy-value'
import { IdeaControl, IdeaTalk } from '@/components/idea-control'
import { RequestText } from '@/components/request-text'
import { diaDaSemana } from '@/lib/agenda'
import { canReach, requireSession } from '@/lib/dal'
import { format, shortDate } from '@/lib/format'
import { ideaDetail } from '@/lib/pautas'

export const dynamic = 'force-dynamic'

/**
 * One pauta, with the script she reads while filming.
 *
 * THE SHAPE IS THE POINT
 *
 * A block per beat, with the seconds on the left and what she says on the right.
 * She holds a phone; a page of prose is a page nobody follows, and "faça um
 * vídeo de opinião de 90 segundos" is the instruction that produced nothing
 * twice already.
 *
 * `says` and `shows` are separate rows in the same block because they are
 * instructions to two different people. The assistant behind the camera is
 * usually not the one talking, and a single merged paragraph makes each of them
 * read past the half that is theirs.
 *
 * The caption is handed over through `CopyValue` — the same component the plan
 * uses for the bio link, and for the same reason: the step that NAMED a string
 * instead of handing it over got the wrong string pasted, and nothing looked
 * broken from her side.
 */

export async function generateMetadata ({
  params
}: {
  params: Promise<{ codigo: string }>
}): Promise<Metadata> {
  const { codigo } = await params
  const identity = await requireSession()
  const pauta = await ideaDetail(codigo, c => canReach(identity, c))

  return { title: pauta?.title ?? 'Pauta' }
}

const ESTADO: Record<string, { rot: string; classe: string }> = {
  proposed: { rot: 'proposta', classe: 'neutro' },
  scheduled: { rot: 'agendada', classe: 'neutro' },
  recorded: { rot: 'gravada', classe: 'atencao' },
  published: { rot: 'no ar', classe: 'ok' },
  dropped: { rot: 'descartada', classe: 'neutro' }
}

export default async function Pauta ({
  params
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const identity = await requireSession()

  /* `canReach` and not a client id read from the URL. Absent and out-of-scope
     answer identically — a distinct "not yours" would turn this URL into a way
     to test whether a pauta exists. */
  const pauta = await ideaDetail(codigo, c => canReach(identity, c))
  if (pauta === null) notFound()

  const selo = ESTADO[pauta.state] ?? ESTADO.proposed

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">
          <Link href="/ideias">Ideias</Link>
          {pauta.pillarName !== null && <> · {pauta.pillarName}</>}
          {pauta.scheduledFor !== null && <> · {diaDaSemana(pauta.scheduledFor)}</>}
        </p>
        <h1 className="display">{pauta.title}</h1>
        <p className="pauta-meta">
          <span className={`selo selo-${selo?.classe}`}>{selo?.rot}</span>
          {pauta.targetSeconds !== null && (
            <span className="pauta-meta-item">
              alvo de {format(pauta.targetSeconds, 'seconds')}
            </span>
          )}
        </p>
      </header>

      {/* Why this pauta exists, before the script. A calendar she can only obey
          is a calendar she cannot disagree with — and disagreeing is what turns
          it into hers. The same argument that put the pillars' reasoning on the
          plan screen. */}
      {pauta.why !== null && (
        <p className="achado"><RequestText text={pauta.why} /></p>
      )}

      {pauta.hook !== null && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Os três primeiros segundos</h2>
            <p className="secao-nota">é aqui que se decide o resto</p>
          </div>
          <p className="gancho">{pauta.hook}</p>
          <p className="rodape-nota">
            Não precisa ser exatamente isso — precisa ser uma frase, dita de cara,
            sem apresentação e sem “oi gente”. O que não pode é começar explicando
            o que o vídeo vai ser.
          </p>
        </section>
      )}

      {pauta.script.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">O roteiro</h2>
            <p className="secao-nota">
              <span className="numero">{pauta.script.length}</span> blocos
            </p>
          </div>
          <ol className="roteiro">
            {pauta.script.map((b, i) => (
              <li className="bloco" key={b.id}>
                <div className="bloco-cab">
                  <span className="numero bloco-n">{String(i + 1).padStart(2, '0')}</span>
                  {b.timeLabel !== null && <span className="bloco-tempo">{b.timeLabel}</span>}
                </div>
                <p className="bloco-fala"><RequestText text={b.says} /></p>
                {b.shows !== null && (
                  <p className="bloco-cena">
                    <span className="bloco-rot">na tela</span>
                    {b.shows}
                  </p>
                )}
                {b.note !== null && <p className="bloco-nota">{b.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {(pauta.caption !== null || pauta.cta !== null) && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Legenda e chamada</h2>
            <p className="secao-nota">na sua voz, minúscula e curta</p>
          </div>
          {pauta.caption !== null && (
            <CopyValue
              valor={pauta.caption}
              rotulo="Cole isto na legenda"
              nota={'Suas legendas que mais funcionaram têm de duas a cinco palavras e nenhuma explica o vídeo — "diálogos de todo casal", "oxi 🍹". Se esta ficar comprida, corte em vez de reescrever.'}
            />
          )}
          {pauta.cta !== null && (
            <p className="pauta-cta">
              <span className="pauta-cta-rot">termina pedindo</span>
              {pauta.cta}
            </p>
          )}
        </section>
      )}

      <section className="secao">
        <div className="secao-cab">
          <h2 className="titulo-secao">Onde está esta pauta</h2>
          <p className="secao-nota">as duas marcam, é a mesma resposta</p>
        </div>
        <IdeaControl ideaId={pauta.id} estado={pauta.state} />
      </section>

      <section className="secao">
        <div className="secao-cab">
          <h2 className="titulo-secao">Conversa sobre esta pauta</h2>
          <p className="secao-nota">é daqui que sai o próximo lote</p>
        </div>

        {pauta.conversa.length === 0
          ? (
            <p className="rodape-nota" style={{ marginTop: 0 }}>
              Nada escrito ainda. O que você achar aqui — que ficou longo, que a
              abertura não é seu jeito de falar, que rendeu comentário — é o que
              muda os roteiros seguintes. Vale mais que marcar “gravei”.
            </p>
            )
          : (
            <div className="linha-tempo">
              {pauta.conversa.map(n => (
                <div className={n.fromClient ? 'evento evento-comment' : 'evento'} key={n.id}>
                  <div className="evento-cab">
                    <span className="evento-quem">{n.userName}</span>
                    <span className="evento-quando">{shortDate(n.createdAt)}</span>
                  </div>
                  <p className="evento-texto"><RequestText text={n.body} /></p>
                </div>
              ))}
            </div>
            )}

        <IdeaTalk ideaId={pauta.id} />
      </section>

      {pauta.publishedCode !== null && (
        <p className="rodape-nota">
          Foi ao ar:{' '}
          <a
            href={`https://instagram.com/reel/${pauta.publishedCode}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            ver no Instagram
          </a>
        </p>
      )}
    </>
  )
}

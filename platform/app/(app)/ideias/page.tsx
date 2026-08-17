import type { Metadata } from 'next'
import Link from 'next/link'
import { agendar, diaDaSemana, diasDeAtraso, hojeEm } from '@/lib/agenda'
import { clientScope } from '@/lib/dal'
import { format } from '@/lib/format'
import { ideas } from '@/lib/pautas'
import type { IdeaRow } from '@/lib/pautas'

export const metadata: Metadata = { title: 'Ideias' }
export const dynamic = 'force-dynamic'

/**
 * The schedule, and the bank behind it.
 *
 * WHY THIS SCREEN EXISTS
 *
 * The plan says what to change; the analysis says what the numbers found. Both
 * stop one step short of the thing she actually does on a Tuesday, which is
 * point a camera at herself and talk. "Grave dois vídeos de opinião" is a
 * decision, not a script — and she runs the profile with an assistant, so the
 * instruction has to survive being read by someone who was not in the
 * conversation where it was decided.
 *
 * WHY SO FEW SCRIPTS
 *
 * Three a week, against the eight Reels she publishes. That is not a shortfall,
 * it is the finding: across 376 posts, the long opinion video converted 41× the
 * brand pauta at comparable reach, and the 1–10s bucket — 39% of all her reach —
 * converts worst of everything she makes. The short, spontaneous half of her
 * week is the distribution engine, it works, and scripting it is how you break
 * the one thing that is not broken.
 *
 * WHAT LEAVES THE LIST
 *
 * A pauta she published is gone from the working groups, into a section at the
 * bottom she never has to open. That is the same rule the plan now follows: what
 * is done stops asking.
 */

const FORMATO: Record<string, string> = {
  reel: 'Reel',
  carrossel: 'carrossel',
  story: 'Story',
  foto: 'foto'
}

function Cartao ({ pauta, atraso }: { pauta: IdeaRow; atraso?: number }) {
  return (
    <li className={`pauta pauta-${pauta.state}`}>
      <div className="pauta-cab">
        <span className="pauta-quando">
          {atraso !== undefined
            ? `atrasada ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`
            : pauta.scheduledFor === null
              ? 'sem data'
              : diaDaSemana(pauta.scheduledFor)}
        </span>
        <span className="pauta-tags">
          <span className="tag">{FORMATO[pauta.format] ?? pauta.format}</span>
          {/* The target length, tagged like the archive tags duration, because
              it is the same fact seen from the other side of the shoot. */}
          {pauta.targetSeconds !== null && (
            <span className={pauta.targetSeconds <= 20 ? 'tag tag-curto' : 'tag'}>
              {format(pauta.targetSeconds, 'seconds')}
            </span>
          )}
          {pauta.pillarName !== null && <span className="tag tag-pilar">{pauta.pillarName}</span>}
        </span>
      </div>

      <h3 className="pauta-titulo">
        <Link href={`/ideias/${pauta.publicCode}`}>{pauta.title}</Link>
      </h3>

      {/* The hook, on the card. It is the only line of the script worth reading
          before deciding whether to open the script — and on this account it is
          the line that decides the whole video: 39% of her reach dies in the
          first ten seconds of content that converts worst. */}
      {pauta.hook !== null && (
        <p className="pauta-gancho">
          <span className="pauta-gancho-rot">abre com</span>
          “{pauta.hook}”
        </p>
      )}

      <p className="pauta-pe">
        {pauta.beats === 0
          ? 'pauta sem roteiro ainda'
          : `roteiro em ${pauta.beats} blocos`}
        {pauta.notes > 0 && (
          <> · <span className="numero">{pauta.notes}</span>{' '}
            {pauta.notes === 1 ? 'recado' : 'recados'}
          </>
        )}
      </p>

      <Link className="btn-abrir" href={`/ideias/${pauta.publicCode}`}>
        {pauta.beats === 0 ? 'Ver a pauta' : 'Abrir o roteiro'}
      </Link>
    </li>
  )
}

function Bloco ({
  titulo,
  nota,
  pautas,
  hoje
}: {
  titulo: string
  nota?: string
  pautas: IdeaRow[]
  hoje?: string
}) {
  if (pautas.length === 0) return null

  return (
    <section className="secao">
      <div className="secao-cab">
        <h2 className="titulo-secao">{titulo}</h2>
        {nota !== undefined && <p className="secao-nota">{nota}</p>}
      </div>
      <ul className="pautas">
        {pautas.map(p => (
          <Cartao
            key={p.id}
            pauta={p}
            {...(hoje !== undefined && p.scheduledFor !== null
              ? { atraso: diasDeAtraso(p.scheduledFor, hoje) }
              : {})}
          />
        ))}
      </ul>
    </section>
  )
}

export default async function Ideias () {
  const clientId = await clientScope()
  const lista = await ideas(clientId)

  /* The clock is read once, here at the edge, and handed to a pure function.
     `lib/agenda.ts` never reaches for it — which is what lets the week boundary
     be tested without waiting for Sunday. */
  const hoje = hojeEm(new Date())
  const agenda = agendar(lista, hoje)

  if (lista.length === 0) {
    return (
      <header className="pagina-cab">
        <p className="sobrancelha">Ideias</p>
        <h1 className="display">Ainda não escrevi nenhuma.</h1>
        <p className="lead">
          As pautas e os roteiros entram por aqui. Quando o primeiro lote estiver
          pronto, ele aparece nesta tela com dia, gancho e o texto de cada bloco.
        </p>
      </header>
    )
  }

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">O que gravar</p>
        <h1 className="display">
          {agenda.aFazer === 0
            ? 'Nada na fila.'
            : agenda.atrasada.length > 0
              ? `${agenda.atrasada.length} ${agenda.atrasada.length === 1 ? 'atrasada' : 'atrasadas'}.`
              : agenda.hoje.length > 0
                ? `${agenda.hoje.length} ${agenda.hoje.length === 1 ? 'pauta' : 'pautas'} para hoje.`
                : `${agenda.aFazer} na fila.`}
        </h1>
        <p className="lead">
          {agenda.aFazer === 0
            ? 'Tudo o que estava aqui já saiu ou foi descartado. O próximo lote entra nesta tela.'
            : 'Cada uma tem gancho, blocos e legenda sugerida. Não é para seguir palavra por palavra — é para você não parar no meio pensando no que vem depois.'}
        </p>
        {/* Said here rather than left to be inferred from a short list. Someone
            who publishes eight Reels a week and finds three scripts concludes
            the product is incomplete unless the product says otherwise. */}
        <p className="rodape-nota">
          São três roteiros por semana, não oito. Os outros vídeos da sua semana
          são o que já funciona sozinho — o roteiro existe só para o vídeo de
          opinião, que é o que traz seguidor.
        </p>
      </header>

      <Bloco
        titulo="Passou da data"
        nota="grava atrasado ou descarta — as duas respostas servem"
        pautas={agenda.atrasada}
        hoje={hoje}
      />
      <Bloco titulo="Hoje" pautas={agenda.hoje} />
      <Bloco titulo="Nos próximos sete dias" pautas={agenda.semana} />
      <Bloco titulo="Depois" nota="já com data, mais para frente" pautas={agenda.depois} />
      <Bloco
        titulo="Banco de pautas"
        nota="sem data — para o dia em que não vier ideia"
        pautas={agenda.banco}
      />

      {/* Done and refused, at the bottom, where they do not compete with the
          queue. Kept rather than hidden: the pauta she said no to is the most
          useful thing on this screen when the next batch is written. */}
      {agenda.publicada.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Já foi ao ar</h2>
            <p className="secao-nota">
              <span className="numero">{agenda.publicada.length}</span>{' '}
              {agenda.publicada.length === 1 ? 'publicada' : 'publicadas'}
            </p>
          </div>
          <ul className="lista-simples">
            {agenda.publicada.map(p => (
              <li key={p.id}>
                <Link className="lista-item" href={`/ideias/${p.publicCode}`}>
                  <span className="lista-titulo">{p.title}</span>
                  <span className="lista-meta">
                    {p.notes > 0 ? `${p.notes} recado${p.notes === 1 ? '' : 's'}` : 'publicada'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {agenda.descartada.length > 0 && (
        <section className="secao">
          <div className="secao-cab">
            <h2 className="titulo-secao">Você disse que não</h2>
            <p className="secao-nota">ficam aqui — é assim que eu escrevo as próximas</p>
          </div>
          <ul className="lista-simples">
            {agenda.descartada.map(p => (
              <li key={p.id}>
                <Link className="lista-item" href={`/ideias/${p.publicCode}`}>
                  <span className="lista-titulo">{p.title}</span>
                  <span className="lista-meta">descartada</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="rodape-nota">
        O que você já publicou está em <Link href="/conteudo">Conteúdo</Link>, com
        os números de cada post.
      </p>
    </>
  )
}

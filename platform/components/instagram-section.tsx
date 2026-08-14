import { DesconectarInstagram } from './instagram-connect.tsx'
import { ageOf } from '@/lib/freshness'
import { longDate, shortDate } from '@/lib/format'
import type { ConnectionView, FailedAttempts } from '@/lib/instagram/connection'

/**
 * The connection, as the client sees it.
 *
 * Written in consequence rather than in status: "expired" and "revoked" are our
 * words for our problem. What she needs to know is whether the numbers are
 * still arriving, and what to press if they are not.
 *
 * Server component — nothing here needs the browser except the disconnect
 * confirmation, which is its own island.
 */

/** What each result of the authorisation round trip says, in her words. */
const RESULTADOS: Record<string, { texto: string; erro: boolean }> = {
  conectado: { texto: 'Pronto, conectei. Os números começam a chegar sozinhos.', erro: false },
  recusado: { texto: 'Você cancelou na tela do Instagram — não conectei nada.', erro: false },
  falhou: {
    texto: 'O Instagram não confirmou a conexão. Pode tentar de novo; se insistir, me chama.',
    erro: true
  },
  'estado-invalido': {
    texto: 'Esse link de conexão não vale mais. Comece de novo pelo botão abaixo.',
    erro: true
  },
  'sem-codigo': {
    texto: 'A resposta do Instagram veio incompleta. Tente de novo pelo botão abaixo.',
    erro: true
  },
  'so-cliente': {
    texto: 'Só a dona da conta pode conectar o Instagram.',
    erro: true
  },
  indisponivel: {
    texto: 'A conexão com o Instagram ainda não está configurada aqui. Isso é comigo.',
    erro: true
  },
  'termo-mudou': {
    /* The tab was left open across a change to the terms. Saying so plainly
       beats "erro ao processar", which would read as a bug she caused. */
    texto: 'O que eu explico antes de conectar mudou desde que você abriu essa tela. Comece de novo para ler a versão nova.',
    erro: true
  }
}

export function InstagramSection ({
  conexao,
  falhas,
  resultado,
  configurado,
  ehCliente
}: {
  conexao: ConnectionView | null
  falhas: FailedAttempts
  resultado?: string
  /** False when the app credentials are absent — the button would lead nowhere. */
  configurado: boolean
  ehCliente: boolean
}) {
  const aviso = resultado === undefined ? undefined : RESULTADOS[resultado]
  const conectada = conexao !== null && conexao.state === 'active'
  const precisaReconectar = conexao !== null && (conexao.state === 'expired' || conexao.state === 'revoked')

  return (
    <section className="secao">
      <div className="secao-cab">
        <h2 className="titulo-secao">Seu Instagram</h2>
        <p className="secao-nota">
          {conectada ? 'os números chegam sozinhos' : 'hoje os números vêm por print'}
        </p>
      </div>

      {aviso !== undefined && (
        <p className={aviso.erro ? 'aviso aviso-erro' : 'aviso'}>{aviso.texto}</p>
      )}

      {conectada && (
        <div className="pessoa">
          <div className="pessoa-cab">
            <span className="pessoa-nome">
              {conexao.username === null ? 'Sua conta' : `@${conexao.username}`}
            </span>
            <span className="selo selo-ok">conectada</span>
          </div>
          <p className="pessoa-meta">
            {conexao.connectedAt !== null && <>Conectada em {shortDate(conexao.connectedAt)}. </>}
            {conexao.lastSyncAt === null
              ? 'Ainda não busquei os números — a primeira leitura é a próxima.'
              : `Números atualizados ${ageOf(conexao.lastSyncAt).label}.`}
          </p>
          <DesconectarInstagram />
        </div>
      )}

      {conexao !== null && conexao.state === 'failing' && (
        <div className="pessoa">
          <div className="pessoa-cab">
            <span className="pessoa-nome">
              {conexao.username === null ? 'Sua conta' : `@${conexao.username}`}
            </span>
            <span className="selo selo-atencao">com problema</span>
          </div>
          <p className="pessoa-meta">
            {/* The date, not the error. What matters to her is how stale the
                numbers are, not which endpoint answered what. */}
            {conexao.lastSyncAt === null
              ? 'Não consegui buscar os números nenhuma vez ainda.'
              : `A última leitura que deu certo foi ${ageOf(conexao.lastSyncAt).label}.`}
            {' '}Já estou olhando isso — você não precisa fazer nada.
          </p>
        </div>
      )}

      {precisaReconectar && (
        <div className="pessoa">
          <div className="pessoa-cab">
            <span className="pessoa-nome">Conexão encerrada</span>
            <span className="selo selo-atencao">precisa de você</span>
          </div>
          <p className="pessoa-meta">
            {conexao.state === 'revoked'
              ? 'A autorização foi retirada. '
              : 'A autorização venceu — isso acontece de tempos em tempos. '}
            {/* `ageOf().label` já vem como "de 2 dias atrás", então a frase tem
                de terminar onde o "de" encaixa. "pararam de atualizar de 2 dias
                atrás" não é português. */}
            {conexao.lastSyncAt === null
              ? 'Nenhum número chegou por aqui.'
              : `A última atualização é ${ageOf(conexao.lastSyncAt).label}.`}
          </p>
          {ehCliente && configurado && (
            <a className="btn-acesso" href="/conta/instagram">Conectar de novo</a>
          )}
        </div>
      )}

      {conexao === null && (
        <>
          {/* Tried and broke. A failed authorisation writes an audit row and no
              connection row, so without this the screen greets her with the
              same first-time invitation she already followed — three times, on
              13/08/2026, each one looking like the first.

              What she gets is the consequence and where the fault is; the
              provider's own message goes to the consultant only, the same rule
              `lastError` follows. Blaming the tool is not politeness here, it
              is accuracy: it broke inside Instagram, after she left this app. */}
          {falhas.count > 0 && (
            <div className="grupo grupo-critico" style={{ marginTop: 0 }}>
              <p className="grupo-titulo">
                {ehCliente ? 'Você já tentou' : 'Ela já tentou'}{' '}
                <span className="numero grupo-n">{falhas.count}</span>
              </p>
              <p className="grupo-item">
                {ehCliente
                  ? 'Quebrou do lado do Instagram, depois de você sair daqui — não é você fazendo errado. Estou resolvendo com eles; assim que destravar eu te aviso e a gente tenta de novo.'
                  : 'Falhou dentro do Instagram, sem criar conexão. Enquanto isso os números entram pelos prints que ela manda.'}
              </p>
              {falhas.lastAt !== null && (
                <p className="grupo-quem">última tentativa em {longDate(falhas.lastAt)}</p>
              )}
              {!ehCliente && falhas.detail !== null && (
                <p className="grupo-detalhe">Instagram respondeu: {falhas.detail}</p>
              )}
            </div>
          )}

          {/* What she is agreeing to, before she agrees. In consequence, not in
              scope names: "instagram_business_manage_insights" tells her
              nothing, and the authorisation screen she lands on is written in
              Meta's words, not ours. */}
          <p className="rodape-nota" style={{ marginTop: 0 }}>
            Conectando sua conta, eu passo a ler sozinho os números que hoje você
            precisa exportar e me mandar: quantas pessoas passaram a te seguir,
            quantas abriram seu perfil, o alcance, e salvamentos e
            compartilhamentos por post.
          </p>
          <p className="rodape-nota">
            <strong>Só leitura.</strong> Não publico nada, não comento, não
            respondo mensagem e não vejo suas conversas. Você entra no Instagram
            na tela deles — sua senha não passa por aqui — e pode desligar quando
            quiser, nesta mesma tela.
          </p>

          {ehCliente
            ? configurado
              ? <a className="btn-acesso" href="/conta/instagram">Conectar meu Instagram</a>
              : <p className="rodape-nota">A conexão ainda não está pronta do meu lado.</p>
            : <p className="rodape-nota">Ela ainda não conectou a conta.</p>}
        </>
      )}
    </section>
  )
}

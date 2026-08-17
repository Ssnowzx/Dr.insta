import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/dal'
import { credentialsFromEnv } from '@/lib/instagram/oauth'
import { GARANTIA, LE, NAO_FAZ, TERMS_VERSION } from '@/lib/instagram/termos'

export const metadata: Metadata = { title: 'Conectar seu Instagram' }
export const dynamic = 'force-dynamic'

/**
 * The agreement, before anything leaves for Instagram.
 *
 * This used to be a redirect: pressing the button on Conta sent her straight to
 * Meta's authorisation screen. That screen is written in Meta's words — scope
 * names and generic phrasing — and it is the only thing she would have read
 * before handing over access to an account with 713k followers.
 *
 * So the decision happens here, in plain Portuguese, and the acceptance is
 * recorded with the version of the text she saw. Consent that leaves no trace
 * is indistinguishable from consent nobody asked for.
 *
 * The "does not" list is longer than the "does" list, deliberately. What
 * someone actually wants to know when connecting an account is the reach of the
 * thing, and answering that beats any assurance about our intentions.
 */
export default async function ConectarInstagram () {
  const identity = await requireSession()
  const creds = credentialsFromEnv(process.env.APP_URL ?? '')

  /* Nothing to agree to if there is nowhere to go. Both cases land back on
     Conta, which explains the state. */
  if (creds === null) redirect('/conta?instagram=indisponivel')
  if (identity.role !== 'client') redirect('/conta?instagram=so-cliente')

  return (
    <>
      <header className="pagina-cab">
        <p className="sobrancelha">antes de conectar</p>
        <h1 className="display">O que eu vou poder ver.</h1>
        <p className="lead">
          Leia sem pressa. Depois de conectar, os números chegam sozinhos, sem
          você exportar nem mandar nada — e você desliga quando quiser, na tela
          da sua conta.
        </p>
      </header>

      <section className="secao">
        <div className="secao-cab">
          <h2 className="titulo-secao">O que eu vou ler</h2>
          <p className="secao-nota">só números, nunca pessoas</p>
        </div>
        <ul className="termo-lista termo-le">
          {LE.map(item => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="secao">
        <div className="secao-cab">
          <h2 className="titulo-secao">O que eu não consigo fazer</h2>
          <p className="secao-nota">nem se quisesse</p>
        </div>
        <ul className="termo-lista termo-nao">
          {NAO_FAZ.map(item => <li key={item}>{item}</li>)}
        </ul>
        <p className="termo-garantia">{GARANTIA}</p>
      </section>

      {/* A POST, not a link. Accepting has an effect — it is written down — and
          an effect behind a GET is one a preload or a back button can repeat. */}
      <form action="/conta/instagram/autorizar" method="post" className="termo-aceite">
        <label className="termo-check">
          <input type="checkbox" name="aceito" value={TERMS_VERSION} required />
          <span>
            Li as duas listas e entendi o que estou autorizando.
          </span>
        </label>

        <button className="btn-acesso" type="submit">
          Continuar para o Instagram
        </button>
      </form>

      <p className="rodape-nota">
        Na próxima tela quem pergunta é o Instagram, não eu — é lá que você entra
        na sua conta. Sua senha não passa por aqui.{' '}
        <Link href="/conta">Voltar sem conectar</Link>.
      </p>
    </>
  )
}

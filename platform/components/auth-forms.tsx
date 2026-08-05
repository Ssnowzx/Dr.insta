'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { FormState } from '@/lib/auth-actions'
import { acceptInvite, requestReset, setNewPassword, signIn } from '@/lib/auth-actions'

/**
 * Client components for the credential screens.
 *
 * Only the form is a client component; the page around it stays a Server
 * Component. That keeps the JavaScript the phone downloads down to the part
 * that genuinely needs interactivity.
 *
 * Every visible string is pt-BR — the client reads these.
 */

const VAZIO: FormState = {}

function Botao ({ children }: { children: string }) {
  /* `useFormStatus` has to live in a child of the <form>, not in the component
     that renders it — from the parent it always reads false, and the button
     never shows it is working. */
  const { pending } = useFormStatus()
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? 'Um instante…' : children}
    </button>
  )
}

function Aviso ({ estado }: { estado: FormState }) {
  if (estado.error !== undefined) {
    return <p className="aviso aviso-erro" role="alert">{estado.error}</p>
  }
  if (estado.ok !== undefined) {
    return <p className="aviso aviso-ok" role="status">{estado.ok}</p>
  }
  return null
}

// -------------------------------------------------------------------- entrar

export function FormEntrar ({ destino }: { destino?: string }) {
  const [estado, acao] = useActionState(signIn, VAZIO)

  return (
    <form action={acao} noValidate>
      <Aviso estado={estado} />

      {destino !== undefined && <input type="hidden" name="destino" value={destino} />}

      <div className="campo">
        <label htmlFor="email">Seu e-mail</label>
        <input
          id="email" name="email" type="email" required
          autoComplete="username" inputMode="email"
          autoCapitalize="off" autoCorrect="off" spellCheck={false}
          placeholder="voce@exemplo.com.br"
        />
      </div>

      <div className="campo">
        <label htmlFor="senha">Sua senha</label>
        <input
          id="senha" name="senha" type="password" required
          autoComplete="current-password"
        />
      </div>

      <Botao>Entrar</Botao>
    </form>
  )
}

// -------------------------------------------------------- convite / nova senha

function FormSenha ({
  acao,
  rotuloBotao
}: {
  acao: (prev: FormState, form: FormData) => Promise<FormState>
  rotuloBotao: string
}) {
  const [estado, enviar] = useActionState(acao, VAZIO)

  return (
    <form action={enviar} noValidate>
      <Aviso estado={estado} />

      <div className="campo">
        <label htmlFor="senha">Escolha uma senha</label>
        <input
          id="senha" name="senha" type="password" required
          autoComplete="new-password" minLength={12}
        />
        <span className="dica">
          Pelo menos 12 caracteres. Uma frase curta que só você lembra funciona
          melhor que uma palavra com símbolos.
        </span>
      </div>

      <div className="campo">
        <label htmlFor="confirmacao">Repita a senha</label>
        <input
          id="confirmacao" name="confirmacao" type="password" required
          autoComplete="new-password" minLength={12}
        />
      </div>

      <Botao>{rotuloBotao}</Botao>
    </form>
  )
}

export function FormConvite ({ token }: { token: string }) {
  /* `bind` puts the token on the server side of the action. Carrying it in a
     hidden field would let it be edited in the browser — and it is the secret
     that authorises setting this password. */
  return <FormSenha acao={acceptInvite.bind(null, token)} rotuloBotao="Criar minha senha" />
}

export function FormNovaSenha ({ token }: { token: string }) {
  return <FormSenha acao={setNewPassword.bind(null, token)} rotuloBotao="Salvar a senha nova" />
}

// ----------------------------------------------------------------- recuperar

export function FormRecuperar () {
  const [estado, acao] = useActionState(requestReset, VAZIO)

  return (
    <form action={acao} noValidate>
      <Aviso estado={estado} />

      <div className="campo">
        <label htmlFor="email">Seu e-mail</label>
        <input
          id="email" name="email" type="email" required
          autoComplete="username" inputMode="email"
          autoCapitalize="off" autoCorrect="off" spellCheck={false}
          placeholder="voce@exemplo.com.br"
        />
      </div>

      <Botao>Mandar o link</Botao>
    </form>
  )
}

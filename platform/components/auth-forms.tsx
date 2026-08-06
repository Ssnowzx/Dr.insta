'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { FormState } from '@/lib/auth-actions'
import { acceptInvite, changePassword, requestReset, setNewPassword, signIn } from '@/lib/auth-actions'

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

/**
 * A password field that can be read.
 *
 * `type` is swapped on the element rather than a second input being rendered:
 * two inputs means two values to keep in step, and a password manager filling
 * the hidden one.
 *
 * The button is `tabIndex={-1}` on purpose. Tabbing out of a password field
 * should reach the submit button; landing on a reveal toggle first is the kind
 * of detour that only shows up for someone who never touches the mouse.
 */
function CampoSenha ({
  nome,
  rotulo,
  autoComplete,
  dica
}: {
  nome: string
  rotulo: string
  autoComplete: 'current-password' | 'new-password'
  dica?: string
}) {
  const id = useId()
  const [visivel, setVisivel] = useState(false)

  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="campo-inp">
        <input
          id={id}
          name={nome}
          type={visivel ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          {...(autoComplete === 'new-password' ? { minLength: 12 } : {})}
        />
        <button
          type="button"
          className="campo-olho"
          tabIndex={-1}
          onClick={() => { setVisivel(v => !v) }}
          aria-label={visivel ? 'Esconder a senha' : 'Mostrar a senha'}
          title={visivel ? 'Esconder a senha' : 'Mostrar a senha'}
        >
          <Olho aberto={visivel} />
        </button>
      </div>
      {dica !== undefined && <span className="dica">{dica}</span>}
    </div>
  )
}

function Olho ({ aberto }: { aberto: boolean }) {
  const comum = {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }

  return aberto
    ? (
      <svg {...comum}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
        <path d="m3 3 18 18" />
      </svg>
      )
    : (
      <svg {...comum}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      )
}

const DICA_SENHA =
  'Pelo menos 12 caracteres. Uma frase curta que só você lembra funciona ' +
  'melhor que uma palavra com símbolos.'

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

      <CampoSenha nome="senha" rotulo="Sua senha" autoComplete="current-password" />

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

      <CampoSenha
        nome="senha" rotulo="Escolha uma senha"
        autoComplete="new-password" dica={DICA_SENHA}
      />
      <CampoSenha
        nome="confirmacao" rotulo="Repita a senha"
        autoComplete="new-password"
      />

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

// ------------------------------------------------------------- trocar a senha

/**
 * Changing the password from inside the account.
 *
 * Separate from `FormSenha` because it asks for the current password first, and
 * that field is the whole security difference between the two: the token forms
 * are authorised by a secret in the URL, this one by knowing the password it is
 * about to replace.
 */
export function FormTrocarSenha () {
  const [estado, acao] = useActionState(changePassword, VAZIO)

  return (
    <form action={acao} noValidate className="form-senha">
      <Aviso estado={estado} />

      <CampoSenha
        nome="atual" rotulo="Sua senha atual"
        autoComplete="current-password"
      />
      <CampoSenha
        nome="senha" rotulo="Senha nova"
        autoComplete="new-password" dica={DICA_SENHA}
      />
      <CampoSenha
        nome="confirmacao" rotulo="Repita a senha nova"
        autoComplete="new-password"
      />

      <Botao>Trocar a senha</Botao>
    </form>
  )
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

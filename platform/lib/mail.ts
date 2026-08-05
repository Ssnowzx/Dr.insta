import 'server-only'
import { createTransport } from 'nodemailer'
import type { Transporter } from 'nodemailer'

/**
 * Sending mail.
 *
 * Nodemailer is the one runtime dependency added for this: SMTP with STARTTLS,
 * AUTH negotiation, MIME encoding and quoted-printable is not something to
 * hand-roll on the path that delivers a credential. The project rule is to
 * justify every dependency, and this is the justification.
 *
 * When SMTP is not configured the link is written to the log instead, and the
 * screen says so. A screen that claims an email was sent when none was is worse
 * than one that admits it.
 */

let transporter: Transporter | undefined

export function mailConfigured (): boolean {
  return (process.env.SMTP_HOST ?? '').trim() !== ''
}

function transport (): Transporter {
  const host = (process.env.SMTP_HOST ?? '').trim()
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = (process.env.SMTP_USER ?? '').trim()
  const pass = process.env.SMTP_PASSWORD ?? ''

  /* Local development runs against a sink that speaks no STARTTLS. The escape
     hatch is explicit and refuses to exist in production, so it cannot be left
     on by accident — the failure mode of a quiet `requireTLS: false` is a
     password sent in the clear. */
  const insecure = (process.env.SMTP_INSECURE ?? '').trim() === 'true'
  if (insecure && process.env.NODE_ENV === 'production') {
    throw new Error('SMTP_INSECURE cannot be used in production: the password would travel unencrypted.')
  }

  transporter ??= createTransport({
    host,
    port,
    /* 465 is implicit TLS; 587 starts plain and upgrades with STARTTLS.
       `requireTLS` makes the upgrade mandatory rather than opportunistic — an
       unencrypted fallback would put the password on the wire. */
    secure: !insecure && port === 465,
    requireTLS: !insecure && port !== 465,
    ...(insecure ? { ignoreTLS: true } : {}),
    ...(user === '' ? {} : { auth: { user, pass } })
  })

  return transporter
}

interface Message {
  to: string
  subject: string
  /** Plain text. Always sent, and the only body when HTML is stripped. */
  text: string
  html: string
}

async function send (message: Message): Promise<void> {
  const from = (process.env.SMTP_FROM ?? '').trim()
  if (from === '') throw new Error('SMTP_FROM is not set.')

  await transport().sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  })
}

/**
 * Escapes text going into the HTML body.
 *
 * The only interpolated values are a name and a URL we generated, but a name
 * comes from a form. Escaping at the boundary costs nothing and removes the
 * question entirely.
 */
function escape (value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The shared shell.
 *
 * Table-based and inline-styled on purpose: mail clients strip <style> blocks
 * and have no CSS grid. This is the one place in the project where 2005 HTML is
 * the correct answer.
 */
function shell (heading: string, body: string, cta: { url: string; label: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#fbf9f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf9f6;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #ded4c9;border-radius:14px;">
    <tr><td style="padding:32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#14100d;">
      <p style="margin:0 0 24px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6f6459;">My Favorite</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;font-weight:600;color:#14100d;">${heading}</h1>
      <div style="font-size:15px;line-height:1.6;color:#4a423a;">${body}</div>
      <p style="margin:28px 0 0;">
        <a href="${escape(cta.url)}" style="display:inline-block;background:#14100d;color:#fdfbf8;text-decoration:none;font-size:15px;font-weight:600;padding:14px 22px;border-radius:10px;">${cta.label}</a>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6f6459;">
        Se o botão não abrir, copie este endereço:<br>
        <span style="word-break:break-all;color:#96682f;">${escape(cta.url)}</span>
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`
}

/** Logs the link when SMTP is absent, so onboarding never waits on a mail server. */
function logInstead(kind: string, to: string, url: string): void {
  console.warn(`[${kind}] sem SMTP configurado. Link para ${to}: ${url}`)
}

export async function sendInvite (
  to: string,
  name: string,
  url: string,
  role: 'consultant' | 'client'
): Promise<{ sent: boolean }> {
  if (!mailConfigured()) {
    logInstead('convite', to, url)
    return { sent: false }
  }

  const first = name.split(' ')[0] ?? name
  const body = role === 'consultant'
    ? '<p style="margin:0;">Seu acesso de consultor está pronto. Escolha uma senha e os painéis, planos e retornos de cada cliente ficam num lugar só.</p>'
    : '<p style="margin:0;">Sua área está pronta. É onde vão viver o plano, os números e o que eu precisar te pedir — tudo num lugar só, sem link novo a cada vez.</p><p style="margin:16px 0 0;">O link abaixo vale por sete dias e só pode ser usado uma vez.</p>'

  await send({
    to,
    subject: 'Sua área na My Favorite está pronta',
    text: `Oi, ${first}.\n\nEscolha uma senha para entrar:\n${url}\n\nO link vale por sete dias e só pode ser usado uma vez.`,
    html: shell(`Oi, ${escape(first)}.`, body, { url, label: 'Criar minha senha' })
  })

  return { sent: true }
}

export async function sendReset (to: string, name: string, url: string): Promise<{ sent: boolean }> {
  if (!mailConfigured()) {
    logInstead('recuperacao', to, url)
    return { sent: false }
  }

  const first = name.split(' ')[0] ?? name

  await send({
    to,
    subject: 'Criar uma senha nova',
    text: `Oi, ${first}.\n\nUse este link para criar uma senha nova:\n${url}\n\nEle vale por uma hora. Se não foi você que pediu, pode ignorar — nada muda.`,
    html: shell(
      `Oi, ${escape(first)}.`,
      '<p style="margin:0;">Recebi um pedido para criar uma senha nova na sua conta.</p>' +
      '<p style="margin:16px 0 0;">O link abaixo vale por <strong>uma hora</strong>. Se não foi você que pediu, pode ignorar este e-mail — nada muda.</p>',
      { url, label: 'Criar senha nova' }
    )
  })

  return { sent: true }
}

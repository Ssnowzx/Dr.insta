import { describe, expect, it } from 'vitest'
import { escapeHtml, mailConfigured } from '../lib/mail.ts'

/**
 * The parts of mail that do not need a socket.
 *
 * `escapeHtml` guards the one place where a value from a form — a person's
 * name, typed by whoever created the account — reaches an HTML body. Mail
 * clients render HTML, so an unescaped name is a live injection point in a
 * message the recipient has every reason to trust.
 */

describe('escapeHtml', () => {
  it('should neutralise a script tag', () => {
    // ARRANGE
    const name = '<script>alert(1)</script>'

    // ACT
    const escaped = escapeHtml(name)

    // ASSERT
    expect(escaped).not.toContain('<script>')
    expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('should escape a quote that would break out of an attribute', () => {
    // ARRANGE — the URL goes into href="…", so a bare quote ends the attribute
    // ACT / ASSERT
    expect(escapeHtml('" onmouseover="alert(1)'))
      .toBe('&quot; onmouseover=&quot;alert(1)')
  })

  it('should escape the ampersand first, so an escape is not double-encoded', () => {
    // ARRANGE — replacing < before & would turn "&lt;" into "&amp;lt;" on a
    // second pass, and the reader sees the entity instead of the character
    // ACT / ASSERT
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('<')).toBe('&lt;')
  })

  it('should leave ordinary text and accents alone', () => {
    // ARRANGE / ACT / ASSERT — her name must survive intact
    expect(escapeHtml('Bianca Olivo')).toBe('Bianca Olivo')
    expect(escapeHtml('relatório de julho')).toBe('relatório de julho')
  })
})

describe('mailConfigured', () => {
  it('should report false when no host is set', () => {
    // ARRANGE — with no host the flows log the link instead, and the screen
    // says so rather than claiming an email was sent
    const before = process.env.SMTP_HOST
    process.env.SMTP_HOST = ''

    // ACT / ASSERT
    expect(mailConfigured()).toBe(false)
    process.env.SMTP_HOST = before
  })

  it('should report false for a host of only whitespace', () => {
    // ARRANGE — an env file with a trailing space would otherwise look configured
    const before = process.env.SMTP_HOST
    process.env.SMTP_HOST = '   '

    // ACT / ASSERT
    expect(mailConfigured()).toBe(false)
    process.env.SMTP_HOST = before
  })

  it('should report true when a host is set', () => {
    // ARRANGE
    const before = process.env.SMTP_HOST
    process.env.SMTP_HOST = 'smtp.exemplo.com.br'

    // ACT / ASSERT
    expect(mailConfigured()).toBe(true)
    process.env.SMTP_HOST = before
  })
})

describe('undeliverable addresses', () => {
  it('should refuse an address that can never receive mail', async () => {
    // ARRANGE — the failure this prevents is the quietest kind: the SMTP server
    // accepts the handoff, the log says "sent", and nobody ever receives
    // anything. The daily summary would report to nowhere every morning and
    // look healthy doing it.
    const before = { host: process.env.SMTP_HOST, from: process.env.SMTP_FROM }
    process.env.SMTP_HOST = '127.0.0.1'
    process.env.SMTP_FROM = 'Teste <teste@exemplo.invalido>'

    const { sendReset } = await import('../lib/mail.ts')

    // ACT / ASSERT
    await expect(sendReset('rodrigo@exemplo.invalido', 'Rodrigo', 'https://x/y'))
      .rejects.toThrow(/never receive mail/)
    await expect(sendReset('alguem@example.com', 'Alguém', 'https://x/y'))
      .rejects.toThrow(/never receive mail/)
    await expect(sendReset('alguem@teste.test', 'Alguém', 'https://x/y'))
      .rejects.toThrow(/never receive mail/)

    process.env.SMTP_HOST = before.host
    process.env.SMTP_FROM = before.from
  })
})

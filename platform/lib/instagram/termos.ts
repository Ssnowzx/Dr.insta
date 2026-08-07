/**
 * What she is agreeing to, in her words.
 *
 * Written here and not in the page so that the version and the text live
 * together. When the scopes change this text has to change with them, and the
 * version bump is what makes an old acceptance stop counting — "she agreed" is
 * worth nothing without "to what".
 *
 * The rule for the wording: every line describes a CONSEQUENCE, never a scope
 * name. `instagram_business_manage_insights` tells her nothing, and the point
 * of this screen is that she can decide, not that we can prove we told her.
 *
 * The "does not" list is longer than the "does" list on purpose. What a person
 * fears when connecting an account is the reach of it, and answering that
 * directly is worth more than any assurance about intentions.
 */

/**
 * Bump this whenever either list changes. Dated rather than numbered so the
 * value itself says when it was written.
 */
export const TERMS_VERSION = '2026-08-07'

/** What the platform will read. */
export const LE = [
  'Quantas contas viram seus posts, e quantas abriram seu perfil',
  'Salvamentos, compartilhamentos, curtidas e comentários — os totais, não quem fez',
  'Cliques no link da sua bio',
  'A lista dos seus posts, com data, duração e legenda',
  'Até onde as pessoas assistem seus Reels, em média',
  'Faixa etária, gênero e cidade de quem te acompanha — somados, nunca pessoa por pessoa'
] as const

/** What it cannot do, whatever happens. */
export const NAO_FAZ = [
  'Publicar, agendar ou apagar qualquer coisa',
  'Comentar, responder comentários ou curtir',
  'Ler ou enviar mensagens no Direct',
  'Mudar sua bio, seu link, sua foto ou seu nome',
  'Seguir ou deixar de seguir alguém',
  'Ver seu feed, seus Stories salvos ou quem você segue',
  'Ver ou mudar sua senha, seu e-mail ou suas configurações'
] as const

/**
 * The one sentence that matters most, kept apart from the lists so it cannot be
 * skimmed past: this is not a promise about what we intend to do, it is a
 * description of what the authorisation makes possible.
 */
export const GARANTIA =
  'Isso não é promessa de bom comportamento: a autorização que você dá é só de ' +
  'leitura. Mesmo que alguém roubasse o acesso, não conseguiria publicar nem ' +
  'mandar mensagem pela sua conta.'

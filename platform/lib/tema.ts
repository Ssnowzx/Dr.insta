/**
 * What the server and the browser both have to agree on about the theme.
 *
 * This lives outside `components/tema.tsx` on purpose. That file is a
 * `'use client'` module, and importing a plain constant out of one into a
 * server component works today by way of the bundler being able to fold it —
 * not by contract. When it stops folding, the failure is a string turning into
 * a client reference and the head script emitting garbage, which nothing here
 * would catch.
 *
 * Deliberately free of `server-only`: both sides import it.
 */

export const CHAVE_TEMA = 'tema'

/** The saved themes. `sistema` is the absence of a choice, so it is not stored. */
export type Tema = 'sistema' | 'claro' | 'escuro'

/**
 * Applies the saved theme before the first paint, inlined in the document head.
 *
 * Without it the page renders in the OS theme and corrects itself on hydration
 * — a white flash on every navigation for anyone who chose dark. It is a string
 * because it has to run before React exists, and it swallows its own errors:
 * Safari in private mode throws on `localStorage`, and a theme preference is
 * never worth a blank page.
 */
export const SCRIPT_TEMA =
  `(function(){try{var t=localStorage.getItem('${CHAVE_TEMA}');` +
  `if(t==='claro'||t==='escuro')document.documentElement.dataset.tema=t}catch(e){}})()`

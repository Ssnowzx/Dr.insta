import { Fragment } from 'react'

/**
 * Request descriptions carry real instructions — including links she has to
 * open. Rendered as plain text, a link is an instruction she cannot follow
 * with a tap, and on a phone that means she will not follow it.
 *
 * Only URLs written with an explicit http(s) protocol become anchors: no
 * domain guessing, so ordinary prose can never turn into a wrong link. The
 * protocol is dropped from the visible label because it is noise she does
 * not need to read.
 */
const URL_PATTERN = /https?:\/\/[^\s]+/g

export function RequestText ({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN)
  const links = text.match(URL_PATTERN) ?? []

  return (
    <>
      {parts.map((part, i) => {
        const link = links[i]
        return (
          /* Positional keys are safe here: the list is derived from a single
             immutable string and never reorders. */
          <Fragment key={i}>
            {part}
            {link !== undefined && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="desc-link"
              >
                {link.replace(/^https?:\/\//, '')}
              </a>
            )}
          </Fragment>
        )
      })}
    </>
  )
}

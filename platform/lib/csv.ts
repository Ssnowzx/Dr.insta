/**
 * A small RFC 4180 reader.
 *
 * Written rather than depended on because the input is one known file and the
 * hard part is exactly two rules: a quoted field may contain commas and
 * newlines, and `""` inside a quoted field is one quote. Her captions contain
 * both, so a `split(',')` would shred them silently — the row count would still
 * look right.
 */

export type Row = Record<string, string>

export function parseCsv (text: string): Row[] {
  const records = parseRecords(text)
  const header = records.shift()
  if (header === undefined) return []

  return records
    /* A trailing newline yields a final record of one empty field. Dropping it
       here beats every consumer having to guard against a blank row. */
    .filter(fields => !(fields.length === 1 && fields[0] === ''))
    .map(fields => {
      const row: Row = {}
      header.forEach((name, i) => { row[name.trim()] = fields[i] ?? '' })
      return row
    })
}

function parseRecords (text: string): string[][] {
  const records: string[][] = []
  let fields: string[] = []
  let value = ''
  let quoted = false
  let i = 0

  /* A BOM ahead of the first header name would make the column unreachable by
     its own name — Excel writes one. */
  if (text.charCodeAt(0) === 0xfeff) i = 1

  while (i < text.length) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { value += '"'; i += 2; continue }
        quoted = false
        i++
        continue
      }
      value += char
      i++
      continue
    }

    if (char === '"') { quoted = true; i++; continue }
    if (char === ',') { fields.push(value); value = ''; i++; continue }

    if (char === '\n' || char === '\r') {
      /* Accept CRLF, LF and CR alike: the file may have come from Excel on
         Windows, from a Mac export, or from a shell. */
      if (char === '\r' && text[i + 1] === '\n') i++
      fields.push(value)
      records.push(fields)
      fields = []
      value = ''
      i++
      continue
    }

    value += char
    i++
  }

  if (value !== '' || fields.length > 0) {
    fields.push(value)
    records.push(fields)
  }

  return records
}

/** A number, or `null`. Empty and unparseable both become `null`, never 0 — a missing measurement is not a zero measurement. */
export function num (value: string | undefined): number | null {
  if (value === undefined) return null
  const clean = value.trim()
  if (clean === '') return null
  const n = Number(clean.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

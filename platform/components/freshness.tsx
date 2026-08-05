import { ageOf, endOfMonth } from '@/lib/freshness'
import { longDate, monthLabel } from '@/lib/format'

/**
 * Says out loud how old the numbers are.
 *
 * Nothing here updates by itself. The failure this prevents is quiet: she opens
 * the panel weeks later, reads a number with no date on it, and treats it as
 * today's. A stale number presented as current is worse than no number.
 *
 * The tone escalates with the age rather than shouting from day one — a warning
 * that always looks urgent stops being read.
 */
export function DataAge ({ period }: { period: string }) {
  const age = ageOf(endOfMonth(period))

  if (age.level === 'fresh') {
    return (
      <p className="idade idade-fresca">
        Números de <strong>{monthLabel(period)}</strong>, {age.label}.
      </p>
    )
  }

  return (
    <p className={`idade idade-${age.level}`}>
      <strong>Estes números são de {monthLabel(period)}</strong> — {age.label}.{' '}
      {age.level === 'stale'
        ? 'Já passou mais de um mês fechado desde então, então eles não descrevem o momento. Me mande o Insights do período novo e eu atualizo.'
        : 'Eles não entram sozinhos: eu atualizo quando você me manda o Insights do mês.'}
    </p>
  )
}

/**
 * The archive's own age, which is a different date from the metrics.
 *
 * The two are separated on purpose: the archive can be a day old while the
 * metrics are a month old, and collapsing them into one date would make one of
 * the two a lie.
 */
export function ArchiveAge ({ importedAt, lastPostAt }: { importedAt: Date; lastPostAt: Date }) {
  const age = ageOf(importedAt)

  return (
    <p className={age.level === 'fresh' ? 'idade idade-fresca' : `idade idade-${age.level}`}>
      Acervo atualizado {age.label === 'de hoje' ? 'hoje' : age.label}, e o último
      Reel aqui é de <strong>{longDate(lastPostAt)}</strong>.
      {age.level !== 'fresh' && ' O que você postou depois disso ainda não entrou.'}
    </p>
  )
}

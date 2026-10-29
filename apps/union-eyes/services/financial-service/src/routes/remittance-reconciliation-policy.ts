/**
 * Currency arithmetic for remittance reconciliation.
 *
 * Monetary columns are NUMERIC(..., 2); converting their decimal text into
 * integer cents avoids floating-point reconciliation drift and prevents a
 * malformed upstream amount from being treated as an accepted payment.
 */
export function moneyToCents(value: string | number): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim())
  if (!match) throw new Error('Invalid remittance monetary amount')
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) throw new Error('Remittance amount exceeds safe precision')
  return match[1] === '-' ? -cents : cents
}

export function calculateRemittanceVariance(
  expected: string | number,
  transactions: readonly (string | number)[],
): { expectedAmount: number; matchedAmount: number; variance: number; varianceAmount: string; exactMatch: boolean } {
  const expectedCents = moneyToCents(expected)
  const matchedCents = transactions.reduce<number>((sum, amount) => {
    const total = sum + moneyToCents(amount)
    if (!Number.isSafeInteger(total)) throw new Error('Remittance total exceeds safe precision')
    return total
  }, 0)
  const varianceCents = expectedCents - matchedCents
  if (!Number.isSafeInteger(varianceCents)) throw new Error('Remittance variance exceeds safe precision')
  return {
    expectedAmount: expectedCents / 100,
    matchedAmount: matchedCents / 100,
    variance: varianceCents / 100,
    varianceAmount: (varianceCents / 100).toFixed(2),
    exactMatch: varianceCents === 0,
  }
}

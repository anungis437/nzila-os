import type { CreditorClassification } from '@nzila/trustcore-contracts'

/**
 * Distribution priority order for Canadian insolvency practice
 * (highest priority first). Used by the distribution waterfall + dashboards.
 *
 * NOTE: Statutory deeming priorities (CRA source-deductions, employee wages)
 * are modelled as `priority` here; finer-grained statutory tiers are out of
 * scope for v1 and live in the policy engine YAML when introduced.
 */
export const CREDITOR_PRIORITY_ORDER: ReadonlyArray<CreditorClassification> = [
  'secured',
  'priority',
  'unsecured',
  'subordinated',
  'equity',
] as const

const PRIORITY_RANK: Record<CreditorClassification, number> =
  CREDITOR_PRIORITY_ORDER.reduce(
    (acc, cls, i) => {
      acc[cls] = i
      return acc
    },
    {} as Record<CreditorClassification, number>,
  )

/** Comparator: lower index = higher priority (sort ascending = descending priority). */
export function compareCreditorPriority(
  a: CreditorClassification,
  b: CreditorClassification,
): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b]
}

/** Returns the higher-priority classification of the pair. */
export function higherPriority(
  a: CreditorClassification,
  b: CreditorClassification,
): CreditorClassification {
  return compareCreditorPriority(a, b) <= 0 ? a : b
}

export const FINANCE_FLAGS = {
  FINANCE_CORE_ENABLED: 'FINANCE_CORE_ENABLED',
  FINANCE_LEDGER_ENABLED: 'FINANCE_LEDGER_ENABLED',
  FINANCE_PAYMENTS_ENABLED: 'FINANCE_PAYMENTS_ENABLED',
  FINANCE_PAYOUTS_ENABLED: 'FINANCE_PAYOUTS_ENABLED',
  FINANCE_DUES_ENABLED: 'FINANCE_DUES_ENABLED',
  FINANCE_GOVERNANCE_ENABLED: 'FINANCE_GOVERNANCE_ENABLED',
  FINANCE_COMPLIANCE_ENABLED: 'FINANCE_COMPLIANCE_ENABLED',
  FINANCE_ANALYTICS_ENABLED: 'FINANCE_ANALYTICS_ENABLED',
  FINANCE_EXPERIMENTAL_ENABLED: 'FINANCE_EXPERIMENTAL_ENABLED',
} as const

export type FinanceFlag = (typeof FINANCE_FLAGS)[keyof typeof FINANCE_FLAGS]

const SAFE_DEFAULT_ON: ReadonlySet<string> = new Set([FINANCE_FLAGS.FINANCE_CORE_ENABLED])

export function resolveFinanceFlag(flag: string, env: Record<string, string> = process.env as Record<string, string>): boolean {
  const value = env[flag]
  if (value !== undefined) {
    return value === '1' || value.toLowerCase() === 'true'
  }
  return SAFE_DEFAULT_ON.has(flag)
}

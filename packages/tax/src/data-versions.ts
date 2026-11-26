/**
 * @nzila/tax — Data versioning & staleness tracking
 *
 * Tracks which tax year each CRA data module targets and when
 * the data was last verified against the authoritative CRA source.
 *
 * Libraries and UI components can import this to:
 * 1. Display "Data current as of..." notices
 * 2. Flag stale data (> 90 days since last verification)
 * 3. Drive automated update reminders in CI or dashboards
 */

export interface DataModuleVersion {
  /** Module name (matches the file / subpath export) */
  module: string
  /** Tax year the data applies to */
  taxYear: number | string
  /** When the data was last verified against the CRA source (ISO date) */
  lastVerified: string
  /** CRA publication / source reference */
  source: string
  /** Optional notes about the data */
  notes?: string
}

/**
 * Registry of all CRA data modules and their version metadata.
 * Update this whenever a module's data is refreshed.
 */
export const DATA_VERSIONS: DataModuleVersion[] = [
  {
    module: 'rates',
    taxYear: 2026,
    lastVerified: '2026-08-26',
    source: 'CRA T4012 (2026), Schedule 510, ITA s.123/125',
    notes: 'Federal & provincial corporate tax rates, SBD limits, capital gains inclusion',
  },
  {
    module: 'cra-deadlines',
    taxYear: 2026,
    lastVerified: '2026-08-26',
    source: 'ITA s.150(1)(a), s.157, CRA RC4022',
    notes: 'Auto-calculated T2/CO-17/GST filing & payment deadlines from FYE',
  },
  {
    module: 'bn-validation',
    taxYear: 'evergreen',
    lastVerified: '2026-08-26',
    source: 'CRA RC2 — Business Number Registration',
    notes: 'Luhn check algorithm, program ID codes (RC/RP/RT etc)',
  },
  {
    module: 'installments',
    taxYear: 2026,
    lastVerified: '2026-08-26',
    source: 'ITA s.157, CRA T7B-CORP',
    notes: 'Installment threshold ($3K), 3 CRA methods, quarterly CCPC',
  },
  {
    module: 'prescribed-interest',
    taxYear: '2023-2026',
    lastVerified: '2026-08-26',
    source: 'CRA IC07-1, Reg. 4301(a)',
    notes: 'Quarterly prescribed rates 2023 Q1 through 2026 Q4',
  },
  {
    module: 'gst-hst',
    taxYear: 2026,
    lastVerified: '2026-08-26',
    source: 'CRA GI-209, ETA s.165',
    notes: 'GST/HST/QST/PST rates by province, registration threshold',
  },
  {
    module: 'payroll-thresholds',
    taxYear: 2026,
    lastVerified: '2026-08-26',
    source: 'CRA T4001, CPP Regulations, EI Act',
    notes: 'Remitter types, CPP/CPP2/EI maximums for 2026',
  },
  {
    module: 'penalties',
    taxYear: 2026,
    lastVerified: '2026-08-26',
    source: 'ITA s.162, ETA s.280',
    notes: 'Late filing penalties: T2, GST/HST, information returns',
  },
  {
    module: 'personal-rates',
    taxYear: 2026,
    lastVerified: '2026-08-26',
    source: 'ITA s.117(2), CRA T1 General, Schedule 428',
    notes: 'Federal & provincial T1 brackets indexed for 2026, basic personal amounts',
  },
  {
    module: 'dividend-tax',
    taxYear: 2026,
    lastVerified: '2026-08-26',
    source: 'ITA s.82(1), s.121, s.129',
    notes: 'Dividend gross-up, DTC rates, RDTOH, salary vs dividend comparison',
  },
]

/** Maximum days before data is considered stale. A module is stale only after this age. */
export const STALENESS_THRESHOLD_DAYS = 90

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Parse a verification date as UTC midnight.
 * Calendar dates that roll over, such as 2026-02-31, are rejected.
 */
export function parseVerificationDate(value: string | null | undefined): Date | null {
  if (!value || !ISO_DATE.test(value)) return null
  const [, yearText, monthText, dayText] = ISO_DATE.exec(value) ?? []
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }
  return parsed
}

/**
 * Elapsed days from the UTC verification instant to `asOf`.
 * Returns null when the verification date is not a real calendar date.
 */
export function verificationAgeDays(lastVerified: string | null | undefined, asOf: Date): number | null {
  const verified = parseVerificationDate(lastVerified)
  if (!verified || Number.isNaN(asOf.getTime())) return null
  return (asOf.getTime() - verified.getTime()) / DAY_MS
}

/**
 * A module is stale unless its source is recorded and its verification age is
 * within the threshold, measured from an explicit instant.
 *
 * Invalid dates, blank sources, and future verification claims are stale.
 * Those inputs previously compared as not stale because `NaN > 90` is false
 * and a negative age is not greater than 90. Exactly 90 days remains current.
 */
export function isModuleStale(module: DataModuleVersion, asOfDate?: Date): boolean {
  const asOf = asOfDate ?? new Date()
  if (!module.source?.trim()) return true
  const age = verificationAgeDays(module.lastVerified, asOf)
  if (age === null || age < 0) return true
  return age > STALENESS_THRESHOLD_DAYS
}

/**
 * Select stale modules from an explicit registry. Callers that need a mixed
 * registry pass it here. The recorded registry stays unchanged.
 */
export function selectStaleModules(
  modules: readonly DataModuleVersion[],
  asOfDate?: Date,
): DataModuleVersion[] {
  return modules.filter((module) => isModuleStale(module, asOfDate))
}

/**
 * Get all stale modules in the recorded registry.
 */
export function getStaleModules(asOfDate?: Date): DataModuleVersion[] {
  return selectStaleModules(DATA_VERSIONS, asOfDate)
}

/**
 * Get the version info for a specific module.
 */
export function getModuleVersion(moduleName: string): DataModuleVersion | undefined {
  return DATA_VERSIONS.find((m) => m.module === moduleName)
}

/**
 * Get the latest verification date across all modules.
 */
export function getLatestVerificationDate(): string {
  return DATA_VERSIONS.reduce((latest, m) => (m.lastVerified > latest ? m.lastVerified : latest), '1970-01-01')
}

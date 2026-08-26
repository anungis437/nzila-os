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

/** Maximum days before data is considered stale */
export const STALENESS_THRESHOLD_DAYS = 90

/**
 * Check whether a data module's last verification date exceeds the staleness threshold.
 */
export function isModuleStale(module: DataModuleVersion, asOfDate?: Date): boolean {
  const now = asOfDate ?? new Date()
  const verified = new Date(module.lastVerified)
  const diffMs = now.getTime() - verified.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays > STALENESS_THRESHOLD_DAYS
}

/**
 * Get all stale modules.
 */
export function getStaleModules(asOfDate?: Date): DataModuleVersion[] {
  return DATA_VERSIONS.filter((m) => isModuleStale(m, asOfDate))
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

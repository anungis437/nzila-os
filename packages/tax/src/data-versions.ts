/**
 * @nzila/tax — Data versioning & staleness tracking
 *
 * Tracks which tax year each CRA data module targets and when
 * the declared reference data was last reviewed against primary government sources.
 * A current date does not certify every calculator or every taxation period;
 * taxYear, source and notes define the reviewed scope and known limitations.
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
  /** Review date of the declared reference scope (ISO date), not feature certification. */
  lastVerified: string
  /** Primary government publication / source reference */
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
    taxYear: 'current snapshot; 2026 transition conditions',
    lastVerified: '2026-11-23',
    source: 'CRA corporation rates and T4012; ITA ss.38,123.4,125,125.1; Revenu Quebec May 4, 2026 notice',
    notes: 'Current standard rates, SBD thresholds and enacted capital-gain inclusion reviewed. Date-free estimates do not prorate rate transitions, establish provincial eligibility or certify all historical effective dates. See REFERENCE_MAINTENANCE_20261123.md.',
  },
  {
    module: 'cra-deadlines',
    taxYear: 'ordinary corporate nominal dates; evergreen rules reviewed 2026',
    lastVerified: '2026-11-23',
    source: 'CRA T2 balance/filing guidance; GST filing guidance; T4068; Revenu Québec corporate and filing-frequency guidance',
    notes: 'Nominal dates only before applicable weekend/public-holiday extensions. Ordinary corporate GST/QST only. Three-month T2 balance requires explicitly established CRA eligibility; T5013 requires known partner composition and shared fiscal period. Special financial-institution/individual GST rules excluded.',
  },
  {
    module: 'bn-validation',
    taxYear: 'evergreen published format and program identifiers',
    lastVerified: '2026-11-23',
    source: 'CRA program account types (updated 2026-09-03); Government of Quebec NEQ format',
    notes: 'Published BN/program/NEQ formats and current program IDs verified. Legacy Luhn and nonzero-reference restrictions remain local policy, not CRA-attested checksum/registration rules. No account assignment or live registration verification.',
  },
  {
    module: 'installments',
    taxYear: '2026 full-year CRA instalment basis',
    lastVerified: '2026-11-23',
    source: 'CRA 2026 instalment worksheets and due-date guidance; ITA s.157',
    notes: 'Simple full-year basis without refundable-credit adjustments only; test federal and CRA-administered provincial thresholds separately. Quebec/Alberta and short years excluded. Quarterly status must already qualify. Scalar payment output does not represent the reduced method\'s uneven schedule. Dates are nominal; single-rate interest is not a complete CRA assessment.',
  },
  {
    module: 'prescribed-interest',
    taxYear: '2023 Q1 through 2026 Q4',
    lastVerified: '2026-11-23',
    source: 'Original CRA prescribed-interest publications for all 16 quarters; Income Tax Regulations 4301',
    notes: 'All quarterly rate/date fields compared; four historical rows corrected. Verification ends December 31, 2026. Legacy out-of-range fallback values remain unverified.',
  },
  {
    module: 'gst-hst',
    taxYear: 'standard rates current November 2026',
    lastVerified: '2026-11-23',
    source: 'CRA GST/HST provincial rate table; RC4022; provincial QST/PST references',
    notes: 'All 13 standard provincial/territorial rows and scoped registration/quick-method thresholds reviewed. No place-of-supply, exemption, registration or quick-method eligibility determination; QST recovery is separate from CRA input credits.',
  },
  {
    module: 'payroll-thresholds',
    taxYear: 2026,
    lastVerified: '2026-11-23',
    source: 'CRA T4032/T4127 2026; current CRA remitter classification guidance',
    notes: 'Standard CPP/CPP2 and Canada-except-Quebec EI constants reviewed. Quarterly status requires separately confirmed eligibility; unknown status defaults to regular. Remittance dates are nominal, before weekend/holiday adjustment. QPP/QPIP and reduced employer premiums excluded.',
  },
  {
    module: 'penalties',
    taxYear: 'evergreen ordinary rules reviewed 2026',
    lastVerified: '2026-11-23',
    source: 'ITA s.162(1),(2),(7.01),(7.1), current to 2026-10-29; ETA s.280.1; current CRA information-return relief table',
    notes: 'Ordinary resident-corporation T2 penalty, ordinary GST late-filing formula, prescribed-slip tiers/administrative relief, and ordinary T5013 filing penalty. Explicitly known partial-month lateness and T2 filing-demand/prior-penalty criteria supported. Non-resident minima, gross-negligence and heightened partnership repeat penalties are not assessed by these inputs.',
  },
  {
    module: 'personal-rates',
    taxYear: 2026,
    lastVerified: '2026-11-23',
    source: 'CRA detailed T4127 July 2026 tables; Manitoba Income Tax Act 4.1(2); Revenu Quebec 2026 tables',
    notes: 'Annual bracket arrays and maximum basic personal amounts reviewed. Maximum-only estimates omit income phaseouts, Ontario surtax/health premium and Quebec federal abatement. Deprecated 2025 names alias 2026 data, not historical schedules.',
  },
  {
    module: 'dividend-tax',
    taxYear: 'mixed: evergreen statutory DTC rules; AB/NU latest published 2025 worksheets; 2026 CPP1 illustration',
    lastVerified: '2026-11-23',
    source: 'CRA T5 Rev26; provincial/territorial tax acts and official guides; CRA AB428/NU428 2025; CPP 2026 table',
    notes: 'All13jurisdiction values have identified primary provenance. AB/NU worksheets currently list2025 only and do not certify2026. SK uses s.32(h) after2024c22 repealed scheduled2026increase. PE/SK retain statutory gross-up fractions; other CRA table values retain published rounding. RDTOH output is a potential ceiling, not a pool-qualified refund. Salary employerCpp illustrates2026CPP1 only, excludesCPP2 and QuebecQPP.',
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

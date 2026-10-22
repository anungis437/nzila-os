import { sql } from 'drizzle-orm'
import contract from './catalog-authority-contract.json'
import { admissionQueries, assessCatalogAdmission } from './catalog-admission-core.mjs'
import { canonicalCatalogContract, inspectCanonicalAuthCatalog } from './canonical-catalog-admission'

export const CATALOG_ADMISSION_PUBLIC_ERROR = 'catalog authority admission failed'

type QueryRow = Record<string, unknown>

export type CatalogAdmissionReport = {
  ok: boolean
  applicationReady: false
  environment: string
  source: string
  violations: string[]
}

async function executeWithAppDatabase(statement: string): Promise<QueryRow[]> {
  const { db } = await import('@nzila/db')
  // Cast needed: the health pool and this module can resolve different drizzle copies.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await db.execute(sql.raw(statement) as any)
  return Array.from(result as Iterable<QueryRow>)
}

/**
 * Read-only admission for the packaged application. The contract is bundled.
 * This does not open a raw driver, spawn a CLI, or change privileges.
 */
export async function evaluateCatalogAdmission(
  execute: (statement: string) => Promise<QueryRow[]> = executeWithAppDatabase,
): Promise<CatalogAdmissionReport> {
  const snapshots: Record<string, QueryRow[]> = {}
  for (const query of admissionQueries) {
    snapshots[query.name] = await execute(query.sql)
  }
  const canonical = process.env.UE_CANONICAL_BOOTSTRAP_V2 === '1'
  const report = assessCatalogAdmission(
    canonical ? canonicalCatalogContract() : contract,
    snapshots,
    process.env.UE_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
  )
  if (canonical) {
    report.violations.push(...await inspectCanonicalAuthCatalog(execute))
    report.ok = report.violations.length === 0
  }
  return report
}

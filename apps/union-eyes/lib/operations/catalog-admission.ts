import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import contract from './catalog-authority-contract.json'
import { admissionQueries, assessCatalogAdmission, catalogContractDigest } from './catalog-admission-core.mjs'
import { canonicalCatalogContract, inspectCanonicalAuthCatalog } from './canonical-catalog-admission'

export const CATALOG_ADMISSION_PUBLIC_ERROR = 'catalog authority admission failed'

type QueryRow = Record<string, unknown>
type Execute = (statement: string) => Promise<QueryRow[]>

export type CatalogAdmissionReport = {
  ok: boolean
  applicationReady: false
  environment: string
  source: string
  violations: string[]
}

type AdmissionContext = { canonical: boolean; environment: string }
type InFlightInspections = Map<string, Promise<CatalogAdmissionReport>>

// Next can bundle health and readiness separately. Share their running inspection
// within this process, rather than sending duplicate scans through the same pool.
// The fingerprint also separates independently packaged or corrupted contracts.
const inFlightKey = Symbol.for('nzila.union-eyes.catalog-admission.in-flight.v1')
const inspectionGlobal = globalThis as typeof globalThis & { [inFlightKey]?: InFlightInspections }
const contractFingerprint = catalogContractDigest({ legacy: contract, canonical: canonicalCatalogContract() })

async function appDatabaseExecutor(): Promise<Execute> {
  const { db } = await import('@nzila/db')
  return async statement => {
    // Cast needed: the health pool and this module can resolve different drizzle copies.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.execute(sql.raw(statement) as any)
    return Array.from(result as Iterable<QueryRow>)
  }
}

/**
 * Read-only admission for the packaged application. The contract is bundled.
 * This does not open a raw driver, spawn a CLI, or change privileges.
 */
async function inspectCatalogAdmission(
  execute: Execute,
  context: AdmissionContext,
): Promise<CatalogAdmissionReport> {
  const snapshots: Record<string, QueryRow[]> = {}
  for (const query of admissionQueries) {
    snapshots[query.name] = await execute(query.sql)
  }
  const report = assessCatalogAdmission(
    context.canonical ? canonicalCatalogContract() : contract,
    snapshots,
    context.environment,
  )
  if (context.canonical) {
    report.violations.push(...await inspectCanonicalAuthCatalog(execute))
    report.ok = report.violations.length === 0
  }
  return report
}

/** Coalesce only an overlapping default inspection. No settled success or
 * failure is cached; the next request inspects current privileges again.
 * Explicit executors can target another connection or transaction and never
 * participate in the process-wide default-database flight.
 */
export async function evaluateCatalogAdmission(execute?: Execute): Promise<CatalogAdmissionReport> {
  const context = {
    canonical: process.env.UE_CANONICAL_BOOTSTRAP_V2 === '1',
    environment: process.env.UE_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
  }
  if (execute) return inspectCatalogAdmission(execute, context)

  const database = createHash('sha256').update(process.env.DATABASE_URL ?? '').digest('hex')
  const key = JSON.stringify([contractFingerprint, context, database, process.env.GIT_SHA ?? ''])
  const inspections = inspectionGlobal[inFlightKey] ??= new Map()
  let pending = inspections.get(key)
  if (!pending) {
    pending = appDatabaseExecutor()
      .then(executeDefault => inspectCatalogAdmission(executeDefault, context))
      .finally(() => {
        if (inspections.get(key) === pending) inspections.delete(key)
      })
    inspections.set(key, pending)
  }
  const report = await pending
  // Keep one caller's diagnostics from mutating another caller's result.
  return { ...report, violations: [...report.violations] }
}

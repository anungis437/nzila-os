/**
 * Fast R-46 loop: builds the canonical V2 database fixture (disposable docker, loopback-only) and runs the application's own catalog
 * admission against it through a runtime-role pool, printing the violations. No Next build, no HTTP.
 *   tsx scripts/runtime/v2-admission-probe.ts [--json]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { evaluateCatalogAdmission } from '../../lib/operations/catalog-admission'
import { folder, type V2Plan } from '../bootstrap-v2/source'
import { openNativeRuntimeFixture } from '../bootstrap-v2/native-runtime-fixture'

async function main() {
  const plan: V2Plan = JSON.parse(readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'))
  const fixture = await openNativeRuntimeFixture(plan, { auth: true })
  try {
    // Admission reads the catalog through the same pool the application uses: the runtime role.
    const pool = new pg.Pool({ connectionString: fixture.runtimeUrl, max: 1 })
    const execute = async (statement: string) => (await pool.query(statement)).rows
    const report = await evaluateCatalogAdmission(execute as never)
    await pool.end()
    console.log(`ok=${report.ok} violations=${report.violations.length}`)
    for (const v of report.violations) console.log(' -', v)
    if (process.argv.includes('--json')) writeFileSync(path.join(process.env.TEMP ?? '.', 'v2-admission.json'), JSON.stringify(report, null, 1))
  } finally {
    await fixture.dispose()
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exit(1)
})

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import { buildPlan, folder } from './source'

export async function main() {
  const wheelhouse = process.env.UE_V2_WHEELHOUSE
  if (!wheelhouse) throw new Error('UE_V2_WHEELHOUSE_REQUIRED')
  const plan = await buildPlan(wheelhouse)
  mkdirSync(folder, { recursive: true })
  const bytes = await format(JSON.stringify(plan), { parser: 'json' })
  const target = path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json')
  if (process.argv.includes('--self-test')) {
    const repeated = await buildPlan(wheelhouse)
    assert.equal(
      JSON.stringify(repeated),
      JSON.stringify(plan),
      'UE_V2_GENERATION_NOT_DETERMINISTIC',
    )
  }
  if (process.argv.includes('--check'))
    assert.equal(readFileSync(target, 'utf8'), bytes, 'UE_V2_SOURCE_PLAN_DRIFT')
  else writeFileSync(target, bytes)
  process.stdout.write(
    JSON.stringify({
      tables: plan.tables.length,
      statements: plan.statements.length,
      decisions: plan.decisions.length,
      exclusions: plan.exclusions.length,
      securityBlockers: plan.securityBlockers.length,
      fullReadiness: 'NOT_YET_PROVEN',
    }) + '\n',
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })

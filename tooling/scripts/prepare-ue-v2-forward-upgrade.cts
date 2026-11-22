/** Build-time asset preparation. SQL query generation is not native execution
 * evidence; the export's actual native qualification remains independently bound. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { inspectCatalog, catalogDigest } from '../../apps/union-eyes/scripts/bootstrap-v2/installer'
import { FORWARD_EVENT_CATALOG_QUERY } from './lib/ue-v2-forward-upgrade-runtime'

const root = path.resolve(__dirname, '../..')
const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  assert(i > 0 && process.argv[i + 1], `${name} required`)
  return path.resolve(process.argv[i + 1])
}
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
const git = (args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim()
async function main() {
  const exported = arg('--export'),
    out = arg('--out')
  const applicationSourceSha = '57728a2a750b28ee3dfd4b9eb82c54e03ad0bed3'
  const operatorSourceSha = git(['rev-parse', 'HEAD'])
  const plan = JSON.parse(
    fs.readFileSync(
      path.join(root, 'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'),
      'utf8',
    ),
  )
  const admittedPlan = JSON.parse(
    git([
      'show',
      `${applicationSourceSha}:docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json`,
    ]),
  )
  const sourcePlanDigest = hash(JSON.stringify(plan))
  assert.equal(
    sourcePlanDigest,
    hash(JSON.stringify(admittedPlan)),
    'UE_UPGRADE_APPLICATION_PLAN_DIFFERS',
  )
  assert.equal(sourcePlanDigest, '4a6f7127801d1dd1eb1e57ea370805326ff6764978c97c9de277dceda9c4f908')
  for (const [source, expected] of Object.entries(plan.sourceCommitments) as [string, string][]) {
    if (source.startsWith('python:')) continue
    assert.equal(
      hash(fs.readFileSync(path.join(root, source))),
      expected,
      `UE_UPGRADE_SOURCE_DRIFT:${source}`,
    )
    const original = execFileSync('git', ['show', `${applicationSourceSha}:${source}`], {
      cwd: root,
      maxBuffer: 32 * 1024 * 1024,
    })
    assert.equal(hash(original), expected, `UE_UPGRADE_APPLICATION_SOURCE_NOT_EQUIVALENT:${source}`)
  }
  const report = JSON.parse(
    fs.readFileSync(path.join(exported, 'export-qualification.json'), 'utf8'),
  )
  assert.equal(report.applicationSourceSha, operatorSourceSha)
  assert.equal(report.sourcePlanDigest, sourcePlanDigest)
  assert.equal(report.restoredDump, 'PASS')
  assert.equal(report.repeat, 'NOOP')
  assert.equal(report.restoredRepeat, 'NOOP')
  assert.equal(report.privilegeStatus, 'PASS_PUBLIC_AND_AUTH_NATIVE_PRIVILEGES')
  assert.deepEqual(report.privilegeMismatches, [])
  assert.equal(
    hash(fs.readFileSync(path.join(exported, 'schema.sql'))),
    report.files['schema.sql'].sha256,
  )
  const expected = JSON.parse(fs.readFileSync(path.join(exported, 'expected-catalog.json'), 'utf8'))
  assert.equal(catalogDigest(expected), report.catalogDigest)
  const queries: string[] = []
  await inspectCatalog({
    query: async (sql: string) =>
      sql.includes('server_version_num')
        ? { rows: [{ version: '160012' }] }
        : (queries.push(sql), { rows: [] }),
  } as unknown as pg.Client)
  queries.push(FORWARD_EVENT_CATALOG_QUERY)
  assert(queries.every((sql) => /^\s*SELECT\s/i.test(sql)))
  fs.mkdirSync(out, { recursive: true })
  for (const file of ['schema.sql', 'expected-catalog.json', 'export-qualification.json'])
    fs.copyFileSync(path.join(exported, file), path.join(out, file))
  fs.writeFileSync(path.join(out, 'catalog-queries.json'), JSON.stringify(queries))
  const files = Object.fromEntries(
    [
      'schema.sql',
      'expected-catalog.json',
      'export-qualification.json',
      'catalog-queries.json',
    ].map((file) => [file, hash(fs.readFileSync(path.join(out, file)))]),
  )
  fs.writeFileSync(
    path.join(out, 'manifest.json'),
    JSON.stringify(
      {
        version: 1,
        applicationSourceSha,
        operatorSourceSha,
        sourcePlanDigest,
        sourceBindingsVerifiedAgainstApplication: true,
        queryProgramGenerationOnly: true,
        files,
      },
      null,
      2,
    ),
  )
  console.log(
    JSON.stringify({
      applicationSourceSha,
      operatorSourceSha,
      sourcePlanDigest,
      queries: queries.length,
      nativeExportQualified: true,
    }),
  )
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'UE_UPGRADE_ASSET_PREPARATION_FAILED')
  process.exitCode = 1
})

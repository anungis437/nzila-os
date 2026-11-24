import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type pg from 'pg'
import { catalogDigest } from '../../../apps/union-eyes/scripts/bootstrap-v2/installer'
import {
  ALIAS_FUNCTION,
  load,
  assertPhysicalKBinding,
  assertOnlyAliasFunctionDelta,
  aliasReplacementIndexes,
  injectAfterActualAlias,
} from '../prove-ue-v2-second-increment.cts'
import type { ForwardUpgradeBundle } from './ue-v2-forward-upgrade-runtime'
import type { UpgradeObject } from './ue-v2-forward-upgrade'

const oldAlias = "linked_entity_type::text='grievance'"
const newAlias = "linked_entity_type::text IN ('case','grievance')"
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
const fn = (body = oldAlias): UpgradeObject => ({
  kind: 'function',
  id: ALIAS_FUNCTION,
  definition: {
    owner: 'ue_external_read_reader',
    acl: '{ue_external_read_reader=X/ue_external_read_reader}',
    config: ['search_path=pg_catalog'],
    definer: true,
    definition: `CREATE FUNCTION public.ue_external_sources_match(p jsonb) RETURNS boolean AS $function$ BEGIN RETURN EXISTS(SELECT FROM document_links WHERE ${body}); END; $function$ LANGUAGE plpgsql;`,
  },
})
const replacement = (
  sql = 'CREATE OR REPLACE FUNCTION public.ue_external_sources_match(p jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$',
) => ({ phase: 'function', object: ALIAS_FUNCTION, sql })
const bundle = (statements = [replacement()]): ForwardUpgradeBundle => ({
  version: 1,
  applicationSourceSha: 'a'.repeat(40),
  catalogSourceSha: 'a'.repeat(40),
  sourcePlanDigest: 'b'.repeat(64),
  catalogQueries: [],
  before: [fn()],
  target: [fn(newAlias)],
  statements,
})

function exportsFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ue-second-controls-')),
    physical = path.join(root, 'physical'),
    admitted = path.join(root, 'admitted')
  // These tiny unit fixtures exercise admission controls only; no native restore or qualification is claimed.
  const { mkdirSync } = require('node:fs') as typeof import('node:fs')
  mkdirSync(physical)
  mkdirSync(admitted)
  const body = '-- unit fixture only\nSELECT 1;\n'
  const guarded = (token: string) =>
    `-- unit fixture only\n\\restrict ${token}\n${body}\\unrestrict ${token}\n`
  const files = {
    'schema.sql': guarded('physical'),
    'receipt.sql': guarded('receipt'),
    'roles.sql': '-- unit fixture only\n',
    'schema-restore.sql': guarded('restore'),
    'receipt-restore.sql': guarded('receipt_restore'),
  }
  for (const [name, bytes] of Object.entries(files)) writeFileSync(path.join(physical, name), bytes)
  const catalog = [fn()],
    catalogBytes = JSON.stringify(catalog)
  writeFileSync(path.join(physical, 'expected-catalog.json'), catalogBytes)
  const report = {
    applicationSourceSha: 'f77804b4a8ac0ef8b8ae6c0ab891c1aa42008347',
    sourcePlanDigest: '983fc98751821e1121ce09b90aea577c13027588a50106f69f8bc9dcf90cc8a5',
    catalogDigest: catalogDigest(catalog),
    localOnly: true,
    restoredDump: 'PASS',
    repeat: 'NOOP',
    restoredRepeat: 'NOOP',
    privilegeStatus: 'PASS_PUBLIC_AND_AUTH_NATIVE_PRIVILEGES',
    privilegeMismatches: [],
    files: Object.fromEntries(
      Object.entries(files).map(([name, bytes]) => [name, { sha256: hash(bytes) }]),
    ),
  }
  writeFileSync(path.join(physical, 'export-qualification.json'), JSON.stringify(report))
  writeFileSync(path.join(admitted, 'schema.sql'), guarded('admitted'))
  writeFileSync(path.join(admitted, 'expected-catalog.json'), catalogBytes)
  writeFileSync(path.join(admitted, 'catalog-queries.json'), '[]')
  const admittedReport = {
    ...report,
    applicationSourceSha: '8b2583405b5265f78d5b627fafa79fe508f33b02',
    sourcePlanDigest: '6ec71d4631810207ffad4e5b78046be219528d27608a3da13170f3bb96c41161',
    files: { ...report.files, 'schema.sql': { sha256: hash(guarded('admitted')) } },
  }
  writeFileSync(path.join(admitted, 'export-qualification.json'), JSON.stringify(admittedReport))
  const rehashManifest = () =>
    writeFileSync(
      path.join(admitted, 'manifest.json'),
      JSON.stringify({
        version: 1,
        applicationSourceSha: '6a60c95c9de17e9343e0414bb51766afbc190054',
        operatorSourceSha: admittedReport.applicationSourceSha,
        sourcePlanDigest: admittedReport.sourcePlanDigest,
        files: Object.fromEntries(
          [
            'schema.sql',
            'expected-catalog.json',
            'catalog-queries.json',
            'export-qualification.json',
          ].map((name) => [name, hash(readFileSync(path.join(admitted, name)))]),
        ),
      }),
    )
  rehashManifest()
  return {
    root,
    physical,
    admitted,
    report,
    admittedReport,
    rehashManifest,
    close: () => rmSync(root, { recursive: true, force: true }),
  }
}

test('full physical-K fixture retains original f778 provenance while matching admitted K except pg_dump tokens', () => {
  const f = exportsFixture()
  try {
    const result = assertPhysicalKBinding(load(f.physical, true), f.admitted)
    assert.equal(result.provenanceRelabeled, false)
    assert.equal(result.physicalExportSourceSha, 'f77804b4a8ac0ef8b8ae6c0ab891c1aa42008347')
    assert.equal(result.applicationSourceSha, '6a60c95c9de17e9343e0414bb51766afbc190054')
  } finally {
    f.close()
  }
})

test('a changed or missing full-export file cannot be treated as a qualified preimage', () => {
  const f = exportsFixture()
  try {
    writeFileSync(path.join(f.physical, 'roles.sql'), 'tampered')
    assert.throws(() => load(f.physical, true))
  } finally {
    f.close()
  }
})

test('claimed native qualification without successful restored repeat is refused', () => {
  const f = exportsFixture()
  try {
    writeFileSync(
      path.join(f.physical, 'export-qualification.json'),
      JSON.stringify({ ...f.report, restoredRepeat: 'UNEXECUTED' }),
    )
    assert.throws(() => load(f.physical, true))
  } finally {
    f.close()
  }
})

test('a newly recomputed manifest cannot bless different K physical SQL', () => {
  const f = exportsFixture()
  try {
    const sql = readFileSync(path.join(f.admitted, 'schema.sql'), 'utf8').replace(
      'SELECT 1',
      'SELECT 2',
    )
    writeFileSync(path.join(f.admitted, 'schema.sql'), sql)
    writeFileSync(
      path.join(f.admitted, 'export-qualification.json'),
      JSON.stringify({
        ...f.admittedReport,
        files: { ...f.admittedReport.files, 'schema.sql': { sha256: hash(sql) } },
      }),
    )
    f.rehashManifest()
    assert.throws(
      () => assertPhysicalKBinding(load(f.physical, true), f.admitted),
      /SECOND_K_SCHEMA_SQL_DIFFERS/,
    )
  } finally {
    f.close()
  }
})

test('one exact alias predicate change preserves owner, ACL, definer and fixed search path', () => {
  assert.equal(assertOnlyAliasFunctionDelta([fn()], [fn(newAlias)]).authorityUnchanged, true)
})

test('the second increment refuses an unrelated function or any authority widening', () => {
  const before = [fn(), { ...fn(), id: 'unrelated(jsonb)' }]
  const after = [fn(newAlias), { ...fn(newAlias), id: 'unrelated(jsonb)' }]
  assert.throws(
    () => assertOnlyAliasFunctionDelta(before, after),
    /SECOND_UNEXPECTED_PHYSICAL_DELTA/,
  )
  const widened = fn(newAlias)
  widened.definition.acl = '{=X/ue_external_read_reader}'
  assert.throws(
    () => assertOnlyAliasFunctionDelta([fn()], [widened]),
    /SECOND_FUNCTION_AUTHORITY_CHANGED/,
  )
})

test('a new alias predicate with any other body edit is refused', () => {
  const changed = fn(newAlias)
  changed.definition.definition = String(changed.definition.definition).replace(
    'RETURN EXISTS',
    'RETURN NOT EXISTS',
  )
  assert.throws(
    () => assertOnlyAliasFunctionDelta([fn()], [changed]),
    /SECOND_ALIAS_BODY_DELTA_DIFFERS/,
  )
})

test('failure injection never fires on an unrelated step or old body', async () => {
  let reads = 0
  const client = {
    query: async () => {
      reads++
      return { rows: [{ prosrc: oldAlias }] }
    },
  } as unknown as Pick<pg.Client, 'query'>
  const work = bundle([{ phase: 'target-acl', object: 'public', sql: 'SELECT 1' }, replacement()])
  const inject = injectAfterActualAlias(client, work, 'EXPECTED_SENTINEL')
  await inject(0)
  assert.equal(reads, 0)
  await assert.rejects(inject(1), /SECOND_INJECTION_DID_NOT_OBSERVE_NEW_BODY/)
  assert.equal(reads, 1)
})

test('failure injection verifies the actually installed new body before throwing its sentinel', async () => {
  const client = { query: async () => ({ rows: [{ prosrc: newAlias }] }) } as unknown as Pick<
    pg.Client,
    'query'
  >
  await assert.rejects(
    injectAfterActualAlias(client, bundle(), 'AFTER_CONFIRMED_REPLACEMENT')(0),
    /AFTER_CONFIRMED_REPLACEMENT/,
  )
})

test('a missing or duplicate body replacement cannot produce a claimed injection proof', () => {
  const client = {} as Pick<pg.Client, 'query'>
  assert.throws(
    () => injectAfterActualAlias(client, bundle([]), 'unused'),
    /SECOND_EXACT_ALIAS_REPLACEMENT_REQUIRED/,
  )
  assert.throws(
    () => injectAfterActualAlias(client, bundle([replacement(), replacement()]), 'unused'),
    /SECOND_EXACT_ALIAS_REPLACEMENT_REQUIRED/,
  )
})

test('semantic repeat identifies no body replacement while permitting explicit ACL reapplication', () => {
  const repeat = bundle([
    {
      phase: 'reset-function-acl',
      object: ALIAS_FUNCTION,
      sql: 'REVOKE ALL ON FUNCTION public.ue_external_sources_match(jsonb) FROM PUBLIC',
    },
  ])
  assert.deepEqual(aliasReplacementIndexes(repeat), [])
  assert.equal(repeat.statements.length, 1)
})

// pg_dump's source-bound parsed fragment retains its leading comment delimiter.
test('actual pg_dump comment prefixes do not hide the function-body injection point', () => {
  const target = bundle([
    replacement(
      '--\n\nCREATE OR REPLACE FUNCTION public.ue_external_sources_match(p jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$',
    ),
  ])
  assert.deepEqual(aliasReplacementIndexes(target), [0])
})

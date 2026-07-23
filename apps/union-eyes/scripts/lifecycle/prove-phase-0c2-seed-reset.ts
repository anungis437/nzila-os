#!/usr/bin/env tsx
/**
 * Phase 0C.2 §10 — Seed / reset completion proof.
 *
 * Verifies the deterministic seed pipeline (`scripts/seed-test-env.ts`) against
 * a freshly-allocated disposable DB and proves that:
 *
 *   1. Seed completes to green on a bootstrap-only DB (no legacy replay).
 *   2. The 4 canonical fixture organizations, the 10 fixture users
 *      (including the 5 canonical primary personas), and the 3 fixture
 *      claim rows are all persisted.
 *   3. The seed is idempotent: re-running it against the same DB does NOT
 *      produce duplicate rows or increase the fixture counts (the seed's
 *      "reset" semantics act like an upsert).
 *
 * This is a Phase 0C.2 remediation proof — it is invoked manually via
 * `pnpm exec tsx apps/union-eyes/scripts/lifecycle/prove-phase-0c2-seed-reset.ts`
 * and writes evidence into
 * `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-seed-reset-proof.md`.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

import { allocateDatabase, dropDatabase } from './allocate-db'

const APP_ROOT = path.resolve(__dirname, '..', '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..')
const REPORT_PATH = path.resolve(
  REPO_ROOT,
  'reports',
  'audits',
  'cupe-national-phase-0',
  'phase-0c',
  'phase-0c2-seed-reset-proof.md',
)

const EXPECTED_ORG_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
]
const EXPECTED_USER_IDS_PRIMARY = [
  'ue-qa-member-primary',
  'ue-qa-steward-primary',
  'ue-qa-staff-primary',
  'ue-qa-executive-primary',
  'ue-qa-admin-primary',
]
const EXPECTED_ALL_USER_IDS = [
  ...EXPECTED_USER_IDS_PRIMARY,
  'ue-qa-member-secondary',
  'ue-qa-ux-tester-001',
  'ue-qa-auditor-readonly',
  'ue-qa-steward-secondary',
  'ue-qa-member-suspended',
]
const EXPECTED_CLAIM_IDS = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
]

interface FixtureCounts {
  organizations: number
  users: number
  organizationUsers: number
  claims: number
  organizationMembers: number
  authOrgPolicies: number
  authUserSessions: number
}

async function fetchCounts(dbUrl: string): Promise<FixtureCounts> {
  const c = new Client({ connectionString: dbUrl })
  await c.connect()
  try {
    const q = async (sql: string, params: unknown[]): Promise<number> => {
      const r = await c.query<{ n: string }>(sql, params)
      return parseInt(r.rows[0]?.n ?? '0', 10)
    }
    return {
      organizations: await q(
        `SELECT COUNT(*)::text AS n FROM public.organizations WHERE id = ANY($1::uuid[])`,
        [EXPECTED_ORG_IDS],
      ),
      users: await q(
        `SELECT COUNT(*)::text AS n FROM user_management.users WHERE user_id = ANY($1::varchar[])`,
        [EXPECTED_ALL_USER_IDS],
      ),
      organizationUsers: await q(
        `SELECT COUNT(*)::text AS n FROM user_management.organization_users WHERE user_id = ANY($1::varchar[])`,
        [EXPECTED_ALL_USER_IDS],
      ),
      claims: await q(
        `SELECT COUNT(*)::text AS n FROM public.claims WHERE claim_id = ANY($1::uuid[])`,
        [EXPECTED_CLAIM_IDS],
      ),
      organizationMembers: await q(
        `SELECT COUNT(*)::text AS n FROM public.organization_members WHERE user_id = ANY($1::varchar[])`,
        [EXPECTED_ALL_USER_IDS],
      ),
      authOrgPolicies: await q(
        `SELECT COUNT(*)::text AS n FROM user_management.org_auth_policies WHERE organization_id = ANY($1::uuid[])`,
        [EXPECTED_ORG_IDS],
      ),
      authUserSessions: await q(
        `SELECT COUNT(*)::text AS n FROM user_management.user_sessions WHERE user_id = ANY($1::varchar[])`,
        [EXPECTED_ALL_USER_IDS],
      ),
    }
  } finally {
    await c.end()
  }
}

function runSeed(dbUrl: string): { exitCode: number; durationSec: number; stderrTail: string } {
  const started = Date.now()
  const res = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'tsx', 'scripts/seed-test-env.ts'],
    {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
        QA_TEST_ENV: 'true',
        UE_TEST_USER_PASSWORD: process.env.UE_TEST_USER_PASSWORD ?? 'NzilaQa!2026',
      },
      stdio: 'pipe',
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  )
  const durationSec = (Date.now() - started) / 1000
  const stderrTail = (res.stderr ?? '').split('\n').slice(-20).join('\n')
  return { exitCode: res.status ?? -1, durationSec, stderrTail }
}

function countsMatch(before: FixtureCounts, after: FixtureCounts): { ok: boolean; deltas: string[] } {
  const deltas: string[] = []
  for (const k of Object.keys(before) as (keyof FixtureCounts)[]) {
    if (before[k] !== after[k]) deltas.push(`${k}: ${before[k]} → ${after[k]}`)
  }
  return { ok: deltas.length === 0, deltas }
}

function ensureReportDir(): void {
  const dir = path.dirname(REPORT_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

async function main(): Promise<void> {
  ensureReportDir()

  const lines: string[] = []
  const log = (s: string) => {
    lines.push(s)
    process.stdout.write(s + '\n')
  }

  log(`# Phase 0C.2 §10 — Seed / Reset Completion Proof`)
  log('')
  log(`**Generated:** ${new Date().toISOString()}`)
  log(`**Harness:** \`apps/union-eyes/scripts/lifecycle/prove-phase-0c2-seed-reset.ts\``)
  log(`**Seed script under proof:** \`apps/union-eyes/scripts/seed-test-env.ts\``)
  log('')
  log('---')
  log('')

  let alloc: Awaited<ReturnType<typeof allocateDatabase>> | null = null
  let verdict: 'PASS' | 'FAIL' = 'PASS'
  const failures: string[] = []

  try {
    log('## Step 1 — Allocate disposable DB (compliant bootstrap)')
    log('')
    alloc = await allocateDatabase({})
    log(`- dbName: \`${alloc.dbName}\``)
    log(`- runId: \`${alloc.runId}\``)
    log('')

    log('## Step 2 — Run seed (initial)')
    log('')
    const seed1 = runSeed(alloc.url)
    log(`- exit code: \`${seed1.exitCode}\``)
    log(`- duration: \`${seed1.durationSec.toFixed(2)}s\``)
    if (seed1.exitCode !== 0) {
      log('')
      log('- stderr tail:')
      log('  ```')
      log(seed1.stderrTail.split('\n').map((l) => '  ' + l).join('\n'))
      log('  ```')
      failures.push(`seed (initial) exited with code ${seed1.exitCode}`)
      verdict = 'FAIL'
    }
    log('')

    log('## Step 3 — Verify fixture rows persisted')
    log('')
    const counts1 = await fetchCounts(alloc.url)
    const rows: [string, number, number][] = [
      ['organizations (expected 3)', counts1.organizations, 3],
      ['user_management.users (expected 10)', counts1.users, 10],
      ['user_management.organization_users (expected 10)', counts1.organizationUsers, 10],
      ['public.claims (expected 3)', counts1.claims, 3],
      ['public.organization_members (expected 10)', counts1.organizationMembers, 10],
      ['user_management.org_auth_policies (expected 3)', counts1.authOrgPolicies, 3],
      ['user_management.user_sessions (expected 10)', counts1.authUserSessions, 10],
    ]
    log('| Table | Actual | Expected | OK? |')
    log('|---|---:|---:|:---:|')
    for (const [label, actual, expected] of rows) {
      const ok = actual === expected
      if (!ok) {
        failures.push(`${label}: expected ${expected}, got ${actual}`)
        verdict = 'FAIL'
      }
      log(`| ${label} | ${actual} | ${expected} | ${ok ? '✅' : '❌'} |`)
    }
    log('')

    log('## Step 4 — Verify 5 canonical primary personas present by email')
    log('')
    const c = new Client({ connectionString: alloc.url })
    await c.connect()
    let primaryEmails: string[] = []
    try {
      const r = await c.query<{ email: string }>(
        `SELECT email FROM user_management.users WHERE user_id = ANY($1::varchar[]) ORDER BY email`,
        [EXPECTED_USER_IDS_PRIMARY],
      )
      primaryEmails = r.rows.map((r) => r.email)
    } finally {
      await c.end()
    }
    const expectedEmails = [
      'ue.qa.admin.primary@nzila.test',
      'ue.qa.executive.primary@nzila.test',
      'ue.qa.member.primary@nzila.test',
      'ue.qa.staff.primary@nzila.test',
      'ue.qa.steward.primary@nzila.test',
    ]
    const missing = expectedEmails.filter((e) => !primaryEmails.includes(e))
    log('| Persona | Email | Present? |')
    log('|---|---|:---:|')
    for (const e of expectedEmails) {
      const present = primaryEmails.includes(e)
      if (!present) {
        failures.push(`canonical persona missing: ${e}`)
        verdict = 'FAIL'
      }
      log(`| ${e.split('@')[0].split('.').slice(2, -1).join('.')} | \`${e}\` | ${present ? '✅' : '❌'} |`)
    }
    if (missing.length === 0) log('')
    else log(`\n**Missing personas:** ${missing.join(', ')}\n`)

    log('## Step 5 — Re-run seed (idempotency)')
    log('')
    const seed2 = runSeed(alloc.url)
    log(`- exit code: \`${seed2.exitCode}\``)
    log(`- duration: \`${seed2.durationSec.toFixed(2)}s\``)
    if (seed2.exitCode !== 0) {
      log('')
      log('- stderr tail:')
      log('  ```')
      log(seed2.stderrTail.split('\n').map((l) => '  ' + l).join('\n'))
      log('  ```')
      failures.push(`seed (idempotency re-run) exited with code ${seed2.exitCode}`)
      verdict = 'FAIL'
    }
    log('')

    log('## Step 6 — Verify counts unchanged (no duplicates)')
    log('')
    const counts2 = await fetchCounts(alloc.url)
    const cmp = countsMatch(counts1, counts2)
    if (cmp.ok) {
      log('- ✅ all fixture counts unchanged after re-seed')
    } else {
      log('- ❌ counts changed after re-seed (duplicates introduced):')
      for (const d of cmp.deltas) log(`  - ${d}`)
      failures.push('re-seed produced duplicates: ' + cmp.deltas.join('; '))
      verdict = 'FAIL'
    }
    log('')

    log('## Step 7 — Drop disposable DB')
    log('')
    const drop = await dropDatabase(alloc)
    alloc = null
    log(`- drop: \`${JSON.stringify(drop)}\``)
    log('')
  } catch (err) {
    verdict = 'FAIL'
    const msg = err instanceof Error ? err.message : String(err)
    failures.push(`exception: ${msg}`)
    log(`\n**Exception:** ${msg}\n`)
  } finally {
    if (alloc) {
      try {
        await dropDatabase(alloc)
      } catch { /* ignore */ }
    }
  }

  log('---')
  log('')
  log('## Verdict')
  log('')
  if (verdict === 'PASS') {
    log('**✅ PASS** — Phase 0C.2 §10 seed / reset completion proof.')
    log('')
    log('The deterministic seed pipeline succeeds against a bootstrap-only disposable DB, ' +
      'the 4 canonical fixture orgs, 10 fixture users (5 canonical primary personas), and ' +
      '3 fixture claims are persisted, and re-running the seed does NOT introduce duplicate rows.')
  } else {
    log('**❌ FAIL** — Phase 0C.2 §10 seed / reset completion proof.')
    log('')
    log('Failures:')
    for (const f of failures) log(`- ${f}`)
  }
  log('')

  writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8')
  process.stdout.write(`[phase-0c2-seed-reset-proof] wrote ${REPORT_PATH}\n`)
  process.exit(verdict === 'PASS' ? 0 : 2)
}

main().catch((err) => {
  process.stderr.write(`[phase-0c2-seed-reset-proof] fatal: ${err instanceof Error ? err.stack : String(err)}\n`)
  process.exit(3)
})

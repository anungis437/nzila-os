import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '../../../..')

function policy(ref: string) {
  return spawnSync(
    'pnpm',
    ['exec', 'tsx', 'scripts/release/validate-branch-tag-policy.ts', '--mode', 'branch', '--ref', ref],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__tests__') continue
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(target, out)
    else if (/\.(ts|tsx|sql|mjs|py)$/.test(entry.name)) out.push(target)
  }
  return out
}

describe('convergence P0 contracts', () => {
  it('accepts the open cloud-agent branch and rejects an arbitrary cursor branch', () => {
    expect(policy('cursor/ue-convergence-p0-cfc5').status).toBe(0)
    expect(policy('fix/membership-uuid').status).toBe(0)
    const rejected = policy('cursor/arbitrary')
    expect(rejected.status).toBe(1)
    expect(`${rejected.stdout}${rejected.stderr}`).toMatch(/does not match policy/)
  })

  it('keeps the QA baseline membership column as uuid', () => {
    const baseline = fs.readFileSync(path.join(REPO_ROOT, 'tooling/sql/union-eyes-qa-baseline.sql'), 'utf8')
    expect(baseline).toContain('organization_id uuid NOT NULL')
    expect(baseline).not.toContain('ALTER COLUMN organization_id TYPE text')
  })

  it('separates the frozen slug migration from the current uuid producer', () => {
    const historical = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations/20260909_strike_fund_disbursements_organization_id.sql'),
      'utf8',
    )
    const current = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations-platform/0008_strike_fund_uuid_membership_provenance.sql'),
      'utf8',
    )
    expect(historical).toContain('o.slug = om.organization_id')
    expect(current).toContain('o.id = om.organization_id')
    expect(current).not.toContain('o.slug = om.organization_id')
  })

  it('reports 0014 production order as blocked and does not claim runtime execution', () => {
    const result = spawnSync('node', ['tooling/scripts/union-eyes-0014-producer-graph.mjs', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
    expect(result.status).toBe(1)
    const graph = JSON.parse(result.stdout) as {
      coverage: { bootstrapV2Source: string; productionDrizzleBootstrap0014: string; runtimeExecution: string }
      v2CompileWouldMiss: string[]
      counts: { targets: number; legacyCleanroomUndeclaredBefore0014: number }
    }
    expect(graph.counts.targets).toBe(100)
    expect(graph.v2CompileWouldMiss).not.toContain('dues_assignments')
    expect(graph.v2CompileWouldMiss).toEqual([])
    expect(graph.counts.legacyCleanroomUndeclaredBefore0014).toBe(0)
    expect(graph.coverage.bootstrapV2Source).toBe('SOURCE_DECLARATIONS_REACHABLE')
    expect(graph.coverage.productionDrizzleBootstrap0014).toBe('BLOCKED')
    expect(graph.coverage.runtimeExecution).toBe('NOT_EXECUTED')
  })

  it('records the financial contradiction as contained rather than reconciled', () => {
    const ledger = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'docs/union-eyes/convergence/UE_CONVERGENCE_DECISION_LEDGER.json'), 'utf8'),
    ) as { conflicts: Array<Record<string, string>> }
    const financial = ledger.conflicts.find((row) => row.CONFLICT_ID === 'FINANCIAL_TOPOLOGY_ENDPOINT')
    expect(financial?.FINANCIAL_ARCHITECTURE_DECISION).toBe('SAME_CANONICAL_DATABASE')
    expect(financial?.FINANCIAL_RUNTIME_CONFIGURATION_COMPATIBILITY).toBe('INCOMPATIBLE')
    expect(financial?.FINANCIAL_SERVICE_DEPLOYMENT_STATUS).toBe('UNDEPLOYED')
    expect(financial?.CLASSIFICATION).toBe('CONTAINED_NOT_RECONCILED')
  })

  it('allows the slug membership join only in the frozen migration and the historical verifier branch', () => {
    const allowed = new Set([
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations/20260909_strike_fund_disbursements_organization_id.sql'),
      path.join(REPO_ROOT, 'apps/union-eyes/scripts/verify-strike-fund-org-backfill.ts'),
    ])
    const hits: string[] = []
    for (const file of walk(path.join(REPO_ROOT, 'apps/union-eyes'))) {
      if (allowed.has(file) || file.includes(`${path.sep}db${path.sep}migrations${path.sep}`)) continue
      const text = fs.readFileSync(file, 'utf8')
      if (/o\.slug\s*=\s*om\.organization_id/.test(text) || /organizations\.slug\s*=\s*[^;\n]*organization_members\.organization_id/.test(text)) {
        hits.push(path.relative(REPO_ROOT, file))
      }
    }
    expect(hits).toEqual([])
  })
})

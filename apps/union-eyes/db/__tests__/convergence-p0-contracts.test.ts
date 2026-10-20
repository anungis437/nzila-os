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
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__tests__' || entry.name === '.next' || entry.name === 'dist') continue
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

  it('declares a 0014 producer for every active target without claiming PostgreSQL execution', () => {
    const result = spawnSync('node', ['tooling/scripts/union-eyes-0014-producer-graph.mjs', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
    expect(result.status).toBe(0)
    const graph = JSON.parse(result.stdout) as {
      coverage: { bootstrapV2Source: string; productionDrizzleBootstrap0014: string; runtimeExecution: string }
      v2CompileWouldMiss: string[]
      productionBootstrapNotBefore0014: string[]
      counts: { targets: number; legacyCleanroomUndeclaredBefore0014: number }
      rows: Array<Record<string, unknown>>
    }
    expect(graph.counts.targets).toBe(100)
    expect(graph.v2CompileWouldMiss).not.toContain('dues_assignments')
    expect(graph.v2CompileWouldMiss).toEqual([])
    expect(graph.counts.legacyCleanroomUndeclaredBefore0014).toBe(0)
    expect(graph.coverage.bootstrapV2Source).toBe('SOURCE_DECLARATIONS_REACHABLE')
    expect(graph.coverage.productionDrizzleBootstrap0014).toBe('DECLARED_COMPLETE')
    expect(graph.coverage.runtimeExecution).toBe('NOT_EXECUTED')
    expect(graph.productionBootstrapNotBefore0014).toEqual([])
    const rows = graph.rows
    const billing = rows.find((row) => row.table === 'billing_subscriptions') as {
      declaredOrder: { productionDrizzleBootstrap: string }
      migrationJournal: { platformRunsBefore0014OnProductionBootstrap: boolean }
    }
    expect(billing.declaredOrder.productionDrizzleBootstrap).toBe('BEFORE_0014')
    expect(billing.migrationJournal.platformRunsBefore0014OnProductionBootstrap).toBe(true)
    for (const table of ['org_subscriptions', 'platform_invoices', 'platform_payments']) {
      const row = rows.find((item) => item.table === table) as { executableProducer: string }
      expect(row.executableProducer).toBe('tooling/sql/union-eyes-qa-baseline.sql')
    }
    const lineage = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations-platform/0009_canonical_lineage_relations.sql'),
      'utf8',
    )
    expect(lineage).toContain('incompatible existing relation')
    expect(lineage).not.toContain('CREATE TABLE "org_subscriptions"')
    expect(lineage).not.toContain('CREATE TABLE "platform_invoices"')
    expect(lineage).not.toContain('CREATE TABLE "platform_payments"')
  })

  it('uses the same production stage list the runner executes', async () => {
    const { pathToFileURL } = await import('node:url')
    const stages = (await import(
      pathToFileURL(path.join(REPO_ROOT, 'tooling/scripts/lib/union-eyes-bootstrap-stages.mjs')).href
    )) as {
      PRODUCTION_BOOTSTRAP_ORDER: Array<{ id: string }>
      platformMigrationPrecedesScopedClosure: () => boolean
      runtimeGrantsFollowSecurityClosure: () => boolean
    }
    expect(stages.PRODUCTION_BOOTSTRAP_ORDER.map((stage) => stage.id)).toEqual([
      'extensions',
      'snapshot_or_qa_baseline',
      'scoped_foundation',
      'runtime_privilege_quarantine',
      'platform_sql',
      'scoped_rls_closure',
      'runtime_grant_activation',
    ])
    expect(stages.platformMigrationPrecedesScopedClosure()).toBe(true)
    expect(stages.runtimeGrantsFollowSecurityClosure()).toBe(true)
    const runner = fs.readFileSync(
      path.join(REPO_ROOT, 'tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs'),
      'utf8',
    )
    expect(runner).toContain('PRODUCTION_BOOTSTRAP_ORDER')
    expect(runner).toContain('throughTag: SCOPED_FOUNDATION_THROUGH_TAG')
    expect(runner).toContain('afterTag: SCOPED_FOUNDATION_THROUGH_TAG')
    expect(runner).not.toContain('regrantRuntimeTablePrivileges')
    expect(runner).not.toContain('ON ALL TABLES IN SCHEMA public')
    const scopedExecutor = fs.readFileSync(
      path.join(REPO_ROOT, 'tooling/scripts/lib/union-eyes-scoped-migrations.mjs'),
      'utf8',
    )
    expect(scopedExecutor).toContain("entry.tag === '0009_baseline_runtime_role_grants'")
    expect(scopedExecutor).toContain(
      'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system, PUBLIC',
    )
    const foundation = runner.indexOf('throughTag: SCOPED_FOUNDATION_THROUGH_TAG')
    const quarantine = runner.indexOf('const quarantineSummary = await quarantineUnprotectedRuntimePrivileges')
    const platform = runner.indexOf('Applying post-freeze PLATFORM_SQL')
    const closure = runner.indexOf('afterTag: SCOPED_FOUNDATION_THROUGH_TAG')
    const activation = runner.indexOf('const activationSummary = await activateRuntimePrivileges')
    expect(foundation).toBeGreaterThan(-1)
    expect(foundation).toBeLessThan(quarantine)
    expect(quarantine).toBeLessThan(platform)
    expect(platform).toBeLessThan(closure)
    expect(closure).toBeLessThan(activation)
  })

  it('evolves the historical DAPL enums before platform 0009 validates them', () => {
    const journal = JSON.parse(
      fs.readFileSync(
        path.join(REPO_ROOT, 'apps/union-eyes/db/migrations-platform/meta/_journal.json'),
        'utf8',
      ),
    ) as { entries: Array<{ idx: number; tag: string }> }
    const tags = journal.entries.map((entry) => entry.tag)
    const evolution = tags.indexOf('0008_dapl_enum_label_evolution')
    const canonical = tags.indexOf('0009_canonical_lineage_relations')
    expect(evolution).toBeGreaterThan(-1)
    expect(canonical).toBeGreaterThan(evolution)
    expect(journal.entries.map((entry) => entry.idx)).toEqual(journal.entries.map((_, index) => index))
    const sql = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations-platform/0008_dapl_enum_label_evolution.sql'),
      'utf8',
    )
    for (const label of [
      'transaction_fee',
      'settlement',
      'fee_captured',
      'settlement_closed',
      'settlement_batch',
    ]) {
      expect(sql).toContain(`'${label}'`)
    }
    expect(sql).toContain('incompatible existing type')
    expect(sql).not.toMatch(/DROP TYPE/i)
    expect(sql).not.toMatch(/USING\s+/i)
    const frozen = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql'),
      'utf8',
    )
    expect(frozen).toContain(
      "CREATE TYPE platform_cost_type AS ENUM ('base_subscription','local_fee','seat_fee','module_fee','usage_fee','onboarding_fee','support_fee','adjustment','credit','subsidy','writeoff')",
    )
    expect(frozen).not.toContain('transaction_fee')
    expect(frozen).not.toContain('fee_captured')
    expect(frozen).not.toContain('settlement_batch')
    const feeEvolution = tags.indexOf('0008_fee_adjustment_enum_label_evolution')
    expect(feeEvolution).toBeGreaterThan(evolution)
    expect(canonical).toBeGreaterThan(feeEvolution)
    const feeSql = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations-platform/0008_fee_adjustment_enum_label_evolution.sql'),
      'utf8',
    )
    expect(feeSql).toContain("'partial_reversal'")
    expect(feeSql).toContain('incompatible existing type')
    expect(feeSql).not.toMatch(/DROP TYPE/i)
    const monetization = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations/0086_monetization_phase2.sql'),
      'utf8',
    )
    expect(monetization).toContain(
      "CREATE TYPE fee_adjustment_type AS ENUM ('reversal','waiver','correction','dispute_credit')",
    )
    expect(monetization).not.toContain('partial_reversal')
    const stubEvolution = tags.indexOf('0008_django_stub_relation_evolution')
    expect(stubEvolution).toBeGreaterThan(feeEvolution)
    expect(canonical).toBeGreaterThan(stubEvolution)
    const stubSql = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations-platform/0008_django_stub_relation_evolution.sql'),
      'utf8',
    )
    for (const relation of [
      'employers',
      'worksites',
      'bargaining_units',
      'committees',
      'collective_agreements',
      'cba_clauses',
      'cost_centers',
      'grievance_case_access_assignments',
      'document_access_grants',
      'case_documents',
      'org_configurations',
      'committee_action_items',
      'committee_meetings',
    ]) {
      expect(stubSql).toContain(`'${relation}'`)
    }
    expect(stubSql).toContain('member_jurisdiction_preferences_organization_id_organizations_id_fk')
    expect(stubSql).toContain('commercial_contracts_organization_id_organizations_id_fk')
    expect(stubSql).toContain('commercial_contracts_billing_account_id_billing_accounts_id_fk')
    expect(stubSql).toContain('commercial_contracts_subscription_id_org_subscriptions_id_fk')
    expect(stubSql).toContain('incompatible existing relation public.%')
    expect(stubSql).toContain('Rows were not rewritten.')
    expect(stubSql).not.toMatch(/DROP TABLE/i)
    expect(stubSql).not.toMatch(/DROP TYPE/i)
    const canonicalSql = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/union-eyes/db/migrations-platform/0009_canonical_lineage_relations.sql'),
      'utf8',
    )
    expect(canonicalSql).toContain('expected 33 matching columns')
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

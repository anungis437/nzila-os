/**
 * Contract: canonical merge-authority contexts are unique, always decided,
 * and fail closed when underlying CI evidence is missing, cancelled, or failed.
 *
 * @invariant MERGE_AUTHORITY_SURFACE_001
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  CANONICAL_CONTEXTS,
  CI_PATHS_IGNORE,
  SECRET_AUTHORITY_CONTEXTS,
  applyExecution,
  classifyChangedPaths,
  evaluateCiResults,
  planFastPath,
  verdictToCheckRun,
} from '../ci/merge-authority/surface.mjs'

const ROOT = join(__dirname, '..', '..')
const WORKFLOWS = join(ROOT, '.github', 'workflows')

function workflowFiles() {
  return readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
}

function jobIdentities() {
  const identities = []
  for (const file of workflowFiles()) {
    const doc = parse(readFileSync(join(WORKFLOWS, file), 'utf8'))
    const jobs = doc?.jobs ?? {}
    for (const [id, job] of Object.entries(jobs)) {
      if (!job || typeof job !== 'object') continue
      const name = typeof job.name === 'string' ? job.name : id
      identities.push({ file, id, name })
    }
  }
  return identities
}

function duplicateNames(identities) {
  const byName = new Map()
  for (const identity of identities) {
    const list = byName.get(identity.name) ?? []
    list.push(`${identity.file}#${identity.id}`)
    byName.set(identity.name, list)
  }
  return [...byName.entries()]
    .filter(([, locations]) => locations.length > 1)
    .map(([name, locations]) => ({ name, locations: locations.sort() }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Pre-existing display-name collisions. They are not canonical authority
 * contexts. A new collision fails this contract.
 */
const KNOWN_DUPLICATE_JOB_NAMES = [
  {
    name: 'Lint & Typecheck',
    locations: ['ci.yml#lint-and-typecheck', 'cupe-pilot-readiness.yml#lint-and-typecheck'],
  },
  {
    name: 'Pre-Deploy Gates',
    locations: [
      'deploy-console.yml#pre-deploy-gates',
      'deploy-partners.yml#pre-deploy-gates',
      'deploy-union-eyes.yml#pre-deploy-gates',
      'deploy-web.yml#pre-deploy-gates',
    ],
  },
  {
    name: 'Red-Team Adversarial',
    locations: ['ci.yml#red-team', 'nzila-governance.yml#red-team'],
  },
  {
    name: 'Unit Tests',
    locations: ['ci.yml#test', 'cupe-pilot-readiness.yml#unit-tests'],
  },
]

function conclusions(verdicts) {
  return Object.fromEntries(verdicts.map((verdict) => [verdict.name, verdict.conclusion]))
}

function evidence(verdicts) {
  return Object.fromEntries(verdicts.map((verdict) => [verdict.name, verdict.evidence]))
}

describe('merge authority surface', () => {
  it('keeps CI paths-ignore identical to the classifier copy', () => {
    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    expect(ci.on.pull_request['paths-ignore']).toEqual(CI_PATHS_IGNORE)
    expect(ci.on.push['paths-ignore']).toEqual(CI_PATHS_IGNORE)
  })

  it('does not let any workflow job publish a canonical authority name', () => {
    const names = new Set(jobIdentities().map((identity) => identity.name))
    for (const context of CANONICAL_CONTEXTS) {
      expect(names.has(context.name)).toBe(false)
    }
    const prefixed = [...names].filter((name) => name.startsWith('Merge Authority /'))
    expect(prefixed).toEqual([])
  })

  it('keeps secret-safety contexts unique and outside the engineering aggregator', () => {
    const identities = jobIdentities()
    for (const secretName of SECRET_AUTHORITY_CONTEXTS) {
      const hits = identities.filter((identity) => identity.name === secretName)
      expect(hits.map((hit) => hit.file)).toEqual(['secret-scan.yml'])
    }
    const reporter = identities.filter((identity) => identity.id === 'report-merge-authority')
    expect(reporter).toEqual([
      { file: 'ci.yml', id: 'report-merge-authority', name: 'Report merge authority' },
    ])
  })

  it('freezes duplicate job display names so a new collision fails', () => {
    expect(duplicateNames(jobIdentities())).toEqual(KNOWN_DUPLICATE_JOB_NAMES)
  })

  it('scenario A — documentation only publishes NOT_APPLICABLE and keeps secret safety applicable', () => {
    const plan = planFastPath([
      'docs/engineering-convergence/ci-execution/CI_EXECUTION_BASELINE.md',
      'README.md',
    ])
    expect(plan.classification.classification).toBe('ALL_NOT_APPLICABLE')
    expect(plan.classification.secretSafety).toBe('APPLICABLE')
    expect(plan.action).toBe('PUBLISH')
    expect(evidence(plan.verdicts)).toEqual(
      Object.fromEntries(CANONICAL_CONTEXTS.map((context) => [context.name, 'NOT_APPLICABLE'])),
    )
    expect(new Set(Object.values(conclusions(plan.verdicts)))).toEqual(new Set(['success']))
    for (const verdict of plan.verdicts) {
      const check = verdictToCheckRun(verdict, 'abc123')
      expect(check.conclusion).toBe('success')
      expect(check.output.summary).toContain('evidence: NOT_APPLICABLE')
      expect(check.output.summary).toContain('Secret safety remains APPLICABLE')
    }
  })

  it('scenario B — application code defers to CI and a failed lint fails authority', () => {
    const plan = planFastPath(['apps/union-eyes/app/api/example/route.ts'])
    expect(plan.classification.contexts['Merge Authority / Lint & Typecheck']).toBe('REQUIRES_EXECUTION')
    expect(plan.classification.contexts['Merge Authority / Hash Chain Integrity']).toBe('NOT_APPLICABLE')
    expect(plan.action).toBe('DEFER_TO_CI')
    expect(plan.classification.ciSkippedByPathsIgnore).toBe(false)
    const verdicts = evaluateCiResults({
      'lint-and-typecheck': 'failure',
      test: 'success',
      'schema-drift': 'success',
      'sage-postgres-concurrency': 'success',
      'sage-live-postgres': 'success',
      build: 'skipped',
    })
    const byName = Object.fromEntries(verdicts.map((verdict) => [verdict.name, verdict]))
    expect(byName['Merge Authority / Lint & Typecheck']).toMatchObject({
      evidence: 'FAILURE',
      conclusion: 'failure',
    })
    expect(byName['Merge Authority / Unit Tests'].conclusion).toBe('success')
    expect(byName['Merge Authority / Affected Build']).toMatchObject({
      evidence: 'UNRESOLVED',
      conclusion: 'failure',
    })
  })

  it('scenario C — a shared package is code and requires execution', () => {
    const plan = planFastPath(['packages/db/src/index.ts'])
    expect(plan.classification.classification).toBe('CODE_OR_UNKNOWN')
    expect(plan.classification.contexts['Merge Authority / Schema Integrity']).toBe('REQUIRES_EXECUTION')
    expect(plan.action).toBe('DEFER_TO_CI')
  })

  it('scenario D — schema, migration, and RLS paths require the database gates', () => {
    const plan = planFastPath([
      'packages/db/src/schema/tenant.ts',
      'migrations/0045_example.sql',
      'apps/union-eyes/db/migrations/0099_rls.sql',
    ])
    expect(plan.classification.classification).toBe('CODE_OR_UNKNOWN')
    expect(plan.action).toBe('DEFER_TO_CI')
    const verdicts = evaluateCiResults({
      'lint-and-typecheck': 'success',
      test: 'success',
      'schema-drift': 'failure',
      'sage-postgres-concurrency': 'failure',
      'sage-live-postgres': 'failure',
      build: 'success',
    })
    expect(evidence(verdicts)['Merge Authority / Schema Integrity']).toBe('FAILURE')
    expect(evidence(verdicts)['Merge Authority / PostgreSQL RLS']).toBe('FAILURE')
    expect(evidence(verdicts)['Merge Authority / Migration Chain']).toBe('FAILURE')
  })

  it('scenario E — an unknown path fails closed to CODE_OR_UNKNOWN', () => {
    const plan = planFastPath(['something-unexpected.bin'])
    expect(plan.classification.classification).toBe('CODE_OR_UNKNOWN')
    expect(plan.action).toBe('DEFER_TO_CI')
    expect(classifyChangedPaths(['../secrets.md']).classification).toBe('CODE_OR_UNKNOWN')
    expect(classifyChangedPaths([]).classification).toBe('CODE_OR_UNKNOWN')
  })

  it('scenario F — a missing underlying job is not success', () => {
    const verdicts = evaluateCiResults({
      'lint-and-typecheck': 'success',
      test: 'success',
      'sage-postgres-concurrency': 'success',
      'sage-live-postgres': 'success',
      build: 'success',
    })
    const schema = verdicts.find((verdict) => verdict.name === 'Merge Authority / Schema Integrity')
    expect(schema.evidence).toBe('MISSING')
    expect(schema.conclusion).not.toBe('success')
  })

  it('scenario G — a cancelled underlying job is not success', () => {
    const verdicts = evaluateCiResults({
      'lint-and-typecheck': 'cancelled',
      test: 'success',
      'schema-drift': 'success',
      'sage-postgres-concurrency': 'success',
      'sage-live-postgres': 'success',
      build: 'success',
    })
    const lint = verdicts.find((verdict) => verdict.name === 'Merge Authority / Lint & Typecheck')
    expect(lint.evidence).toBe('UNRESOLVED')
    expect(lint.conclusion).not.toBe('success')
  })

  it('scenario H — a failed underlying job is FAILURE', () => {
    const verdicts = evaluateCiResults({
      'lint-and-typecheck': 'success',
      test: 'failure',
      'schema-drift': 'success',
      'sage-postgres-concurrency': 'success',
      'sage-live-postgres': 'success',
      build: 'success',
    })
    const unit = verdicts.find((verdict) => verdict.name === 'Merge Authority / Unit Tests')
    expect(unit).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
  })

  it('does not treat a skipped CI job as NOT_APPLICABLE', () => {
    const verdicts = evaluateCiResults({
      'lint-and-typecheck': 'skipped',
      test: 'skipped',
      'schema-drift': 'skipped',
      'sage-postgres-concurrency': 'skipped',
      'sage-live-postgres': 'skipped',
      build: 'skipped',
    })
    expect(verdicts.every((verdict) => verdict.evidence !== 'NOT_APPLICABLE')).toBe(true)
    expect(verdicts.every((verdict) => verdict.conclusion === 'failure')).toBe(true)
  })

  it('fails closed when CI will ignore a path the classifier cannot prove harmless', () => {
    const plan = planFastPath(['docs/schema/overview.md', 'docs/foo.yml'])
    expect(plan.classification.classification).toBe('MIXED')
    expect(plan.classification.ciSkippedByPathsIgnore).toBe(true)
    expect(plan.action).toBe('PUBLISH')
    const byName = Object.fromEntries(plan.verdicts.map((verdict) => [verdict.name, verdict.evidence]))
    expect(byName['Merge Authority / Lint & Typecheck']).toBe('UNRESOLVED')
    expect(byName['Merge Authority / Hash Chain Integrity']).toBe('NOT_APPLICABLE')
  })

  it('scenario I — governance-consumed markdown is not waived for governance integrity', () => {
    const plan = planFastPath([
      'docs/categories/platform-and-operations/platform/EVIDENCE_LIFECYCLE_POLICY.md',
    ])
    expect(plan.classification.secretSafety).toBe('APPLICABLE')
    expect(plan.classification.contexts['Merge Authority / Lint & Typecheck']).toBe('NOT_APPLICABLE')
    expect(plan.classification.contexts['Merge Authority / Governance Integrity']).toBe('REQUIRES_EXECUTION')
    expect(plan.action).toBe('PUBLISH')
    const governance = plan.verdicts.find((verdict) => verdict.name === 'Merge Authority / Governance Integrity')
    expect(governance.evidence).toBe('UNRESOLVED')
    expect(governance.conclusion).not.toBe('success')
  })

  it('refuses NOT_APPLICABLE check runs unless the classifier proved the invariant irrelevant', () => {
    expect(() =>
      verdictToCheckRun(
        {
          name: 'Merge Authority / Unit Tests',
          ciJob: 'test',
          classifier: 'CODE_OR_UNKNOWN',
          applicability: 'REQUIRES_EXECUTION',
          evidence: 'NOT_APPLICABLE',
          conclusion: 'success',
          detail: 'illegal',
        },
        'abc123',
      ),
    ).toThrow(/NOT_APPLICABLE requires a PROVEN_IRRELEVANT classifier/)
  })

  it('wires the CI reporter to every canonical job result', () => {
    const ci = readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8')
    for (const context of CANONICAL_CONTEXTS) {
      expect(ci).toContain(`- ${context.ciJob}`)
    }
    expect(ci).toContain('MA_RESULT_LINT:')
    expect(ci).toContain('MA_RESULT_UNIT:')
    expect(ci).toContain('MA_RESULT_SCHEMA:')
    expect(ci).toContain('MA_RESULT_RLS:')
    expect(ci).toContain('MA_RESULT_MIGRATION:')
    expect(ci).toContain('MA_RESULT_BUILD:')
    expect(ci).toContain('node tooling/ci/merge-authority/publish.mjs publish-ci-results')
    expect(ci).toContain('MA_RESULT_CONTRACTS:')
    expect(ci).toContain('MA_RESULT_INVENTORY:')
    expect(ci).toContain('MA_RESULT_GOVERNANCE:')
    expect(ci).toContain('MA_RESULT_HASH:')
    expect(ci).toContain('MA_RESULT_OPERATING:')
    const authority = readFileSync(join(WORKFLOWS, 'merge-authority.yml'), 'utf8')
    expect(authority).toContain('classify-and-publish')
    const classifyJob = parse(authority).jobs.classify
    expect(JSON.stringify(classifyJob)).not.toContain('setup-monorepo')
    expect(JSON.stringify(classifyJob)).not.toContain('pnpm ')
  })

  function withResults(overrides: Record<string, string>) {
    const base = Object.fromEntries(CANONICAL_CONTEXTS.map((context) => [context.ciJob, 'success']))
    return evaluateCiResults({ ...base, ...overrides })
  }

  it('scenario A2 — inventory failure fails repository inventory only', () => {
    const inventory = withResults({ 'repository-inventory': 'failure' }).find(
      (verdict) => verdict.name === 'Merge Authority / Repository Inventory',
    )
    expect(inventory).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
  })

  it('scenario B2 — a governance integrity failure is canonical failure', () => {
    const governance = withResults({ 'governance-integrity': 'failure' }).find(
      (verdict) => verdict.name === 'Merge Authority / Governance Integrity',
    )
    expect(governance).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
  })

  it('scenario C — DORA and cost steps stay outside Governance Integrity', () => {
    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    const integrity = ci.jobs['governance-integrity'].steps
      .map((step: { name?: string }) => step.name)
      .filter((name: string | undefined) => Boolean(name))
    const omnibus = ci.jobs['governance-gates'].steps.map((step: { name?: string }) => step.name)
    expect(integrity).toEqual([
      'Script alias regression guard',
      'Governance fail-closed gate',
      'Evidence lifecycle policy gate',
      'Truth authority validation',
      'Auth authority validation',
      'GA state machine validation',
      'Workspace dependency integrity',
      'Control manifest validation',
    ])
    expect(integrity.join('\n')).not.toContain('DORA')
    expect(integrity.join('\n')).not.toContain('cost')
    expect(omnibus).toContain('Collect DORA metrics')
    expect(omnibus).toContain('Collect cost attribution')
    expect(omnibus).toContain('Enforce committed inventory lock')
  })

  it('scenario D2 — architectural contract failure is independent of governance gates', () => {
    const contracts = withResults({ 'contract-tests': 'failure', 'governance-integrity': 'success' }).find(
      (verdict) => verdict.name === 'Merge Authority / Architectural Contracts',
    )
    expect(contracts).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
  })

  it('scenario E2 — hash-chain failure', () => {
    const hash = withResults({ 'hash-chain-drift': 'failure' }).find(
      (verdict) => verdict.name === 'Merge Authority / Hash Chain Integrity',
    )
    expect(hash).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
  })

  it('scenario F2 — operating-layer failure', () => {
    const operating = withResults({ 'operating-layer-gate': 'failure' }).find(
      (verdict) => verdict.name === 'Merge Authority / Operating Layer',
    )
    expect(operating).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
  })

  it('scenario G — auth-authority failure fails governance while PostgreSQL RLS passes', () => {
    const verdicts = withResults({
      'sage-postgres-concurrency': 'success',
      'governance-integrity': 'failure',
    })
    const byName = Object.fromEntries(verdicts.map((verdict) => [verdict.name, verdict]))
    expect(byName['Merge Authority / PostgreSQL RLS'].conclusion).toBe('success')
    expect(byName['Merge Authority / Governance Integrity']).toMatchObject({
      evidence: 'FAILURE',
      conclusion: 'failure',
    })
    expect(byName['Merge Authority / Governance Integrity'].detail).toContain('not PostgreSQL row-level security')
    expect(byName['Merge Authority / PostgreSQL RLS'].detail).toContain('not application or platform auth-authority')
  })

  it('scenario H2 — RLS failure stays independent of governance integrity', () => {
    const verdicts = withResults({
      'sage-postgres-concurrency': 'failure',
      'governance-integrity': 'success',
    })
    const byName = Object.fromEntries(verdicts.map((verdict) => [verdict.name, verdict]))
    expect(byName['Merge Authority / PostgreSQL RLS'].evidence).toBe('FAILURE')
    expect(byName['Merge Authority / Governance Integrity'].conclusion).toBe('success')
  })

  it('scenario J — harmless docs waive engineering and keep secret safety applicable', () => {
    const plan = planFastPath(['docs/engineering-convergence/ci-execution/CI_AUTHORITY_SURFACE.md'])
    expect(plan.classification.contexts['Merge Authority / Affected Build']).toBe('NOT_APPLICABLE')
    expect(plan.classification.contexts['Merge Authority / Governance Integrity']).toBe('NOT_APPLICABLE')
    expect(plan.classification.secretSafety).toBe('APPLICABLE')
  })

  it('does not turn a skipped execution into NOT_APPLICABLE without proof', () => {
    const plan = planFastPath(['docs/categories/platform-and-operations/platform/EVIDENCE_LIFECYCLE_POLICY.md'])
    const applied = applyExecution(plan.verdicts, {
      'governance-integrity': 'skipped',
      'repository-inventory': 'skipped',
    })
    const governance = applied.find((verdict) => verdict.name === 'Merge Authority / Governance Integrity')
    const lint = applied.find((verdict) => verdict.name === 'Merge Authority / Lint & Typecheck')
    expect(governance?.evidence).toBe('UNRESOLVED')
    expect(lint?.evidence).toBe('NOT_APPLICABLE')
  })

  it('records conditional authority as residual rather than a fake required context', () => {
    const ci = readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8')
    expect(ci).not.toContain('Merge Authority / CI')
    expect(ci).not.toContain('Merge Authority / Governance Gates')
    const names = CANONICAL_CONTEXTS.map((context) => context.name)
    expect(names).toHaveLength(11)
    expect(new Set(names).size).toBe(11)
  })
})

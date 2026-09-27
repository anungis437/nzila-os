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
  ACCEPTABLE_AUTHORITY_RESIDUAL,
  CANONICAL_CONTEXTS,
  CI_PATHS_IGNORE,
  IAC_CHECKOV_CONFIGS,
  IAC_AUTHORITY_FILES,
  OPS_PACK_CONTENT_INPUTS,
  OPS_PACK_TOOLING,
  SECRET_AUTHORITY_CONTEXTS,
  applyExecution,
  classifyChangedPaths,
  evaluateCiResults,
  fastPathExecution,
  planFastPath,
  verdictToCheckRun,
} from '../ci/merge-authority/surface.mjs'
import { classifySarifProbe } from '../ci/merge-authority/sarif-reporting.mjs'

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
    expect(plan.classification.classification).toBe('MIXED')
    expect(plan.classification.contexts['Merge Authority / Schema Integrity']).toBe('REQUIRES_EXECUTION')
    expect(plan.classification.contexts['Merge Authority / IaC Security']).toBe('NOT_APPLICABLE')
    expect(plan.classification.contexts['Merge Authority / Ops Documentation']).toBe('NOT_APPLICABLE')
    expect(plan.action).toBe('DEFER_TO_CI')
  })

  it('scenario D — schema, migration, and RLS paths require the database gates', () => {
    const plan = planFastPath([
      'packages/db/src/schema/tenant.ts',
      'migrations/0045_example.sql',
      'apps/union-eyes/db/migrations/0099_rls.sql',
    ])
    expect(plan.classification.classification).toBe('MIXED')
    expect(plan.classification.contexts['Merge Authority / Schema Integrity']).toBe('REQUIRES_EXECUTION')
    expect(plan.classification.contexts['Merge Authority / PostgreSQL RLS']).toBe('REQUIRES_EXECUTION')
    expect(plan.classification.contexts['Merge Authority / Migration Chain']).toBe('REQUIRES_EXECUTION')
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

  it('keeps the canonical surface at 13 contexts and does not promote accepted residuals', () => {
    const ci = readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8')
    expect(ci).not.toContain('Merge Authority / CI')
    expect(ci).not.toContain('Merge Authority / Governance Gates')
    const names = CANONICAL_CONTEXTS.map((context) => context.name)
    expect(names).toEqual([
      'Merge Authority / Lint & Typecheck',
      'Merge Authority / Unit Tests',
      'Merge Authority / Schema Integrity',
      'Merge Authority / PostgreSQL RLS',
      'Merge Authority / Migration Chain',
      'Merge Authority / Affected Build',
      'Merge Authority / Architectural Contracts',
      'Merge Authority / Repository Inventory',
      'Merge Authority / Governance Integrity',
      'Merge Authority / Hash Chain Integrity',
      'Merge Authority / Operating Layer',
      'Merge Authority / IaC Security',
      'Merge Authority / Ops Documentation',
    ])
    expect(new Set(names).size).toBe(13)
    expect(SECRET_AUTHORITY_CONTEXTS).toEqual(['Gitleaks', 'TruffleHog OSS', 'Docker Secret Policy'])
    expect(ACCEPTABLE_AUTHORITY_RESIDUAL).toEqual(['ML Tooling Gates', 'AI Eval Gate'])
    expect(names.some((name) => name.includes('ML Tooling') || name.includes('AI Eval'))).toBe(false)
    const conditional = CANONICAL_CONTEXTS.filter(
      (context) => context.authority === 'CHANGE_CONDITIONAL_MERGE_CRITICAL',
    )
    expect(conditional.map((context) => context.name)).toEqual([
      'Merge Authority / IaC Security',
      'Merge Authority / Ops Documentation',
    ])
  })

  function contextByName(name: string) {
    return CANONICAL_CONTEXTS.find((context) => context.name === name)
  }

  it('locks the ops pack read set to the validator source', () => {
    const source = readFileSync(join(ROOT, 'tooling/ops/validate-ops-pack.ts'), 'utf8')
    const requiredStart = source.indexOf('const REQUIRED_DOCS')
    const requiredEnd = source.indexOf('function countWords')
    const requiredBlock = source.slice(requiredStart, requiredEnd)
    const documented = [...requiredBlock.matchAll(/path: '([^']+)'/g)].map((match) => match[1])
    expect(documented).toEqual(OPS_PACK_CONTENT_INPUTS.filter((path) => path !== 'reports/ops/snapshot.json'))
    expect(source).toContain("join(repoRoot, 'reports/ops/snapshot.json')")
    expect(OPS_PACK_CONTENT_INPUTS).toContain('reports/ops/snapshot.json')
    expect(OPS_PACK_TOOLING).toContain('tooling/ops/validate-ops-pack.ts')
  })

  it('locks Checkov applicability to the scan invocation rather than every IaC extension', () => {
    expect(IAC_CHECKOV_CONFIGS).toEqual([
      'infrastructure/bicep/.checkov.yaml',
      'infrastructure/bicep/.checkov.yml',
      '.checkov.yaml',
      '.checkov.yml',
    ])
    expect(IAC_AUTHORITY_FILES).toContain('.github/workflows/ci.yml')
    const bicep = classifyChangedPaths(['infrastructure/bicep/main.bicep'])
    expect(bicep.contexts['Merge Authority / IaC Security']).toBe('REQUIRES_EXECUTION')
    const parameter = classifyChangedPaths(['infrastructure/bicep/parameters/prod.bicepparam'])
    expect(parameter.contexts['Merge Authority / IaC Security']).toBe('NOT_APPLICABLE')
    const outside = classifyChangedPaths(['apps/union-eyes/infra/main.bicep'])
    expect(outside.contexts['Merge Authority / IaC Security']).toBe('NOT_APPLICABLE')
    const scaffold = classifyChangedPaths(['tech-repo-scaffold/infra-as-code/bicep/main.bicep'])
    expect(scaffold.contexts['Merge Authority / IaC Security']).toBe('NOT_APPLICABLE')
  })

  it('IaC applicable + pass — canonical IaC is PASS', () => {
    const verdicts = withResults({ 'iac-scan': 'success' })
    const iac = verdicts.find((verdict) => verdict.name === 'Merge Authority / IaC Security')
    expect(iac).toMatchObject({ evidence: 'PASS', conclusion: 'success', applicability: 'REQUIRES_EXECUTION' })
  })

  it('IaC applicable + failure — canonical IaC is FAILURE', () => {
    const verdicts = withResults({ 'iac-scan': 'failure' })
    const iac = verdicts.find((verdict) => verdict.name === 'Merge Authority / IaC Security')
    expect(iac).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
  })

  it('IaC irrelevant — canonical IaC is NOT_APPLICABLE', () => {
    const plan = planFastPath(['docs/engineering-convergence/ci-execution/CI_AUTHORITY_SURFACE.md'])
    expect(plan.classification.contexts['Merge Authority / IaC Security']).toBe('NOT_APPLICABLE')
    const iac = plan.verdicts.find((verdict) => verdict.name === 'Merge Authority / IaC Security')
    expect(iac).toMatchObject({
      evidence: 'NOT_APPLICABLE',
      conclusion: 'success',
      classifier: 'PROVEN_IRRELEVANT',
    })
    expect(verdictToCheckRun(iac, 'abc123').conclusion).toBe('success')
  })

  it('IaC unknown cannot become successful NOT_APPLICABLE', () => {
    for (const paths of [['something-unexpected.bin'], ['../secrets.md'], []]) {
      const classified = classifyChangedPaths(paths)
      expect(classified.contexts['Merge Authority / IaC Security']).toBe('REQUIRES_EXECUTION')
    }
    const deferred = planFastPath(['something-unexpected.bin'])
    expect(deferred.action).toBe('DEFER_TO_CI')
    expect(deferred.classification.contexts['Merge Authority / IaC Security']).toBe('REQUIRES_EXECUTION')
    expect(() =>
      verdictToCheckRun(
        {
          name: 'Merge Authority / IaC Security',
          ciJob: 'iac-scan',
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

  it('IaC CI skipped but applicable — fast path executes validation', () => {
    const plan = planFastPath(['docs/foo.yml'])
    expect(plan.classification.ciSkippedByPathsIgnore).toBe(true)
    expect(plan.classification.contexts['Merge Authority / IaC Security']).toBe('REQUIRES_EXECUTION')
    expect(plan.action).toBe('PUBLISH')
    expect(fastPathExecution(plan.classification).iac).toBe(true)
    const before = plan.verdicts.find((verdict) => verdict.name === 'Merge Authority / IaC Security')
    expect(before.evidence).not.toBe('NOT_APPLICABLE')
    expect(before.conclusion).not.toBe('success')
    const applied = applyExecution(plan.verdicts, {
      'iac-scan': 'success',
      'ops-pack-validation': 'skipped',
    })
    const after = applied.find((verdict) => verdict.name === 'Merge Authority / IaC Security')
    expect(after).toMatchObject({ evidence: 'PASS', conclusion: 'success' })
    const authority = parse(readFileSync(join(WORKFLOWS, 'merge-authority.yml'), 'utf8'))
    const job = authority.jobs['iac-security-if-ci-skipped']
    expect(job.if).toBe(
      "needs.classify.outputs.ci_skip == 'true' && needs.classify.outputs.iac == 'REQUIRES_EXECUTION'",
    )
    expect(job.name).not.toBe('Merge Authority / IaC Security')
    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    const fastRun = job.steps.find((step: { name?: string }) => step.name === 'Run Checkov on Bicep templates').run
    const ciRun = ci.jobs['iac-scan'].steps.find(
      (step: { name?: string }) => step.name === 'Run Checkov on Bicep templates',
    ).run
    expect(fastRun).toBe(ciRun)
    expect(fastRun).toContain('--directory infrastructure/bicep')
    expect(fastRun).toContain('--framework bicep')
    expect(fastRun).toContain('--skip-check CKV_AZURE_99')
    expect(fastRun).toContain('--skip-check CKV_AZURE_139')
    expect(fastRun).toContain('--skip-check CKV_AZURE_163')
    expect(fastRun).toContain('--skip-check CKV_AZURE_166')
    expect(fastRun).toContain('--skip-check CKV_AZURE_189')
    const fastInstall = job.steps.find((step: { name?: string }) => step.name === 'Install Checkov').run
    const ciInstall = ci.jobs['iac-scan'].steps.find((step: { name?: string }) => step.name === 'Install Checkov').run
    expect(fastInstall).toBe(ciInstall)
  })

  it('does not run a second IaC scan when CI will already run the authoritative job', () => {
    const plan = planFastPath(['infrastructure/bicep/main.bicep'])
    expect(plan.classification.contexts['Merge Authority / IaC Security']).toBe('REQUIRES_EXECUTION')
    expect(plan.classification.ciSkippedByPathsIgnore).toBe(false)
    expect(plan.action).toBe('DEFER_TO_CI')
    expect(fastPathExecution(plan.classification).iac).toBe(false)
    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    expect(ci.jobs['iac-scan'].needs).toEqual(['lint-and-typecheck'])
    expect(ci.jobs['report-merge-authority'].needs).toContain('iac-scan')
    expect(ci.jobs['report-merge-authority'].needs).not.toContain('ml-gates')
    expect(ci.jobs['report-merge-authority'].needs).not.toContain('ai-eval-gate')
    expect(ci.jobs['report-merge-authority'].needs).not.toContain('governance-gates')
  })

  it('Ops applicable + pass — canonical Ops Documentation is PASS', () => {
    const verdicts = withResults({ 'ops-pack-validation': 'success' })
    const ops = verdicts.find((verdict) => verdict.name === 'Merge Authority / Ops Documentation')
    expect(ops).toMatchObject({ evidence: 'PASS', conclusion: 'success' })
  })

  it('Ops applicable + failure — canonical Ops Documentation is FAILURE', () => {
    const verdicts = withResults({ 'ops-pack-validation': 'failure' })
    const ops = verdicts.find((verdict) => verdict.name === 'Merge Authority / Ops Documentation')
    expect(ops).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
  })

  it('Ops irrelevant — canonical Ops Documentation is NOT_APPLICABLE', () => {
    const plan = planFastPath(['ops/runbooks/security/keyvault-rotation.md', 'README.md'])
    expect(plan.classification.ciSkippedByPathsIgnore).toBe(true)
    expect(plan.classification.contexts['Merge Authority / Ops Documentation']).toBe('NOT_APPLICABLE')
    expect(plan.classification.contexts['Merge Authority / IaC Security']).toBe('NOT_APPLICABLE')
    expect(fastPathExecution(plan.classification).ops).toBe(false)
    const ops = plan.verdicts.find((verdict) => verdict.name === 'Merge Authority / Ops Documentation')
    expect(ops).toMatchObject({ evidence: 'NOT_APPLICABLE', conclusion: 'success', classifier: 'PROVEN_IRRELEVANT' })
  })

  it('Ops unknown cannot become successful NOT_APPLICABLE', () => {
    for (const paths of [['something-unexpected.bin'], ['../secrets.md'], []]) {
      const classified = classifyChangedPaths(paths)
      expect(classified.contexts['Merge Authority / Ops Documentation']).toBe('REQUIRES_EXECUTION')
    }
    const deferred = planFastPath(['package.json'])
    expect(deferred.action).toBe('DEFER_TO_CI')
    expect(deferred.classification.contexts['Merge Authority / Ops Documentation']).toBe('REQUIRES_EXECUTION')
  })

  it('Ops documentation PR skipped by CI — fast path executes Ops Pack validation', () => {
    const plan = planFastPath(['ARCHITECTURE.md', 'ops/runbooks/README.md', 'SECURITY.md'])
    expect(plan.classification.ciSkippedByPathsIgnore).toBe(true)
    expect(plan.classification.contexts['Merge Authority / Ops Documentation']).toBe('REQUIRES_EXECUTION')
    expect(plan.classification.contexts['Merge Authority / IaC Security']).toBe('NOT_APPLICABLE')
    expect(plan.classification.contexts['Merge Authority / Lint & Typecheck']).toBe('NOT_APPLICABLE')
    expect(plan.action).toBe('PUBLISH')
    expect(fastPathExecution(plan.classification)).toEqual({
      iac: false,
      ops: true,
      governance: false,
      inventory: false,
    })
    const before = plan.verdicts.find((verdict) => verdict.name === 'Merge Authority / Ops Documentation')
    expect(before.evidence).not.toBe('NOT_APPLICABLE')
    expect(before.conclusion).not.toBe('success')
    const passed = applyExecution(plan.verdicts, {
      'ops-pack-validation': 'success',
      'iac-scan': 'skipped',
    }).find((verdict) => verdict.name === 'Merge Authority / Ops Documentation')
    expect(passed).toMatchObject({ evidence: 'PASS', conclusion: 'success' })
    const failed = applyExecution(plan.verdicts, { 'ops-pack-validation': 'failure' }).find(
      (verdict) => verdict.name === 'Merge Authority / Ops Documentation',
    )
    expect(failed).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
    const authority = parse(readFileSync(join(WORKFLOWS, 'merge-authority.yml'), 'utf8'))
    const job = authority.jobs['ops-documentation-if-ci-skipped']
    expect(job.if).toBe(
      "needs.classify.outputs.ci_skip == 'true' && needs.classify.outputs.ops == 'REQUIRES_EXECUTION'",
    )
    expect(job.name).not.toBe('Merge Authority / Ops Documentation')
    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    const fastRun = job.steps.find((step: { name?: string }) => step.name === 'Validate ops pack completeness').run
    const ciRun = ci.jobs['ops-pack-validation'].steps.find(
      (step: { name?: string }) => step.name === 'Validate ops pack completeness',
    ).run
    expect(fastRun).toBe(ciRun)
    expect(fastRun).toContain('pnpm tsx tooling/ops/validate-ops-pack.ts')
    expect(ci.jobs['ops-pack-validation'].needs).toBeUndefined()
    expect(ci.jobs['report-merge-authority'].needs).toContain('ops-pack-validation')
  })

  it('missing or cancelled IaC and Ops source results are not success', () => {
    const missing = evaluateCiResults({ 'lint-and-typecheck': 'success' })
    for (const name of ['Merge Authority / IaC Security', 'Merge Authority / Ops Documentation']) {
      const verdict = missing.find((item) => item.name === name)
      expect(verdict.evidence).toBe('MISSING')
      expect(verdict.conclusion).not.toBe('success')
    }
    const cancelled = withResults({ 'iac-scan': 'cancelled', 'ops-pack-validation': 'cancelled' })
    for (const name of ['Merge Authority / IaC Security', 'Merge Authority / Ops Documentation']) {
      const verdict = cancelled.find((item) => item.name === name)
      expect(verdict.evidence).toBe('UNRESOLVED')
      expect(verdict.conclusion).not.toBe('success')
    }
    const skipped = withResults({ 'iac-scan': 'skipped', 'ops-pack-validation': 'skipped' })
    for (const name of ['Merge Authority / IaC Security', 'Merge Authority / Ops Documentation']) {
      const verdict = skipped.find((item) => item.name === name)
      expect(verdict.evidence).toBe('UNRESOLVED')
      expect(verdict.evidence).not.toBe('NOT_APPLICABLE')
      expect(verdict.conclusion).not.toBe('success')
    }
  })

  it('a generic documentation path does not waive an ops pack input', () => {
    const plan = planFastPath(['docs/readme-style.md'])
    expect(plan.classification.contexts['Merge Authority / Ops Documentation']).toBe('NOT_APPLICABLE')
    const consumed = planFastPath(['reports/ops/snapshot.json'])
    expect(consumed.classification.contexts['Merge Authority / Ops Documentation']).toBe('REQUIRES_EXECUTION')
    expect(consumed.classification.ciSkippedByPathsIgnore).toBe(false)
    expect(consumed.action).toBe('DEFER_TO_CI')
    expect(fastPathExecution(consumed.classification).ops).toBe(false)
    expect(contextByName('Merge Authority / Ops Documentation')?.ciJob).toBe('ops-pack-validation')
    expect(contextByName('Merge Authority / IaC Security')?.ciJob).toBe('iac-scan')
  })
})

describe('IaC validation and SARIF reporting separation', () => {
  function iacVerdict(overrides = {}) {
    const base = Object.fromEntries(CANONICAL_CONTEXTS.map((context) => [context.ciJob, 'success']))
    return evaluateCiResults({ ...base, ...overrides }).find(
      (verdict) => verdict.name === 'Merge Authority / IaC Security',
    )
  }

  function workflows() {
    return {
      ci: parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8')),
      authority: parse(readFileSync(join(WORKFLOWS, 'merge-authority.yml'), 'utf8')),
      publisher: readFileSync(join(ROOT, 'tooling/ci/merge-authority/publish.mjs'), 'utf8'),
    }
  }

  it('C1 — Checkov PASS and reporting SUCCESS still yield canonical PASS', () => {
    const verdict = iacVerdict({ 'iac-scan': 'success', 'iac-sarif-reporting': 'success' })
    expect(verdict).toMatchObject({ evidence: 'PASS', conclusion: 'success' })
  })

  it('C2 — Checkov PASS and reporting NOT_CONFIGURED still yield canonical PASS', () => {
    const verdict = iacVerdict({ 'iac-scan': 'success', 'iac-sarif-reporting': 'NOT_CONFIGURED' })
    expect(verdict).toMatchObject({ evidence: 'PASS', conclusion: 'success' })
    expect(classifySarifProbe(403, 'Code scanning is not enabled for this repository.')).toBe(
      'NOT_CONFIGURED',
    )
  })

  it('C3 — Checkov PASS and reporting FAILURE still yield canonical PASS', () => {
    const verdict = iacVerdict({ 'iac-scan': 'success', 'iac-sarif-reporting': 'failure' })
    expect(verdict).toMatchObject({ evidence: 'PASS', conclusion: 'success' })
    expect(classifySarifProbe(500, 'upstream unavailable')).toBe('FAILURE')
  })

  it('C4 — Checkov FAILURE blocks canonical IaC regardless of reporting', () => {
    const verdict = iacVerdict({ 'iac-scan': 'failure', 'iac-sarif-reporting': 'success' })
    expect(verdict).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
    expect(verdict.conclusion).not.toBe('success')
  })

  it('C5 — missing Checkov evidence cannot become canonical PASS', () => {
    const verdict = evaluateCiResults({ 'lint-and-typecheck': 'success' }).find(
      (item) => item.name === 'Merge Authority / IaC Security',
    )
    expect(verdict.evidence).toBe('MISSING')
    expect(verdict.conclusion).not.toBe('success')
  })

  it('C6 — cancelled Checkov cannot become canonical PASS', () => {
    const verdict = iacVerdict({ 'iac-scan': 'cancelled' })
    expect(verdict.evidence).toBe('UNRESOLVED')
    expect(verdict.conclusion).not.toBe('success')
  })

  it('C7 — unexpected Checkov skip cannot become canonical PASS or N/A', () => {
    const verdict = iacVerdict({ 'iac-scan': 'skipped' })
    expect(verdict.evidence).toBe('UNRESOLVED')
    expect(verdict.evidence).not.toBe('NOT_APPLICABLE')
    expect(verdict.conclusion).not.toBe('success')
  })

  it('C8 — unknown applicability cannot take the N/A shortcut', () => {
    const plan = planFastPath(['something-unexpected.bin'])
    expect(plan.classification.contexts['Merge Authority / IaC Security']).toBe('REQUIRES_EXECUTION')
    expect(plan.action).toBe('DEFER_TO_CI')
    const unresolved = planFastPath(['docs/foo.yml'])
    expect(unresolved.classification.ciSkippedByPathsIgnore).toBe(true)
    expect(unresolved.classification.contexts['Merge Authority / IaC Security']).toBe('REQUIRES_EXECUTION')
    expect(unresolved.verdicts.find((verdict) => verdict.name === 'Merge Authority / IaC Security').evidence).not.toBe(
      'NOT_APPLICABLE',
    )
  })

  it('C9 — proven documentation is deterministic canonical N/A', () => {
    const plan = planFastPath(['docs/guide.md'])
    expect(plan.classification.contexts['Merge Authority / IaC Security']).toBe('NOT_APPLICABLE')
    expect(plan.action).toBe('PUBLISH')
    expect(fastPathExecution(plan.classification).iac).toBe(false)
    const iac = plan.verdicts.find((verdict) => verdict.name === 'Merge Authority / IaC Security')
    expect(iac).toMatchObject({
      evidence: 'NOT_APPLICABLE',
      conclusion: 'success',
      classifier: 'PROVEN_IRRELEVANT',
    })
  })

  it('C10 — CI-skip applicable IaC executes Checkov and that result owns authority', () => {
    const plan = planFastPath(['docs/foo.yml'])
    expect(fastPathExecution(plan.classification).iac).toBe(true)
    const passed = applyExecution(plan.verdicts, { 'iac-scan': 'success' }).find(
      (verdict) => verdict.name === 'Merge Authority / IaC Security',
    )
    expect(passed).toMatchObject({ evidence: 'PASS', conclusion: 'success' })
    const failed = applyExecution(plan.verdicts, { 'iac-scan': 'failure' }).find(
      (verdict) => verdict.name === 'Merge Authority / IaC Security',
    )
    expect(failed.conclusion).not.toBe('success')
    const { ci, authority } = workflows()
    const fast = authority.jobs['iac-security-if-ci-skipped']
    const validation = ci.jobs['iac-scan']
    const fastRun = fast.steps.find((step) => step.name === 'Run Checkov on Bicep templates').run
    const ciRun = validation.steps.find((step) => step.name === 'Run Checkov on Bicep templates').run
    expect(fastRun).toBe(ciRun)
    expect(JSON.stringify(fast)).not.toContain('upload-sarif')
    expect(JSON.stringify(validation)).not.toContain('upload-sarif')
  })

  it('C11 — a malformed Checkov feeder result cannot become canonical PASS', () => {
    for (const malformed of ['passed', 'ok', 'SUCCESS', 'error', 'neutral']) {
      const verdict = iacVerdict({ 'iac-scan': malformed })
      expect(verdict.conclusion).not.toBe('success')
      expect(verdict.evidence).not.toBe('PASS')
      expect(verdict.evidence).not.toBe('NOT_APPLICABLE')
    }
  })

  it('C12 — reporting presence does not feed IaC authority', () => {
    const { ci, publisher } = workflows()
    const reporter = ci.jobs['report-merge-authority']
    expect(reporter.needs).toContain('iac-scan')
    expect(reporter.needs).not.toContain('iac-sarif-reporting')
    expect(reporter.env ?? ci.jobs['report-merge-authority'].steps.at(-1).env.MA_RESULT_IAC).toBe(
      '${{ needs.iac-scan.result }}',
    )
    expect(publisher).toContain("'iac-scan': 'MA_RESULT_IAC'")
    expect(publisher).not.toContain('iac-sarif-reporting')
    expect(ci.jobs['iac-sarif-reporting'].needs).toEqual(['iac-scan'])
    expect(ci.jobs['iac-scan'].permissions).toEqual({ contents: 'read' })
    expect(ci.jobs['iac-sarif-reporting'].permissions).toEqual({
      contents: 'read',
      'security-events': 'read',
    })
    expect(JSON.stringify(ci.jobs['iac-sarif-reporting'])).not.toContain('actions: read')
    expect(JSON.stringify(ci.jobs['iac-scan'])).not.toContain('upload-sarif')
    const removed = iacVerdict()
    expect(removed).toMatchObject({ evidence: 'PASS', conclusion: 'success', ciJob: 'iac-scan' })
  })

  it('does not treat a configured destination or an unknown probe error as NOT_CONFIGURED', () => {
    expect(classifySarifProbe(200, '[]')).toBe('CONFIGURED')
    expect(classifySarifProbe(403, 'Resource not accessible by integration')).toBe('FAILURE')
    expect(
      classifySarifProbe(
        403,
        'GitHub Code Security or GitHub Advanced Security must be enabled for this repository to use code scanning',
      ),
    ).toBe('NOT_CONFIGURED')
  })
})

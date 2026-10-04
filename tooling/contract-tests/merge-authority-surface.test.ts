/**
 * Contract: canonical merge-authority contexts are unique, always decided,
 * and fail closed when underlying CI evidence is missing, cancelled, or failed.
 *
 * @invariant MERGE_AUTHORITY_SURFACE_001
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
  deferPublications,
  evaluateCiResults,
  fastPathExecution,
  planFastPath,
  verdictToCheckRun,
} from '../ci/merge-authority/surface.mjs'
import { classifySarifProbe } from '../ci/merge-authority/sarif-reporting.mjs'
import {
  CI_AUTHORITY_JOBS,
  EXPENSIVE_WORKFLOW_CONCURRENCY,
  MERGE_AUTHORITY_CONCURRENCY,
  PUBLISHER_CONCURRENCY,
  PUBLISHER_JOB_ID,
  PUBLISHER_WORKFLOW_FILE,
  capturedPublicationHead,
  publicationTarget,
  runIsTerminal,
  secretCheckPublications,
  selectRunForHead,
  terminalChecksForHead,
} from '../ci/merge-authority/supersession.mjs'

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
    const reporter = identities.filter((identity) => identity.id === PUBLISHER_JOB_ID)
    expect(reporter).toEqual([
      { file: PUBLISHER_WORKFLOW_FILE, id: PUBLISHER_JOB_ID, name: 'Publish required checks' },
    ])
    expect(identities.some((identity) => identity.id === 'report-merge-authority')).toBe(false)
    expect(identities.some((identity) => identity.id === 'report-secret-contexts')).toBe(false)
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
    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    for (const context of CANONICAL_CONTEXTS) {
      expect(ci.jobs[context.ciJob]).toBeTruthy()
      expect(CI_AUTHORITY_JOBS.find((job) => job.id === context.ciJob)?.name).toBe(ci.jobs[context.ciJob].name)
    }
    const publisher = readFileSync(join(WORKFLOWS, PUBLISHER_WORKFLOW_FILE), 'utf8')
    expect(publisher).toContain('node tooling/ci/merge-authority/publish.mjs publish-pull-request')
    expect(publisher).not.toContain('workflow_run')
    const publisherSource = readFileSync(join(ROOT, 'tooling/ci/merge-authority/publish.mjs'), 'utf8')
    expect(publisherSource).toContain('evaluateCiResults(results, diffPaths)')
    expect(publisherSource).toContain('ciResultsFromJobs(jobs)')
    expect(publisherSource).toContain("'iac-scan': 'MA_RESULT_IAC'")
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
    expect(omnibus).not.toContain('Enforce committed inventory lock')
    expect(omnibus).not.toContain('Regenerate inventory')
    const inventory = ci.jobs['repository-inventory'].steps.map((step: { name?: string }) => step.name)
    expect(inventory).toContain('Enforce committed inventory lock')
    expect(inventory).toContain('Regenerate inventory')
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
    const consumed = CI_AUTHORITY_JOBS.map((job) => job.id)
    expect(consumed).toContain('iac-scan')
    expect(consumed).not.toContain('ml-gates')
    expect(consumed).not.toContain('ai-eval-gate')
    expect(consumed).not.toContain('governance-gates')
    expect(ci.jobs['report-merge-authority']).toBeUndefined()
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
    expect(CI_AUTHORITY_JOBS.map((job) => job.id)).toContain('ops-pack-validation')
    expect(ci.jobs['report-merge-authority']).toBeUndefined()
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
    const consumed = CI_AUTHORITY_JOBS.map((job) => job.id)
    expect(consumed).toContain('iac-scan')
    expect(consumed).not.toContain('iac-sarif-reporting')
    expect(CI_AUTHORITY_JOBS.find((job) => job.id === 'iac-scan')?.name).toBe(ci.jobs['iac-scan'].name)
    expect(publisher).toContain("'iac-scan': 'MA_RESULT_IAC'")
    expect(publisher).not.toContain('iac-sarif-reporting')
    expect(ci.jobs['report-merge-authority']).toBeUndefined()
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

const REQUIRED_CHECK_NAMES = [
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
  'Gitleaks',
  'TruffleHog OSS',
  'Docker Secret Policy',
]

describe('phase 1 NOT_APPLICABLE publication', () => {
  const codePaths = ['apps/union-eyes/app/api/example/route.ts']

  function jobResults(overrides: Record<string, string> = {}) {
    return {
      ...Object.fromEntries(CANONICAL_CONTEXTS.map((context) => [context.ciJob, 'success'])),
      ...overrides,
    }
  }

  function byName(verdicts: ReturnType<typeof evaluateCiResults>) {
    return Object.fromEntries(verdicts.map((verdict) => [verdict.name, verdict]))
  }

  it('posts proven NOT_APPLICABLE contexts and keeps the five publication proofs', () => {
    const plan = planFastPath(codePaths)
    const posted = deferPublications(plan)
    const postedChecks = posted.map((verdict) => verdictToCheckRun(verdict, 'abc123'))
    const publisher = readFileSync(join(ROOT, 'tooling/ci/merge-authority/publish.mjs'), 'utf8')
    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    const authority = readFileSync(join(WORKFLOWS, 'merge-authority.yml'), 'utf8')
    const secret = parse(readFileSync(join(WORKFLOWS, 'secret-scan.yml'), 'utf8'))

    const failedJobs = jobResults({
      'lint-and-typecheck': 'failure',
      'iac-scan': 'failure',
      'ops-pack-validation': 'failure',
    })
    const honored = byName(evaluateCiResults(failedJobs, codePaths))
    const iacNowApplicable = byName(
      evaluateCiResults(failedJobs, [...codePaths, 'infrastructure/bicep/main.bicep']),
    )
    const opsNowApplicable = byName(
      evaluateCiResults(failedJobs, [...codePaths, 'ops/runbooks/README.md']),
    )
    const skippedButProven = byName(
      evaluateCiResults(
        jobResults({ 'iac-scan': 'skipped', 'ops-pack-validation': 'skipped' }),
        codePaths,
      ),
    )
    const skippedWithoutDiff = byName(
      evaluateCiResults(jobResults({ 'iac-scan': 'skipped', 'ops-pack-validation': 'skipped' })),
    )

    const unknownPlan = planFastPath(['something-unexpected.bin'])
    const unknownMissing = evaluateCiResults({}, ['something-unexpected.bin'])
    const unknownExecuted = evaluateCiResults(jobResults(), ['something-unexpected.bin'])
    const emptyDiff = byName(evaluateCiResults(jobResults({ 'ops-pack-validation': 'failure' }), []))
    const traversal = byName(evaluateCiResults(jobResults({ 'iac-scan': 'failure' }), ['../secrets.md']))

    const executedChecks = evaluateCiResults(jobResults(), ['something-unexpected.bin']).map((verdict) =>
      verdictToCheckRun(verdict, 'abc123'),
    )
    const secretJobNames = Object.values(secret.jobs).map((job) =>
      typeof job.name === 'string' ? job.name : '',
    )
    const publishedNames = [...executedChecks.map((check) => check.name), ...SECRET_AUTHORITY_CONTEXTS]

    const naPosts =
      plan.action === 'DEFER_TO_CI' &&
      posted.length > 0 &&
      posted.some((verdict) => verdict.name === 'Merge Authority / IaC Security') &&
      posted.some((verdict) => verdict.name === 'Merge Authority / Ops Documentation') &&
      posted.every(
        (verdict) =>
          verdict.evidence === 'NOT_APPLICABLE' &&
          verdict.applicability === 'NOT_APPLICABLE' &&
          verdict.classifier === 'PROVEN_IRRELEVANT',
      ) &&
      !posted.some((verdict) => verdict.name === 'Merge Authority / Lint & Typecheck') &&
      publisher.includes('await publishCheckRuns(deferPublications(plan), headSha)') &&
      !/if \(plan\.action === 'DEFER_TO_CI'\) return/.test(publisher) &&
      authority.includes('classify-and-publish') &&
      honored['Merge Authority / IaC Security'].evidence === 'NOT_APPLICABLE' &&
      honored['Merge Authority / Ops Documentation'].evidence === 'NOT_APPLICABLE' &&
      skippedButProven['Merge Authority / Ops Documentation'].evidence === 'NOT_APPLICABLE'

    const naConclusion =
      naPosts &&
      postedChecks.length === posted.length &&
      postedChecks.every(
        (check) =>
          check.status === 'completed' &&
          check.conclusion === 'success' &&
          check.output.title === 'NOT_APPLICABLE' &&
          check.output.summary.includes('evidence: NOT_APPLICABLE') &&
          check.output.summary.includes('classifier: PROVEN_IRRELEVANT'),
      ) &&
      honored['Merge Authority / IaC Security'].conclusion === 'success' &&
      honored['Merge Authority / Ops Documentation'].conclusion === 'success' &&
      skippedButProven['Merge Authority / IaC Security'].conclusion === 'success'

    const applicableFailureRemains =
      honored['Merge Authority / Lint & Typecheck'].evidence === 'FAILURE' &&
      honored['Merge Authority / Lint & Typecheck'].conclusion === 'failure' &&
      honored['Merge Authority / Lint & Typecheck'].applicability === 'REQUIRES_EXECUTION' &&
      iacNowApplicable['Merge Authority / IaC Security'].evidence === 'FAILURE' &&
      iacNowApplicable['Merge Authority / IaC Security'].conclusion === 'failure' &&
      iacNowApplicable['Merge Authority / Ops Documentation'].evidence === 'NOT_APPLICABLE' &&
      opsNowApplicable['Merge Authority / Ops Documentation'].evidence === 'FAILURE' &&
      opsNowApplicable['Merge Authority / Ops Documentation'].conclusion === 'failure' &&
      opsNowApplicable['Merge Authority / IaC Security'].evidence === 'NOT_APPLICABLE' &&
      skippedWithoutDiff['Merge Authority / Ops Documentation'].evidence !== 'NOT_APPLICABLE' &&
      skippedWithoutDiff['Merge Authority / Ops Documentation'].conclusion !== 'success' &&
      ci.jobs['iac-scan'].if == null &&
      ci.jobs['ops-pack-validation'].if == null &&
      CI_AUTHORITY_JOBS.some((job) => job.id === 'iac-scan') &&
      CI_AUTHORITY_JOBS.some((job) => job.id === 'ops-pack-validation')

    const unknownRemains =
      unknownPlan.action === 'DEFER_TO_CI' &&
      unknownPlan.classification.classification === 'CODE_OR_UNKNOWN' &&
      deferPublications(unknownPlan).length === 0 &&
      unknownMissing.every(
        (verdict) => verdict.evidence !== 'NOT_APPLICABLE' && verdict.conclusion !== 'success',
      ) &&
      unknownExecuted.every(
        (verdict) =>
          verdict.applicability === 'REQUIRES_EXECUTION' &&
          verdict.evidence === 'PASS' &&
          verdict.conclusion === 'success',
      ) &&
      emptyDiff['Merge Authority / Ops Documentation'].evidence === 'FAILURE' &&
      emptyDiff['Merge Authority / Ops Documentation'].conclusion === 'failure' &&
      traversal['Merge Authority / IaC Security'].evidence === 'FAILURE' &&
      traversal['Merge Authority / IaC Security'].applicability === 'REQUIRES_EXECUTION' &&
      classifyChangedPaths(['../secrets.md']).contexts['Merge Authority / Ops Documentation'] ===
        'REQUIRES_EXECUTION'

    const sixteenPublishable =
      publishedNames.length === 16 &&
      new Set(publishedNames).size === 16 &&
      publishedNames.every((name) => REQUIRED_CHECK_NAMES.includes(name)) &&
      REQUIRED_CHECK_NAMES.every((name) => publishedNames.includes(name)) &&
      executedChecks.every((check) => check.status === 'completed' && check.conclusion === 'success') &&
      postedChecks.every((check) => REQUIRED_CHECK_NAMES.includes(check.name)) &&
      SECRET_AUTHORITY_CONTEXTS.every((name) => {
        const job = Object.values(secret.jobs).find((item) => item.name === name)
        return Boolean(job) && job.if == null
      }) &&
      CANONICAL_CONTEXTS.map((context) => context.name).join('\n') ===
        REQUIRED_CHECK_NAMES.slice(0, 13).join('\n') &&
      publisher.includes('MA_CHANGED_PATHS') &&
      publisher.includes('evaluateCiResults(results, diffPaths)') &&
      readFileSync(join(WORKFLOWS, PUBLISHER_WORKFLOW_FILE), 'utf8').includes(
        'MA_CHANGED_PATHS="$(git diff --name-only "$PR_BASE_SHA" "$PR_HEAD_SHA")"',
      )

    expect(deferPublications({ action: 'PUBLISH', verdicts: posted })).toEqual([])
    expect(() =>
      deferPublications({
        action: 'DEFER_TO_CI',
        verdicts: [
          {
            name: 'Merge Authority / Unit Tests',
            evidence: 'UNRESOLVED',
            applicability: 'REQUIRES_EXECUTION',
            classifier: 'CODE_OR_UNKNOWN',
            conclusion: 'failure',
          },
        ],
      }),
    ).toThrow(/DEFER_TO_CI cannot publish/)
    expect(() => evaluateCiResults(jobResults(), 'apps/union-eyes/app/api/example/route.ts')).toThrow(
      /diff paths must be an array/,
    )

    expect({
      NA_CONTEXT_POSTS: naPosts ? 'YES' : 'NO',
      NA_CONTEXT_CONCLUSION: naConclusion ? 'SUCCESS' : 'NO',
      APPLICABLE_FAILURE_REMAINS_FAILURE: applicableFailureRemains ? 'YES' : 'NO',
      UNKNOWN_REMAINS_NON_TERMINAL_OR_EXECUTED: unknownRemains ? 'YES' : 'NO',
      ALL_16_REQUIRED_NAMES_CAN_BE_PUBLISHED: sixteenPublishable ? 'YES' : 'NO',
    }).toEqual({
      NA_CONTEXT_POSTS: 'YES',
      NA_CONTEXT_CONCLUSION: 'SUCCESS',
      APPLICABLE_FAILURE_REMAINS_FAILURE: 'YES',
      UNKNOWN_REMAINS_NON_TERMINAL_OR_EXECUTED: 'YES',
      ALL_16_REQUIRED_NAMES_CAN_BE_PUBLISHED: 'YES',
    })
  })

  function postedChecks(
    command: string,
    input: string,
    env: Record<string, string | undefined>,
  ): Array<{ name: string; conclusion: string; output: { title: string; summary: string } }> {
    const dir = mkdtempSync(join(tmpdir(), 'merge-authority-'))
    const postedPath = join(dir, 'posted.json')
    const preload = join(dir, 'preload.mjs')
    writeFileSync(
      preload,
      `import { writeFileSync } from 'node:fs'
const posted = []
globalThis.fetch = async (_url, init) => {
  posted.push(JSON.parse(init.body))
  writeFileSync(${JSON.stringify(postedPath)}, JSON.stringify(posted))
  return new Response('{}', { status: 201 })
}
`,
    )
    const result = spawnSync(
      process.execPath,
      ['--import', preload, join(ROOT, 'tooling/ci/merge-authority/publish.mjs'), command],
      {
        input,
        encoding: 'utf8',
        env: {
          ...process.env,
          HEAD_SHA: 'abc123',
          GITHUB_REPOSITORY: 'anungis437/nzila-os',
          GITHUB_TOKEN: 'test-token',
          ...env,
        },
      },
    )
    expect(result.status, result.stderr || result.stdout).toBe(0)
    return JSON.parse(readFileSync(postedPath, 'utf8'))
  }

  it('posts terminal NOT_APPLICABLE checks on DEFER_TO_CI and the CI reporter keeps them', () => {
    const deferred = postedChecks('classify-and-publish', `${codePaths.join('\n')}\n`, {})
    expect(deferred.length).toBeGreaterThan(0)
    expect(deferred.map((check) => check.name)).not.toContain('Merge Authority / Lint & Typecheck')
    expect(deferred.find((check) => check.name === 'Merge Authority / Ops Documentation')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(deferred.find((check) => check.name === 'Merge Authority / IaC Security')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(deferred.every((check) => check.output.summary.includes('evidence: NOT_APPLICABLE'))).toBe(true)

    const resultEnv = Object.fromEntries(
      CANONICAL_CONTEXTS.map((context) => {
        const envName = {
          'lint-and-typecheck': 'MA_RESULT_LINT',
          test: 'MA_RESULT_UNIT',
          'schema-drift': 'MA_RESULT_SCHEMA',
          'sage-postgres-concurrency': 'MA_RESULT_RLS',
          'sage-live-postgres': 'MA_RESULT_MIGRATION',
          build: 'MA_RESULT_BUILD',
          'contract-tests': 'MA_RESULT_CONTRACTS',
          'repository-inventory': 'MA_RESULT_INVENTORY',
          'governance-integrity': 'MA_RESULT_GOVERNANCE',
          'hash-chain-drift': 'MA_RESULT_HASH',
          'operating-layer-gate': 'MA_RESULT_OPERATING',
          'iac-scan': 'MA_RESULT_IAC',
          'ops-pack-validation': 'MA_RESULT_OPS',
        }[context.ciJob]
        return [envName, 'success']
      }),
    )
    const reported = postedChecks('publish-ci-results', '', {
      ...resultEnv,
      GITHUB_EVENT_NAME: 'pull_request',
      MA_CHANGED_PATHS: codePaths.join('\n'),
      MA_RESULT_LINT: 'failure',
      MA_RESULT_IAC: 'failure',
      MA_RESULT_OPS: 'failure',
    })
    expect(reported).toHaveLength(13)
    expect(reported.map((check) => check.name)).toEqual(CANONICAL_CONTEXTS.map((context) => context.name))
    expect(reported.find((check) => check.name === 'Merge Authority / Lint & Typecheck')).toMatchObject({
      conclusion: 'failure',
      output: { title: 'FAILURE' },
    })
    expect(reported.find((check) => check.name === 'Merge Authority / Ops Documentation')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(reported.find((check) => check.name === 'Merge Authority / IaC Security')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })

    const diffChanged = postedChecks('publish-ci-results', '', {
      ...resultEnv,
      GITHUB_EVENT_NAME: 'pull_request',
      MA_CHANGED_PATHS: [...codePaths, 'infrastructure/bicep/main.bicep', 'ops/runbooks/README.md'].join('\n'),
      MA_RESULT_IAC: 'failure',
      MA_RESULT_OPS: 'failure',
    })
    expect(diffChanged.find((check) => check.name === 'Merge Authority / IaC Security')).toMatchObject({
      conclusion: 'failure',
      output: { title: 'FAILURE' },
    })
    expect(diffChanged.find((check) => check.name === 'Merge Authority / Ops Documentation')).toMatchObject({
      conclusion: 'failure',
      output: { title: 'FAILURE' },
    })

    const unknown = postedChecks('publish-ci-results', '', {
      ...resultEnv,
      GITHUB_EVENT_NAME: 'pull_request',
      MA_CHANGED_PATHS: 'something-unexpected.bin',
      MA_RESULT_OPS: 'skipped',
    })
    expect(unknown.every((check) => check.output.title !== 'NOT_APPLICABLE')).toBe(true)
    expect(unknown.find((check) => check.name === 'Merge Authority / Ops Documentation')?.conclusion).not.toBe(
      'success',
    )
  })
})

function renderConcurrencyGroup(template: string, vars: Record<string, string>) {
  return template
    .replaceAll('${{ github.workflow }}', vars.workflow)
    .replaceAll('${{ github.ref }}', vars.ref)
    .replaceAll('${{ github.event.workflow_run.id }}', vars.runId)
    .replaceAll('${{ github.event.pull_request.head.sha }}', vars.head)
}

describe('phase 2 supersession', () => {
  const oldHead = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const newHead = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const ref = 'refs/pull/897/merge'
  const codePaths = ['apps/union-eyes/app/api/example/route.ts']

  function cancelledJobs() {
    return Object.fromEntries(CANONICAL_CONTEXTS.map((context) => [context.ciJob, 'cancelled']))
  }

  function cancelledSecrets() {
    return Object.fromEntries(SECRET_AUTHORITY_CONTEXTS.map((name) => [name, 'cancelled']))
  }

  it('posts terminal required checks when a newer commit supersedes expensive work', () => {
    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    const secret = parse(readFileSync(join(WORKFLOWS, 'secret-scan.yml'), 'utf8'))
    const authority = parse(readFileSync(join(WORKFLOWS, 'merge-authority.yml'), 'utf8'))
    const publisherText = readFileSync(join(WORKFLOWS, PUBLISHER_WORKFLOW_FILE), 'utf8')
    const publisher = parse(publisherText)
    const publisherJob = publisher.jobs[PUBLISHER_JOB_ID]
    const ciText = readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8')
    const secretText = readFileSync(join(WORKFLOWS, 'secret-scan.yml'), 'utf8')

    const oldExpensive = renderConcurrencyGroup(EXPENSIVE_WORKFLOW_CONCURRENCY.group, {
      workflow: 'CI',
      ref,
      runId: '111',
      head: oldHead,
    })
    const newExpensive = renderConcurrencyGroup(EXPENSIVE_WORKFLOW_CONCURRENCY.group, {
      workflow: 'CI',
      ref,
      runId: '222',
      head: newHead,
    })
    const oldPublisherGroup = renderConcurrencyGroup(PUBLISHER_CONCURRENCY.group, {
      workflow: 'Publish required checks',
      ref,
      runId: '111',
      head: oldHead,
    })
    const newPublisherGroup = renderConcurrencyGroup(PUBLISHER_CONCURRENCY.group, {
      workflow: 'Publish required checks',
      ref,
      runId: '222',
      head: newHead,
    })
    const publisherCommands = publisherJob.steps
      .map((step: { run?: string; uses?: string }) => `${step.run ?? ''}\n${step.uses ?? ''}`)
      .join('\n')
    const jobsHaveNoConcurrency = (doc: { jobs: Record<string, { concurrency?: unknown }> }) =>
      Object.values(doc.jobs).every((job) => job.concurrency == null)

    const supersededRunCancelled =
      ci.name === 'CI' &&
      secret.name === 'Secret Scan' &&
      ci.concurrency?.group === EXPENSIVE_WORKFLOW_CONCURRENCY.group &&
      ci.concurrency?.['cancel-in-progress'] === EXPENSIVE_WORKFLOW_CONCURRENCY.cancelInProgress &&
      secret.concurrency?.group === EXPENSIVE_WORKFLOW_CONCURRENCY.group &&
      secret.concurrency?.['cancel-in-progress'] === EXPENSIVE_WORKFLOW_CONCURRENCY.cancelInProgress &&
      EXPENSIVE_WORKFLOW_CONCURRENCY.group.includes('github.workflow') &&
      EXPENSIVE_WORKFLOW_CONCURRENCY.group.includes('github.ref') &&
      !EXPENSIVE_WORKFLOW_CONCURRENCY.group.includes('github.job') &&
      !EXPENSIVE_WORKFLOW_CONCURRENCY.group.includes('head.sha') &&
      EXPENSIVE_WORKFLOW_CONCURRENCY.cancelInProgress.includes('pull_request') &&
      oldExpensive === newExpensive &&
      oldExpensive === `CI-${ref}` &&
      jobsHaveNoConcurrency(ci) &&
      jobsHaveNoConcurrency(secret) &&
      ci.jobs['report-merge-authority'] == null &&
      secret.jobs['report-secret-contexts'] == null &&
      !ciText.includes('publish-pull-request') &&
      !secretText.includes('publish-pull-request') &&
      !ciText.includes('workflow_run') &&
      !secretText.includes('workflow_run')

    const publisherFiresBeforeMerge =
      publisher.on?.pull_request?.branches?.includes('main') &&
      publisher.on.workflow_run == null &&
      !publisherText.includes('workflow_run') &&
      publisherText.includes('github.event.pull_request.head.sha') &&
      publisherText.includes('github.event.pull_request.base.sha') &&
      !publisherText.includes('pull_requests[0].head.sha')

    const currentHeadReporterSurvives =
      publisherFiresBeforeMerge &&
      publisher.name === 'Publish required checks' &&
      publisher.concurrency?.group === PUBLISHER_CONCURRENCY.group &&
      publisher.concurrency?.['cancel-in-progress'] === false &&
      PUBLISHER_CONCURRENCY.group.includes('pull_request.head.sha') &&
      !PUBLISHER_CONCURRENCY.group.includes('github.ref') &&
      !PUBLISHER_CONCURRENCY.group.includes('github.job') &&
      !PUBLISHER_CONCURRENCY.group.includes('workflow_run') &&
      oldPublisherGroup !== newPublisherGroup &&
      oldPublisherGroup === `publish-required-checks-${oldHead}` &&
      newPublisherGroup === `publish-required-checks-${newHead}` &&
      oldPublisherGroup !== oldExpensive &&
      !oldPublisherGroup.includes(ref) &&
      publisherJob.if == null &&
      publisherJob.needs == null &&
      !publisherCommands.includes('inventory:generate') &&
      !publisherCommands.includes('pnpm ') &&
      !publisherCommands.includes('contract-tests') &&
      !publisherCommands.includes('trufflehog') &&
      !publisherCommands.includes('gitleaks') &&
      !publisherCommands.includes('audit-secrets') &&
      !publisherCommands.includes('setup-monorepo') &&
      publisherCommands.includes('node tooling/ci/merge-authority/publish.mjs publish-pull-request') &&
      publisherCommands.includes('MA_CHANGED_PATHS="$(git diff --name-only "$PR_BASE_SHA" "$PR_HEAD_SHA")"') &&
      !readFileSync(join(ROOT, 'tooling/ci/merge-authority/publish.mjs'), 'utf8').includes('/pulls/') &&
      authority.concurrency?.group === MERGE_AUTHORITY_CONCURRENCY.group &&
      authority.concurrency?.['cancel-in-progress'] === false &&
      CI_AUTHORITY_JOBS.length === CANONICAL_CONTEXTS.length &&
      CANONICAL_CONTEXTS.every(
        (context) => CI_AUTHORITY_JOBS.find((job) => job.id === context.ciJob)?.name === ci.jobs[context.ciJob].name,
      )

    let refusedOverride = false
    try {
      publicationTarget(oldHead, newHead)
    } catch (error) {
      refusedOverride = error instanceof Error && /refusing to publish checks for/.test(error.message)
    }
    const ownedByOldHead = terminalChecksForHead({
      results: cancelledJobs(),
      diffPaths: codePaths,
      secretResults: cancelledSecrets(),
      runHeadSha: oldHead,
      requestedHeadSha: oldHead,
    })
    let rejectedRetarget = false
    try {
      terminalChecksForHead({
        results: cancelledJobs(),
        diffPaths: codePaths,
        secretResults: cancelledSecrets(),
        runHeadSha: oldHead,
        requestedHeadSha: newHead,
      })
    } catch (error) {
      rejectedRetarget = error instanceof Error && /this run owns/.test(error.message)
    }
    const mergeSha = 'cccccccccccccccccccccccccccccccccccccccc'
    let refusedLiveLookup = false
    try {
      capturedPublicationHead({
        sourceEvent: 'pull_request',
        workflowRunHeadSha: newHead,
        pullRequestHeadSha: '',
      })
    } catch (error) {
      refusedLiveLookup = error instanceof Error && /refusing to look up the live head/.test(error.message)
    }
    const frozenOldHead = capturedPublicationHead({
      sourceEvent: 'pull_request',
      workflowRunHeadSha: mergeSha,
      pullRequestHeadSha: oldHead,
    })
    const listedRuns = [
      {
        id: 10,
        head_sha: oldHead,
        event: 'pull_request',
        status: 'completed',
        conclusion: 'cancelled',
        pull_requests: [{ head: { sha: newHead } }],
      },
      {
        id: 11,
        head_sha: newHead,
        event: 'pull_request',
        status: 'in_progress',
        conclusion: null,
        pull_requests: [{ head: { sha: newHead } }],
      },
    ]
    const selectedOldRun = selectRunForHead(listedRuns, oldHead)
    const selectedNewRun = selectRunForHead(listedRuns, newHead)
    const oldHeadCannotOverride =
      refusedOverride &&
      rejectedRetarget &&
      refusedLiveLookup &&
      frozenOldHead === oldHead &&
      frozenOldHead !== mergeSha &&
      frozenOldHead !== newHead &&
      selectedOldRun?.id === 10 &&
      selectedNewRun?.id === 11 &&
      runIsTerminal(selectedOldRun) &&
      !runIsTerminal(selectedNewRun) &&
      ownedByOldHead.every((check) => check.head_sha === oldHead) &&
      publicationTarget(newHead, newHead) === newHead

    const byName = Object.fromEntries(ownedByOldHead.map((check) => [check.name, check]))
    const mixed = terminalChecksForHead({
      results: { ...cancelledJobs(), 'lint-and-typecheck': 'failure', 'iac-scan': 'failure' },
      diffPaths: ['infrastructure/bicep/main.bicep'],
      secretResults: {
        Gitleaks: 'failure',
        'TruffleHog OSS': 'success',
        'Docker Secret Policy': 'cancelled',
      },
      runHeadSha: newHead,
    })
    const mixedByName = Object.fromEntries(mixed.map((check) => [check.name, check]))
    const unknown = terminalChecksForHead({
      results: cancelledJobs(),
      diffPaths: ['something-unexpected.bin'],
      secretResults: Object.fromEntries(SECRET_AUTHORITY_CONTEXTS.map((name) => [name, 'skipped'])),
      runHeadSha: oldHead,
    })
    const requiredNotPending =
      ownedByOldHead.length === 16 &&
      new Set(ownedByOldHead.map((check) => check.name)).size === 16 &&
      REQUIRED_CHECK_NAMES.every((name) => byName[name]?.status === 'completed') &&
      byName['Merge Authority / Lint & Typecheck'].conclusion === 'failure' &&
      byName['Merge Authority / Ops Documentation'].conclusion === 'success' &&
      byName['Merge Authority / Ops Documentation'].output.title === 'NOT_APPLICABLE' &&
      byName['Merge Authority / IaC Security'].output.title === 'NOT_APPLICABLE' &&
      byName.Gitleaks.conclusion === 'failure' &&
      byName.Gitleaks.output.title === 'SUPERSEDED' &&
      byName['TruffleHog OSS'].conclusion === 'failure' &&
      byName['Docker Secret Policy'].conclusion === 'failure' &&
      mixedByName['Merge Authority / Lint & Typecheck'].conclusion === 'failure' &&
      mixedByName['Merge Authority / IaC Security'].conclusion === 'failure' &&
      mixedByName['Merge Authority / IaC Security'].output.title === 'FAILURE' &&
      mixedByName.Gitleaks.conclusion === 'failure' &&
      mixedByName['TruffleHog OSS'].conclusion === 'success' &&
      mixedByName['Docker Secret Policy'].conclusion === 'failure' &&
      mixedByName['Docker Secret Policy'].output.title === 'SUPERSEDED' &&
      mixed.every((check) => check.head_sha === newHead) &&
      unknown.every(
        (check) =>
          check.status === 'completed' && check.conclusion !== 'success' && check.output.title !== 'NOT_APPLICABLE',
      )

    expect({
      SUPERSEDED_RUN_CANCELLED: supersededRunCancelled ? 'YES' : 'NO',
      CURRENT_HEAD_REPORTER_SURVIVES: currentHeadReporterSurvives ? 'YES' : 'NO',
      OLD_HEAD_CANNOT_OVERRIDE_NEW_HEAD: oldHeadCannotOverride ? 'YES' : 'NO',
      REQUIRED_CONTEXTS_NOT_LEFT_PENDING: requiredNotPending ? 'YES' : 'NO',
      PUBLISHER_FIRES_BEFORE_MERGE: publisherFiresBeforeMerge ? 'YES' : 'NO',
    }).toEqual({
      SUPERSEDED_RUN_CANCELLED: 'YES',
      CURRENT_HEAD_REPORTER_SURVIVES: 'YES',
      OLD_HEAD_CANNOT_OVERRIDE_NEW_HEAD: 'YES',
      REQUIRED_CONTEXTS_NOT_LEFT_PENDING: 'YES',
      PUBLISHER_FIRES_BEFORE_MERGE: 'YES',
    })
  })

  it('posts only unexecuted secret contexts, and only for the captured head', () => {
    const dir = mkdtempSync(join(tmpdir(), 'merge-authority-secret-'))
    const postedPath = join(dir, 'posted.json')
    const preload = join(dir, 'preload.mjs')
    writeFileSync(
      preload,
      `import { writeFileSync } from 'node:fs'
const posted = []
globalThis.fetch = async (_url, init) => {
  posted.push(JSON.parse(init.body))
  writeFileSync(${JSON.stringify(postedPath)}, JSON.stringify(posted))
  return new Response('{}', { status: 201 })
}
`,
    )
    const command = [
      '--import',
      preload,
      join(ROOT, 'tooling/ci/merge-authority/publish.mjs'),
      'publish-secret-terminals',
    ]
    const baseEnv = {
      ...process.env,
      GITHUB_REPOSITORY: 'anungis437/nzila-os',
      GITHUB_TOKEN: 'test-token',
      MA_SECRET_GITLEAKS: 'cancelled',
      MA_SECRET_TRUFFLEHOG: 'success',
      MA_SECRET_DOCKER: 'failure',
    }
    const postedRun = spawnSync(process.execPath, command, {
      encoding: 'utf8',
      env: { ...baseEnv, HEAD_SHA: oldHead, MA_RUN_HEAD_SHA: oldHead },
    })
    expect(postedRun.status, postedRun.stderr).toBe(0)
    const posted = JSON.parse(readFileSync(postedPath, 'utf8'))
    expect(posted.map((check: { name: string }) => check.name)).toEqual(['Gitleaks'])
    expect(posted[0]).toMatchObject({
      head_sha: oldHead,
      status: 'completed',
      conclusion: 'failure',
      output: { title: 'SUPERSEDED' },
    })
    const mismatch = spawnSync(process.execPath, command, {
      encoding: 'utf8',
      env: { ...baseEnv, HEAD_SHA: newHead, MA_RUN_HEAD_SHA: oldHead },
    })
    expect(mismatch.status).not.toBe(0)
    expect(mismatch.stderr).toMatch(/refusing to publish checks for/)
  })

  function postedPullRequest(
    env: Record<string, string>,
    options: {
      ciJobs: Array<{ name: string; conclusion: string | null }>
      secretJobs: Array<{ name: string; conclusion: string | null }>
      delayCi?: boolean
      /** HTTP status of the first check-run POST. Later posts return 201. */
      firstCheckStatus?: number
      /** Return this status for the real body of one name until retries are exhausted. */
      exhaustName?: string
      exhaustAttempts?: number
    },
  ) {
    const dir = mkdtempSync(join(tmpdir(), 'merge-authority-run-'))
    const postedPath = join(dir, 'posted.json')
    const statusesPath = join(dir, 'statuses.json')
    const preload = join(dir, 'preload.mjs')
    const head = env.PR_HEAD_SHA
    writeFileSync(
      preload,
      `import { writeFileSync } from 'node:fs'
const posted = []
const statuses = []
const ciJobs = ${JSON.stringify(options.ciJobs)}
const secretJobs = ${JSON.stringify(options.secretJobs)}
const earlyCiJobs = ciJobs.map((job) => ({ ...job, conclusion: 'success' }))
const head = ${JSON.stringify(head)}
const newHead = ${JSON.stringify(newHead)}
let ciPolls = 0
const delayCi = ${options.delayCi ? 'true' : 'false'}
const firstCheckStatus = ${JSON.stringify(options.firstCheckStatus ?? 201)}
const exhaustName = ${JSON.stringify(options.exhaustName ?? null)}
const exhaustAttempts = ${JSON.stringify(options.exhaustAttempts ?? 0)}
const realAttempts = {}
globalThis.fetch = async (url, init) => {
  const target = String(url)
  if (target.includes('/workflows/ci.yml/runs')) {
    ciPolls += 1
    const ready = !delayCi || ciPolls > 1
    return new Response(JSON.stringify({ workflow_runs: [
      { id: 200, head_sha: newHead, event: 'pull_request', status: 'in_progress', conclusion: null, pull_requests: [{ head: { sha: newHead } }] },
      { id: 100, head_sha: head, event: 'pull_request', status: ready ? 'completed' : 'in_progress', conclusion: ready ? 'cancelled' : null, pull_requests: [{ head: { sha: newHead } }] },
    ] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (target.includes('/workflows/secret-scan.yml/runs')) {
    return new Response(JSON.stringify({ workflow_runs: [
      { id: 300, head_sha: head, event: 'pull_request', status: 'completed', conclusion: 'success', pull_requests: [{ head: { sha: newHead } }] },
    ] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (target.includes('/actions/runs/100/jobs')) {
    const jobs = delayCi && ciPolls < 2 ? earlyCiJobs : ciJobs
    return new Response(JSON.stringify({ jobs }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (target.includes('/actions/runs/300/jobs')) {
    return new Response(JSON.stringify({ jobs: secretJobs }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (target.includes('/pulls/')) {
    throw new Error('refusing live pull request lookup')
  }
  const body = JSON.parse(init.body)
  posted.push(body)
  const fallback = String(body.output?.summary ?? '').includes('could not be published with its real conclusion')
  realAttempts[body.name] = (realAttempts[body.name] ?? 0) + (fallback ? 0 : 1)
  let status = posted.length === 1 ? firstCheckStatus : 201
  if (exhaustName && body.name === exhaustName && !fallback && realAttempts[body.name] <= exhaustAttempts) status = 504
  statuses.push(status)
  writeFileSync(${JSON.stringify(postedPath)}, JSON.stringify(posted))
  writeFileSync(${JSON.stringify(statusesPath)}, JSON.stringify(statuses))
  return new Response('gateway timeout', { status })
}
`,
    )
    const result = spawnSync(
      process.execPath,
      ['--import', preload, join(ROOT, 'tooling/ci/merge-authority/publish.mjs'), 'publish-pull-request'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_REPOSITORY: 'anungis437/nzila-os',
          GITHUB_TOKEN: 'test-token',
          MA_POLL_INTERVAL_MS: '0',
          MA_POLL_TIMEOUT_MS: '2000',
          ...env,
        },
      },
    )
    return {
      result,
      posted: existsPosted(postedPath) ? JSON.parse(readFileSync(postedPath, 'utf8')) : [],
      statuses: existsPosted(statusesPath) ? JSON.parse(readFileSync(statusesPath, 'utf8')) : [],
    }
  }

  function existsPosted(postedPath: string) {
    try {
      readFileSync(postedPath, 'utf8')
      return true
    } catch {
      return false
    }
  }

  it('publishes the frozen head from a cancelled run without rerunning expensive work', () => {
    const cancelledCi = CI_AUTHORITY_JOBS.map((job) => ({ name: job.name, conclusion: 'cancelled' as const }))
    const secretJobs = [
      { name: 'Gitleaks', conclusion: 'cancelled' },
      { name: 'TruffleHog OSS', conclusion: 'success' },
      { name: 'Docker Secret Policy', conclusion: null },
    ]
    const ciRun = postedPullRequest(
      {
        PR_HEAD_SHA: oldHead,
        HEAD_SHA: newHead,
        MA_CHANGED_PATHS: codePaths.join('\n'),
      },
      { ciJobs: cancelledCi, secretJobs, delayCi: true },
    )
    expect(ciRun.result.status, ciRun.result.stderr).toBe(0)
    expect(ciRun.posted).toHaveLength(16)
    expect(ciRun.posted.every((check: { head_sha: string }) => check.head_sha === oldHead)).toBe(true)
    expect(new Set(ciRun.posted.map((check: { name: string }) => check.name))).toEqual(
      new Set([...CANONICAL_CONTEXTS.map((context) => context.name), ...SECRET_AUTHORITY_CONTEXTS]),
    )
    expect(ciRun.posted.find((check: { name: string }) => check.name === 'Merge Authority / Lint & Typecheck')).toMatchObject({
      conclusion: 'failure',
      output: { title: 'UNRESOLVED' },
    })
    expect(ciRun.posted.find((check: { name: string }) => check.name === 'Merge Authority / Ops Documentation')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(ciRun.posted.find((check: { name: string }) => check.name === 'Merge Authority / IaC Security')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(ciRun.posted.find((check: { name: string }) => check.name === 'Gitleaks')).toMatchObject({
      conclusion: 'failure',
      output: { title: 'SUPERSEDED' },
    })
    expect(ciRun.posted.find((check: { name: string }) => check.name === 'TruffleHog OSS')).toMatchObject({
      conclusion: 'success',
    })
    expect(ciRun.posted.find((check: { name: string }) => check.name === 'Docker Secret Policy')).toMatchObject({
      conclusion: 'failure',
      output: { title: 'UNRESOLVED' },
    })

    const applicable = postedPullRequest(
      {
        PR_HEAD_SHA: oldHead,
        MA_CHANGED_PATHS: 'infrastructure/bicep/main.bicep',
      },
      { ciJobs: cancelledCi, secretJobs },
    )
    expect(
      applicable.posted.find((check: { name: string }) => check.name === 'Merge Authority / IaC Security'),
    ).toMatchObject({ conclusion: 'failure', output: { title: 'UNRESOLVED' } })

    const missingHead = postedPullRequest(
      {
        HEAD_SHA: newHead,
        MA_CHANGED_PATHS: codePaths.join('\n'),
      },
      { ciJobs: cancelledCi, secretJobs },
    )
    expect(missingHead.result.status).not.toBe(0)
    expect(missingHead.result.stderr).toMatch(/refusing to look up the live head/)

    const docsOnly = postedPullRequest(
      {
        PR_HEAD_SHA: oldHead,
        MA_CHANGED_PATHS: 'README.md',
      },
      { ciJobs: cancelledCi, secretJobs },
    )
    expect(docsOnly.result.status, docsOnly.result.stderr).toBe(0)
    expect(docsOnly.posted).toHaveLength(16)
    expect(new Set(docsOnly.posted.map((check: { name: string }) => check.name))).toEqual(new Set(REQUIRED_CHECK_NAMES))
    expect(docsOnly.posted.every((check: { head_sha: string }) => check.head_sha === oldHead)).toBe(true)
    expect(
      docsOnly.posted
        .filter((check: { name: string }) => check.name.startsWith('Merge Authority /'))
        .every(
          (check: { conclusion: string; output: { title: string } }) =>
            check.conclusion === 'success' && check.output.title === 'NOT_APPLICABLE',
        ),
    ).toBe(true)
  })

  it('retries the first 504 and still posts every required name', () => {
    const publishSource = readFileSync(join(ROOT, 'tooling/ci/merge-authority/publish.mjs'), 'utf8')
    expect(publishSource).toContain('408')
    expect(publishSource).toContain('429')
    expect(publishSource).toContain('502')
    expect(publishSource).toContain('503')
    expect(publishSource).toContain('504')

    const cancelledCi = CI_AUTHORITY_JOBS.map((job) => ({ name: job.name, conclusion: 'cancelled' as const }))
    const secretJobs = [
      { name: 'Gitleaks', conclusion: 'cancelled' },
      { name: 'TruffleHog OSS', conclusion: 'success' },
      { name: 'Docker Secret Policy', conclusion: 'failure' },
    ]
    const env = {
      PR_HEAD_SHA: oldHead,
      HEAD_SHA: newHead,
      MA_CHANGED_PATHS: codePaths.join('\n'),
      MA_CHECK_RETRY_BASE_MS: '0',
      MA_CHECK_ATTEMPTS: '4',
    }
    const retried = postedPullRequest(env, { ciJobs: cancelledCi, secretJobs, firstCheckStatus: 504 })
    expect(retried.result.status, retried.result.stderr).toBe(0)
    expect(retried.statuses[0]).toBe(504)
    expect(retried.statuses.slice(1).every((status: number) => status === 201)).toBe(true)

    const latest = new Map<string, { name: string; head_sha: string; conclusion: string; output: { title: string; summary: string } }>()
    for (const check of retried.posted) latest.set(check.name, check)
    expect(latest.size).toBe(16)
    expect(new Set(latest.keys())).toEqual(new Set(REQUIRED_CHECK_NAMES))
    expect([...latest.values()].every((check) => check.head_sha === oldHead)).toBe(true)
    expect(latest.get('Merge Authority / Lint & Typecheck')).toMatchObject({
      conclusion: 'failure',
      output: { title: 'UNRESOLVED' },
    })
    expect(latest.get('Merge Authority / Lint & Typecheck')?.output.summary ?? '').not.toContain(
      'could not be published with its real conclusion',
    )
    expect(latest.get('Merge Authority / Ops Documentation')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(latest.get('Merge Authority / IaC Security')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(latest.get('Gitleaks')).toMatchObject({ conclusion: 'failure', output: { title: 'SUPERSEDED' } })
    expect(latest.get('TruffleHog OSS')).toMatchObject({ conclusion: 'success', output: { title: 'PASS' } })
    expect(latest.get('Docker Secret Policy')).toMatchObject({ conclusion: 'failure', output: { title: 'FAILURE' } })

    const exhausted = postedPullRequest(
      { ...env, MA_CHECK_ATTEMPTS: '2' },
      {
        ciJobs: cancelledCi,
        secretJobs,
        exhaustName: 'Merge Authority / Ops Documentation',
        exhaustAttempts: 2,
      },
    )
    expect(exhausted.result.status, exhausted.result.stderr).toBe(0)
    const afterFailure = new Map<string, { name: string; head_sha: string; conclusion: string; output: { title: string; summary: string } }>()
    for (const check of exhausted.posted) afterFailure.set(check.name, check)
    expect(afterFailure.size).toBe(16)
    expect(new Set(afterFailure.keys())).toEqual(new Set(REQUIRED_CHECK_NAMES))
    expect([...afterFailure.values()].every((check) => check.head_sha === oldHead)).toBe(true)
    expect(afterFailure.get('Merge Authority / Ops Documentation')).toMatchObject({
      conclusion: 'failure',
      output: { title: 'UNRESOLVED' },
    })
    expect(afterFailure.get('Merge Authority / Ops Documentation')?.output.summary ?? '').toContain(
      'could not be published with its real conclusion',
    )
    expect(afterFailure.get('Merge Authority / Lint & Typecheck')).toMatchObject({
      conclusion: 'failure',
      output: { title: 'UNRESOLVED' },
    })
    expect(afterFailure.get('Merge Authority / Lint & Typecheck')?.output.summary ?? '').not.toContain(
      'could not be published with its real conclusion',
    )
    expect(afterFailure.get('Merge Authority / IaC Security')).toMatchObject({
      conclusion: 'success',
      output: { title: 'NOT_APPLICABLE' },
    })
    expect(afterFailure.get('Gitleaks')?.conclusion).toBe('failure')
    expect(afterFailure.get('TruffleHog OSS')?.conclusion).toBe('success')
    expect(afterFailure.get('Docker Secret Policy')?.conclusion).toBe('failure')
  })

  it('phase 3 dedupe: each control has one execution owner and a removed duplicate cannot return under another name', () => {
    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    const governance = parse(readFileSync(join(WORKFLOWS, 'nzila-governance.yml'), 'utf8'))
    const secrets = parse(readFileSync(join(WORKFLOWS, 'secret-scan.yml'), 'utf8'))
    const inventoryCheck = parse(readFileSync(join(WORKFLOWS, 'repo-inventory-check.yml'), 'utf8'))
    const authority = parse(readFileSync(join(WORKFLOWS, 'merge-authority.yml'), 'utf8'))

    function runs(job: { steps?: Array<{ run?: string; uses?: string }> }) {
      return (job.steps ?? []).map((step) => `${step.uses ?? ''}\n${step.run ?? ''}`).join('\n')
    }

    const gateRuns = runs(ci.jobs['governance-gates'])
    expect(gateRuns).not.toMatch(/pnpm contract-tests\b/)
    expect(gateRuns).not.toMatch(/inventory:generate/)
    expect(gateRuns).not.toMatch(/gitleaks/i)
    expect(gateRuns).not.toMatch(/trufflehog/i)
    expect(gateRuns).toContain('CI job contract-tests')
    expect(gateRuns).toContain('CI job repository-inventory')
    expect(runs(ci.jobs['contract-tests'])).toContain('pnpm contract-tests')
    expect(runs(ci.jobs['repository-inventory'])).toContain('pnpm inventory:generate')
    expect(runs(ci.jobs['reconcile-frozen-head'])).toContain('reconcile-this-run')
    expect(runs(ci.jobs['reconcile-frozen-head'])).not.toMatch(/pnpm contract-tests|inventory:generate|gitleaks|trufflehog/)

    const ciContractRuns = Object.values(ci.jobs).flatMap((job) => (job as { steps?: Array<{ run?: string }> }).steps ?? []).map((step) => step.run ?? '')
    expect(ciContractRuns.filter((run) => /\bpnpm contract-tests\b/.test(run))).toEqual(['pnpm contract-tests'])
    const ciInventoryRuns = ciContractRuns.filter((run) => run.includes('inventory:generate'))
    expect(ciInventoryRuns).toEqual(['pnpm inventory:generate'])

    for (const job of Object.values(governance.jobs)) {
      const blob = runs(job as { steps?: Array<{ run?: string; uses?: string }> })
      expect(blob).not.toMatch(/gitleaks\/gitleaks-action|trufflesecurity\/trufflehog/)
      expect(blob).not.toMatch(/\bpnpm contract-tests\b/)
      expect(blob).not.toMatch(/inventory:generate/)
    }
    expect(runs(governance.jobs['secret-scan'])).toContain('secret-scan.yml job gitleaks')
    expect(runs(governance.jobs['secret-scan'])).toContain('secret-scan.yml job trufflehog')
    expect(runs(governance.jobs['contract-tests'])).toContain('ci.yml job contract-tests')
    expect(runs(secrets.jobs.gitleaks)).toContain('gitleaks/gitleaks-action@')
    expect(runs(secrets.jobs.trufflehog)).toContain('trufflesecurity/trufflehog@')
    expect(runs(secrets.jobs['docker-secret-policy'])).toContain('audit-secrets.ts')
    expect(runs(secrets.jobs['reconcile-frozen-head'])).toContain('reconcile-this-run')
    expect(runs(secrets.jobs['reconcile-frozen-head'])).not.toMatch(/gitleaks\/gitleaks-action|trufflesecurity\/trufflehog/)

    const drift = runs(inventoryCheck.jobs['drift-check'])
    expect(drift).toContain('tooling/repo-inventory/src/check-drift.ts')
    expect(drift).toContain('tooling/repo-inventory/src/generate.ts')
    expect(drift).not.toContain('inventory:generate')

    expect(authority.jobs['repository-inventory-if-ci-skipped'].if).toContain("needs.classify.outputs.ci_skip == 'true'")
    expect(runs(authority.jobs['repository-inventory-if-ci-skipped'])).toContain('pnpm inventory:generate')

    const actionRoot = join(ROOT, '.github', 'actions')
    const actionFiles: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(yml|yaml|sh|mjs|js|ts)$/.test(entry.name)) actionFiles.push(full)
      }
    }
    walk(actionRoot)
    for (const file of actionFiles) {
      const body = readFileSync(file, 'utf8')
      expect(body, file).not.toMatch(/gitleaks\/gitleaks-action|trufflesecurity\/trufflehog|\bpnpm contract-tests\b|inventory:generate/)
    }

    const referenced = new Set<string>()
    for (const job of [ci.jobs['governance-gates'], governance.jobs['secret-scan'], governance.jobs['contract-tests']]) {
      for (const step of (job as { steps?: Array<{ run?: string }> }).steps ?? []) {
        for (const match of (step.run ?? '').matchAll(/(?:^|\s)((?:tooling|scripts)\/[A-Za-z0-9_./-]+\.(?:mjs|js|ts))/g)) {
          referenced.add(match[1])
        }
      }
    }
    for (const relative of referenced) {
      const body = readFileSync(join(ROOT, relative), 'utf8')
      expect(body, relative).not.toMatch(/gitleaks\/gitleaks-action|trufflesecurity\/trufflehog|execSync\([^)]*contract-tests|spawn\([^)]*contract-tests|inventory:generate\(/)
    }
  })

  it('phase 3 dedupe: seven synthetic change classes classify and terminate without a live Actions run', () => {
    const classes: Array<{
      name: string
      paths: string[]
      classification: string
      ciSkipped: boolean
      required: string[]
    }> = [
      {
        name: 'docs-only',
        paths: ['README.md'],
        classification: 'ALL_NOT_APPLICABLE',
        ciSkipped: true,
        required: [],
      },
      {
        name: 'inventory-lock-only',
        paths: ['tooling/repo-inventory/output/inventory.json'],
        classification: 'MIXED',
        ciSkipped: false,
        required: [
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
        ],
      },
      {
        name: 'product-code',
        paths: ['apps/union-eyes/app/api/example/route.ts'],
        classification: 'MIXED',
        ciSkipped: false,
        required: [
          'Merge Authority / Lint & Typecheck',
          'Merge Authority / Unit Tests',
          'Merge Authority / Schema Integrity',
          'Merge Authority / PostgreSQL RLS',
          'Merge Authority / Migration Chain',
          'Merge Authority / Affected Build',
          'Merge Authority / Architectural Contracts',
          'Merge Authority / Repository Inventory',
          'Merge Authority / Governance Integrity',
          'Merge Authority / Operating Layer',
        ],
      },
      {
        name: 'test-only',
        paths: ['apps/union-eyes/app/api/example/route.test.ts'],
        classification: 'MIXED',
        ciSkipped: false,
        required: [
          'Merge Authority / Lint & Typecheck',
          'Merge Authority / Unit Tests',
          'Merge Authority / Schema Integrity',
          'Merge Authority / PostgreSQL RLS',
          'Merge Authority / Migration Chain',
          'Merge Authority / Affected Build',
          'Merge Authority / Architectural Contracts',
          'Merge Authority / Repository Inventory',
          'Merge Authority / Governance Integrity',
          'Merge Authority / Operating Layer',
        ],
      },
      {
        name: 'architecture-affecting',
        paths: ['tooling/contract-tests/merge-authority-surface.test.ts'],
        classification: 'MIXED',
        ciSkipped: false,
        required: [
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
        ],
      },
      {
        name: 'ops-docs-affecting',
        paths: ['ops/runbooks/README.md'],
        classification: 'MIXED',
        ciSkipped: true,
        required: ['Merge Authority / Ops Documentation'],
      },
      {
        name: 'workflow/governance',
        paths: ['.github/workflows/ci.yml'],
        classification: 'CODE_OR_UNKNOWN',
        ciSkipped: false,
        required: CANONICAL_CONTEXTS.map((context) => context.name),
      },
    ]

    const ci = parse(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'))
    for (const sample of classes) {
      const plan = classifyChangedPaths(sample.paths)
      expect(plan.classification, sample.name).toBe(sample.classification)
      expect(plan.ciSkippedByPathsIgnore, sample.name).toBe(sample.ciSkipped)
      expect(plan.secretSafety, sample.name).toBe('APPLICABLE')
      const required = Object.entries(plan.contexts)
        .filter(([, value]) => value === 'REQUIRES_EXECUTION')
        .map(([name]) => name)
        .sort()
      expect(required, sample.name).toEqual([...sample.required].sort())
      const fast = fastPathExecution(plan)
      expect(fast.governance, sample.name).toBe(sample.ciSkipped && plan.contexts['Merge Authority / Governance Integrity'] === 'REQUIRES_EXECUTION')
      expect(fast.inventory, sample.name).toBe(sample.ciSkipped && plan.contexts['Merge Authority / Repository Inventory'] === 'REQUIRES_EXECUTION')
      expect(fast.iac, sample.name).toBe(sample.ciSkipped && plan.contexts['Merge Authority / IaC Security'] === 'REQUIRES_EXECUTION')
      expect(fast.ops, sample.name).toBe(sample.ciSkipped && plan.contexts['Merge Authority / Ops Documentation'] === 'REQUIRES_EXECUTION')
      if (!sample.ciSkipped) {
        for (const context of CANONICAL_CONTEXTS) {
          expect(ci.jobs[context.ciJob].if, `${sample.name} ${context.ciJob}`).toBeUndefined()
        }
      }

      const passed = evaluateCiResults(
        Object.fromEntries(CANONICAL_CONTEXTS.map((context) => [context.ciJob, 'success'])),
        sample.paths,
      )
      expect(passed, sample.name).toHaveLength(13)
      for (const verdict of passed) {
        expect(verdict.conclusion, `${sample.name} ${verdict.name}`).toBe('success')
        const expectNa = !sample.required.includes(verdict.name)
        expect(verdict.evidence, `${sample.name} ${verdict.name}`).toBe(expectNa ? 'NOT_APPLICABLE' : 'PASS')
      }
      const secretPass = secretCheckPublications({
        Gitleaks: 'success',
        'TruffleHog OSS': 'success',
        'Docker Secret Policy': 'success',
      })
      expect(secretPass.map((item) => item.name).sort()).toEqual([...SECRET_AUTHORITY_CONTEXTS].sort())
      expect(secretPass.every((item) => item.status === 'completed' && item.conclusion === 'success' && item.evidence === 'PASS')).toBe(true)
      expect(passed.length + secretPass.length).toBe(16)

      const failingJob = sample.required.length > 0
        ? CANONICAL_CONTEXTS.find((context) => context.name === sample.required[0])!.ciJob
        : 'lint-and-typecheck'
      const failed = evaluateCiResults(
        Object.fromEntries(CANONICAL_CONTEXTS.map((context) => [context.ciJob, context.ciJob === failingJob ? 'failure' : 'success'])),
        sample.paths,
      )
      const failedVerdict = failed.find((verdict) => verdict.ciJob === failingJob)!
      if (sample.required.includes(failedVerdict.name)) {
        expect(failedVerdict, sample.name).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
      } else {
        expect(failedVerdict, sample.name).toMatchObject({ evidence: 'NOT_APPLICABLE', conclusion: 'success' })
      }
      const secretFail = secretCheckPublications({
        Gitleaks: 'failure',
        'TruffleHog OSS': 'success',
        'Docker Secret Policy': 'cancelled',
      })
      expect(secretFail.find((item) => item.name === 'Gitleaks')).toMatchObject({ evidence: 'FAILURE', conclusion: 'failure' })
      expect(secretFail.find((item) => item.name === 'TruffleHog OSS')).toMatchObject({ evidence: 'PASS', conclusion: 'success' })
      expect(secretFail.find((item) => item.name === 'Docker Secret Policy')?.conclusion).not.toBe('success')
    }
  })
})

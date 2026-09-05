import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'

const ROOT = join(__dirname, '..', '..')
const WORKFLOW_PATH = join(ROOT, '.github', 'workflows', 'deploy-union-eyes.yml')
const source = readFileSync(WORKFLOW_PATH, 'utf-8')
const doc = load(source) as {
  jobs: Record<string, { needs?: string | string[]; steps?: Array<{ name?: string; run?: string }> }>
}

function stepsOf(jobName: string) {
  return doc.jobs[jobName]?.steps ?? []
}

function combinedRunOf(jobName: string): string {
  return stepsOf(jobName)
    .map((s) => s.run ?? '')
    .join('\n')
}

describe('ICRA capability migration deploy gate (PR #752)', () => {
  it('defines a mandatory apply-icra-capability-migration job (not gated behind a workflow_dispatch input, unlike 0108)', () => {
    const job = doc.jobs['apply-icra-capability-migration']
    expect(job, 'expected apply-icra-capability-migration job to exist').toBeTruthy()
    // Unlike apply-rls-foundation-migration, this job must have no `if:` condition
    // restricting it to an optional operator-triggered input.
    expect((job as any).if).toBeUndefined()
  })

  it('the deploy job depends on the capability migration gate — deployment cannot run if the gate fails or is skipped', () => {
    // This is the ONLY invariant GitHub Actions actually guarantees: job
    // scheduling is driven by `needs:` edges, never by YAML declaration
    // order. `deploy` must both declare the dependency AND carry no `if:`
    // override that would let it run despite an upstream failure (the
    // GitHub Actions default — skip a job if any of its `needs` failed —
    // only holds as long as nothing overrides it, e.g. `if: always()`).
    const deployJob = doc.jobs.deploy as { needs?: string | string[]; if?: unknown }
    const needsArray = Array.isArray(deployJob.needs) ? deployJob.needs : [deployJob.needs]
    expect(needsArray).toContain('apply-icra-capability-migration')
    expect(
      deployJob.if,
      'deploy must not override the default needs-based skip behavior (e.g. with if: always())',
    ).toBeUndefined()
  })

  it('build-push is NOT required to wait for the migration gate (building an image has no DB dependency; only deploying it does)', () => {
    // Explicit, intentional scope: the safety invariant this workflow must
    // guarantee is "migration confirmed before the application REVISION is
    // replaced", not "before the image is built". Building in parallel is
    // safe and faster; only `deploy` (which replaces the live revision)
    // needs the gate. If this ever needs to change, update this test to
    // assert build-push.needs contains the gate — do not just add it
    // silently and leave this test asserting the opposite.
    const buildPushNeeds = doc.jobs['build-push'].needs
    const needsArray = Array.isArray(buildPushNeeds) ? buildPushNeeds : [buildPushNeeds]
    expect(needsArray).not.toContain('apply-icra-capability-migration')
  })

  it('fails closed if the migration-admin Key Vault secret is unavailable, before any build/deploy', () => {
    const run = combinedRunOf('apply-icra-capability-migration')
    expect(run).toContain('union-eyes-migration-admin-database-url')
    expect(run).toMatch(/az keyvault secret show[\s\S]*?exit 1/)
    expect(run).toContain('Refusing to proceed to build/deploy')
  })

  it('uses the canonical shared scoped-migration executor via icra:capability-rollout:check/:apply — never a hand-written copy of the 0005 DDL', () => {
    const run = combinedRunOf('apply-icra-capability-migration')
    expect(run).toContain('icra:capability-rollout:check')
    expect(run).toContain('icra:capability-rollout:apply')
    expect(run).not.toMatch(/ALTER TABLE|CREATE INDEX/) // no inline DDL in the workflow itself

    const rolloutScriptPath = join(ROOT, 'tooling', 'scripts', 'apply-icra-capability-rollout.mjs')
    const rolloutSrc = readFileSync(rolloutScriptPath, 'utf-8')
    expect(rolloutSrc).toContain("from './lib/union-eyes-scoped-migrations.mjs'")

    const packageJsonPath = join(ROOT, 'apps', 'union-eyes', 'package.json')
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    expect(pkg.scripts['icra:capability-rollout:check']).toContain('apply-icra-capability-rollout.mjs --check')
    expect(pkg.scripts['icra:capability-rollout:apply']).toContain('apply-icra-capability-rollout.mjs --apply')
  })

  it('applies only when the initial check is not already GO, then re-checks and fails closed if verification does not pass', () => {
    const run = combinedRunOf('apply-icra-capability-migration')
    // initial check
    expect(run).toMatch(/icra:capability-rollout:check[\s\S]*?CHECK_STATUS=\$\?/)
    // conditional apply
    expect(run).toMatch(/CHECK_STATUS.*-ne 0[\s\S]*?icra:capability-rollout:apply/)
    // apply failure fails the job
    expect(run).toMatch(/APPLY_STATUS.*-ne 0[\s\S]*?exit 1/)
    // mandatory post-apply re-check
    expect(run).toMatch(/icra:capability-rollout:check[\s\S]*?FINAL_STATUS=\$\?/)
    expect(run).toMatch(/FINAL_STATUS.*-ne 0[\s\S]*?exit 1/)
  })

  it('never traces the exported admin connection string', () => {
    const run = combinedRunOf('apply-icra-capability-migration')
    expect(run).toContain('set +x')
    expect(run).toContain('unset RLS_MIGRATION_ADMIN_DATABASE_URL ADMIN_URL')
  })
})

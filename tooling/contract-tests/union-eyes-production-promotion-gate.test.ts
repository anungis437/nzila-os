import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'

const ROOT = join(__dirname, '..', '..')
const AUTO_PROMOTE_PATH = join(ROOT, '.github', 'workflows', 'auto-promote-union-eyes.yml')
const DEPLOY_PATH = join(ROOT, '.github', 'workflows', 'deploy-union-eyes.yml')

const autoPromoteSource = readFileSync(AUTO_PROMOTE_PATH, 'utf-8')
const deploySource = readFileSync(DEPLOY_PATH, 'utf-8')

const autoPromoteDoc = load(autoPromoteSource) as {
  on: { push?: { branches?: string[] } }
  jobs: Record<
    string,
    {
      strategy?: { matrix?: { environment?: string[] } }
      steps?: Array<{ run?: string }>
    }
  >
}

const deployDoc = load(deploySource) as {
  on: { push?: { branches?: string[] } }
  jobs: Record<string, { steps?: Array<{ id?: string; run?: string }> }>
}

function combinedRunOf(doc: typeof deployDoc, jobName: string): string {
  return (doc.jobs[jobName]?.steps ?? [])
    .map((s) => s.run ?? '')
    .join('\n')
}

describe('Union Eyes production-promotion gate — merge/push to main must never auto-authorize production rollout', () => {
  it('auto-promote-union-eyes.yml fanout matrix does not include production', () => {
    const matrixEnv = autoPromoteDoc.jobs.fanout?.strategy?.matrix?.environment
    expect(matrixEnv, 'expected fanout job to declare a matrix.environment array').toBeTruthy()
    expect(matrixEnv).not.toContain('production')
    // Non-production environments must remain automated — this gate is
    // deliberately narrow, not a blanket disable of automated promotion.
    expect(matrixEnv).toEqual(expect.arrayContaining(['demo', 'pilot', 'staging']))
  })

  it('auto-promote-union-eyes.yml has a runtime guard refusing to dispatch if environment ever resolves to production', () => {
    const run = combinedRunOf(autoPromoteDoc, 'fanout')
    expect(run).toMatch(/matrix\.environment\s*}}"\s*=\s*"production"/)
    expect(run).toMatch(/exit 1/)
  })

  it('deploy-union-eyes.yml only resolves DEPLOY_ENV=production from an explicit workflow_dispatch input, never from a bare push/ref-name fallback', () => {
    const run = combinedRunOf(deployDoc, 'plan')
    // The ONLY place the literal DEPLOY_ENV="production" may appear is
    // inside a workflow_dispatch-gated assignment sourced from the
    // operator-supplied `environment` input — never a ref-name/push-based
    // fallback. If a future edit reintroduces
    // `elif ... github.ref_name ... main ... DEPLOY_ENV="production"`,
    // this must fail.
    expect(run).not.toMatch(/ref_name[\s\S]{0,80}main[\s\S]{0,80}DEPLOY_ENV="production"/)
    expect(run).toMatch(/workflow_dispatch[\s\S]{0,120}DEPLOY_ENV="\$\{\{ github\.event\.inputs\.environment \}\}"/)
  })

  it('deploy-union-eyes.yml is not triggered by a push to main (production can only be reached via workflow_dispatch)', () => {
    const pushBranches = deployDoc.on.push?.branches ?? []
    expect(pushBranches).not.toContain('main')
  })

  it('the production GitHub Environment name is never referenced as a hardcoded default anywhere a push event could reach it', () => {
    // Belt-and-suspenders: assert the fallback branch of the DEPLOY_ENV
    // if/else resolves to "staging", not "production", for any
    // non-workflow_dispatch event.
    const run = combinedRunOf(deployDoc, 'plan')
    const match = run.match(/if \[ "\$\{\{ github\.event_name \}\}" = "workflow_dispatch" \][\s\S]*?\n\s*fi\n/)
    expect(match, 'expected to find the DEPLOY_ENV resolution if/else block').toBeTruthy()
    const block = match![0]
    expect(block).toMatch(/else[\s\S]*DEPLOY_ENV="staging"/)
  })
})

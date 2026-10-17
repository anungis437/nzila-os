/**
 * E6-C: affected typecheck must prove a non-empty closure or run the full
 * universe. Exit codes are not the contract. The plan is.
 *
 * @invariant AFFECTED_TYPECHECK_FAIL_CLOSED_001
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { planAffectedBuild, listWorkspacePackageDirs } from '../ci/affected-build-plan.mjs'
import {
  PLAN_VERSION,
  DOCTRINE,
  assessScm,
  buildWorkspaceTypecheckGraph,
  composeTypecheckPlan,
  expandTypecheckClosure,
  parseTurboTypecheckPackages,
  pathForcesFullTypecheck,
  unionAffectedPackages,
} from '../ci/affected-typecheck-plan.mjs'

const ROOT = join(__dirname, '..', '..')

const FIXTURE_DIRS = [
  'apps/cfo',
  'apps/civic',
  'apps/web',
  'packages/config',
  'packages/db',
  'packages/fx',
  'packages/webhooks',
  'tooling/openapi-gen',
]

function fixtureGraph() {
  return {
    ok: true as const,
    dirToName: new Map([
      ['packages/fx', '@nzila/fx'],
      ['apps/cfo', '@nzila/cfo'],
      ['packages/webhooks', '@nzila/webhooks'],
      ['apps/civic', '@nzila/civic'],
      ['packages/config', '@nzila/config'],
      ['apps/web', '@nzila/web'],
      ['packages/db', '@nzila/db'],
      ['tooling/openapi-gen', '@nzila/openapi-gen'],
    ]),
    dependents: new Map<string, Set<string>>([['@nzila/fx', new Set(['@nzila/cfo'])]]),
    hasTypecheck: new Set([
      '@nzila/fx',
      '@nzila/cfo',
      '@nzila/webhooks',
      '@nzila/web',
      '@nzila/db',
    ]),
    typecheckPackages: ['@nzila/cfo', '@nzila/db', '@nzila/fx', '@nzila/web', '@nzila/webhooks'],
  }
}

function plan(paths: string[], extras: Record<string, unknown> = {}) {
  const graph = fixtureGraph()
  return composeTypecheckPlan({
    baseSha: 'base',
    headSha: 'head',
    scm: { confident: true, kind: 'resolved', mode: null, diffBase: 'base' },
    paths,
    packageDirs: FIXTURE_DIRS,
    graph,
    ...extras,
  })
}

describe('affected typecheck plan contract', () => {
  it('names the doctrine and plan version', () => {
    expect(PLAN_VERSION).toBe('e6c-1')
    expect(DOCTRINE).toBe('PROVE_AFFECTED_OR_RUN_FULL')
    expect(plan(['packages/webhooks/src/types.ts']).DOCTRINE).toBe('PROVE_AFFECTED_OR_RUN_FULL')
    expect(plan(['packages/webhooks/src/types.ts']).PLAN_VERSION).toBe('e6c-1')
  })

  it('selects a leaf package and does not treat that as the full universe', () => {
    const result = plan(['packages/webhooks/src/types.ts'], {
      turboPackages: ['@nzila/webhooks'],
    })
    expect(result).toMatchObject({
      MODE: 'AFFECTED',
      BASE_SHA: 'base',
      HEAD_SHA: 'head',
      DIFF_BASE: 'base',
      TASK_COUNT: 1,
      FALLBACK_REASON: '',
      CLASSIFICATION: 'workspace-package-changes',
      SCM_CONFIDENT: true,
    })
    expect(result.AFFECTED_PACKAGES).toEqual(['@nzila/webhooks'])
    expect(result.CHANGED_PATHS).toEqual(['packages/webhooks/src/types.ts'])
    expect(result.FULL_UNIVERSE).toBe(5)
  })

  it('expands an fx export change to the untouched cfo dependent', () => {
    const closure = expandTypecheckClosure(['@nzila/fx'], fixtureGraph())
    expect(closure).toEqual(['@nzila/cfo', '@nzila/fx'])
    const result = plan(['packages/fx/src/index.ts'], {
      turboPackages: ['@nzila/fx', '@nzila/cfo'],
    })
    expect(result.MODE).toBe('AFFECTED')
    expect(result.AFFECTED_PACKAGES).toEqual(['@nzila/cfo', '@nzila/fx'])
    expect(result.TASK_COUNT).toBe(2)
  })

  it('refuses a turbo selection that drops the dependent', () => {
    const union = unionAffectedPackages(['@nzila/cfo', '@nzila/fx'], ['@nzila/fx'])
    expect(union.ok).toBe(false)
    expect(union.missing).toEqual(['@nzila/cfo'])
    const result = plan(['packages/fx/src/index.ts'], { turboPackages: ['@nzila/fx'] })
    expect(result.MODE).toBe('FULL')
    expect(result.FALLBACK_REASON).toBe('dependent-expansion-incomplete')
    expect(result.TRIGGERS).toEqual(['@nzila/cfo'])
    expect(result.MODE).not.toBe('AFFECTED')
    expect(result.MODE).not.toBe('NOT_APPLICABLE')
  })

  it('keeps turbo extras and still typechecks the closure', () => {
    const result = plan(['packages/webhooks/src/types.ts'], {
      turboPackages: ['@nzila/webhooks', '@nzila/db'],
    })
    expect(result.MODE).toBe('AFFECTED')
    expect(result.AFFECTED_PACKAGES).toEqual(['@nzila/db', '@nzila/webhooks'])
    expect(result.TASK_COUNT).toBe(2)
  })

  it('parses turbo dry-run tasks and ignores nonexistent scripts', () => {
    expect(
      parseTurboTypecheckPackages({
        tasks: [
          {
            taskId: '@nzila/fx#typecheck',
            task: 'typecheck',
            package: '@nzila/fx',
            command: 'tsc --noEmit',
          },
          {
            taskId: '@nzila/cfo#typecheck',
            task: 'typecheck',
            package: '@nzila/cfo',
            command: 'tsc --noEmit',
          },
          {
            taskId: '@nzila/civic#typecheck',
            task: 'typecheck',
            package: '@nzila/civic',
            command: '<NONEXISTENT>',
          },
          { taskId: '//#build', task: 'build', package: '//', command: 'turbo build' },
        ],
      }),
    ).toEqual(['@nzila/cfo', '@nzila/fx'])
  })

  it('sends a zero-task package to the full universe and never to not-applicable', () => {
    const result = plan(['apps/civic/probe.ts'])
    expect(result.MODE).toBe('FULL')
    expect(result.FALLBACK_REASON).toBe('zero-task-affected')
    expect(result.TASK_COUNT).toBe(result.FULL_UNIVERSE)
    expect(result.TASK_COUNT).toBeGreaterThan(0)
    expect(result.MODE).not.toBe('NOT_APPLICABLE')
    expect(result.MODE).not.toBe('AFFECTED')
  })

  it('does not promote an empty affected closure when turbo also returns nothing', () => {
    const result = plan(['apps/civic/probe.ts'], { turboPackages: [] })
    expect(result.MODE).toBe('FULL')
    expect(result.FALLBACK_REASON).toBe('zero-task-affected')
  })
})

describe('affected typecheck parity with the build fallback', () => {
  const fullPaths = [
    'pnpm-lock.yaml',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'yarn.lock',
    'bun.lock',
    'bun.lockb',
    'turbo.json',
    'turbo.jsonc',
    'pnpm-workspace.yaml',
    'package.json',
    '.npmrc',
    'apps/web/pnpm-lock.yaml',
    'something-unexpected.bin',
    '.github/workflows/ci.yml',
    'tooling/ci/affected-build-plan.mjs',
    'tooling/ci/affected-typecheck-plan.mjs',
    'scripts/release/validate-branch-tag-policy.ts',
    'infrastructure/bicep/main.bicep',
  ]

  it('forces FULL for every path the build planner already runs as a portfolio build', () => {
    for (const path of fullPaths) {
      const build = planAffectedBuild([path], FIXTURE_DIRS)
      const typecheck = plan([path])
      expect(build.mode, path).toBe('full')
      expect(typecheck.MODE, path).toBe('FULL')
      expect(typecheck.MODE, path).not.toBe('NOT_APPLICABLE')
      expect(typecheck.MODE, path).not.toBe('AFFECTED')
    }
  })

  it('treats an empty diff and an unknown path as FULL', () => {
    expect(plan([])).toMatchObject({ MODE: 'FULL', FALLBACK_REASON: 'empty-diff', TASK_COUNT: 5 })
    expect(plan(['../secrets.md'])).toMatchObject({ MODE: 'FULL', FALLBACK_REASON: 'unknown-path' })
  })

  it('leaves proven documentation NOT_APPLICABLE and does not run tasks', () => {
    const result = plan([
      'docs/engineering-convergence/ci-execution/CI_AUTHORITY_SURFACE.md',
      'README.md',
      'NOTICE.markdown',
    ])
    expect(result).toMatchObject({
      MODE: 'NOT_APPLICABLE',
      FALLBACK_REASON: 'proven-irrelevant',
      TASK_COUNT: 0,
      AFFECTED_PACKAGES: [],
      CLASSIFICATION: 'proven-irrelevant',
    })
  })

  it('forces FULL for shared compilation config inside a package', () => {
    expect(pathForcesFullTypecheck('packages/config/tsconfig.base.json')).toBe(true)
    expect(pathForcesFullTypecheck('packages/webhooks/tsconfig.json')).toBe(true)
    expect(pathForcesFullTypecheck('packages/webhooks/src/types.ts')).toBe(false)
    const build = planAffectedBuild(['packages/config/tsconfig.base.json'], FIXTURE_DIRS)
    expect(build.mode).toBe('affected')
    const result = plan(['packages/config/tsconfig.base.json'])
    expect(result.MODE).toBe('FULL')
    expect(result.FALLBACK_REASON).toBe('shared-compilation-config')
    expect(result.TRIGGERS).toEqual(['packages/config/tsconfig.base.json'])
  })
})

describe('affected typecheck SCM fail-closed', () => {
  const graph = fixtureGraph()

  function fromScm(scm: ReturnType<typeof assessScm>) {
    return composeTypecheckPlan({
      baseSha: 'base',
      headSha: 'head',
      scm,
      paths: ['packages/webhooks/src/types.ts'],
      packageDirs: FIXTURE_DIRS,
      graph,
      turboPackages: ['@nzila/webhooks'],
    })
  }

  it('refuses affected when the base is missing, zero, or has no merge-base', () => {
    expect(
      assessScm({
        base: '',
        head: 'head',
        baseExists: false,
        headExists: true,
        ancestor: false,
        headInCheckout: true,
      }),
    ).toMatchObject({ confident: false, kind: 'unresolved-scm', mode: 'FULL' })
    expect(
      assessScm({
        base: '0'.repeat(40),
        head: 'head',
        baseExists: false,
        headExists: true,
        ancestor: false,
        headInCheckout: true,
      }),
    ).toMatchObject({ kind: 'unresolved-scm', mode: 'FULL' })
    expect(
      assessScm({
        base: 'base',
        head: 'head',
        baseExists: false,
        headExists: true,
        checkoutSha: 'head',
        ancestor: false,
        headInCheckout: true,
      }),
    ).toMatchObject({ kind: 'missing-base', mode: 'FULL' })
    expect(
      assessScm({
        base: 'base',
        head: 'head',
        baseExists: true,
        headExists: true,
        checkoutSha: 'head',
        ancestor: false,
        mergeBase: '',
        headInCheckout: true,
      }),
    ).toMatchObject({ kind: 'force-update', mode: 'FULL' })

    for (const kind of ['unresolved-scm', 'missing-base', 'force-update']) {
      const result = fromScm({ confident: false, kind, mode: 'FULL', diffBase: '' })
      expect(result.MODE, kind).toBe('FULL')
      expect(result.FALLBACK_REASON, kind).toBe(kind)
      expect(result.MODE, kind).not.toBe('AFFECTED')
      expect(result.MODE, kind).not.toBe('NOT_APPLICABLE')
    }
  })

  it('uses the merge-base when the branch diverged but history is still readable', () => {
    expect(
      assessScm({
        base: 'main-tip',
        head: 'pr-head',
        baseExists: true,
        headExists: true,
        checkoutSha: 'merge',
        ancestor: false,
        mergeBase: 'shared',
        headInCheckout: true,
      }),
    ).toEqual({ confident: true, kind: 'merge-base', mode: null, diffBase: 'shared' })
  })

  it('errors when the checkout does not contain the planned head', () => {
    const scm = assessScm({
      base: 'base',
      head: 'head',
      baseExists: true,
      headExists: true,
      checkoutSha: 'other',
      ancestor: true,
      headInCheckout: false,
    })
    expect(scm).toMatchObject({ confident: false, kind: 'checkout-head-mismatch', mode: 'ERROR' })
    const result = fromScm(scm)
    expect(result.MODE).toBe('ERROR')
    expect(result.FALLBACK_REASON).toBe('checkout-head-mismatch')
    expect(result.TASK_COUNT).toBe(0)
    expect(result.AFFECTED_PACKAGES).toEqual([])
  })

  it('accepts a pull-request merge checkout that contains the head', () => {
    const scm = assessScm({
      base: 'base',
      head: 'head',
      baseExists: true,
      headExists: true,
      checkoutSha: 'merge-commit',
      ancestor: true,
      headInCheckout: true,
    })
    expect(scm.kind).toBe('resolved')
    expect(fromScm(scm).MODE).toBe('AFFECTED')
  })

  it('fails a turbo query instead of trusting an affected pass', () => {
    const result = plan(['packages/webhooks/src/types.ts'], { turboQueryFailed: true })
    expect(result.MODE).toBe('FULL')
    expect(result.FALLBACK_REASON).toBe('turbo-query-failed')
  })
})

describe('real workspace typecheck closure', () => {
  const dirs = listWorkspacePackageDirs(ROOT)
  const graph = buildWorkspaceTypecheckGraph(ROOT, dirs)

  it('counts the executable typecheck universe', () => {
    expect(graph.ok).toBe(true)
    if (!graph.ok) return
    expect(graph.typecheckPackages).toHaveLength(232)
    expect(graph.typecheckPackages).toContain('@nzila/fx')
    expect(graph.typecheckPackages).toContain('@nzila/cfo')
    expect(graph.typecheckPackages).toContain('@nzila/webhooks')
    expect(graph.hasTypecheck.has('@nzila/civic')).toBe(true)
  })

  it('proves the fx to cfo dependent and the webhooks leaf on the real graph', () => {
    if (!graph.ok) throw new Error('graph')
    const resolved = {
      confident: true,
      kind: 'resolved',
      mode: null,
      diffBase: 'base',
    }
    const fx = composeTypecheckPlan({
      baseSha: 'base',
      headSha: 'head',
      scm: resolved,
      paths: ['packages/fx/src/index.ts'],
      packageDirs: dirs,
      graph,
      turboPackages: ['@nzila/cfo', '@nzila/fx'],
    })
    expect(fx.MODE).toBe('AFFECTED')
    expect(fx.AFFECTED_PACKAGES).toEqual(['@nzila/cfo', '@nzila/fx'])

    const leaf = composeTypecheckPlan({
      baseSha: 'base',
      headSha: 'head',
      scm: resolved,
      paths: ['packages/webhooks/src/types.ts'],
      packageDirs: dirs,
      graph,
      turboPackages: ['@nzila/webhooks'],
    })
    expect(leaf.MODE).toBe('AFFECTED')
    expect(leaf.AFFECTED_PACKAGES).toEqual(['@nzila/webhooks'])
    expect(leaf.TASK_COUNT).toBeLessThan(graph.typecheckPackages.length)

    const civic = composeTypecheckPlan({
      baseSha: 'base',
      headSha: 'head',
      scm: resolved,
      paths: ['apps/civic/probe.ts'],
      packageDirs: dirs,
      graph,
    })
    expect(civic.MODE).toBe('AFFECTED')
    expect(civic.FALLBACK_REASON).toBe('')
    expect(civic.AFFECTED_PACKAGES).toEqual(['@nzila/civic'])
    expect(civic.TASK_COUNT).toBe(1)
  })
})

describe('CI Lint & Typecheck invokes the fail-closed planner', () => {
  const ci = parse(readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')) as {
    on: { pull_request: { branches: string[] }; push: { branches: string[] } }
    jobs: Record<
      string,
      {
        name?: string
        needs?: string[]
        if?: string
        'continue-on-error'?: boolean
        steps?: Array<{ name?: string; run?: string; with?: { 'fetch-depth'?: number } }>
      }
    >
  }
  const script = readFileSync(join(ROOT, 'tooling', 'ci', 'run-affected-typecheck.sh'), 'utf8')

  it('keeps the required job name and runs lint unchanged', () => {
    const job = ci.jobs['lint-and-typecheck']
    expect(job.name).toBe('Lint & Typecheck')
    expect(job['continue-on-error']).not.toBe(true)
    expect(ci.on.pull_request.branches).toEqual(['main'])
    expect(ci.on.push.branches).toEqual(['main'])
    expect(job.needs).toEqual(['classify', 'lint', 'typecheck'])
    expect(job.if).toContain('always()')
    expect(job.if).toContain("needs.classify.outputs.lint_and_typecheck == 'APPLICABLE'")
    const gate = job.steps?.find((step) => step.name === 'Require both checks')
    expect(gate?.run).toContain('test "$LINT_RESULT" = success')
    expect(gate?.run).toContain('test "$TYPECHECK_RESULT" = success')
    expect(gate?.run).not.toMatch(/\|\|\s*true/)
    const lintJob = ci.jobs.lint
    const typecheckJob = ci.jobs.typecheck
    expect(lintJob.needs).toEqual(['classify'])
    expect(typecheckJob.needs).toEqual(['classify'])
    expect(lintJob['continue-on-error']).not.toBe(true)
    expect(typecheckJob['continue-on-error']).not.toBe(true)
    const checkout = lintJob.steps?.find((step) => step.with && 'fetch-depth' in (step.with ?? {}))
    expect(checkout?.with?.['fetch-depth']).toBe(0)
    const lint = lintJob.steps?.find((step) => step.name === 'Lint')
    expect(lint?.run).toBe('pnpm lint')
  })

  it('runs the planner and refuses a zero-task or unknown mode', () => {
    const job = ci.jobs.typecheck
    const step = job.steps?.find((candidate) =>
      candidate.run?.includes('run-affected-typecheck.sh'),
    )
    expect(step?.name).toBe('Typecheck affected packages or full universe')
    expect(step?.run).toContain('bash tooling/ci/run-affected-typecheck.sh')
    const envText = JSON.stringify(step)
    expect(envText).toContain('github.event.pull_request.base.sha')
    expect(envText).toContain('github.event.pull_request.head.sha')

    expect(script).toContain('affected-typecheck-plan.mjs')
    expect(script).toContain('--verify-turbo')
    expect(script).toContain('pnpm typecheck')
    expect(script).toContain('TURBO_SCM_BASE="${DIFF_BASE:-$BASE}" TURBO_SCM_HEAD="$HEAD"')
    expect(script).toContain('pnpm exec turbo run typecheck')
    expect(script).toContain('NOT_APPLICABLE')
    expect(script).toContain('exit 1')
    expect(script).toContain('zero-task refused; running full typecheck')
    expect(script).not.toMatch(/\|\|\s*true/)

    const fullBranch = script.slice(script.indexOf('FULL)'), script.indexOf('AFFECTED)'))
    expect(fullBranch).toContain('pnpm typecheck')
    expect(fullBranch).not.toContain('--affected')
    expect(fullBranch).not.toContain('--filter')

    const affectedBranch = script.slice(
      script.indexOf('AFFECTED)'),
      script.indexOf('NOT_APPLICABLE)'),
    )
    expect(affectedBranch).toContain('--filter=')
    expect(affectedBranch).toContain('pnpm exec turbo run typecheck')
    expect(affectedBranch).not.toContain('--affected')
  })
})

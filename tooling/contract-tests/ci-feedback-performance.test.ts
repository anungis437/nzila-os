import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { partitionTypecheckPlan } from '../ci/run-typecheck-shard.mjs'
import { listWorkspacePackageDirs } from '../ci/affected-build-plan.mjs'
import { buildWorkspaceTypecheckGraph } from '../ci/affected-typecheck-plan.mjs'
import { scopedBuildPlan, selectBuildScope } from '../ci/run-scoped-build-shard.mjs'

const ROOT = join(__dirname, '..', '..')
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')

describe('CI feedback caching', () => {
  const turbo = JSON.parse(read('turbo.json'))
  const setup = parse(read('.github/actions/setup-monorepo/action.yml'))

  it('keeps preview builds in the active scope without duplicating canonical quality checks', () => {
    const preview = parse(read('.github/workflows/preview-deploy.yml'))
    const steps = preview.jobs.preview.steps
    const commands = steps.map((step: { run?: string }) => step.run ?? '').join('\n')
    expect(commands).toContain('node tooling/ci/run-scoped-build-shard.mjs 1 1')
    expect(commands).not.toMatch(/pnpm (?:lint|typecheck|test|build)\b/)
    const setupStep = steps.find(
      (step: { uses?: string }) => step.uses === './.github/actions/setup-monorepo',
    )
    expect(setupStep.with['turbo-cache-key']).toBe('preview-build')
    const ci = parse(read('.github/workflows/ci.yml'))
    expect(ci.jobs.lint.steps.some((step: { run?: string }) => step.run === 'pnpm lint')).toBe(true)
    expect(ci.jobs.typecheck).toBeDefined()
    expect(ci.jobs.test).toBeDefined()
  })

  it('persists the directory Turbo actually writes, scoped by runtime and lockfile', () => {
    const cache = setup.runs.steps.find(
      (step: { name?: string }) => step.name === 'Restore turbo cache',
    )
    expect(cache.with.path).toBe(turbo.cacheDir)
    expect(cache.with.key).toContain('inputs.node-version')
    expect(cache.with.key).toContain("hashFiles('pnpm-lock.yaml')")
    expect(cache.with['restore-keys'].trim().split('\n')).toHaveLength(1)
    expect(cache.with['restore-keys']).toContain("hashFiles('pnpm-lock.yaml')")
    expect(cache.env.SEGMENT_DOWNLOAD_TIMEOUT_MINS).toBe('1')
    const nodeSetup = setup.runs.steps.find(
      (step: { uses?: string }) => step.uses === 'actions/setup-node@v6',
    )
    expect(nodeSetup.env.SEGMENT_DOWNLOAD_TIMEOUT_MINS).toBe('1')
  })

  it('hashes all tracked package inputs, including actions, database and CLI sources', () => {
    for (const task of ['build', 'lint', 'typecheck']) {
      expect(turbo.tasks[task].inputs).toContain('$TURBO_DEFAULT$')
      expect(turbo.tasks[task].dependsOn).toContain('^build')
    }
    // UE CLI sources also read evidence JSON outside their workspace package.
    expect(turbo.tasks.typecheck.inputs).toContain('$TURBO_ROOT$/docs/**/*.json')
  })
})

describe('parallel lint/typecheck merge authority', () => {
  const ci = parse(read('.github/workflows/ci.yml'))
  const gate = ci.jobs['lint-and-typecheck'].steps.find(
    (step: { name?: string }) => step.name === 'Require both checks',
  )
  const bash =
    process.platform === 'win32'
      ? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe')
      : 'bash'
  const outcomes = ['success', 'failure', 'cancelled', 'skipped']

  it('requires all four shards through the matrix job result', () => {
    expect(ci.jobs.typecheck.strategy.matrix.shard).toEqual([1, 2, 3, 4])
    expect(ci.jobs.typecheck.strategy['fail-fast']).toBe(false)
    const step = ci.jobs.typecheck.steps.find((candidate: { run?: string }) =>
      candidate.run?.includes('run-affected-typecheck.sh'),
    )
    expect(step.env.TYPECHECK_SHARD_INDEX).toBe('${{ matrix.shard }}')
    expect(step.env.TYPECHECK_SHARD_TOTAL).toBe('4')
    expect(ci.jobs['lint-and-typecheck'].needs).toContain('typecheck')
    expect(ci.jobs['build-worker'].needs).toEqual(['classify'])
    expect(ci.jobs['build-worker'].if).toBe("needs.classify.outputs.build == 'APPLICABLE'")
    expect(ci.jobs.build.needs).toEqual(['classify', 'build-worker'])
    expect(ci.jobs.build.name).toBe('Build All')
    expect(ci.jobs['build-worker'].strategy.matrix.shard).toEqual([1, 2, 3, 4])
    expect(ci.jobs.build.steps[0].run).toBe('test "$BUILD_RESULT" = success')
  })

  it.each(outcomes.flatMap((lint) => outcomes.map((typecheck) => [lint, typecheck])))(
    'lint=%s, typecheck=%s: only two successes pass',
    (lint, typecheck) => {
      const result = spawnSync(bash, ['-e', '-c', gate.run], {
        cwd: ROOT,
        env: { ...process.env, LINT_RESULT: lint, TYPECHECK_RESULT: typecheck },
        encoding: 'utf8',
      })
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(lint === 'success' && typecheck === 'success' ? 0 : 1)
    },
  )
})

describe('parallel unit coverage authority', () => {
  const ci = parse(read('.github/workflows/ci.yml'))
  const worker = ci.jobs['test-workers']
  const gate = ci.jobs.test
  const coverage = worker.steps.find((step: { name?: string }) => step.name === 'Run tests with coverage')
  const bash = process.platform === 'win32'
    ? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe')
    : 'bash'

  it('starts both complete coverage lanes after classification with isolated migrated databases', () => {
    expect(worker.needs).toEqual(['classify'])
    expect(worker.if).toBe("needs.classify.outputs.test == 'APPLICABLE'")
    expect(worker.strategy['fail-fast']).toBe(false)
    expect(worker.strategy.matrix.lane).toEqual(['shared', 'union-eyes'])
    expect(worker.services.postgres.image).toBe('postgres:16')
    expect(worker.steps.find((step: { name?: string }) => step.name === 'Run migrations').run)
      .toBe('pnpm --filter @nzila/db db:migrate')
    expect(worker.steps.find((step: { name?: string }) => step.name === 'Run transferred orphan merge-correctness tests').if)
      .toBe("matrix.lane == 'shared'")
    expect(gate.name).toBe('Unit Tests')
    expect(gate.needs).toEqual(['classify', 'test-workers'])
    expect(gate.if).toBe("always() && needs.classify.outputs.test == 'APPLICABLE'")
    expect(ci.jobs['reconcile-frozen-head'].needs).toContain('test-workers')
    const upload = worker.steps.find((step: { name?: string }) => step.name === 'Upload coverage reports')
    expect(upload.with.name).toContain('${{ matrix.lane }}')
  })

  it.each(['shared', 'union-eyes', 'unknown'])('executes only the exact %s lane and rejects unknown lanes', (lane) => {
    const result = spawnSync(bash, ['-e', '-c', 'pnpm() { printf "%s\\n" "$*"; }; export -f pnpm;\n' + coverage.run], {
      cwd: ROOT, env: { ...process.env, UNIT_LANE: lane }, encoding: 'utf8',
    })
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(lane === 'unknown' ? 1 : 0)
    if (lane !== 'unknown') {
      expect(result.stdout.trim()).toBe(`test:coverage --force --filter=${lane === 'shared' ? '!' : ''}@nzila/union-eyes`)
    }
  })

  it.each(['success', 'failure', 'cancelled', 'skipped'])('requires successful coverage workers: %s', (outcome) => {
    const result = spawnSync(bash, ['-e', '-c', gate.steps[0].run], {
      cwd: ROOT, env: { ...process.env, UNIT_RESULT: outcome }, encoding: 'utf8',
    })
    expect(result.status).toBe(outcome === 'success' ? 0 : 1)
  })

  it('propagates coverage command failures', () => {
    const result = spawnSync(bash, ['-e', '-c', 'pnpm() { return 7; }; export -f pnpm;\n' + coverage.run], {
      cwd: ROOT, env: { ...process.env, UNIT_LANE: 'union-eyes' }, encoding: 'utf8',
    })
    expect(result.status).toBe(7)
  })
})

describe('owner-declared routine build scope', () => {
  it('retains the seven chosen apps and partitions the entire selected build universe', () => {
    const plan = scopedBuildPlan(ROOT)
    expect(plan.ACTIVE_APPS).toEqual([
      'union-eyes',
      'cora',
      'civic',
      'web',
      'console',
      'control-plane',
      'orchestrator-api',
    ])
    expect(plan.AFFECTED_PACKAGES).toContain('@nzila/union-eyes')
    expect(plan.AFFECTED_PACKAGES).toContain('@nzila/web')
    expect(plan.AFFECTED_PACKAGES).not.toContain('@nzila/zonga')
    expect(plan.EXCLUDED_APP_PACKAGES).toContain('@nzila/zonga')
    expect(plan.EXCLUDED_APP_PACKAGES).toContain('@nzila/platform-admin')
    const all = [1, 2, 3, 4].flatMap(
      (index) => partitionTypecheckPlan(plan, index, 4).ASSIGNED_PACKAGES,
    )
    expect(all.length).toBe(plan.TASK_COUNT)
    expect(new Set(all).size).toBe(plan.TASK_COUNT)
    expect(all.sort()).toEqual(plan.AFFECTED_PACKAGES)
    const e2e = parse(read('.github/workflows/e2e.yml'))
    const e2eApps = [
      ...new Set<string>(
        e2e.jobs.e2e.strategy.matrix.include.map((entry: { app: string }) => entry.app),
      ),
    ]
    expect(e2eApps).toEqual(['web', 'console', 'union-eyes', 'control-plane'])
    expect(e2eApps.every((app: string) => plan.ACTIVE_APPS.includes(app))).toBe(true)
  })

  const entries = [
    { dir: 'apps/live', manifest: { name: '@test/live', scripts: { build: 'next build' } } },
    { dir: 'apps/dormant', manifest: { name: '@test/dormant', scripts: { build: 'next build' } } },
    { dir: 'packages/core', manifest: { name: '@test/core', scripts: { build: 'tsc' } } },
  ]
  const catalog = ['live', 'dormant']

  it('keeps shared builds while excluding dormant application roots', () => {
    expect(selectBuildScope(entries, ['live'], catalog)).toEqual({
      selected: ['@test/core', '@test/live'],
      excluded: ['@test/dormant'],
    })
  })

  it('refuses empty/unknown/duplicate scope and unclassified app workspaces', () => {
    for (const active of [[], ['unknown'], ['live', 'live']]) {
      expect(() => selectBuildScope(entries, active, catalog)).toThrow()
    }
    expect(() => selectBuildScope(entries.slice(1), ['live'], catalog)).toThrow(
      'workspace is missing',
    )
    expect(() => selectBuildScope(entries, ['live'], ['live'])).toThrow('Unclassified app')
    expect(() =>
      selectBuildScope(
        [
          ...entries.slice(1),
          {
            dir: 'apps/live/services/worker',
            manifest: { name: '@test/worker', scripts: { build: 'tsc' } },
          },
        ],
        ['live'],
        catalog,
      ),
    ).toThrow('workspace is missing')
  })
})

describe('Union Eyes E2E shard authority', () => {
  const workflow = parse(read('.github/workflows/e2e.yml'))
  const worker = workflow.jobs.e2e
  const gate = workflow.jobs['union-eyes-result']
  const code = gate.steps[0].run.match(/node --input-type=module <<'NODE'\n([\s\S]*?)\nNODE/)[1]
  const head = 'a'.repeat(40)
  const jobs = [1, 2, 3, 4].map((index) => ({
    id: index,
    name: `UE E2E worker (${index}/4)`,
    run_id: 123,
    run_attempt: 2,
    head_sha: head,
    status: 'completed',
    conclusion: 'success',
  }))

  it('runs all four shards in separate runner-local databases with one browser worker', () => {
    const entries = worker.strategy.matrix.include.filter(
      (entry: { app: string }) => entry.app === 'union-eyes',
    )
    expect(entries.map((entry: { shard: number }) => entry.shard)).toEqual([1, 2, 3, 4])
    expect(entries.every((entry: { shards: number }) => entry.shards === 4)).toBe(true)
    expect(worker.strategy['fail-fast']).toBe(false)
    const bootstrap = worker.steps.find((step: { name?: string }) =>
      step.name?.startsWith('Bootstrap Union Eyes'),
    )
    expect(bootstrap.env.DATABASE_URL).toBe('postgresql://ci:ci@localhost:5432/ci_e2e')
    expect(bootstrap.run).toContain('docker run --name ci-e2e-postgres')
    expect(read('apps/union-eyes/playwright.config.ts')).toContain('workers: 1')
    expect(read('apps/union-eyes/playwright.config.ts')).toContain('fullyParallel: false')
    const command = worker.steps.find(
      (step: { name?: string }) => step.name === 'Run Playwright tests',
    ).run
    expect(command).toContain('--shard=${{ matrix.shard }}/${{ matrix.shards }}')
    expect(command).not.toContain('--no-deps')
    expect(command).not.toContain('--grep')
    expect(gate.name).toBe('E2E · union-eyes')
    expect(gate.needs).toEqual(['e2e', 'e2e-canonical'])
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(worker.environment).toBeUndefined()
    expect(worker.if).toBe("matrix.app != 'union-eyes' || github.event_name == 'pull_request'")
    expect(JSON.stringify(worker)).not.toContain('secrets.')
    const canonical = workflow.jobs['e2e-canonical']
    expect(canonical.environment).toBe('staging')
    expect(canonical.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/main'")
    expect(canonical.permissions).toEqual({ contents: 'read', 'id-token': 'write' })
    expect(canonical.steps.some((step: { uses?: string }) => step.uses === 'azure/login@v3')).toBe(true)
    expect(gate.if).toBe('always()')
    expect(gate.permissions).toEqual({ contents: 'read', actions: 'read' })
    expect(gate.steps[0].run).toContain('/attempts/${EXPECTED_ATTEMPT}/jobs')
    for (const step of worker.steps.filter(
      (step: { uses?: string }) => step.uses === 'actions/upload-artifact@v4',
    )) {
      expect(step.with.name).toContain('matrix.shard')
      expect(step.with.overwrite).toBe(true)
    }
  })

  const cases = [
    {
      name: 'all UE workers pass despite an unrelated app failure',
      jobs: [...jobs, { name: 'E2E · web', conclusion: 'failure' }],
      pass: true,
    },
    {
      name: 'skipped companion workers from the other qualification mode',
      jobs: [
        ...jobs,
        ...jobs.map((job) => ({ ...job, id: job.id + 10, conclusion: 'skipped', status: 'completed' })),
      ],
      pass: true,
    },
    { name: 'missing worker', jobs: jobs.slice(1), pass: false },
    { name: 'duplicate worker identity', jobs: [jobs[0], jobs[0], ...jobs.slice(2)], pass: false },
    {
      name: 'unexpected fifth worker',
      jobs: [...jobs, { ...jobs[0], id: 5, name: 'UE E2E worker (5/4)' }],
      pass: false,
    },
    ...['failure', 'cancelled', 'skipped', 'timed_out', 'neutral', null].map((conclusion) => ({
      name: `worker conclusion ${conclusion}`,
      jobs: [{ ...jobs[0], conclusion }, ...jobs.slice(1)],
      pass: false,
    })),
    {
      name: 'foreign head',
      jobs: [{ ...jobs[0], head_sha: 'b'.repeat(40) }, ...jobs.slice(1)],
      pass: false,
    },
    {
      name: 'earlier attempt',
      jobs: [{ ...jobs[0], run_attempt: 1 }, ...jobs.slice(1)],
      pass: false,
    },
    { name: 'foreign run', jobs: [{ ...jobs[0], run_id: 122 }, ...jobs.slice(1)], pass: false },
    {
      name: 'unfinished worker',
      jobs: [{ ...jobs[0], status: 'in_progress' }, ...jobs.slice(1)],
      pass: false,
    },
  ]

  it.each(cases)('executes the real aggregate validator: $name', ({ jobs: scenario, pass }) => {
    const directory = mkdtempSync(join(tmpdir(), 'nzila-ue-e2e-gate-'))
    try {
      const file = join(directory, 'jobs.json')
      const receipt = join(directory, 'receipt.json')
      writeFileSync(
        file,
        JSON.stringify([{ jobs: scenario.slice(0, 2) }, { jobs: scenario.slice(2) }]),
      )
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
        encoding: 'utf8',
        env: {
          ...process.env,
          EXPECTED_HEAD: head,
          EXPECTED_RUN: '123',
          EXPECTED_ATTEMPT: '2',
          SHARD_JOBS_FILE: file,
          SHARD_RECEIPT_FILE: receipt,
        },
      })
      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(pass ? 0 : 1)
      if (pass) expect(JSON.parse(readFileSync(receipt, 'utf8')).workers).toHaveLength(4)
    } finally {
      for (const name of ['jobs.json', 'receipt.json'])
        rmSync(join(directory, name), { force: true })
      rmdirSync(directory)
    }
  })
})

describe('typecheck shard coverage', () => {
  const packages = ['@test/a', '@test/b', '@test/c', '@test/d', '@test/e']
  const plan = { MODE: 'FULL', AFFECTED_PACKAGES: packages, TASK_COUNT: 5, FULL_UNIVERSE: 5 }

  it('covers the actual full repository universe exactly once', () => {
    const graph = buildWorkspaceTypecheckGraph(ROOT, listWorkspacePackageDirs(ROOT))
    expect(graph.ok).toBe(true)
    if (!graph.ok) throw new Error(graph.reason)
    const universe = graph.typecheckPackages
    const full = {
      MODE: 'FULL',
      AFFECTED_PACKAGES: universe,
      TASK_COUNT: universe.length,
      FULL_UNIVERSE: universe.length,
    }
    const assigned = [1, 2, 3, 4].flatMap(
      (index) => partitionTypecheckPlan(full, index, 4).ASSIGNED_PACKAGES,
    )
    expect(assigned.length).toBe(universe.length)
    expect(new Set(assigned).size).toBe(universe.length)
    expect(assigned.sort()).toEqual([...universe].sort())
  })

  it('also preserves the affected closure and deterministic partition ordering', () => {
    const affected = { ...plan, MODE: 'AFFECTED', AFFECTED_PACKAGES: [...packages].reverse() }
    const shards = [1, 2, 3, 4].map((index) => partitionTypecheckPlan(affected, index, 4))
    expect(shards.flatMap((shard) => shard.ASSIGNED_PACKAGES).sort()).toEqual(packages)
    expect(shards[0].ASSIGNED_PACKAGES).toEqual(['@test/a', '@test/e'])
    for (const index of [1, 2, 3, 4]) {
      const singleton = { MODE: 'AFFECTED', AFFECTED_PACKAGES: ['@test/e'], TASK_COUNT: 1 }
      expect(partitionTypecheckPlan(singleton, index, 4).ASSIGNED_PACKAGES).toEqual(
        shards[index - 1].ASSIGNED_PACKAGES.filter((name: string) => name === '@test/e'),
      )
    }
  })

  it('allows a small closure to leave a shard empty, but never an empty executable plan', () => {
    expect(
      partitionTypecheckPlan({ MODE: 'AFFECTED', AFFECTED_PACKAGES: ['a'], TASK_COUNT: 1 }, 4, 4)
        .ASSIGNED_PACKAGES,
    ).toEqual([])
    expect(() =>
      partitionTypecheckPlan({ MODE: 'AFFECTED', AFFECTED_PACKAGES: [], TASK_COUNT: 0 }, 1, 4),
    ).toThrow('empty or incomplete')
  })

  it.each([
    [0, 4],
    [5, 4],
    [1, 0],
    [1, 17],
    [1.5, 4],
    [1, Number.NaN],
  ])('rejects invalid shard coordinates %s/%s', (index, total) => {
    expect(() => partitionTypecheckPlan(plan, index, total)).toThrow('coordinates')
  })

  it('rejects unknown, truncated, duplicate and wildcard package plans', () => {
    for (const invalid of [
      { ...plan, MODE: 'ERROR' },
      { ...plan, FULL_UNIVERSE: 6 },
      { ...plan, TASK_COUNT: 6 },
      { ...plan, AFFECTED_PACKAGES: ['a', 'a'], TASK_COUNT: 2, FULL_UNIVERSE: 2 },
      { ...plan, AFFECTED_PACKAGES: ['*'], TASK_COUNT: 1, FULL_UNIVERSE: 1 },
      { MODE: 'NOT_APPLICABLE', AFFECTED_PACKAGES: [], TASK_COUNT: 0 },
    ])
      expect(() => partitionTypecheckPlan(invalid, 1, 4)).toThrow()
  })
})

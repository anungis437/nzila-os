import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  classifyChangedFiles,
  getChangedFiles,
  isApprovedRunbookUpdate,
  isMigrationFile,
  resolveRange,
  runWithTransientRetry,
  UnresolvableRangeError,
} from '../../scripts/release/migration-safety-policy'

const root = resolve(import.meta.dirname, '../..')
const deployStagingPath = resolve(root, '.github/workflows/deploy-staging.yml')
const deployStagingWorkflow = load(readFileSync(deployStagingPath, 'utf8')) as any

const NESTED_DJANGO_MIGRATION =
  'apps/union-eyes/backend/core/migrations/0003_automation_rules_organization_id.py'
const CANONICAL_P4_RUNBOOK = 'docs/union-eyes/P4_AUTHORITY_ROLLOUT_REMEDIATION.md'

describe('migration safety classifier: isMigrationFile', () => {
  it('recognizes nested Django migration modules', () => {
    expect(isMigrationFile(NESTED_DJANGO_MIGRATION)).toBe(true)
  })

  it('does not treat a bare migrations/__init__.py as a migration trigger', () => {
    expect(isMigrationFile('apps/example/migrations/__init__.py')).toBe(false)
  })

  it('preserves existing SQL, root migrations/, and /migrate- conventions', () => {
    expect(isMigrationFile('apps/union-eyes/db/migrations/0006_flat_stepford_cuckoos.sql')).toBe(true)
    expect(isMigrationFile('migrations/0001_init.sql')).toBe(true)
    expect(isMigrationFile('scripts/db/migrate-foo.ts')).toBe(true)
  })

  it('does not classify ordinary source files as migrations', () => {
    expect(isMigrationFile('apps/union-eyes/lib/logger.ts')).toBe(false)
  })
})

describe('migration safety classifier: isApprovedRunbookUpdate', () => {
  it('accepts the exact canonical P4 runbook path only', () => {
    expect(isApprovedRunbookUpdate(CANONICAL_P4_RUNBOOK)).toBe(true)
  })

  it('rejects an unrelated Union Eyes document (policy is not broadened to docs/union-eyes/**)', () => {
    expect(isApprovedRunbookUpdate('docs/union-eyes/random-note.md')).toBe(false)
  })

  it('preserves existing approved operational-document paths', () => {
    expect(isApprovedRunbookUpdate('docs/ops/ENVIRONMENT_OPERATIONS.md')).toBe(true)
    expect(isApprovedRunbookUpdate('ops/runbooks/incident-42.md')).toBe(true)
    expect(isApprovedRunbookUpdate('docs/ops/release-governance/plan.md')).toBe(true)
  })
})

describe('migration safety end-to-end classification', () => {
  it('1: nested Django migration + exact P4 runbook => PASS', () => {
    const { migrationFiles, hasRunbookUpdate } = classifyChangedFiles([
      NESTED_DJANGO_MIGRATION,
      CANONICAL_P4_RUNBOOK,
    ])
    expect(migrationFiles.length).toBeGreaterThan(0)
    expect(hasRunbookUpdate).toBe(true)
  })

  it('2: nested Django migration with no runbook => FAIL', () => {
    const { migrationFiles, hasRunbookUpdate } = classifyChangedFiles([NESTED_DJANGO_MIGRATION])
    expect(migrationFiles.length).toBeGreaterThan(0)
    expect(hasRunbookUpdate).toBe(false)
  })

  it('3: nested Django migration + unrelated Union Eyes doc => FAIL', () => {
    const { migrationFiles, hasRunbookUpdate } = classifyChangedFiles([
      NESTED_DJANGO_MIGRATION,
      'docs/union-eyes/random-note.md',
    ])
    expect(migrationFiles.length).toBeGreaterThan(0)
    expect(hasRunbookUpdate).toBe(false)
  })

  it('4: nested Django migration + existing approved ops runbook => PASS', () => {
    const { migrationFiles, hasRunbookUpdate } = classifyChangedFiles([
      NESTED_DJANGO_MIGRATION,
      'ops/runbooks/union-eyes-p4.md',
    ])
    expect(migrationFiles.length).toBeGreaterThan(0)
    expect(hasRunbookUpdate).toBe(true)
  })

  it('5: SQL migration + approved runbook => PASS', () => {
    const { migrationFiles, hasRunbookUpdate } = classifyChangedFiles([
      'apps/union-eyes/db/migrations/0006_flat_stepford_cuckoos.sql',
      'docs/ops/ENVIRONMENT_OPERATIONS.md',
    ])
    expect(migrationFiles.length).toBeGreaterThan(0)
    expect(hasRunbookUpdate).toBe(true)
  })

  it('6: migrations/__init__.py alone does not trigger a migration', () => {
    const { migrationFiles } = classifyChangedFiles(['apps/example/migrations/__init__.py'])
    expect(migrationFiles).toEqual([])
  })

  it('7: ordinary non-migration source change without runbook => PASS (no trigger)', () => {
    const { migrationFiles } = classifyChangedFiles(['apps/union-eyes/lib/logger.ts'])
    expect(migrationFiles).toEqual([])
  })
})

describe('migration safety range resolution', () => {
  it('resolves an explicit push-event range from GITHUB_EVENT_BEFORE/GITHUB_SHA', () => {
    const range = resolveRange(['node', 'script'], {
      GITHUB_EVENT_BEFORE: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      GITHUB_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    } as unknown as NodeJS.ProcessEnv)
    expect(range).toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    )
  })

  it('handles the all-zero before SHA explicitly instead of diffing against a synthetic object', () => {
    const range = resolveRange(['node', 'script'], {
      GITHUB_EVENT_BEFORE: '0000000000000000000000000000000000000000',
      GITHUB_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    } as unknown as NodeJS.ProcessEnv)
    expect(range).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
  })

  it('8: an unresolvable supplied range fails closed instead of returning no changes', () => {
    expect(() =>
      getChangedFiles(
        '0000000000000000000000000000000000000000..deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      ),
    ).toThrow(UnresolvableRangeError)
  })
})

describe('11: transient OS-level spawn failures retry instead of failing closed immediately', () => {
  function transientError(code: string): NodeJS.ErrnoException {
    const error = new Error(`spawnSync /bin/sh ${code}`) as NodeJS.ErrnoException
    error.code = code
    return error
  }

  it('retries on ENOBUFS and succeeds once the transient condition clears', () => {
    let calls = 0
    const result = runWithTransientRetry(() => {
      calls += 1
      if (calls < 3) throw transientError('ENOBUFS')
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })

  it('does not retry a non-transient error', () => {
    let calls = 0
    expect(() =>
      runWithTransientRetry(() => {
        calls += 1
        throw new Error('fatal: bad revision')
      }),
    ).toThrow('bad revision')
    expect(calls).toBe(1)
  })

  it('getChangedFiles recovers from a transient exec failure via retry', () => {
    let calls = 0
    const changed = getChangedFiles('HEAD~1..HEAD', () => {
      calls += 1
      if (calls < 2) throw transientError('ENOBUFS')
      return 'apps/example/file.ts\n'
    })
    expect(changed).toEqual(['apps/example/file.ts'])
    expect(calls).toBe(2)
  })

  it('still fails closed if the transient error persists past the retry budget', () => {
    expect(() =>
      getChangedFiles('HEAD~1..HEAD', () => {
        throw transientError('ENOBUFS')
      }),
    ).toThrow(UnresolvableRangeError)
  })
})

describe('9: workflow checkout-depth contract', () => {
  it('Staging Pre-Deploy Gates checkout sets fetch-depth: 0', () => {
    const steps = deployStagingWorkflow.jobs['pre-deploy-gates'].steps
    const checkoutStep = steps.find((step: { uses?: string }) => step.uses === 'actions/checkout@v5')
    expect(checkoutStep).toBeDefined()
    expect(checkoutStep.with?.['fetch-depth']).toBe(0)
  })
})

describe('10: historical P4 merge simulation against a disposable git repository', () => {
  it('detects both the nested migration and the canonical runbook across a real commit range', () => {
    const repoDir = mkdtempSync(join(tmpdir(), 'migration-safety-sim-'))
    try {
      const run = (cmd: string) => execSync(cmd, { cwd: repoDir, stdio: 'pipe' })
      run('git init -q')
      run('git config user.email test@example.com')
      run('git config user.name "Migration Safety Test"')

      writeFileSync(join(repoDir, 'README.md'), 'seed\n')
      run('git add -A && git commit -q -m seed')
      const before = execSync('git rev-parse HEAD', { cwd: repoDir, encoding: 'utf8' }).trim()

      mkdirSync(join(repoDir, 'apps/union-eyes/backend/core/migrations'), { recursive: true })
      writeFileSync(join(repoDir, NESTED_DJANGO_MIGRATION), '# migration\n')
      mkdirSync(join(repoDir, 'docs/union-eyes'), { recursive: true })
      writeFileSync(join(repoDir, CANONICAL_P4_RUNBOOK), '# runbook\n')
      run('git add -A && git commit -q -m "p4 merge"')
      const after = execSync('git rev-parse HEAD', { cwd: repoDir, encoding: 'utf8' }).trim()

      const changed = getChangedFiles(`${before}..${after}`, (cmd) =>
        execSync(cmd, { cwd: repoDir, encoding: 'utf8' }),
      )
      const { migrationFiles, hasRunbookUpdate } = classifyChangedFiles(changed)

      expect(migrationFiles).toContain(NESTED_DJANGO_MIGRATION)
      expect(hasRunbookUpdate).toBe(true)
    } finally {
      rmSync(repoDir, { recursive: true, force: true })
    }
  })
})

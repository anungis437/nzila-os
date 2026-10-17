/**
 * E5_B: Build All must not PASS on an empty `--affected` graph when the diff
 * includes a root/global input or any path whose build relevance is not proven
 * irrelevant. Docs-only stays not applicable.
 *
 * @invariant AFFECTED_BUILD_PORTFOLIO_FALLBACK_001
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  LOCKFILE_AND_GRAPH_BASENAMES,
  ROOT_FULL_BUILD_PATHS,
  listWorkspacePackageDirs,
  parseNameStatusZ,
  parseWorkspacePatterns,
  planAffectedBuild,
} from '../ci/affected-build-plan.mjs'
import { classifyChangedPaths } from '../ci/merge-authority/surface.mjs'

const ROOT = join(__dirname, '..', '..')

const PACKAGE_DIRS = ['apps/web', 'packages/db', 'tooling/openapi-gen']

function mode(paths: string[], packageDirs: string[] = PACKAGE_DIRS) {
  return planAffectedBuild(paths, packageDirs)
}

describe('affected build portfolio fallback', () => {
  it('locks the explicit root and lockfile trigger set', () => {
    expect([...LOCKFILE_AND_GRAPH_BASENAMES].sort()).toEqual(
      [
        'bun.lock',
        'bun.lockb',
        'npm-shrinkwrap.json',
        'package-lock.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'turbo.json',
        'turbo.jsonc',
        'yarn.lock',
      ].sort(),
    )
    expect([...ROOT_FULL_BUILD_PATHS].sort()).toEqual(['.npmrc', 'package.json'])
  })

  it('forces a full portfolio build for lockfiles, the task graph, and root package inputs', () => {
    for (const path of [
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
      'packages/db/turbo.json',
    ]) {
      expect(mode([path]), path).toMatchObject({ mode: 'full', reason: 'root-or-global-input' })
    }
  })

  it('forces a full portfolio build when a workspace change is mixed with a root input', () => {
    expect(mode(['apps/web/app/page.tsx', 'pnpm-lock.yaml'])).toMatchObject({
      mode: 'full',
      triggers: ['pnpm-lock.yaml'],
    })
    expect(mode(['README.md', 'package.json'])).toMatchObject({
      mode: 'full',
      triggers: ['package.json'],
    })
  })

  it('keeps in-package changes on the affected graph, including nested package manifests', () => {
    expect(mode(['apps/web/app/page.tsx'])).toEqual({
      mode: 'affected',
      reason: 'workspace-package-changes',
      triggers: [],
    })
    expect(mode(['apps/web/package.json'])).toMatchObject({ mode: 'affected' })
    expect(mode(['packages/db/src/index.ts', 'README.md'])).toMatchObject({ mode: 'affected' })
    expect(mode(['tooling/openapi-gen/src/cli.ts'])).toMatchObject({ mode: 'affected' })
  })

  it('does not treat unknown or non-package paths as not applicable', () => {
    for (const path of [
      'something-unexpected.bin',
      '.github/workflows/ci.yml',
      'tooling/ci/affected-build-plan.mjs',
      'tooling/contract-tests/affected-build-plan.test.ts',
      'scripts/release/validate-branch-tag-policy.ts',
      'packages/automation/src/index.ts',
      'docs/not-markdown.json',
      'infrastructure/bicep/main.bicep',
    ]) {
      const plan = mode([path])
      expect(plan.mode, path).toBe('full')
      expect(plan.mode, path).not.toBe('not_applicable')
    }
    expect(mode([])).toEqual({ mode: 'full', reason: 'empty-diff', triggers: [] })
    expect(mode(['../secrets.md'])).toMatchObject({ mode: 'full', reason: 'unknown-path' })
    expect(planAffectedBuild('pnpm-lock.yaml' as unknown as string[], PACKAGE_DIRS)).toMatchObject({
      mode: 'full',
      reason: 'unknown-change-set',
    })
  })

  it('leaves proven documentation paths not applicable', () => {
    expect(
      mode(['docs/engineering-convergence/ci-execution/CI_AUTHORITY_SURFACE.md', 'README.md']),
    ).toEqual({
      mode: 'not_applicable',
      reason: 'proven-irrelevant',
      triggers: [],
    })
    expect(mode(['LICENSE', '.gitignore', '.editorconfig', '.github/CODEOWNERS'])).toMatchObject({
      mode: 'not_applicable',
    })
  })

  it('does not let merge authority mark those inputs not applicable', () => {
    for (const path of [
      'pnpm-lock.yaml',
      'turbo.json',
      'pnpm-workspace.yaml',
      'package.json',
      '.npmrc',
    ]) {
      expect(classifyChangedPaths([path]).contexts['Merge Authority / Affected Build'], path).toBe(
        'REQUIRES_EXECUTION',
      )
    }
    expect(
      classifyChangedPaths(['something-unexpected.bin']).contexts[
        'Merge Authority / Affected Build'
      ],
    ).toBe('REQUIRES_EXECUTION')
    expect(
      classifyChangedPaths(['docs/engineering-convergence/ci-execution/CI_AUTHORITY_SURFACE.md'])
        .contexts['Merge Authority / Affected Build'],
    ).toBe('NOT_APPLICABLE')
  })

  it('reads both sides of a lockfile rename', () => {
    const payload = Buffer.from('R100\0pnpm-lock.yaml\0archive/old-lock.yaml\0', 'utf8')
    expect(parseNameStatusZ(payload)).toEqual(['pnpm-lock.yaml', 'archive/old-lock.yaml'])
    expect(mode(parseNameStatusZ(payload))).toMatchObject({ mode: 'full' })
  })

  it('discovers real workspace packages and still excludes non-packages', () => {
    const patterns = parseWorkspacePatterns(readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8'))
    expect(patterns).toEqual([
      'apps/*',
      'apps/*/services/*',
      'packages/*',
      'services/*',
      '!packages/automation',
      '!packages/packages',
      'tooling/*',
    ])
    const dirs = listWorkspacePackageDirs(ROOT, patterns)
    expect(dirs).toContain('apps/web')
    expect(dirs).toContain('packages/db')
    expect(dirs).toContain('tooling/openapi-gen')
    expect(dirs).not.toContain('packages/automation')
    expect(dirs).not.toContain('tooling/contract-tests')
    expect(dirs).not.toContain('tooling/ci')

    expect(planAffectedBuild(['apps/web/app/page.tsx'], dirs).mode).toBe('affected')
    expect(
      planAffectedBuild(['tooling/contract-tests/affected-build-plan.test.ts'], dirs).mode,
    ).toBe('full')
  })
})

describe('CI Build All compiles the declared routine scope', () => {
  function buildJob(): {
    'continue-on-error'?: boolean
    steps?: Array<{ name?: string; run?: string; 'continue-on-error'?: boolean }>
  } {
    const doc = parse(readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')) as {
      jobs: {
        'build-worker': {
          'continue-on-error'?: boolean
          steps?: Array<{ name?: string; run?: string; 'continue-on-error'?: boolean }>
        }
      }
    }
    return doc.jobs['build-worker']
  }

  it('compiles the complete owner-declared scope for both root and package changes', () => {
    const job = buildJob()
    expect(job['continue-on-error']).not.toBe(true)
    const step = job.steps?.find(
      (candidate) =>
        typeof candidate.run === 'string' && candidate.run.includes('affected-build-plan.mjs'),
    )
    expect(step?.run).toBeTruthy()
    expect(step?.['continue-on-error']).not.toBe(true)

    const run = step?.run ?? ''
    expect(run).toContain('node tooling/ci/affected-build-plan.mjs --base "$BASE" --head "$HEAD"')
    expect(run).toContain('node tooling/ci/run-scoped-build-shard.mjs')
    expect(run).toContain('BUILD_BASE="$BASE" BUILD_HEAD="$HEAD"')
    expect(run).not.toContain('pnpm build')
    expect(run).not.toContain('pnpm exec turbo run build --affected')
    expect(run).not.toMatch(/\|\|\s*true/)
    expect(run).toContain('not_applicable')
    expect(run).toContain('exit 1')

    const executableBranch = run.slice(
      run.indexOf('full|affected)'),
      run.indexOf('not_applicable)'),
    )
    expect(executableBranch).toContain('run_scoped_build')
    expect(run).toContain('SCM base unavailable; compiling the complete active CI scope')
  })

  it('keeps Reliability Guard SRE-only without test:fast or portfolio pnpm build (E5-F)', () => {
    const guard = readFileSync(join(ROOT, '.github', 'workflows', 'reliability-guard.yml'), 'utf8')
    expect(guard).not.toContain('pnpm test:fast')
    expect(guard).not.toContain('pnpm build')
    expect(guard).toContain('validate-health-contract')
    expect(guard).toContain('synthetic-dry-run')
    expect(guard).toContain('alert-routing-dry-run')
    expect(guard).toContain('audit-reliability')
    expect(guard).toContain('generate-executive-dashboard')
  })
})

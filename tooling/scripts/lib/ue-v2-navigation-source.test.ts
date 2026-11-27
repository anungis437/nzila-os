import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { parse } from 'yaml'
import { navigationSource } from './ue-v2-navigation-source'

function fixture(run: (root: string, sha: string, git: (...args: string[]) => string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-navigation-source-'))
  const git = (...args: string[]) => execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  try {
    git('init', '-q'); git('config', 'user.name', 'Synthetic source proof'); git('config', 'user.email', 'source@example.invalid')
    const directory = path.join(root, 'apps/union-eyes/lib/dashboard')
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, 'label.ts'), "export const label: string = 'Accepted snapshot'\n")
    fs.writeFileSync(path.join(directory, 'navigation.ts'), "import { label } from './label'; export const landing = () => ({label, path:'/dashboard/inbox'})\n")
    fs.writeFileSync(path.join(directory, 'external.ts'), "import fs from 'node:fs'; export const value = fs.existsSync('.')\n")
    git('add', '.'); git('commit', '-qm', 'accepted synthetic application')
    run(root, git('rev-parse', 'HEAD'), git)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
}

test('navigation and dependency digests come from the declared Git tree despite different HEAD code', () => {
  fixture((root, sha, git) => {
    const file = 'apps/union-eyes/lib/dashboard/label.ts'
    const original = git('show', `${sha}:${file}`) + '\n'
    fs.writeFileSync(path.join(root, file), "throw new Error('Unadmitted HEAD must not execute')\n")
    git('add', '.'); git('commit', '-qm', 'different proposed navigation')
    assert.notEqual(git('rev-parse', 'HEAD'), sha)
    const source = navigationSource(root, sha)
    const module = source.load('apps/union-eyes/lib/dashboard/navigation.ts') as { landing: () => unknown }
    assert.deepEqual(JSON.parse(JSON.stringify(module.landing())), { label: 'Accepted snapshot', path: '/dashboard/inbox' })
    assert.equal(source.digests([])[file], createHash('sha256').update(original).digest('hex'))
  })
})

test('missing snapshot files never fall back to a file present only in current HEAD', () => {
  fixture((root, sha) => {
    const file = 'apps/union-eyes/lib/dashboard/future.ts'
    fs.writeFileSync(path.join(root, file), 'export const value = true\n')
    assert.throws(() => navigationSource(root, sha).load(file))
  })
})

test('navigation snapshots refuse mutable refs, noncommit objects, external imports and paths outside the application', () => {
  fixture((root, sha, git) => {
    assert.throws(() => navigationSource(root, 'main'), /NAVIGATION_SOURCE_SHA_REQUIRED/)
    assert.throws(() => navigationSource(root, git('rev-parse', `${sha}^{tree}`)), /NAVIGATION_COMMIT_REQUIRED/)
    assert.throws(() => navigationSource(root, sha).load('apps/union-eyes/lib/dashboard/external.ts'), /NAVIGATION_NONRELATIVE_IMPORT_REFUSED/)
    assert.throws(() => navigationSource(root, sha).read('packages/platform-auth/src/entra/server.ts'), /NAVIGATION_SOURCE_OUTSIDE_APPLICATION/)
    assert.throws(() => navigationSource(root, sha).load('apps/union-eyes/lib/../../outside.ts'), /NAVIGATION_SOURCE_PATH_INVALID/)
  })
})

test('a shallow CI clone fetches only the declared commit and keeps current HEAD unchanged', () => {
  fixture((root, sha, git) => {
    fs.writeFileSync(path.join(root, 'apps/union-eyes/lib/dashboard/label.ts'), "throw new Error('Current HEAD is not the accepted snapshot')\n")
    git('add', '.'); git('commit', '-qm', 'different current checkout')
    const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-navigation-shallow-'))
    try {
      execFileSync('git', ['clone', '--quiet', '--depth=1', 'file://' + root, clone], { stdio: ['ignore', 'pipe', 'pipe'] })
      const before = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: clone, encoding: 'utf8' }).trim()
      assert.throws(() => navigationSource(clone, sha))
      execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', sha], { cwd: clone, stdio: ['ignore', 'pipe', 'pipe'] })
      const module = navigationSource(clone, sha).load('apps/union-eyes/lib/dashboard/navigation.ts') as { landing: () => unknown }
      assert.equal((module.landing() as { label: string }).label, 'Accepted snapshot')
      assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: clone, encoding: 'utf8' }).trim(), before)
    } finally { fs.rmSync(clone, { recursive: true, force: true }) }
  })
})

test('PR native preservation proof stays separate from admitted live-operator packaging', () => {
  const workflow = parse(fs.readFileSync('.github/workflows/ue-v2-staging-forward-upgrade.yml', 'utf8'))
  const steps = workflow.jobs.qualify.steps
  const proof = steps.find((step: { run?: string }) => step.run?.includes('prove-ue-v2-forward-upgrade.cts'))
  assert(proof && !proof.if)
  assert(!proof.run.includes('prepare-ue-v2-forward-upgrade.cts'))
  const assets = steps.find((step: { run?: string }) => step.run?.includes('prepare-ue-v2-forward-upgrade.cts'))
  assert.equal(assets.if, "github.event_name == 'workflow_dispatch'")
  const upload = steps.find((step: { with?: { name?: string } }) => step.with?.name?.startsWith('ue-forward-operator-'))
  assert.equal(upload.if, "github.event_name == 'workflow_dispatch'")
  assert.equal(workflow.jobs.build.if, "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'")
  assert.equal(steps.find((step: { with?: { name?: string } }) => step.with?.name?.startsWith('ue-forward-upgrade-proof-')).if, 'always()')
})

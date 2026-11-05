#!/usr/bin/env node
/**
 * Runs the frozen Gate 0 evidence tests (tooling/scripts/lib/ue-gate0*.test.mjs) against the pinned historical commit they
 * were written for, in a temporary detached worktree, and never against the present branch.
 *
 * Why: those tests quote the source text and registers as they stood when each Gate 0 tranche was accepted. Repairs made since
 * (for example crud-governance.ts and the docs routes) change that text on purpose, so run against the present tree they fail
 * by design. The frozen evidence is not edited to make them pass and the tests are not weakened; they are simply run where
 * their evidence lives. Present-source behaviour is covered by the current-source regression suites (see
 * docs/union-eyes/convergence/GATE0-TEST-TREATMENT.md).
 *
 * Usage:
 *   node tooling/scripts/run-ue-gate0-historical.mjs [--commit <sha>] [--filter <substring>] [--keep]
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const { ANCHOR_COMMIT } = await import(new URL('./lib/ue-gate0b8-ids.mjs', import.meta.url))
const commit = flag('--commit') ?? ANCHOR_COMMIT
const filter = flag('--filter') ?? ''

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim()
git('cat-file', '-e', `${commit}^{commit}`)

const dir = mkdtempSync(join(tmpdir(), 'ue-gate0-historical-'))
git('worktree', 'add', '--detach', dir, commit)
let status = 1
try {
  const libDir = join(dir, 'tooling', 'scripts', 'lib')
  const tests = readdirSync(libDir)
    .filter((f) => /^ue-gate0.*\.test\.mjs$/.test(f) && f.includes(filter))
    .map((f) => join('tooling', 'scripts', 'lib', f))
  console.log(`Gate 0 historical evidence at ${commit}: ${tests.length} test file(s)`)
  const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: dir, stdio: 'inherit' })
  status = result.status ?? 1
} finally {
  if (!args.includes('--keep')) {
    try {
      git('worktree', 'remove', '--force', dir)
    } catch {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}
process.exit(status)

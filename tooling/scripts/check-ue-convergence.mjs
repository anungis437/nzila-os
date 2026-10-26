#!/usr/bin/env node
/**
 * Union Eyes convergence check (CI entrypoint).
 *
 *   node tooling/scripts/check-ue-convergence.mjs [--report]
 *
 * 1. Validates docs/union-eyes/convergence/register/ue-convergence-register.json.
 * 2. Evaluates the allowlist ratchets in ue-convergence-ratchets.json against tracked files (git grep).
 * 3. Verifies the approved migration lineage with the repository's own verifier.
 *
 * Exit status is non-zero on any problem. Stale allowlist entries are reported but do not fail, so the lists can
 * shrink as legacy code is retired. With --report it prints every match instead of failing (used to author lists).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateRule, validateRegister } from './lib/ue-convergence-check.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const REGISTER = path.join(root, 'docs/union-eyes/convergence/register/ue-convergence-register.json')
const RATCHETS = path.join(root, 'docs/union-eyes/convergence/register/ue-convergence-ratchets.json')
const reportOnly = process.argv.includes('--report')

const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

function matchingFiles(rule) {
  const args = ['grep', '-l', '-I', '-E']
  if (rule.ignoreCase) args.push('-i')
  args.push(rule.pattern, '--', ...rule.paths, ...(rule.exclude ?? []).map((g) => `:(exclude,glob)${g}`))
  const r = git(args)
  if (r.status === 1) return []
  if (r.status !== 0) throw new Error(`git grep failed for ${rule.id}: ${r.stderr}`)
  return r.stdout.split('\n').map((s) => s.trim()).filter(Boolean)
}

const problems = []
const notes = []

const register = JSON.parse(readFileSync(REGISTER, 'utf8'))
const reg = validateRegister(register, {
  fileExists: (p) => existsSync(path.join(root, p)),
  commitExists: (sha) => git(['cat-file', '-e', `${sha}^{commit}`]).status === 0,
})
problems.push(...reg.problems)
notes.push(`register: ${register.entries.length} entries — ${Object.entries(reg.counts).map(([k, v]) => `${k} ${v}`).join(', ')}`)

const ratchets = JSON.parse(readFileSync(RATCHETS, 'utf8'))
for (const rule of ratchets.rules) {
  const files = matchingFiles(rule)
  if (reportOnly) {
    console.log(`\n# ${rule.id} (${files.length} files)`)
    for (const f of files) console.log(`  ${f}`)
    continue
  }
  const r = evaluateRule(rule, files)
  problems.push(...r.problems)
  for (const s of r.stale) notes.push(`stale: ${s}`)
  notes.push(`ratchet ${rule.id}: ${files.length} matching file(s), ${rule.allowed?.length ?? 0} allowlisted`)
}

if (!reportOnly) {
  const lineage = spawnSync(process.execPath, ['tooling/scripts/measure-ue-migration-lineage.mjs', '--verify', '--worktree'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (lineage.status !== 0) problems.push(`migration lineage verification failed:\n${(lineage.stdout + lineage.stderr).split('\n').slice(-12).join('\n')}`)
  else notes.push('migration lineage: verified (no violations)')

  for (const n of notes) console.log(n)
  if (problems.length > 0) {
    console.error(`\nUE convergence check FAILED (${problems.length}):`)
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  console.log('\nUE convergence check passed.')
}

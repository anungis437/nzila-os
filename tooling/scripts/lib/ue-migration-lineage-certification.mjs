/**
 * Migration lineage certification.
 *
 * The staging-recovery qualification (CHG-2026-0112) pins an exact, previously
 * measured migration lineage. This module makes that pin explicit and checkable
 * instead of a hard-coded count:
 *
 *   - APPROVED lineage: every scoped and platform migration measured at the
 *     approved baseline commit, tag by tag, with its SHA-256 over the committed
 *     (git blob, LF) bytes. It is a prefix that must never change.
 *   - REGISTERED ADDITIONS: migrations added after approval. Each is listed with
 *     its tag and measured hash. An addition is NOT qualified: it carries no
 *     clone evidence until a new signed qualification covers it.
 *
 * Anything else is a violation: a modified, removed or reordered approved entry,
 * an addition nobody registered, or a registered addition that is absent or
 * altered. Counts are derived from this record, never edited to make a test pass.
 *
 * Hashes are taken over git blob bytes so they are identical on every platform.
 * Working-tree reads normalise CRLF to LF for the same reason.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const APPROVED_LINEAGE_PATH = path.join(ROOT, 'tooling/scripts/lib/ue-approved-migration-lineage.json')

/** Order matches canonicalMigrations() in ue-staging-clone-qualification.mjs. */
export const LINEAGES = [
  { key: 'scoped', dir: 'apps/union-eyes/db/migrations-cache' },
  { key: 'platform', dir: 'apps/union-eyes/db/migrations-platform' },
]

export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const lf = (buf) => Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1')

function gitBlob(ref, file, root) {
  return execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
}

/** Measures both journals as committed at `ref`. */
export function readLineageFromGit(ref, root = ROOT) {
  const out = {}
  for (const { key, dir } of LINEAGES) {
    const journal = JSON.parse(gitBlob(ref, `${dir}/meta/_journal.json`, root).toString('utf8'))
    out[key] = journal.entries.map((e) => ({ tag: e.tag, sha256: sha256(gitBlob(ref, `${dir}/${e.tag}.sql`, root)) }))
  }
  return out
}

/** Measures the working tree (CRLF normalised), for uncommitted checks. */
export function readLineageFromWorktree(root = ROOT) {
  const out = {}
  for (const { key, dir } of LINEAGES) {
    const journal = JSON.parse(fs.readFileSync(path.join(root, dir, 'meta/_journal.json'), 'utf8'))
    out[key] = journal.entries.map((e) => ({ tag: e.tag, sha256: sha256(lf(fs.readFileSync(path.join(root, dir, `${e.tag}.sql`)))) }))
  }
  return out
}

export function loadApprovedLineage(file = APPROVED_LINEAGE_PATH) {
  const approved = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (approved.version !== 1 || !/^[a-f0-9]{40}$/.test(approved.baselineCommit ?? '')) {
    throw new Error('Approved lineage record is malformed')
  }
  for (const { key } of LINEAGES) {
    if (!Array.isArray(approved[key]) || approved[key].length === 0) throw new Error(`Approved lineage has no ${key} entries`)
    if (!approved.registeredAdditions || !Array.isArray(approved.registeredAdditions[key])) throw new Error(`Registered additions missing for ${key}`)
  }
  return approved
}

/** Counts the gate must expect: approved prefix plus REGISTERED additions. Derived, not typed. */
export function expectedLineageCounts(approved = loadApprovedLineage()) {
  return Object.fromEntries(LINEAGES.map(({ key }) => [key, approved[key].length + approved.registeredAdditions[key].length]))
}

/**
 * Compares a measured lineage with the approved record.
 * `current` is { scoped: [{tag, sha256}], platform: [...] }.
 */
export function certifyLineage(approved, current) {
  const violations = []
  const additions = {}
  const approvedVerified = {}
  for (const { key } of LINEAGES) {
    const base = approved[key]
    const reg = approved.registeredAdditions[key]
    const now = current[key] ?? []
    additions[key] = []
    approvedVerified[key] = 0
    if (now.length < base.length) violations.push(`${key}: ${base.length - now.length} approved migration(s) removed`)
    for (let i = 0; i < Math.min(base.length, now.length); i++) {
      if (now[i].tag !== base[i].tag) violations.push(`${key}[${i}]: approved ${base[i].tag} replaced or reordered (found ${now[i].tag})`)
      else if (now[i].sha256 !== base[i].sha256) violations.push(`${key}[${i}] ${base[i].tag}: approved content changed (${base[i].sha256.slice(0, 12)} -> ${now[i].sha256.slice(0, 12)})`)
      else approvedVerified[key]++
    }
    const extra = now.slice(base.length)
    extra.forEach((entry, j) => {
      const r = reg[j]
      if (!r) violations.push(`${key}: unregistered addition ${entry.tag}`)
      else if (r.tag !== entry.tag) violations.push(`${key}: addition #${j + 1} is ${entry.tag} but ${r.tag} is registered`)
      else if (r.sha256 !== entry.sha256) violations.push(`${key}: registered addition ${entry.tag} changed after registration (${r.sha256.slice(0, 12)} -> ${entry.sha256.slice(0, 12)})`)
      else additions[key].push({ ...entry, status: r.status, qualified: false })
    })
    if (reg.length > extra.length) violations.push(`${key}: registered addition ${reg[extra.length].tag} is absent`)
  }
  return { ok: violations.length === 0, violations, approvedVerified, additions }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  APPROVED_LINEAGE_PATH,
  LINEAGES,
  ROOT,
  certifyLineage,
  expectedLineageCounts,
  loadApprovedLineage,
  readLineageFromGit,
  readLineageFromWorktree,
  sha256,
} from './ue-migration-lineage-certification.mjs'

const approved = loadApprovedLineage()
const clone = (value) => JSON.parse(JSON.stringify(value))
const lineageOf = (a) => ({ scoped: [...a.scoped, ...a.registeredAdditions.scoped].map(({ tag, sha256: h }) => ({ tag, sha256: h })), platform: [...a.platform, ...a.registeredAdditions.platform].map(({ tag, sha256: h }) => ({ tag, sha256: h })) })

test('the approved record is the 20 scoped and 16 platform migrations the staging recovery qualified', () => {
  assert.equal(approved.scoped.length, 20)
  assert.equal(approved.platform.length, 16)
  assert.equal(approved.baselineCommit, '0c994b968aed0657cca5b702954ba87252408245')
  for (const { key } of LINEAGES) for (const e of approved[key]) assert.match(e.sha256, /^[a-f0-9]{64}$/)
  assert.equal(new Set(approved.scoped.map((e) => e.tag)).size, 20)
})

test('counts are derived from the approved prefix plus REGISTERED additions, never typed', () => {
  const counts = expectedLineageCounts(approved)
  assert.equal(counts.scoped, 20 + approved.registeredAdditions.scoped.length)
  assert.equal(counts.platform, 16 + approved.registeredAdditions.platform.length)
})

test('every registered addition is explicitly UNQUALIFIED: it carries no clone evidence yet', () => {
  for (const { key } of LINEAGES) for (const a of approved.registeredAdditions[key]) {
    assert.equal(a.status, 'UNQUALIFIED')
    assert.match(a.sha256, /^[a-f0-9]{64}$/)
    assert.ok(a.introducedBy && a.note)
  }
})

test('the pinned approved hashes are byte-identical to the baseline commit (measured from git blobs)', (t) => {
  try { execFileSync('git', ['cat-file', '-e', `${approved.baselineCommit}^{commit}`], { cwd: ROOT, stdio: 'ignore' }) } catch { return t.skip('baseline commit is not in this clone') }
  const measured = readLineageFromGit(approved.baselineCommit)
  for (const { key } of LINEAGES) assert.deepEqual(measured[key], approved[key].map(({ tag, sha256: h }) => ({ tag, sha256: h })))
})

test('the current working tree certifies: approved prefix verified byte-for-byte, additions registered', () => {
  const result = certifyLineage(approved, readLineageFromWorktree())
  assert.deepEqual(result.violations, [])
  assert.equal(result.ok, true)
  assert.deepEqual(result.approvedVerified, { scoped: 20, platform: 16 })
  for (const { key } of LINEAGES) for (const a of result.additions[key]) assert.equal(a.qualified, false)
})

test('a modified approved migration is refused, naming the entry and both hashes', () => {
  const current = lineageOf(approved)
  current.scoped[7] = { ...current.scoped[7], sha256: 'f'.repeat(64) }
  const r = certifyLineage(approved, current)
  assert.equal(r.ok, false)
  assert.match(r.violations[0], new RegExp(`scoped\\[7\\] ${approved.scoped[7].tag}: approved content changed`))
})

test('a removed, renamed or reordered approved migration is refused', () => {
  const removed = lineageOf(approved); removed.platform.splice(2, 1)
  assert.match(certifyLineage(approved, removed).violations.join('\n'), /platform/)
  const renamed = lineageOf(approved); renamed.scoped[0] = { ...renamed.scoped[0], tag: '0000_other' }
  assert.match(certifyLineage(approved, renamed).violations[0], /replaced or reordered/)
  const reordered = lineageOf(approved);[reordered.scoped[4], reordered.scoped[5]] = [reordered.scoped[5], reordered.scoped[4]]
  assert.equal(certifyLineage(approved, reordered).ok, false)
})

test('an unregistered addition is refused; a registered one that later changes is refused; a missing registered one is refused', () => {
  const extra = lineageOf(approved); extra.scoped.push({ tag: '0099_unreviewed', sha256: 'a'.repeat(64) })
  assert.match(certifyLineage(approved, extra).violations.join('\n'), /unregistered addition 0099_unreviewed/)

  const changed = lineageOf(approved)
  const last = changed.platform.length - 1
  changed.platform[last] = { ...changed.platform[last], sha256: 'b'.repeat(64) }
  assert.match(certifyLineage(approved, changed).violations.join('\n'), /changed after registration/)

  const missing = lineageOf(approved); missing.platform.pop()
  assert.match(certifyLineage(approved, missing).violations.join('\n'), /is absent/)
})

test('the record itself is validated before use', () => {
  assert.throws(() => loadApprovedLineage(new URL('../../../package.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), /malformed|Approved lineage|registered additions/i)
  assert.ok(APPROVED_LINEAGE_PATH.endsWith('ue-approved-migration-lineage.json'))
  assert.equal(sha256(Buffer.from('')).length, 64)
  assert.equal(clone(approved).version, 1)
})

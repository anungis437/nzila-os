import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('./', import.meta.url))
export const evidence = path.join(root, 'g3-readiness-evidence')
export const source = path.join(root, 'g3-source')
export const frozen = path.join(evidence, 'g3r2-frozen-source')
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const read = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
export function files(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      assert(!entry.isSymbolicLink(), `UNSUPPORTED_PRESERVATION_SYMLINK:${entry.name}`)
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      return entry.isDirectory()
        ? files(path.join(directory, entry.name), relative)
        : [{ path: relative, sha256: hash(readFileSync(path.join(directory, entry.name))) }]
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}
export function capture() {
  const file = path.join(evidence, 'G3R2I_HISTORICAL_PRESERVATION.json')
  if (existsSync(file)) return verify()
  assert(!existsSync(frozen), 'UNEXPECTED_FROZEN_SOURCE_DIRECTORY')
  const originalSource = files(source)
  const baseline = {
    lineage: 'PROSPECTIVE_G3R2_IMAGE_QUALIFICATION',
    candidate: files(path.join(root, 'synthetic-health')),
    historicalEvidence: readdirSync(evidence, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith('G3R2I'))
      .map((entry) => ({
        path: entry.name,
        sha256: hash(readFileSync(path.join(evidence, entry.name))),
      })),
    originalSource,
    originalGeneratorSha256: hash(readFileSync(path.join(root, 'g3r2-source-closure.mjs'))),
    g2Source: read(path.join(evidence, 'G3_EXECUTION_READINESS.json')).preservation
      .localG2SourceHashes,
    CURRENT_CANDIDATE_BYTES_CHANGED: 'NO',
    historicalImageDecision: 'BLOCKED_PRESERVED_NOT_REWRITTEN',
  }
  for (const entry of originalSource) {
    const target = path.join(frozen, entry.path)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, readFileSync(path.join(source, entry.path)), { flag: 'wx' })
  }
  writeFileSync(file, `${JSON.stringify(baseline, null, 2)}\n`, { flag: 'wx' })
  return verify()
}
export function verify() {
  const baseline = read(path.join(evidence, 'G3R2I_HISTORICAL_PRESERVATION.json'))
  assert.deepEqual(
    files(path.join(root, 'synthetic-health')),
    baseline.candidate,
    'REJECTED_CANDIDATE_CHANGED',
  )
  assert.deepEqual(files(frozen), baseline.originalSource, 'FROZEN_G3R2_SOURCE_CHANGED')
  for (const entry of baseline.historicalEvidence)
    assert.equal(
      hash(readFileSync(path.join(evidence, entry.path))),
      entry.sha256,
      `HISTORICAL_EVIDENCE_CHANGED:${entry.path}`,
    )
  for (const [file, expected] of Object.entries(baseline.g2Source))
    assert.equal(hash(readFileSync(path.join(root, file))), expected, `G2_SOURCE_CHANGED:${file}`)
  assert.equal(
    hash(readFileSync(path.join(root, 'g3r2-source-closure.mjs'))),
    baseline.originalGeneratorSha256,
  )
  for (const input of read(path.join(frozen, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))
    .acceptedLocalInputs)
    assert.equal(
      hash(readFileSync(path.join(root, input.name))),
      input.sha256,
      `ACCEPTED_LOCAL_INPUT_CHANGED:${input.name}`,
    )
  return baseline
}
export function checkFrozenG3R2() {
  verify()
  const manifest = read(path.join(frozen, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))
  const builds = read(path.join(evidence, 'G3R2_LOCAL_BUILD_EVIDENCE.json'))
  for (const entry of manifest.sourceFiles)
    assert.equal(hash(readFileSync(path.join(frozen, entry.path))), entry.sha256)
  for (const entry of builds.entries) {
    assert.equal(hash(readFileSync(path.join(frozen, entry.source))), entry.sourceSha256)
    assert.equal(hash(readFileSync(path.join(frozen, entry.templatePath))), entry.templateSha256)
  }
  assert.equal(
    read(path.join(evidence, 'G3R2_SOURCE_AUTHORITY_CLOSURE.json')).manifestSha256,
    hash(readFileSync(path.join(frozen, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))),
  )
  return { status: 'PASS_PERSISTED_SOURCE_AND_BUILD_HASH_CHECK' }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3)
  assert(['--capture', '--check'].includes(process.argv[2]))
  const baseline = process.argv[2] === '--capture' ? capture() : verify()
  console.log(
    `PASS preservation:${baseline.candidate.length} candidate files,${baseline.historicalEvidence.length} frozen evidence files,${baseline.originalSource.length} archived source/build files;G2 unchanged.`,
  )
}

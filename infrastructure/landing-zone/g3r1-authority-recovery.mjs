import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))
const repo = path.resolve(root, '..', '..')
const evidence = path.join(root, 'g3-readiness-evidence')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const identifiers = [
  'NZ-20261008-INFRA-001',
  'G3A',
  'G3B',
  'G3_EXECUTION_READINESS',
  'G2_TERMINAL_ROOT',
  'G2_PRIVATE_CONTROL_PLANE',
  'g3-synthetic-runtime',
  'synthetic-health',
]
export function gitRead(args) {
  assert(
    ['log', 'rev-list', 'show', 'ls-tree', 'cat-file', 'grep'].includes(args[0]),
    'GIT_READ_ONLY_COMMANDS',
  )
  const result = spawnSync('git', ['--no-pager', ...args], {
    cwd: repo,
    maxBuffer: 32 * 1024 * 1024,
  })
  assert.equal(result.status, 0, `GIT_READ_FAILED:${args.join(' ')}:${result.stderr}`)
  return result.stdout
}
function lines(bytes) {
  return bytes.toString().trim().split(/\r?\n/).filter(Boolean)
}
export function capturePreservation() {
  const files = readdirSync(evidence).filter((name) => !name.startsWith('G3R1_'))
  return Object.fromEntries(
    files.map((name) => [name, sha(readFileSync(path.join(evidence, name)))]),
  )
}
export function recoverAuthority() {
  const revisions = lines(
    gitRead(['log', '--all', '--format=%H', '--', 'infrastructure/landing-zone']),
  )
  assert(revisions.length <= 80, 'HISTORY_REVISION_BOUND_EXCEEDED')
  const objects = lines(gitRead(['rev-list', '--all', '--objects']))
    .map((line) => {
      const split = line.indexOf(' ')
      return { oid: line.slice(0, split), sourcePath: line.slice(split + 1) }
    })
    .filter(
      (item) =>
        item.sourcePath.startsWith('infrastructure/landing-zone/') ||
        /(?:^|\/)(?:g3[^/]*|g2.*terminal[^/]*|.*G2_TERMINAL_ROOT.*)$/i.test(item.sourcePath),
    )
  assert(objects.length <= 300, 'HISTORY_OBJECT_BOUND_EXCEEDED')
  const inspected = []
  const sourceCommits = new Map()
  for (const revision of revisions) {
    for (const line of lines(
      gitRead(['ls-tree', '-r', revision, '--', 'infrastructure/landing-zone']),
    )) {
      const match = /^\d+ blob ([a-f0-9]+)\t(.+)$/.exec(line)
      if (!match) continue
      const key = `${match[1]}:${match[2]}`
      if (!sourceCommits.has(key)) sourceCommits.set(key, [])
      sourceCommits.get(key).push(revision)
    }
  }
  for (const item of objects) {
    if (gitRead(['cat-file', '-t', item.oid]).toString().trim() !== 'blob') continue
    const bytes = gitRead(['cat-file', 'blob', item.oid])
    assert(bytes.length <= 2 * 1024 * 1024, 'HISTORY_BLOB_SIZE_BOUND')
    const text = bytes.toString()
    inspected.push({
      ...item,
      sha256: sha(bytes),
      sourceCommits: sourceCommits.get(`${item.oid}:${item.sourcePath}`) ?? [],
      byteLength: bytes.length,
      identifiers: identifiers.filter((identifier) => text.includes(identifier)),
      standaloneG3: /\bG3\b/.test(text),
      qualifiedDigestMention: text.includes(
        '1a6085926ff5fd78cc81bb2fb6df8ceb9bc62660e3222bbe088e47807a91bb61',
      ),
    })
  }
  const g3 = inspected.filter(
    (item) =>
      item.identifiers.some((id) =>
        ['G3A', 'G3B', 'G3_EXECUTION_READINESS', 'g3-synthetic-runtime'].includes(id),
      ) ||
      /\/g3/i.test(item.sourcePath) ||
      item.qualifiedDigestMention,
  )
  const terminal = inspected.filter(
    (item) =>
      item.identifiers.includes('G2_TERMINAL_ROOT') || /g2.*terminal/i.test(item.sourcePath),
  )
  const source = inspected.filter((item) => item.sourcePath.includes('synthetic-health'))
  return {
    mission: 'NZ-20261008-INFRA-001',
    phase: 'G3R1',
    search: {
      refScope: 'ALL_LOCAL_REACHABLE_REFS;no fetch,reflog or dangling-object claim',
      totalReachableCommits: Number(gitRead(['rev-list', '--all', '--count']).toString()),
      revisions,
      bounds: { pathRevisions: 80, candidateObjects: 300, perBlobBytes: 2097152 },
      identifiers,
      candidateObjects: objects.length,
      inspectedBlobs: inspected.length,
      inspected,
    },
    FROZEN_G3_PACKAGE_GIT_HISTORY_RESULT: g3.length
      ? 'CANDIDATES_REQUIRE_AUTHORITY_ADJUDICATION'
      : 'NOT_FOUND',
    authorityMatches: g3,
    EXPECTED_G3_MODULES: 7,
    RECOVERED_G3_MODULES: 0,
    MISSING_G3_MODULES: {
      count: 7,
      exactPaths: null,
      reason:
        'Original seven path names are not in the supplied authority or searched committed evidence;require the seven-path manifest,not invented paths.',
    },
    CONTROLLER_AUTHORITY: 'NOT_FOUND',
    controllers: [],
    EXECUTION_STATUS: 'NOT_EXECUTED',
    SEALED_G2_TERMINAL_PACKET: terminal.length
      ? 'CANDIDATES_REQUIRE_TERMINAL_ADJUDICATION'
      : 'NOT_FOUND',
    terminalCandidates: terminal,
    QUALIFIED_IMAGE_SOURCE: 'BLOCKED',
    supportingSyntheticSource: source,
    supportingSourceInterpretation:
      'Historical Node and static Go health sources exist,but no exact G3 source-to-qualified-manifest binding is found. Neither is substituted for the frozen image or counted as a G3 module/controller.',
    recoveredArtifacts: [],
    extraction: 'NONE_NO_QUALIFYING_FROZEN_AUTHORITY_FOUND',
    historicalBytesChanged: false,
    workingTreeOverwrite: false,
    preservation: capturePreservation(),
  }
}
export function main(args) {
  assert(
    args.length === 1 && ['--write', '--check'].includes(args[0]),
    'RECOVERY_MANIFEST_FLAGS_ONLY',
  )
  const destination = path.join(evidence, 'G3R1_AUTHORITY_RECOVERY.json')
  const result = recoverAuthority()
  const bytes = `${JSON.stringify(result, null, 2)}\n`
  if (existsSync(destination)) {
    const original = JSON.parse(readFileSync(destination, 'utf8'))
    assert.deepEqual(
      original.preservation,
      result.preservation,
      'REFUSE_CHANGED_HISTORICAL_EVIDENCE',
    )
  }
  if (args[0] === '--write') writeFileSync(destination, bytes)
  else assert.equal(readFileSync(destination, 'utf8'), bytes, 'STALE_RECOVERY_MANIFEST')
  console.log(
    `Git recovery:${result.FROZEN_G3_PACKAGE_GIT_HISTORY_RESULT};${result.search.inspectedBlobs} blobs across ${result.search.revisions.length} path revisions;no checkout or historical rewrite.`,
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2))

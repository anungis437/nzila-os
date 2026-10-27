/** Reads the Gate 0C.3 sources, registers and rendered documents from disk and the accepted Gate 0C.2 commit. */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { compareCodeUnit } from './ue-gate0b1-classification.mjs'
import {
  ANCHOR_COMMIT,
  BASELINE_DECISIONS_FILE,
  CHALLENGES_FILE,
  CHALLENGE_ANCHOR_COMMIT,
  CHALLENGE_FLAG,
  CLASSIFICATION_FILE,
  DOCS_0C3,
  EXCEPTIONS_FILE,
  FILES_0C3,
  FLAG_SCAN_PATHS,
  HANDOFF_FILE,
  MATRIX_FILE,
  PRODUCT_DECISIONS_FILE,
  QUEUE_FILE,
  RATCHETS_FILE,
  RECONCILIATION_0C2_FILE,
  TRANCHE_FILES,
} from './ue-gate0c3-ids.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = (root, file) => JSON.parse(readFileSync(join(root, file), 'utf8'))
const shaFile = (root, file) => createHash('sha256').update(readFileSync(join(root, file))).digest('hex')
const git = (root, args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function citedFiles(value, out = new Set()) {
  if (Array.isArray(value)) for (const item of value) citedFiles(item, out)
  else if (value && typeof value === 'object') {
    if (typeof value.ref === 'string') out.add(value.ref)
    for (const item of Object.values(value)) citedFiles(item, out)
  }
  return out
}

const grepFiles = (root, args, prefix) =>
  (git(root, args) ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => (prefix && line.startsWith(prefix) ? line.slice(prefix.length) : line))
    .sort(compareCodeUnit)

/** Compares the source the two challenges cite, and every file that names the flag, between the challenge commit and the working tree. */
export function loadChallengeEvidence(root, challenges) {
  const cited = [...citedFiles(challenges.challenges)].sort(compareCodeUnit).map((file) => ({
    file,
    anchorBlob: git(root, ['rev-parse', `${CHALLENGE_ANCHOR_COMMIT}:${file}`]),
    liveBlob: existsSync(join(root, file)) ? git(root, ['hash-object', file]) : null,
  }))
  return {
    anchorCommit: CHALLENGE_ANCHOR_COMMIT,
    flag: CHALLENGE_FLAG,
    cited,
    flagFilesAtAnchor: grepFiles(root, ['grep', '-l', '-F', CHALLENGE_FLAG, CHALLENGE_ANCHOR_COMMIT, '--', ...FLAG_SCAN_PATHS], `${CHALLENGE_ANCHOR_COMMIT}:`),
    flagFilesLive: grepFiles(root, ['grep', '-l', '-F', CHALLENGE_FLAG, '--', ...FLAG_SCAN_PATHS]),
  }
}

export function loadSources(root = ROOT) {
  const challenges = readJson(root, CHALLENGES_FILE)
  const pinned = [CLASSIFICATION_FILE, QUEUE_FILE, CHALLENGES_FILE, EXCEPTIONS_FILE, HANDOFF_FILE, RATCHETS_FILE, BASELINE_DECISIONS_FILE, PRODUCT_DECISIONS_FILE, RECONCILIATION_0C2_FILE, ...TRANCHE_FILES]
  return {
    matrix: readJson(root, MATRIX_FILE),
    classification: readJson(root, CLASSIFICATION_FILE),
    queue: readJson(root, QUEUE_FILE),
    challenges,
    exceptions: readJson(root, EXCEPTIONS_FILE),
    handoff: readJson(root, HANDOFF_FILE),
    ratchets: readJson(root, RATCHETS_FILE),
    baselineDecisions: readJson(root, BASELINE_DECISIONS_FILE),
    productDecisions: readJson(root, PRODUCT_DECISIONS_FILE),
    reconciliation: readJson(root, RECONCILIATION_0C2_FILE),
    tranches: TRANCHE_FILES.map((file) => ({ file, ...readJson(root, file) })),
    fileSha: Object.fromEntries(pinned.map((file) => [file, shaFile(root, file)])),
    challengeEvidence: loadChallengeEvidence(root, challenges),
  }
}

export function loadRegisters(root = ROOT) {
  const get = (file) => (existsSync(join(root, file)) ? readJson(root, file) : null)
  return Object.fromEntries(Object.entries(FILES_0C3).map(([key, file]) => [key, get(file)]))
}

export function loadDocs(root = ROOT) {
  return Object.fromEntries(Object.values(DOCS_0C3).map((file) => [file, existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : null]))
}

export function loadFrozen(root = ROOT) {
  const show = (file) => JSON.parse(execFileSync('git', ['show', `${ANCHOR_COMMIT}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }))
  return {
    matrix: show(MATRIX_FILE),
    classification: show(CLASSIFICATION_FILE),
    queue: show(QUEUE_FILE),
    challenges: show(CHALLENGES_FILE),
    exceptions: show(EXCEPTIONS_FILE),
    handoff: show(HANDOFF_FILE),
  }
}

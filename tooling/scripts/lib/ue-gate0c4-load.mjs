/** Reads the Gate 0C.4 sources, registers and rendered documents from disk and from the accepted Gate 0C.3 commit. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOCS_0C3, FILES_0C3 } from './ue-gate0c3-ids.mjs'
import { loadRegisters as loadRegisters0c3, loadSources as loadBase } from './ue-gate0c3-load.mjs'
import { ANCHOR_0C3_COMMIT, CARBON_SERVICE_FILES, DOCS_0C4, FILES_0C4, MATRIX_FILE, PERSONA_PACKAGES, RETENTION_ROUTE, STRUCTURE_FILE } from './ue-gate0c4-ids.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = (root, file) => JSON.parse(readFileSync(join(root, file), 'utf8'))
const shaBytes = (bytes) => createHash('sha256').update(bytes).digest('hex')
const git = (root, args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}
const gitList = (root, args) => (git(root, args) ?? '').split('\n').filter(Boolean).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/** Reads application files from the working tree. Nothing here reads a Gate 0C.3 register. */
export function makeAppReader(root = ROOT) {
  return {
    read: (file) => (existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : null),
    sha: (file) => (existsSync(join(root, file)) ? shaBytes(readFileSync(join(root, file))) : null),
  }
}

const SCAN_PATHS = ['apps/union-eyes', 'infrastructure', '.github', 'vercel.json', 'package.json']
const IGNORED_SUFFIX = ['.md', '.snap', '.map']

/** Tracked files, outside documentation, that match a literal or an extended pattern. */
function trackedMatches(root, flags, pattern) {
  return gitList(root, ['grep', '-l', ...flags, pattern, '--', ...SCAN_PATHS]).filter((file) => !IGNORED_SUFFIX.some((suffix) => file.endsWith(suffix)))
}

export function loadGreps(root = ROOT) {
  return {
    carbonNames: trackedMatches(root, ['-i', '-E'], 'carbon[-_ ]?accounting|carbon_emissions|carbonEmissions'),
    carbonServiceImports: trackedMatches(root, ['-E'], 'carbon-accounting-(service|integration)'),
    retentionRouteReferences: trackedMatches(root, ['-F'], 'location-retention'),
    retentionRoute: RETENTION_ROUTE,
    carbonServiceFiles: CARBON_SERVICE_FILES,
  }
}

export function loadHistory(root = ROOT, extraFiles = []) {
  const show = (file) => git(root, ['show', `${ANCHOR_0C3_COMMIT}:${file}`])
  const registers = {}
  for (const [key, file] of Object.entries(FILES_0C3)) {
    const text = show(file)
    registers[key] = { file, text, sha256: text === null ? null : shaBytes(Buffer.from(text)), json: text === null ? null : JSON.parse(text) }
  }
  const docs = {}
  for (const file of Object.values(DOCS_0C3)) {
    const text = show(file)
    docs[file] = { text, sha256: text === null ? null : shaBytes(Buffer.from(text)) }
  }
  const matrixText = show(MATRIX_FILE)
  const fileSha = {}
  for (const file of extraFiles) {
    const text = show(file)
    fileSha[file] = text === null ? null : shaBytes(Buffer.from(text))
  }
  return { anchorCommit: ANCHOR_0C3_COMMIT, registers, docs, fileSha, matrix: matrixText === null ? null : JSON.parse(matrixText) }
}

export function loadSources(root = ROOT) {
  const base = loadBase(root)
  const registers = loadRegisters0c3(root)
  const registerSha = Object.fromEntries(Object.entries(FILES_0C3).map(([key, file]) => [key, shaBytes(readFileSync(join(root, file)))]))
  return {
    base,
    reg: registers,
    regSha: registerSha,
    history: loadHistory(root, Object.keys(base.fileSha ?? {})),
    persona: Object.fromEntries(Object.entries(PERSONA_PACKAGES).map(([persona, file]) => [persona, { file, sha256: shaBytes(readFileSync(join(root, file))), json: readJson(root, file) }])),
    structure: { file: STRUCTURE_FILE, sha256: shaBytes(readFileSync(join(root, STRUCTURE_FILE))), json: readJson(root, STRUCTURE_FILE) },
    app: makeAppReader(root),
    greps: loadGreps(root),
  }
}

export function loadRegisters(root = ROOT) {
  const get = (file) => (existsSync(join(root, file)) ? readJson(root, file) : null)
  return Object.fromEntries(Object.entries(FILES_0C4).map(([key, file]) => [key, get(file)]))
}

export function loadDocs(root = ROOT) {
  return Object.fromEntries(Object.values(DOCS_0C4).map((file) => [file, existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : null]))
}

/** Reads the Gate 0C.2 sources, registers and rendered documents from disk and the accepted Gate 0C.1 commit. */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { FILES_0C1 } from './ue-gate0c1-classification.mjs'
import { ANCHOR_COMMIT, BASELINE_FILES, DOCS_0C2, FILES_0C2, MATRIX_FILE, PERSONAS, RECOVERY_FILE } from './ue-gate0c2-ids.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = (root, file) => JSON.parse(readFileSync(join(root, file), 'utf8'))
const shaFile = (root, file) => createHash('sha256').update(readFileSync(join(root, file))).digest('hex')

export function loadSources(root = ROOT) {
  const baselines = Object.fromEntries(PERSONAS.map((persona) => [persona, readJson(root, BASELINE_FILES[persona])]))
  return {
    baselines,
    baselineDecisions: readJson(root, BASELINE_FILES.decisions),
    matrix: readJson(root, MATRIX_FILE),
    recovery: readJson(root, RECOVERY_FILE),
    classification: readJson(root, FILES_0C1.classification),
    baselineSha: Object.fromEntries(PERSONAS.map((persona) => [persona, shaFile(root, BASELINE_FILES[persona])])),
  }
}

export function loadRegisters(root = ROOT) {
  const get = (file) => (existsSync(join(root, file)) ? readJson(root, file) : null)
  return {
    preservation: get(FILES_0C2.preservation),
    structure: get(FILES_0C2.structure),
    reconciliation: get(FILES_0C2.reconciliation),
    decisions: get(FILES_0C2.decisions),
    packages: Object.fromEntries(PERSONAS.map((persona) => [persona, get(FILES_0C2[persona])])),
  }
}

export function loadDocs(root = ROOT) {
  return Object.fromEntries(Object.values(DOCS_0C2).map((file) => [file, existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : null]))
}

export function loadFrozen(root = ROOT) {
  const show = (file) => JSON.parse(execFileSync('git', ['show', `${ANCHOR_COMMIT}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }))
  return { matrix: show(MATRIX_FILE) }
}

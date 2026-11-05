/**
 * Builds the Gate 0C.3 reconciliation artifacts: the high-defect release assessment, the release-debt index, the OPL
 * challenge treatment, the carbon scope decision record, the decision index, the defect relationship map, the closure
 * model and the three review documents. Build order: ue-gate0-build-matrix.mjs, this script, then
 * ue-gate0-build-matrix.mjs again to pin the written files. With --check it writes nothing and fails when a file differs
 * from its regeneration.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOCS_0C3, FILES_0C3 } from './ue-gate0c3-ids.mjs'
import { loadSources } from './ue-gate0c3-load.mjs'
import { buildAll, serialize } from './ue-gate0c3-reconcile.mjs'
import { renderDocs } from './ue-gate0c3-render.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export function buildFiles(root = ROOT, src = loadSources(root)) {
  const all = buildAll(src)
  const files = Object.fromEntries(Object.keys(FILES_0C3).map((key) => [FILES_0C3[key], serialize(all[key])]))
  return Object.assign(files, renderDocs(all))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check')
  const files = buildFiles()
  const drift = []
  for (const [file, text] of Object.entries(files)) {
    const path = join(ROOT, file)
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null
    if (current === text) continue
    if (check) drift.push(file)
    else {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
    }
  }
  if (check && drift.length > 0) {
    console.error(`Gate 0C.3 artifacts differ from their regeneration:\n${drift.join('\n')}`)
    process.exit(1)
  }
  console.log(check ? `Gate 0C.3 artifacts are deterministic (${Object.keys(files).length} files).` : `Gate 0C.3 artifacts written (${Object.keys(files).length} files, ${Object.keys(DOCS_0C3).length} documents).`)
}

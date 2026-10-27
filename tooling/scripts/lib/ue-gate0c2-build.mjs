/**
 * Builds the Gate 0C.2 persona ratification-readiness artifacts: the identifier preservation register, the Steward
 * structure recommendation, the three decision packages, the requirement reconciliation, the product decision register
 * and the four review documents. Build order: ue-gate0-build-matrix.mjs, this script, then ue-gate0-build-matrix.mjs again
 * to pin the written files. With --check it writes nothing and fails when a file differs from its regeneration.
 *
 * A decision record that an authorized product owner has moved out of PROPOSED_FOR_RATIFICATION is preserved on rebuild:
 * only the outcome fields are carried over, and the validator rejects any outcome that lacks independent evidence.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOCS_0C2, FILES_0C2, PERSONAS } from './ue-gate0c2-ids.mjs'
import { buildAll, renderDocs, serialize } from './ue-gate0c2-readiness.mjs'
import { loadSources } from './ue-gate0c2-load.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export function buildFiles(root = ROOT) {
  const all = buildAll(loadSources(root))
  const existing = existsSync(join(root, FILES_0C2.decisions)) ? JSON.parse(readFileSync(join(root, FILES_0C2.decisions), 'utf8')) : null
  for (const record of all.decisions.records) {
    const prior = existing?.records?.find((item) => item.recordId === record.recordId)
    if (prior && prior.state !== record.state) Object.assign(record, { state: prior.state, approvalEvidence: prior.approvalEvidence, stateHistory: prior.stateHistory, ...(prior.returnReasons ? { returnReasons: prior.returnReasons } : {}) })
  }
  const files = {
    [FILES_0C2.preservation]: serialize(all.preservation),
    [FILES_0C2.structure]: serialize(all.structure),
    [FILES_0C2.reconciliation]: serialize(all.reconciliation),
    [FILES_0C2.decisions]: serialize(all.decisions),
  }
  for (const persona of PERSONAS) files[FILES_0C2[persona]] = serialize(all.packages[persona])
  Object.assign(files, renderDocs(all))
  return files
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
    console.error(`Gate 0C.2 artifacts differ from their regeneration:\n${drift.join('\n')}`)
    process.exit(1)
  }
  console.log(check ? `Gate 0C.2 artifacts are deterministic (${Object.keys(files).length} files).` : `Gate 0C.2 artifacts written (${Object.keys(files).length} files, ${Object.keys(DOCS_0C2).length} documents).`)
}

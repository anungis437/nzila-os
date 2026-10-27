/**
 * Builds the Gate 0B.1 tranche manifest, classification register, and ledger. The tranche is selected from the
 * ownership register at the anchor commit and then frozen: an existing manifest is verified, never regenerated.
 * Run after ue-gate0-build-matrix.mjs, then run the matrix builder again to pin the written files.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES_0B1, compareCodeUnit, selectTranche, trancheHash, validateClassification } from './ue-gate0b1-classification.mjs'
import { ANCHOR_COMMIT, TRANCHE_ID, TRANCHE_SIZE, CAPABILITY_DOMAINS } from './ue-gate0b1-groups.mjs'
import { GROUP_OF, DEFECTS, UNRESOLVED_FACTS, backfillFacts, billingFacts, clcReportFacts, crudFacts, ingestionFacts } from './ue-gate0b1-facts.mjs'
import { unauthenticatedFacts } from './ue-gate0b1-unauth-facts.mjs'
import { FILES } from './ue-gate0-scope-lock.mjs'
import { UNDECIDED_OWNER } from './ue-gate0-route-ownership.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const APP = 'apps/union-eyes/app/api/'

const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'))
const exists = (file) => existsSync(join(ROOT, file))
const readText = (file) => readFileSync(join(ROOT, file), 'utf8')

export function anchoredEntries(commit = ANCHOR_COMMIT) {
  const text = execFileSync('git', ['show', `${commit}:${FILES.ownership}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(text).entries
}

function stable(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writeIfChanged(file, text) {
  if (!existsSync(join(ROOT, file)) || readFileSync(join(ROOT, file), 'utf8') !== text) writeFileSync(join(ROOT, file), text)
}

export function buildClassification() {
  const anchored = anchoredEntries()
  const undecided = anchored.filter((entry) => entry[4] === 'SCOPE_UNDECIDED').map((entry) => `${entry[0]}|${entry[1]}`)
  const selected = selectTranche(undecided, TRANCHE_SIZE)
  const manifestPath = FILES_0B1.manifest
  let manifest
  if (exists(manifestPath)) {
    manifest = readJson(manifestPath)
    if (manifest.version === 1 && manifest.operations.join('\n') !== selected.join('\n')) {
      throw new Error('the frozen tranche manifest differs from the first 100 SCOPE_UNDECIDED operations at the anchor commit')
    }
  } else {
    manifest = {
      schemaVersion: 1,
      tranche: TRANCHE_ID,
      version: 1,
      size: TRANCHE_SIZE,
      selectionRule: 'The first 100 operations with disposition SCOPE_UNDECIDED in the ownership register at the anchor commit, in ascending code-unit order of the string "<route file>|<METHOD>".',
      anchorCommit: ANCHOR_COMMIT,
      operations: selected,
      operationsHash: trancheHash(selected),
      versionLog: [{ version: 1, date: '2026-10-26', operationsHash: trancheHash(selected), reason: 'Initial freeze of the Gate 0B.1 tranche from the anchored ownership register. No later addition, removal or reorder is allowed without a new version and reason.' }],
    }
  }

  const ownership = readJson(FILES.ownership)
  const entryByKey = new Map(ownership.entries.map((entry) => [`${entry[0]}|${entry[1]}`, entry]))
  const operations = []
  for (const id of manifest.operations) {
    const [route, method] = id.split('|')
    const entry = entryByKey.get(id)
    if (!entry) throw new Error(`tranche operation ${id} is not in the ownership register`)
    const group = GROUP_OF(route)
    let facts
    if (group === 'crud') facts = crudFacts(route, method)
    else if (group === 'billing') facts = billingFacts(route, method)
    else if (group === 'clc') facts = clcReportFacts(route)
    else if (group === 'ingestion') facts = ingestionFacts(route, method)
    else if (group === 'backfill') facts = backfillFacts()
    else {
      facts = UNRESOLVED_FACTS[id]
      if (!facts) throw new Error(`no source facts for unresolved operation ${id}`)
    }
    const classified = group !== 'unresolved'
    const record = {
      id,
      route,
      method,
      status: classified ? 'CLASSIFIED' : 'UNRESOLVED',
      capabilityId: classified ? entry[3] : UNDECIDED_OWNER,
      control: entry[5],
      manifestAudit: entry[6],
      ...facts,
    }
    if (classified) record.domain = facts.domain
    if (record.mutationAudit === 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC' && !record.evidence.some((item) => item.quote.includes('performAuditedOperation'))) {
      record.evidence = [...record.evidence, { ref: `${APP}${route}`, quote: 'performAuditedOperation' }]
    }
    for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
    for (const field of ['defects', 'manifestCorrections']) record[field] = record[field] ?? []
    operations.push(record)
  }

  const unauthenticated = []
  for (const entry of ownership.entries) {
    if (entry[5] !== 'NO_AUTHENTICATION_DECLARED' || ['RETIRED_501', 'STUB_501'].includes(entry[4])) continue
    const source = readText(`${APP}${entry[0]}`)
    const record = unauthenticatedFacts(entry[0], entry[1], source)
    record.inUnjustifiedCount = entry[4] !== 'SYSTEM'
    unauthenticated.push(record)
  }
  unauthenticated.sort((a, b) => compareCodeUnit(a.id, b.id))

  const hash = trancheHash(manifest.operations)
  const classification = {
    schemaVersion: 1,
    tranche: TRANCHE_ID,
    trancheVersion: manifest.version,
    operationsHash: hash,
    note: 'Source-evidenced classification of the Gate 0B.1 tranche. A classified operation names an existing capability whose business domain covers it. An unresolved operation stays SCOPE_UNDECIDED and carries a candidate for Gate 0B.2. Nothing here proves kernel authorization or an atomic audit unless the cited source shows it.',
    defects: DEFECTS,
    operations,
    unauthenticated,
  }
  const priorLedger = exists(FILES_0B1.ledger) ? readJson(FILES_0B1.ledger) : {}
  const ledger = {
    schemaVersion: 1,
    note: 'Cumulative record of operations classified in Gate 0 tranches and of each tranche version and hash. An operation listed here must never return to SCOPE_UNDECIDED.',
    anchorCommit: ANCHOR_COMMIT,
    ...priorLedger,
    tranches: { ...(priorLedger.tranches ?? {}), [TRANCHE_ID]: { version: manifest.version, operationsHash: hash } },
    classified: { ...(priorLedger.classified ?? {}), ...Object.fromEntries(operations.filter((record) => record.status === 'CLASSIFIED').map((record) => [record.id, record.capabilityId])) },
  }
  classification.summary = validateClassification({
    classification: { ...classification, summary: undefined },
    manifest,
    ledger,
    entries: ownership.entries,
    capabilityById: new Map(Object.keys(CAPABILITY_DOMAINS).map((id) => [id, { id }])),
    universe: new Set(ownership.entries.map((entry) => `${entry[0]}|${entry[1]}`)),
    exists,
    readText,
    anchoredEntries: anchored,
  })
  return { manifest, classification, ledger }
}

export function writeClassification() {
  const { manifest, classification, ledger } = buildClassification()
  const result = classification.summary
  if (result.problems.length > 0) throw new Error(`Gate 0B.1 classification has ${result.problems.length} problem(s):\n${result.problems.slice(0, 40).join('\n')}`)
  classification.summary = result.summary
  writeIfChanged(FILES_0B1.manifest, stable(manifest))
  writeIfChanged(FILES_0B1.classification, stable(classification))
  writeIfChanged(FILES_0B1.ledger, stable(ledger))
  return classification.summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeClassification(), null, 2))
}

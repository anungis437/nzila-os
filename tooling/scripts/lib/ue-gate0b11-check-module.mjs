/**
 * Authoring harness for one Gate 0B.11 domain module: builds every record the module authors for its operations of the
 * frozen selection, and runs the Gate 0B.11 record rules against the working tree with virtual ownership assigned from
 * the module groups. Usage: node ue-gate0b11-check-module.mjs <precedents-portal|reports|social-signatures|identity-support> [--json]
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { callerFindingOf, callersOf, loadApiReferences } from './ue-gate0b3-callers.mjs'
import { nonEmpty } from './ue-gate0b1-classification.mjs'
import { OPTIONS_0B11, validateRecord11 } from './ue-gate0b11-classification.mjs'
import { opAuthoring } from './ue-gate0b4-fact-helpers.mjs'
import { domainsForGroups } from './ue-gate0b11-groups.mjs'
import { releaseDispositionProblems } from './ue-gate0b7-release-dispositions.mjs'
import { riskCategoryProblems } from './ue-gate0b9-risk-screen.mjs'
import { crossTenantFlagProblems } from './ue-gate0b10-exposure.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'))
const exists = (file) => existsSync(join(ROOT, file))
const readText = (file) => readFileSync(join(ROOT, file), 'utf8')

const name = process.argv[2]
if (!name) throw new Error('usage: ue-gate0b11-check-module.mjs <precedents-portal|reports|social-signatures|identity-support>')
const module = await import(`./ue-gate0b11-${name}-facts.mjs`)
const selection = readFileSync('/tmp/ops0b11.txt', 'utf8').split('\n').filter(Boolean)
const ops = selection.filter((id) => module.ROUTES.has(id.split('|')[0]))

const groups = Object.entries(module.GROUPS).map(([key, group]) => ({ id: `RULE-0B11-${key.replaceAll('_', '-')}`, domainKey: key, ...group }))
const groupOf = (route, method) => groups.find((group) => group.routes.includes(route) && (!group.methods || group.methods.includes(method)))

const ownership = readJson('docs/union-eyes/convergence/register/ue-route-capability-ownership.json')
const entryByKey = new Map(ownership.entries.map((entry) => {
  const copy = [...entry]
  const group = groupOf(copy[0], copy[1])
  if (group && ops.includes(`${copy[0]}|${copy[1]}`)) {
    copy[2] = group.id
    copy[3] = group.capabilityId
    copy[4] = 'OWNED'
  }
  return [`${entry[0]}|${entry[1]}`, copy]
}))

const matrix = readJson('docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json')
const capabilityById = new Map(matrix.capabilities.map((capability) => [capability.id, capability]))
for (const record of module.CAPABILITIES ?? []) capabilityById.set(record.id, { id: record.id, primaryGate: record.primaryGate })
for (const other of ['precedents-portal', 'reports', 'social-signatures', 'identity-support']) {
  const sibling = await import(`./ue-gate0b11-${other}-facts.mjs`).catch(() => ({}))
  for (const record of sibling.CAPABILITIES ?? []) if (!capabilityById.has(record.id)) capabilityById.set(record.id, { id: record.id, primaryGate: record.primaryGate })
}
if (existsSync('/tmp/cap0b11-shared.json')) {
  for (const [id, primaryGate] of Object.entries(JSON.parse(readFileSync('/tmp/cap0b11-shared.json', 'utf8')))) if (!capabilityById.has(id)) capabilityById.set(id, { id, primaryGate })
}

const earlier = readJson('docs/union-eyes/convergence/register/ue-route-classification-0b10.json')
const defects = [...earlier.defectRegister.map((d) => d.id), ...(module.DEFECTS ?? []).map((d) => d.id)]
const decisionIds = new Set([...earlier.institutionalDecisions.map((d) => d.id), ...(module.DECISIONS ?? []).map((d) => d.id)])

const problems = []
for (const defect of module.DEFECTS ?? []) {
  const capability = capabilityById.get(defect.ownerCapabilityId)
  if (!capability) problems.push(`defect ${defect.id} names unknown capability ${defect.ownerCapabilityId}`)
  else if (capability.primaryGate !== defect.gate) problems.push(`defect ${defect.id} gate ${defect.gate} != ${defect.ownerCapabilityId} gate ${capability.primaryGate}`)
  if (!nonEmpty(defect.title, 20)) problems.push(`defect ${defect.id} title too short`)
  if (!defect.id.startsWith('DEF-0B11-')) problems.push(`defect ${defect.id} must start with DEF-0B11-`)
  problems.push(...releaseDispositionProblems({ ...defect, releaseBlocking: defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING' }, { exists, readText }))
}
for (const [key, group] of Object.entries(module.GROUPS)) {
  if (!capabilityById.has(group.capabilityId)) problems.push(`group ${key} names unknown capability ${group.capabilityId}`)
  for (const item of group.evidence ?? []) {
    if (!exists(item.ref)) problems.push(`group ${key} evidence ${item.ref} does not exist`)
    else if (item.quote && !readText(item.ref).includes(item.quote)) problems.push(`group ${key} evidence quote not in ${item.ref}: ${item.quote}`)
  }
}

const references = loadApiReferences(ROOT)
const ctx = { entryByKey, capabilityById, exists, readText, defectIds: new Set(defects), decisionIds, carry: new Set(), resolvedLater: new Set() }
const options = { ...OPTIONS_0B11, groups, domains: domainsForGroups(groups) }
const records = []
const covered = new Set()
for (const id of ops) {
  const [route, method] = id.split('|')
  const entry = entryByKey.get(id)
  const group = groupOf(route, method)
  if (!group) { problems.push(`${id}: no module group names it`); continue }
  let facts
  try {
    facts = module.facts(opAuthoring(id, readText, exists), readText)
  } catch (error) {
    problems.push(`${id}: facts failed: ${error.message}`)
    continue
  }
  const record = {
    id, route, method, status: 'CLASSIFIED', capabilityId: group.capabilityId, control: entry[5], manifestAudit: entry[6],
    kernelAuthorization: false, ...facts, domain: group.domain,
  }
  record.callers = callersOf(route, references)
  record.callerFinding = callerFindingOf(record.callers)
  record.institutionalDecisions = record.institutionalDecisions ?? []
  record.riskScreen = (module.RISK_SCREENS ?? {})[id] ?? {}
  for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key]
  for (const field of ['defects', 'manifestCorrections']) record[field] = record[field] ?? []
  records.push(record)
  covered.add(id)
  for (const problem of validateRecord11(record, ctx, options)) problems.push(problem)
  const newDefectById = new Map((module.DEFECTS ?? []).map((defect) => [defect.id, defect]))
  const withScreen = record
  for (const problem of riskCategoryProblems(withScreen, newDefectById, { exists, readText })) problems.push(problem)
  for (const problem of crossTenantFlagProblems(record, newDefectById)) problems.push(problem)
}
const cited = new Set(records.flatMap((record) => record.defects))
for (const defect of module.DEFECTS ?? []) if (!cited.has(defect.id)) problems.push(`defect ${defect.id} is not cited by any record of this module`)
for (const id of ops) if (!covered.has(id)) problems.push(`${id} was not classified`)

console.log(`${name}: ${ops.length} operations, ${records.length} records built, ${problems.length} problem(s)`)
for (const problem of problems.slice(0, 120)) console.log(`  - ${problem}`)
if (process.argv.includes('--json')) console.log(JSON.stringify(records, null, 2))
process.exit(problems.length === 0 ? 0 : 1)

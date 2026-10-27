/**
 * Gate 0 scope lock.
 *
 * Compares the completion matrix with the convergence register, the frozen
 * persona sources, the authority-kernel action list, the route-coverage
 * manifest, and the capability registry. It does not implement those obligations
 * and it does not weaken the convergence, route, or mutation ratchets.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRecovery } from './ue-gate0a-persona-recovery.mjs'
import { BASELINE_DATA } from './ue-gate0a2-baseline-facts.mjs'
import { sha256File, validateBaselines } from './ue-gate0a2-validate-baselines.mjs'
import { PERSONAS, computePersonaSpecs, personaActionsFromSpecs, validatePersonaCompleteness } from './ue-gate0-persona-spec.mjs'
import { UNDECIDED_OWNER, ownershipHash, validateRouteOwnership } from './ue-gate0-route-ownership.mjs'
import { evaluateRule } from './ue-convergence-check.mjs'
import { FILES_0B1, validateClassification } from './ue-gate0b1-classification.mjs'
import { ANCHOR_COMMIT } from './ue-gate0b1-groups.mjs'
import { FILES_0B2, validateClassification2 } from './ue-gate0b2-classification.mjs'
import { ANCHOR_COMMIT as ANCHOR_COMMIT_0B2 } from './ue-gate0b2-groups.mjs'
import { FILES_0B3, validateClassification3 } from './ue-gate0b3-classification.mjs'
import { ANCHOR_COMMIT as ANCHOR_COMMIT_0B3 } from './ue-gate0b3-groups.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export const SOURCE_STATUSES = [
  'NOT_IMPLEMENTED',
  'PARTIAL',
  'SOURCE_IMPLEMENTED',
  'SOURCE_VERIFIED',
  'NATIVE_PENDING',
  'EXTERNAL_GATE',
  'SOURCE_UNSPECIFIED',
]

export const QUALIFICATIONS = ['NOT_REQUIRED', 'PENDING', 'PASS']

export const REQUIRED_DISTINCT_IDS = [
  'UE-CAP-REVIEW-INTAKE',
  'UE-OMIT-M04-MEMBER-REQUESTS',
  'UE-OMIT-M04-LEGAL-DEADLINE',
  'UE-OMIT-DEADLINE-OVERDUE',
  'UE-OMIT-PRIVACY-RIGHTS',
  'UE-OMIT-MAIN-APP-CRONS',
  'UE-OMIT-A11Y-BILINGUAL',
  'UE-OMIT-FINANCE-UNAVAILABLE',
  'UE-OMIT-FINANCE-RANGE-UNSPECIFIED',
  'UE-OMIT-REP-CANONICAL-ABSENT',
  'UE-OMIT-DELIVERY-EVIDENCE',
]

const REQUIRED_FIELDS = [
  'businessOutcome',
  'actor',
  'auditEvidence',
  'privacyClassification',
  'notificationPolicy',
  'negativeAndRecovery',
  'gap',
]

export function routeBaselineHash(routes) {
  const lines = routes
    .map((route) => `${route.route}|${[].concat(route.methods).join(',')}|${route.guard}`)
    .sort()
  return createHash('sha256').update(lines.join('\n')).digest('hex')
}

export function kernelBaselineHash(actions) {
  return createHash('sha256').update([...actions].sort().join('\n')).digest('hex')
}

export function guardCounts(routes) {
  const counts = {}
  for (const route of routes) counts[route.guard] = (counts[route.guard] ?? 0) + 1
  return counts
}

export function extractKernelActions(ontologyText) {
  const block = ontologyText.split('export const ACTIONS = [')[1]?.split('] as const')[0] ?? ''
  return [...block.matchAll(/'([a-z]+:[a-z_]+)'/g)].map((m) => m[1])
}

function extractQuotedBlock(body, label) {
  const start = body.indexOf(label)
  if (start < 0) return ''
  const slice = body.slice(start)
  const arrayStart = slice.indexOf('[')
  if (arrayStart < 0) return ''
  let depth = 0
  let inQuote = false
  for (let i = arrayStart; i < slice.length; i++) {
    const ch = slice[i]
    if (ch === "'" && slice[i - 1] !== '\\') inQuote = !inQuote
    else if (!inQuote && ch === '[') depth += 1
    else if (!inQuote && ch === ']') {
      depth -= 1
      if (depth === 0) return slice.slice(arrayStart + 1, i)
    }
  }
  return ''
}

export function extractRegistryIds(registryText) {
  const records = []
  const pattern = /id: '(UE-(?:ACTION|CRON)-[^']+)'([\s\S]*?)\n  \},/g
  for (const match of registryText.matchAll(pattern)) {
    const body = match[2]
    const state = body.match(/state: '([^']+)'/)?.[1] ?? ''
    const owned = extractQuotedBlock(body, 'ownedBy:')
    const routes = [...owned.matchAll(/'([^']+)'/g)].map((item) => item[1])
    records.push({ id: match[1], state, routes })
  }
  return records
}

export function extractPersonaActions(root, options = {}) {
  return personaActionsFromSpecs(computePersonaSpecs(root, options))
}

function ownerIdFor(registerId) {
  return `UE-CAP-${registerId.replace(/^UE-CONV-/, '')}`
}

function gitCommitExists(sha) {
  try {
    execFileSync('git', ['cat-file', '-t', sha], { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function qualificationEvidenceOk(items, exists, readText) {
  if (!Array.isArray(items) || items.length === 0) return false
  return items.every((item) => {
    if (!item || item.result !== 'PASS' || typeof item.ref !== 'string' || !exists(item.ref)) return false
    const text = readText(item.ref)
    return !/describe\.skip|skipped run is not evidence|READY_FOR_VS_EXECUTION|not evidence/i.test(text)
  })
}

export const FILES = {
  matrix: 'docs/union-eyes/convergence/register/ue-pre-vs-engineering-completion.json',
  ownership: 'docs/union-eyes/convergence/register/ue-route-capability-ownership.json',
  lock: 'docs/union-eyes/convergence/register/ue-gate0-capability-lock.json',
  evidence: 'docs/union-eyes/convergence/evidence/gate0-source-verification.json',
}

function readJsonIfPresent(root, file) {
  const path = join(root, file)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function gitBlob(root, path) {
  try {
    return git(root, ['rev-parse', `HEAD:${path}`]).trim()
  } catch {
    return null
  }
}

function anchoredCapabilityIds(root, lock) {
  if (!lock?.anchorCommit) return null
  try {
    const text = git(root, ['show', `${lock.anchorCommit}:${lock.anchorMatrixPath ?? FILES.matrix}`])
    return JSON.parse(text).capabilities.map((capability) => capability.id)
  } catch {
    return null
  }
}

function anchoredPersonaFloor(root, recovery) {
  const anchor = recovery?.universeFloorAnchor
  if (!anchor?.commit) return null
  try {
    const matrix = JSON.parse(git(root, ['show', `${anchor.commit}:${anchor.path ?? FILES.matrix}`]))
    return Object.fromEntries(matrix.personaCompleteness.map((entry) => [entry.persona, entry.universe]))
  } catch {
    return null
  }
}

function anchoredOwnershipEntries(root, commit = ANCHOR_COMMIT) {
  try {
    return JSON.parse(git(root, ['show', `${commit}:${FILES.ownership}`])).entries
  } catch {
    return null
  }
}

function routeDefectProblems(matrix, classification) {
  const register = classification?.defectRegister
  if (!Array.isArray(register)) return []
  const recorded = matrix?.routeDefects
  if (!Array.isArray(recorded)) return ['ROUTE-DEFECTS-ABSENT: the matrix records no routeDefects block']
  const out = []
  const byId = new Map(recorded.map((item) => [item.id, item]))
  for (const defect of register) {
    const item = byId.get(defect.id)
    if (!item) out.push(`ROUTE-DEFECT-MISSING: ${defect.id} is not in the engineering completion matrix`)
    else if (item.ownerCapabilityId !== defect.ownerCapabilityId || item.gate !== defect.gate || item.releaseBlocking !== defect.releaseBlocking) {
      out.push(`ROUTE-DEFECT-DRIFT: ${defect.id} does not match its owner, gate or release-blocking mark in the classification`)
    }
  }
  for (const item of recorded) if (!register.some((defect) => defect.id === item.id)) out.push(`ROUTE-DEFECT-UNKNOWN: ${item.id} is not in the classification defect register`)
  return out
}

function classificationPinProblems(matrix, root) {
  return [
    ...pinProblems(matrix?.routeClassification, 'routeClassification', FILES_0B1, root),
    ...pinProblems(matrix?.routeClassification0b2, 'routeClassification0b2', FILES_0B2, root),
    ...pinProblems(matrix?.routeClassification0b3, 'routeClassification0b3', FILES_0B3, root),
  ]
}

function pinProblems(record, name, files, root) {
  if (!record) return [`CLASSIFICATION-PIN-ABSENT: the matrix records no ${name} block`]
  const out = []
  for (const [key, file] of Object.entries(files)) {
    const entry = record.files?.[key]
    if (!entry || entry.file !== file) {
      out.push(`CLASSIFICATION-PIN-FILE: ${key} is not recorded at ${file}`)
      continue
    }
    try {
      if (sha256File(root, file) !== entry.sha256) out.push(`CLASSIFICATION-PIN-HASH: ${file} no longer matches the hash recorded in the matrix`)
    } catch {
      out.push(`CLASSIFICATION-PIN-FILE: ${file} is unreadable`)
    }
  }
  return out
}

function currentRatchetFailures(root) {
  const ratchets = JSON.parse(readFileSync(join(root, 'docs/union-eyes/convergence/register/ue-convergence-ratchets.json'), 'utf8'))
  const failures = []
  for (const rule of ratchets.rules) {
    const args = ['grep', '-l', '-I', '-E']
    if (rule.ignoreCase) args.push('-i')
    args.push(rule.pattern, '--', ...rule.paths, ...(rule.exclude ?? []).map((glob) => `:(exclude,glob)${glob}`))
    let files = []
    try {
      files = git(root, args).split('\n').map((item) => item.trim()).filter(Boolean)
    } catch (error) {
      if (error.status !== 1) throw error
    }
    for (const problem of evaluateRule(rule, files).problems) {
      const match = problem.match(/^([A-Z0-9-]+): unexpected occurrence in (\S+)/)
      if (match) failures.push({ ruleId: match[1], file: match[2], message: problem })
    }
  }
  return failures
}

function diskRouteKeys(root) {
  const files = git(root, ['ls-files', 'apps/union-eyes/app/api']).split('\n').filter((file) => file.endsWith('/route.ts'))
  return files.map((file) => file.replace('apps/union-eyes/app/api/', ''))
}

export function loadContext(root = ROOT) {
  const register = JSON.parse(readFileSync(join(root, 'docs/union-eyes/convergence/register/ue-convergence-register.json'), 'utf8'))
  const manifest = JSON.parse(readFileSync(join(root, 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json'), 'utf8'))
  const batches = JSON.parse(readFileSync(join(root, 'docs/union-eyes/convergence/register/ue-schema-mutation-batches.json'), 'utf8'))
  const ontology = readFileSync(join(root, 'apps/union-eyes/lib/authority/ontology.ts'), 'utf8')
  const registry = readFileSync(join(root, 'apps/union-eyes/lib/reality/capability-registry.ts'), 'utf8')
  const lock = readJsonIfPresent(root, FILES.lock)
  const personaSpecs = computePersonaSpecs(root)
  return {
    root,
    registerEntries: register.entries.map((entry) => ({
      id: entry.id,
      status: entry.status,
      externalGate: entry.externalGate ?? null,
    })),
    personaSpecs,
    personaFloor: anchoredPersonaFloor(root, loadRecovery(root)),
    personaActions: personaActionsFromSpecs(personaSpecs),
    routes: manifest.routes,
    routeSummaryCount: manifest.summary.routes,
    diskRouteKeys: diskRouteKeys(root),
    kernelActions: extractKernelActions(ontology),
    censusCount: batches.censusCount,
    registryActions: extractRegistryIds(registry),
    ownership: readJsonIfPresent(root, FILES.ownership),
    tranche0b1: readJsonIfPresent(root, FILES_0B1.manifest),
    classification0b1: readJsonIfPresent(root, FILES_0B1.classification),
    ledger0b1: readJsonIfPresent(root, FILES_0B1.ledger),
    tranche0b2: readJsonIfPresent(root, FILES_0B2.manifest),
    classification0b2: readJsonIfPresent(root, FILES_0B2.classification),
    tranche0b3: readJsonIfPresent(root, FILES_0B3.manifest),
    classification0b3: readJsonIfPresent(root, FILES_0B3.classification),
    anchoredOwnershipEntries: anchoredOwnershipEntries(root),
    anchoredOwnershipEntries0b2: anchoredOwnershipEntries(root, ANCHOR_COMMIT_0B2),
    anchoredOwnershipEntries0b3: anchoredOwnershipEntries(root, ANCHOR_COMMIT_0B3),
    lock,
    anchorCapabilityIds: anchoredCapabilityIds(root, lock),
    evidence: readJsonIfPresent(root, FILES.evidence),
    ratchetFailures: currentRatchetFailures(root),
  }
}

function proposedBaselineProblems(matrix, root, ctx) {
  if ('baselineProblems' in ctx) return ctx.baselineProblems
  const out = []
  const record = matrix?.proposedPersonaBaselines
  if (!record) return ['PROPOSED-BASELINES-ABSENT: the matrix records no proposedPersonaBaselines block']
  if (record.status !== 'READY_FOR_PRODUCT_SPECIFICATION_REVIEW') out.push(`PROPOSED-BASELINES-STATUS: status is ${JSON.stringify(record.status)}`)
  if (record.adopted !== false || record.frozen !== false || record.originalRecovered !== false) out.push('PROPOSED-BASELINES-ADOPTED: a proposed baseline is recorded as adopted, frozen, or recovered')
  for (const [key, file] of Object.entries(BASELINE_DATA)) {
    const entry = record.data?.[key]
    if (!entry || entry.file !== file) {
      out.push(`PROPOSED-BASELINES-FILE: ${key} is not recorded at ${file}`)
      continue
    }
    try {
      if (sha256File(root, file) !== entry.sha256) out.push(`PROPOSED-BASELINES-HASH: ${file} no longer matches the hash recorded in the matrix`)
    } catch {
      out.push(`PROPOSED-BASELINES-FILE: ${file} is unreadable`)
    }
  }
  for (const persona of matrix?.personaCompleteness ?? []) {
    if (['steward', 'representative', 'financial-officer'].includes(persona.persona) && persona.resolved === true) out.push(`PROPOSED-BASELINES-RESOLVED: ${persona.persona} is marked resolved by a proposed baseline`)
  }
  out.push(...validateBaselines(root, { matrix }).problems)
  return out
}

export function validateGate0(matrix, ctx = {}) {
  const problems = []
  const base = ctx.base ?? loadContext(ctx.root ?? ROOT)
  const exists = ctx.exists ?? ((file) => existsSync(join(base.root, file)))
  const readText = ctx.readText ?? ((file) => readFileSync(join(base.root, file), 'utf8'))
  const commitExists = ctx.commitExists ?? gitCommitExists
  const registerEntries = ctx.registerEntries ?? base.registerEntries
  const personaActions = ctx.personaActions ?? base.personaActions
  const personaSpecs = ctx.personaSpecs ?? base.personaSpecs
  const evidence = 'evidence' in ctx ? ctx.evidence : base.evidence
  const blobFor = ctx.blobFor ?? ((path) => gitBlob(base.root, path))
  const routes = ctx.routes ?? base.routes
  const kernelActions = ctx.kernelActions ?? base.kernelActions
  const registryActions = ctx.registryActions ?? base.registryActions
  const censusCount = ctx.censusCount ?? base.censusCount
  const routeSummaryCount = ctx.routeSummaryCount ?? base.routeSummaryCount

  if (!matrix || matrix.schemaVersion !== 1) problems.push('matrix schemaVersion must be 1')
  if (!/^[0-9a-f]{40}$/.test(matrix?.evaluatedBaselineSha ?? '') || !commitExists(matrix.evaluatedBaselineSha)) {
    problems.push('evaluated baseline SHA does not exist')
  }
  const capabilities = Array.isArray(matrix?.capabilities) ? matrix.capabilities : []
  const byId = new Map()
  const obligationOwners = new Map()
  for (const capability of capabilities) {
    if (byId.has(capability.id)) problems.push(`duplicate capability id ${capability.id}`)
    byId.set(capability.id, capability)
    if (!capability.obligationKey) problems.push(`${capability.id} has no obligationKey`)
    else if (obligationOwners.has(capability.obligationKey)) {
      problems.push(`conflicting primary ownership of ${capability.obligationKey}: ${obligationOwners.get(capability.obligationKey)} and ${capability.id}`)
    } else obligationOwners.set(capability.obligationKey, capability.id)

    if (!SOURCE_STATUSES.includes(capability.sourceStatus)) problems.push(`${capability.id} has an invalid sourceStatus`)
    if (!QUALIFICATIONS.includes(capability.nativeQualification) || !QUALIFICATIONS.includes(capability.browserQualification)) {
      problems.push(`${capability.id} has an invalid qualification`)
    }
    for (const field of REQUIRED_FIELDS) {
      if (typeof capability[field] !== 'string' || capability[field].trim() === '') problems.push(`${capability.id} requires ${field}`)
    }
    const gate = capability.primaryGate
    const schemaGate = gate === 'schema-census'
    const numbered = Number.isInteger(gate) && gate >= 1 && gate <= 15
    if (!schemaGate && !numbered) problems.push(`${capability.id} points at an invalid gate`)
    if (schemaGate && capability.registerImplementationOwner !== true) problems.push(`${capability.id} uses schema-census without owning UE-CONV-H-007`)
    if (Array.isArray(capability.dependencyGates)) {
      for (const dependency of capability.dependencyGates) {
        if (!Number.isInteger(dependency) || dependency < 1 || dependency > 15) problems.push(`${capability.id} has an invalid dependency gate`)
      }
    }
    const files = Array.isArray(capability.sourceFiles) ? capability.sourceFiles : []
    const tests = Array.isArray(capability.sourceTests) ? capability.sourceTests : []
    if (['SOURCE_IMPLEMENTED', 'NATIVE_PENDING', 'SOURCE_VERIFIED'].includes(capability.sourceStatus)) {
      if (files.length === 0) problems.push(`${capability.id} claims source implementation without source files`)
      for (const file of files) if (!exists(file)) problems.push(`${capability.id} source file does not exist: ${file}`)
    }
    if (capability.sourceStatus === 'NOT_IMPLEMENTED' && files.length > 0) {
      problems.push(`${capability.id} is NOT_IMPLEMENTED but cites source files`)
    }
    if (capability.sourceStatus === 'SOURCE_VERIFIED') {
      if (tests.length === 0) problems.push(`${capability.id} is SOURCE_VERIFIED without test evidence`)
      for (const file of tests) if (!exists(file)) problems.push(`${capability.id} test evidence does not exist: ${file}`)
      problems.push(...executionEvidenceProblems(capability, evidence, { exists, readText, commitExists, blobFor }))
    }
    if (!Array.isArray(capability.trackedDefects ?? [])) problems.push(`${capability.id} trackedDefects must be an array`)
    for (const file of capability.sourceStatus === 'PARTIAL' ? files : []) {
      if (!exists(file)) problems.push(`${capability.id} cited source file does not exist: ${file}`)
    }
    for (const file of capability.sourceStatus === 'PARTIAL' ? tests : []) {
      if (!exists(file)) problems.push(`${capability.id} cited test does not exist: ${file}`)
    }
    if (capability.sourceStatus === 'NATIVE_PENDING' && capability.nativeQualification !== 'PENDING') {
      problems.push(`${capability.id} is NATIVE_PENDING but native qualification is not PENDING`)
    }
    if (capability.sourceStatus === 'EXTERNAL_GATE') {
      const gate = capability.externalDependency
      if (!gate || !gate.owner || !gate.missingProof || gate.operationallyActivated !== false) {
        problems.push(`${capability.id} EXTERNAL_GATE must name an owner and missing proof and stay inactive`)
      }
      if (capability.operationallyActivated === true) problems.push(`${capability.id} EXTERNAL_GATE is marked operationally activated`)
    }
    if (capability.operationallyActivated === true) problems.push(`${capability.id} is marked operationally activated`)
    if (capability.nativeQualification === 'PASS' && !qualificationEvidenceOk(capability.nativeRuntimeEvidence, exists, readText)) {
      problems.push(`${capability.id} native PASS has no recorded runtime evidence`)
    }
    if (capability.browserQualification === 'PASS' && !qualificationEvidenceOk(capability.browserRuntimeEvidence, exists, readText)) {
      problems.push(`${capability.id} browser PASS has no recorded runtime evidence`)
    }
    for (const proof of capability.proof ?? []) {
      if (proof.type === 'commit' && !commitExists(proof.ref)) problems.push(`${capability.id} proof commit does not exist: ${proof.ref}`)
      if (proof.type === 'test' && !exists(proof.ref)) problems.push(`${capability.id} proof test does not exist: ${proof.ref}`)
      if (proof.type === 'path' && !exists(proof.ref)) problems.push(`${capability.id} proof path does not exist: ${proof.ref}`)
    }
  }

  const owners = new Map()
  for (const capability of capabilities) {
    if (capability.registerImplementationOwner !== true) continue
    const registerId = capability.parentRegisterId
    if (owners.has(registerId)) problems.push(`conflicting register ownership of ${registerId}`)
    owners.set(registerId, capability)
  }
  for (const entry of registerEntries) {
    const owner = owners.get(entry.id)
    if (!owner) problems.push(`register entry ${entry.id} has no completion-matrix coverage`)
    else if (owner.id !== ownerIdFor(entry.id)) problems.push(`register entry ${entry.id} owner id must be ${ownerIdFor(entry.id)}`)
    if (entry.status === 'EXTERNAL_GATE') {
      if (!owner || owner.sourceStatus !== 'EXTERNAL_GATE' || owner.operationallyActivated === true) {
        problems.push(`${entry.id} is an EXTERNAL_GATE represented as engineering-complete or operationally activated`)
      }
    }
  }

  const seenActions = new Set()
  const mappings = Array.isArray(matrix?.personaActions) ? matrix.personaActions : []
  const mapped = new Map()
  for (const mapping of mappings) {
    const key = `${mapping.source}|${mapping.actionId}`
    if (seenActions.has(key)) problems.push(`conflicting persona ownership of ${mapping.actionId} in ${mapping.source}`)
    seenActions.add(key)
    if (!byId.has(mapping.capabilityId)) problems.push(`persona action ${mapping.actionId} maps to an unknown capability`)
    mapped.set(key, mapping.capabilityId)
  }
  for (const action of personaActions) {
    const key = `${action.source}|${action.actionId}`
    if (!mapped.has(key)) problems.push(`mandatory persona action ${action.actionId} in ${action.source} has no mapped capability`)
    const mapping = mappings.find((item) => item.source === action.source && item.actionId === action.actionId)
    if (mapping && action.definition && mapping.definition !== action.definition) {
      problems.push(`persona action ${action.actionId} is recorded as ${mapping.definition} but its source defines it as ${action.definition}`)
    }
  }
  const personaFloor = ctx.personaFloor === undefined ? base.personaFloor : ctx.personaFloor
  if (!personaFloor) problems.push('the persona universe floor cannot be read from its anchor commit')
  const personaCheck = validatePersonaCompleteness(matrix, personaSpecs, byId, personaFloor)
  problems.push(...personaCheck.problems)
  problems.push(...proposedBaselineProblems(matrix, base.root, ctx))

  const liveHash = routeBaselineHash(routes)
  const liveGuards = guardCounts(routes)
  if (matrix?.routeBaseline?.hash !== liveHash) problems.push('route baseline does not match the route-coverage manifest')
  if (matrix?.routeBaseline?.routeCount !== routes.length || routeSummaryCount !== routes.length) {
    problems.push('route baseline count does not match the manifest inventory')
  }
  for (const [guard, count] of Object.entries(liveGuards)) {
    if (matrix?.routeBaseline?.guardCounts?.[guard] !== count) problems.push(`route guard ${guard} count moved without a matrix update`)
    const assigned = matrix?.routeBaseline?.guardAssignments?.[guard]
    if (!byId.has(assigned)) problems.push(`route guard ${guard} has no capability assignment`)
  }

  const liveKernel = kernelBaselineHash(kernelActions)
  if (matrix?.kernelBaseline?.hash !== liveKernel) problems.push('kernel action baseline does not match ontology.ts')
  for (const action of kernelActions) {
    const assigned = matrix?.kernelActionAssignments?.[action]
    if (!byId.has(assigned)) problems.push(`kernel action ${action} has no capability assignment`)
  }
  for (const action of Object.keys(matrix?.kernelActionAssignments ?? {})) {
    if (!kernelActions.includes(action)) problems.push(`kernel assignment ${action} is not in ontology.ts`)
  }

  for (const item of matrix?.outOfScope ?? []) {
    if (!item?.id || typeof item.reason !== 'string' || item.reason.trim().length < 20 || !item.evidence) {
      problems.push(`out-of-scope record ${item?.id ?? '(missing id)'} needs a reason and evidence`)
    }
  }

  const stubAssignments = matrix?.stubActionAssignments ?? {}
  const scopeIds = new Set((matrix?.outOfScope ?? []).map((item) => item.id))
  for (const record of registryActions) {
    const target = stubAssignments[record.id]
    const known = byId.has(target) || scopeIds.has(target)
    if (!known) problems.push(`registry action ${record.id} has no matrix assignment`)
    if (record.id.startsWith('UE-ACTION-') && record.id !== 'UE-ACTION-ORG-HIERARCHY-SEED' && record.state === 'NOT_IMPLEMENTED') {
      const declared = new Set(byId.get('UE-CAP-H-002')?.scopedRoutes ?? [])
      for (const route of record.routes) {
        if (!declared.has(route)) problems.push(`stub route ${route} is not on UE-CAP-H-002`)
        if (!exists(`apps/union-eyes/${route}`)) problems.push(`stub route file does not exist: apps/union-eyes/${route}`)
      }
    }
  }

  const censusOwners = capabilities.filter((capability) => capability.schemaCensus === true)
  if (censusOwners.length !== 1) problems.push('UE-CONV-H-007 must remain exactly one schema-census capability')
  const census = censusOwners[0]
  if (census) {
    if (census.parentRegisterId !== 'UE-CONV-H-007' || census.censusCount !== censusCount || census.individuallyReclassified !== false) {
      problems.push('schema census capability does not match the batch manifest or was individually reclassified')
    }
    if (census.primaryGate !== 'schema-census') problems.push('schema census capability must keep the schema-census gate')
  }
  const censusChildren = capabilities.filter((capability) => capability.parentRegisterId === 'UE-CONV-H-007' && capability.schemaCensus !== true)
  if (censusChildren.length > 0) problems.push('schema census entries must not be individually reclassified')

  const locked = new Set(matrix?.lockedCapabilityIds ?? [])
  const dispositions = new Map((matrix?.dispositions ?? []).map((item) => [item.capabilityId, item]))
  for (const capability of capabilities) {
    if (!locked.has(capability.id)) problems.push(`${capability.id} is not in the versioned capability lock`)
  }
  for (const id of locked) {
    if (byId.has(id)) continue
    const disposition = dispositions.get(id)
    if (!disposition || !Number.isInteger(disposition.schemaVersion) || typeof disposition.reason !== 'string' || disposition.reason.trim().length < 20 || !disposition.evidence) {
      problems.push(`mandatory capability ${id} disappeared without a versioned disposition`)
    }
  }
  for (const id of REQUIRED_DISTINCT_IDS) {
    if (byId.has(id)) continue
    const disposition = dispositions.get(id)
    if (!disposition || disposition.schemaVersion < 2) problems.push(`required capability ${id} disappeared without a versioned disposition`)
  }

  const lock = 'lock' in ctx ? ctx.lock : base.lock
  const anchorIds = 'anchorCapabilityIds' in ctx ? ctx.anchorCapabilityIds : base.anchorCapabilityIds
  problems.push(...independentLockProblems(byId, lock, anchorIds, { exists, commitExists }))

  const ownership = 'ownership' in ctx ? ctx.ownership : base.ownership
  const classificationCheck = ownership
    ? validateClassification({
        classification: 'classification0b1' in ctx ? ctx.classification0b1 : base.classification0b1,
        manifest: 'tranche0b1' in ctx ? ctx.tranche0b1 : base.tranche0b1,
        ledger: 'ledger0b1' in ctx ? ctx.ledger0b1 : base.ledger0b1,
        entries: ownership.entries ?? [],
        capabilityById: byId,
        universe: new Set(routes.flatMap((route) => [].concat(route.methods).map((method) => `${route.route}|${method}`))),
        exists,
        readText,
        anchoredEntries: 'anchoredOwnershipEntries' in ctx ? ctx.anchoredOwnershipEntries : base.anchoredOwnershipEntries,
      })
    : { problems: ['route classification cannot be validated without the ownership register'], justifiedUnauthenticated: new Set(), blockers: [], summary: null }
  problems.push(...classificationCheck.problems)
  const classification0b2 = 'classification0b2' in ctx ? ctx.classification0b2 : base.classification0b2
  const check0b2 = ownership
    ? validateClassification2({
        classification: classification0b2,
        manifest: 'tranche0b2' in ctx ? ctx.tranche0b2 : base.tranche0b2,
        ledger: 'ledger0b1' in ctx ? ctx.ledger0b1 : base.ledger0b1,
        classification0b1: 'classification0b1' in ctx ? ctx.classification0b1 : base.classification0b1,
        manifest0b1: 'tranche0b1' in ctx ? ctx.tranche0b1 : base.tranche0b1,
        entries: ownership.entries ?? [],
        capabilityById: byId,
        universe: new Set(routes.flatMap((route) => [].concat(route.methods).map((method) => `${route.route}|${method}`))),
        exists,
        readText,
        anchoredEntries: 'anchoredOwnershipEntries0b2' in ctx ? ctx.anchoredOwnershipEntries0b2 : base.anchoredOwnershipEntries0b2,
      })
    : { problems: ['Gate 0B.2 route classification cannot be validated without the ownership register'], registeredReleaseBlocking: new Set(), releaseBlockingDefects: [], summary: null }
  problems.push(...check0b2.problems)
  const classification0b3 = 'classification0b3' in ctx ? ctx.classification0b3 : base.classification0b3
  const check0b3 = ownership
    ? validateClassification3({
        classification: classification0b3,
        manifest: 'tranche0b3' in ctx ? ctx.tranche0b3 : base.tranche0b3,
        ledger: 'ledger0b1' in ctx ? ctx.ledger0b1 : base.ledger0b1,
        classification0b1: 'classification0b1' in ctx ? ctx.classification0b1 : base.classification0b1,
        classification0b2,
        manifest0b1: 'tranche0b1' in ctx ? ctx.tranche0b1 : base.tranche0b1,
        manifest0b2: 'tranche0b2' in ctx ? ctx.tranche0b2 : base.tranche0b2,
        entries: ownership.entries ?? [],
        capabilityById: byId,
        universe: new Set(routes.flatMap((route) => [].concat(route.methods).map((method) => `${route.route}|${method}`))),
        exists,
        readText,
        anchoredEntries: 'anchoredOwnershipEntries0b3' in ctx ? ctx.anchoredOwnershipEntries0b3 : base.anchoredOwnershipEntries0b3,
      })
    : { problems: ['Gate 0B.3 route classification cannot be validated without the ownership register'], registeredReleaseBlocking: new Set(), releaseBlockingDefects: [], summary: null }
  problems.push(...check0b3.problems)
  problems.push(...routeDefectProblems(matrix, classification0b3))
  problems.push(...('classificationPinProblems' in ctx ? ctx.classificationPinProblems : classificationPinProblems(matrix, base.root)))
  const routeCheck = validateRouteOwnership({
    justifiedUnauthenticated: classificationCheck.justifiedUnauthenticated,
    ownership,
    capabilityById: byId,
    routes,
    diskRouteKeys: ctx.diskRouteKeys ?? base.diskRouteKeys,
    scopeIds,
    registerIds: new Set(registerEntries.map((entry) => entry.id)),
    registryIds: new Set(registryActions.map((record) => record.id)),
    exists,
    readText,
  })
  problems.push(...routeCheck.problems)
  if (ownership && matrix?.routeOwnership?.entriesHash !== ownershipHash(ownership.entries ?? [])) {
    problems.push('route ownership entries do not match the hash recorded in the matrix')
  }
  if (!byId.has(UNDECIDED_OWNER)) problems.push(`route ownership requires the capability ${UNDECIDED_OWNER}`)

  const ratchetFailures = ctx.ratchetFailures ?? base.ratchetFailures
  const debt = defectProblems(capabilities, ratchetFailures, evidence, { exists, readText })
  problems.push(...debt.problems)

  const exposureBlocked = (blocker) => blocker.code === 'ROUTE_UNJUSTIFIED_EXPOSURE' && blocker.operations.every((operation) => check0b3.registeredReleaseBlocking.has(operation))
  const releaseBlocking = check0b3.releaseBlockingDefects.map((item) => ({
    capabilityId: item.ownerCapabilityId,
    id: item.defectId,
    kind: 'RELEASE_BLOCKING_ROUTE_EXPOSURE',
    file: item.operation,
    blocksGates: [item.gate],
    releaseBlocking: true,
  }))
  const blockers = [...personaCheck.blockers, ...routeCheck.blockers, ...classificationCheck.blockers.filter((blocker) => !exposureBlocked(blocker))]
  const gateAcceptanceBlockers = [...debt.open, ...(classificationCheck.blockers.some(exposureBlocked) ? releaseBlocking : [])]
  const verdict = blockers.length > 0 ? 'IN_PROGRESS' : 'READY_FOR_ADVERSARIAL_REVIEW'
  if (matrix?.gate0Verdict !== verdict) {
    problems.push(`gate0Verdict is ${JSON.stringify(matrix?.gate0Verdict)} but ${blockers.length} Gate 0 blocker(s) ${blockers.length > 0 ? 'remain, so it must be IN_PROGRESS' : 'are absent, so it must be READY_FOR_ADVERSARIAL_REVIEW'}`)
  }

  const summary = summarize(matrix, registerEntries, personaActions, problems)
  summary.verdict = verdict
  summary.route = routeCheck.summary
  summary.classification0b1 = classificationCheck.summary
  summary.classification0b2 = check0b2.summary
  summary.classification0b3 = check0b3.summary
  summary.persona = Object.fromEntries(PERSONAS.map((persona) => {
    const spec = personaSpecs[persona]
    return [persona, { identifiers: spec.universe.length, individuallyDefined: spec.individuallyDefined.length, groupedOnly: spec.groupedOnly.length, unspecified: spec.unspecified.length, canonicalFileFound: spec.canonicalFileFound, resolved: spec.resolved }]
  }))
  return { problems, blockers, gateAcceptanceBlockers, summary, routeExceptions: routeCheck.exceptions }
}

export function evidenceDeps(root = ROOT) {
  return {
    exists: (file) => existsSync(join(root, file)),
    readText: (file) => readFileSync(join(root, file), 'utf8'),
    commitExists: gitCommitExists,
    blobFor: (path) => gitBlob(root, path),
  }
}

export function executionEvidenceProblems(capability, evidence, deps) {
  const label = `${capability.id} is SOURCE_VERIFIED without execution evidence`
  const records = (evidence?.records ?? []).filter((record) => record.capabilityId === capability.id)
  if (records.length === 0) return [label]
  const failures = []
  for (const record of records) {
    const why = []
    if (typeof record.command !== 'string' || record.command.trim() === '') why.push('no command')
    if (!/^[0-9a-f]{40}$/.test(record.testedRevision ?? '') || !deps.commitExists(record.testedRevision)) why.push('tested revision is not a commit')
    if (typeof record.suiteFamily !== 'string' || typeof record.assertionFamily !== 'string' || !Array.isArray(record.exclusions)) why.push('suite family, assertion family, or exclusions missing')
    if (Number.isNaN(Date.parse(record.executedAt))) why.push('no execution time')
    if (record.exitCode !== 0) why.push(`exit code ${record.exitCode}`)
    const totals = record.totals ?? {}
    if (!(totals.passed > 0) || totals.failed !== 0 || totals.skipped !== 0) why.push(`totals passed ${totals.passed} failed ${totals.failed} skipped ${totals.skipped}`)
    for (const test of capability.sourceTests ?? []) {
      const file = (record.files ?? []).find((item) => item.path === test)
      if (!file) why.push(`${test} was not executed`)
      else if (file.suiteStatus !== 'passed' || !(file.passed > 0) || file.failed !== 0 || file.skipped !== 0) why.push(`${test} did not pass in full`)
      if (record.testFileBlobs?.[test] !== deps.blobFor(test)) why.push(`${test} changed after the recorded run`)
    }
    for (const source of capability.sourceFiles ?? []) {
      if (record.sourceFileBlobs?.[source] !== deps.blobFor(source)) why.push(`${source} changed after the recorded run or was not recorded`)
    }
    if (!record.logFile || !deps.exists(record.logFile)) why.push('no recorded output')
    else if (createHash('sha256').update(deps.readText(record.logFile)).digest('hex') !== record.logSha256) why.push('recorded output does not match its hash')
    if (why.length === 0) return []
    failures.push(why.join('; '))
  }
  return [`${label}: ${failures.join(' | ')}`]
}

function independentLockProblems(byId, lock, anchorIds, deps) {
  const problems = []
  if (!lock || lock.schemaVersion !== 1) return ['independent capability lock is missing or has the wrong schemaVersion']
  if (!Number.isInteger(lock.lockVersion) || lock.lockVersion < 1) problems.push('independent capability lock needs a lockVersion')
  if (!/^[0-9a-f]{40}$/.test(lock.anchorCommit ?? '') || !deps.commitExists(lock.anchorCommit)) problems.push('independent capability lock anchor commit does not exist')
  if (!Array.isArray(anchorIds)) problems.push('independent capability lock anchor matrix cannot be read from git history')
  const lockIds = new Set(lock.capabilityIds ?? [])
  const retirements = new Map((lock.retirements ?? []).map((item) => [item.capabilityId, item]))
  for (const id of anchorIds ?? []) {
    if (!lockIds.has(id)) problems.push(`independent lock dropped anchored capability ${id}`)
  }
  for (const id of new Set([...(anchorIds ?? []), ...lockIds])) {
    if (byId.has(id)) continue
    const retirement = retirements.get(id)
    const valid = retirement && Number.isInteger(retirement.schemaVersion) && retirement.schemaVersion >= 2 &&
      typeof retirement.reason === 'string' && retirement.reason.trim().length >= 20 && typeof retirement.evidence === 'string' && deps.exists(retirement.evidence)
    if (!valid) problems.push(`mandatory capability ${id} disappeared without a versioned disposition in the independent lock`)
  }
  for (const id of byId.keys()) {
    if (!lockIds.has(id)) problems.push(`${id} is not in the independent capability lock`)
  }
  return problems
}

function defectProblems(capabilities, ratchetFailures, evidence, deps) {
  const problems = []
  const open = []
  const claimed = new Map()
  for (const capability of capabilities) {
    for (const defect of capability.trackedDefects ?? []) {
      const label = `${capability.id} tracked defect ${defect.id ?? '(missing id)'}`
      if (!defect.id || !['RATCHET', 'TEST_SUITE', 'SOURCE_DEFECT'].includes(defect.kind) || !defect.file || typeof defect.description !== 'string' || defect.description.trim().length < 20) {
        problems.push(`${label} is malformed`)
        continue
      }
      if (!Array.isArray(defect.blocksGates) || defect.blocksGates.length === 0 || defect.blocksGates.some((gate) => !Number.isInteger(gate) || gate < 1 || gate > 15)) {
        problems.push(`${label} must name the gates whose acceptance it blocks`)
      }
      if (!deps.exists(defect.file)) problems.push(`${label} cites a missing file ${defect.file}`)
      const key = `${defect.kind}|${defect.ratchetId ?? defect.suite ?? defect.id}|${defect.file}`
      if (claimed.has(key)) problems.push(`defect ${key} is owned by both ${claimed.get(key)} and ${capability.id}`)
      claimed.set(key, capability.id)
      let live = false
      if (defect.kind === 'RATCHET') live = ratchetFailures.some((failure) => failure.ruleId === defect.ratchetId && failure.file === defect.file)
      else if (defect.kind === 'TEST_SUITE') {
        const record = (evidence?.records ?? []).find((item) => item.capabilityId === capability.id)
        const file = record?.files?.find((item) => item.path === defect.suite)
        live = Boolean(file) && (file.suiteStatus !== 'passed' || file.failed > 0 || file.skipped > 0)
      } else if (defect.kind === 'SOURCE_DEFECT') {
        live = deps.exists(defect.file) && deps.readText(defect.file).includes(defect.sourceQuote ?? '\u0000')
      }
      if (!live) problems.push(`${label} no longer reproduces; record it as resolved with new evidence before removing it`)
      else open.push({ capabilityId: capability.id, id: defect.id, kind: defect.kind, file: defect.file, blocksGates: defect.blocksGates })
    }
  }
  for (const failure of ratchetFailures) {
    const tracked = capabilities.some((capability) => (capability.trackedDefects ?? []).some((defect) => defect.kind === 'RATCHET' && defect.ratchetId === failure.ruleId && defect.file === failure.file))
    if (!tracked) problems.push(`global convergence failure ${failure.ruleId} in ${failure.file} is not tracked as engineering debt`)
  }
  return { problems, open }
}

function summarize(matrix, registerEntries, personaActions, problems) {
  const capabilities = matrix?.capabilities ?? []
  const counts = {}
  for (const entry of registerEntries) counts[entry.status] = (counts[entry.status] ?? 0) + 1
  const byGate = {}
  const byStatus = {}
  for (const capability of capabilities) {
    const gate = String(capability.primaryGate)
    byGate[gate] = (byGate[gate] ?? 0) + 1
    byStatus[capability.sourceStatus] = (byStatus[capability.sourceStatus] ?? 0) + 1
  }
  const byPersona = {}
  for (const action of personaActions) byPersona[action.persona] = (byPersona[action.persona] ?? 0) + 1
  const mappedPersona = {}
  for (const mapping of matrix?.personaActions ?? []) {
    const persona = personaActions.find((action) => action.source === mapping.source && action.actionId === mapping.actionId)?.persona ?? 'unmatched'
    mappedPersona[persona] = (mappedPersona[persona] ?? 0) + 1
  }
  return {
    problems: problems.length,
    registerCount: registerEntries.length,
    registerCounts: counts,
    capabilityCount: capabilities.length,
    personaActionsExtracted: personaActions.length,
    personaActionsMapped: (matrix?.personaActions ?? []).length,
    byGate,
    byStatus,
    byPersona,
    mappedPersona,
    omissions: capabilities.filter((capability) => String(capability.id).startsWith('UE-OMIT-')).map((capability) => capability.id),
  }
}

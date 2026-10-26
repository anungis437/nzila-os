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

export const PERSONA_SOURCES = [
  {
    persona: 'governance-officer',
    file: 'docs/union-eyes/governance-officer/UE-GOVERNANCE-OFFICER-CANONICAL-2.1.md',
    extract: (text) => [...text.matchAll(/^\| (G\d{2}) \|/gm)].map((m) => m[1]),
  },
  {
    persona: 'officer-executive',
    file: 'apps/union-eyes/lib/executive/capability-matrix.ts',
    extract: (text) => [...text.matchAll(/id: '(O\d{2})'/g)].map((m) => m[1]),
  },
  {
    persona: 'senior-representative',
    file: 'docs/union-eyes/reality-remediation/32_UE_SENIOR_REPRESENTATIVE_2_1_CONVERGENCE_DISPOSITION.md',
    extract: (text) => {
      const section = text.split('## 4.')[1]?.split('## 5.')[0] ?? ''
      return [...new Set([...section.matchAll(/\bSR\d{2}\b/g)].map((m) => m[0]))]
    },
  },
  {
    persona: 'member',
    file: 'docs/union-eyes/reality-remediation/UE_MEMBER_CANONICAL_2_1.md',
    extract: (text) => [...new Set([...text.matchAll(/\bM\d{2}\b/g)].map((m) => m[0]))],
  },
  {
    persona: 'financial-officer',
    file: 'docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md',
    extract: (text) => [...new Set([...text.matchAll(/\bFJ\d{2}\b|\bF\d{2}\b/g)].map((m) => m[0]))],
  },
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

export function extractPersonaActions(root, read = (file) => readFileSync(join(root, file), 'utf8')) {
  const actions = []
  for (const source of PERSONA_SOURCES) {
    const ids = source.extract(read(source.file))
    for (const actionId of ids) actions.push({ persona: source.persona, source: source.file, actionId })
  }
  return actions
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

export function loadContext(root = ROOT) {
  const register = JSON.parse(readFileSync(join(root, 'docs/union-eyes/convergence/register/ue-convergence-register.json'), 'utf8'))
  const manifest = JSON.parse(readFileSync(join(root, 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json'), 'utf8'))
  const batches = JSON.parse(readFileSync(join(root, 'docs/union-eyes/convergence/register/ue-schema-mutation-batches.json'), 'utf8'))
  const ontology = readFileSync(join(root, 'apps/union-eyes/lib/authority/ontology.ts'), 'utf8')
  const registry = readFileSync(join(root, 'apps/union-eyes/lib/reality/capability-registry.ts'), 'utf8')
  return {
    root,
    registerEntries: register.entries.map((entry) => ({
      id: entry.id,
      status: entry.status,
      externalGate: entry.externalGate ?? null,
    })),
    personaActions: extractPersonaActions(root),
    routes: manifest.routes,
    routeSummaryCount: manifest.summary.routes,
    kernelActions: extractKernelActions(ontology),
    censusCount: batches.censusCount,
    registryActions: extractRegistryIds(registry),
  }
}

export function validateGate0(matrix, ctx = {}) {
  const problems = []
  const base = ctx.base ?? loadContext(ctx.root ?? ROOT)
  const exists = ctx.exists ?? ((file) => existsSync(join(base.root, file)))
  const readText = ctx.readText ?? ((file) => readFileSync(join(base.root, file), 'utf8'))
  const commitExists = ctx.commitExists ?? gitCommitExists
  const registerEntries = ctx.registerEntries ?? base.registerEntries
  const personaActions = ctx.personaActions ?? base.personaActions
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
    }
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
  }

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

  const summary = summarize(matrix, registerEntries, personaActions, problems)
  return { problems, summary }
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

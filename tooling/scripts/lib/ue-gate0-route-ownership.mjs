/**
 * Route and method ownership for Gate 0.
 *
 * Every route/method pair in the route-coverage manifest must resolve to exactly one ownership
 * rule, one primary capability, one authorization control category, one audit obligation, one
 * privacy obligation (or a justified non-applicability), and one disposition. The guard class in
 * the manifest is the declared control category. It is not implementation evidence.
 */
import { createHash } from 'node:crypto'

export const DISPOSITIONS = ['OWNED', 'SYSTEM', 'RETIRED_501', 'STUB_501', 'SCOPE_UNDECIDED', 'COMPAT', 'GENERATED', 'OUT_OF_SCOPE']
export const ENDPOINT_501 = ['RETIRED_501', 'STUB_501']
export const SCOPE_DISPOSITIONS = ['COMPAT', 'GENERATED', 'OUT_OF_SCOPE']
export const EVIDENCE_KINDS = ['register', 'file', 'registry', 'manifest']
export const ENTRY_COLUMNS = ['route', 'method', 'ruleId', 'capabilityId', 'disposition', 'control', 'audit', 'privacy', 'actor']
export const UNDECIDED_OWNER = 'UE-OMIT-ROUTE-DOMAIN-SCOPE'

export const GUARD_CONTROL = {
  ADMIN_AUTH: 'ADMIN_ROLE_CHECK',
  CAPABILITY_TOKEN: 'BEARER_CAPABILITY_TOKEN',
  CRON_SECRET: 'SHARED_SECRET',
  CRUD_FACTORY: 'GENERIC_CRUD_ROLE_FLOOR',
  DELEGATED: 'DELEGATED_TO_HANDLER',
  NONE: 'NO_AUTHENTICATION_DECLARED',
  ORG_AUTH: 'ORGANIZATION_ROLE_CHECK',
  PLATFORM_AUTH_HANDLER: 'IDENTITY_PROVIDER_HANDLER',
  RETIRED: 'NONE_RETIRED_501',
  ROLE_AUTH: 'ROLE_TITLE_CHECK',
  SESSION_AUTH: 'SESSION_ONLY',
  WEBHOOK_SIGNATURE: 'PROVIDER_SIGNATURE',
  WITH_API: 'WITH_API_WRAPPER',
  WITH_API_PUBLIC: 'PUBLIC_WRAPPER',
}

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS']
const ATOMIC_AUDIT = ['ATOMIC', 'ATOMIC_SERVICE', 'CRUD_ATOMIC']
const EXEMPT_AUDIT = ['EXEMPT_UNATTRIBUTABLE', 'EXEMPT_BALLOT_SECRECY']
const NO_WRITE_AUDIT = ['READ_ONLY', 'COMPUTE_ONLY', 'NO_WRITES_FOUND']

export function routeKeys(routes) {
  return routes.flatMap((route) => [].concat(route.methods).map((method) => `${route.route}|${method}`))
}

export function selectRule(rules, route, method) {
  const applicable = []
  for (const rule of rules) {
    if (Array.isArray(rule.guards) && !rule.guards.includes(route.guard)) continue
    if (method && Array.isArray(rule.methods) && !rule.methods.includes(method)) continue
    let best = -1
    for (const prefix of rule.prefixes ?? []) if (route.route.startsWith(prefix) && prefix.length > best) best = prefix.length
    if (best >= 0) applicable.push({ rule, precedence: rule.precedence ?? 10, length: best })
  }
  if (applicable.length === 0) return { rule: null, ambiguous: [] }
  applicable.sort((a, b) => b.precedence - a.precedence || b.length - a.length)
  const top = applicable[0]
  const ties = applicable.filter((item) => item.precedence === top.precedence && item.length === top.length && item.rule.id !== top.rule.id)
  return { rule: top.rule, ambiguous: ties.map((item) => item.rule.id) }
}

export function deriveDisposition(rule, route) {
  if (ENDPOINT_501.includes(rule.disposition) || SCOPE_DISPOSITIONS.includes(rule.disposition)) return rule.disposition
  if (route.guard === 'RETIRED') return 'RETIRED_501'
  return rule.disposition
}

export function deriveControl(route) {
  return GUARD_CONTROL[route.guard] ?? `UNKNOWN_GUARD:${route.guard}`
}

export function deriveAudit(route, method, disposition) {
  if (ENDPOINT_501.includes(disposition)) return 'NOT_APPLICABLE:501'
  if (READ_METHODS.includes(method)) return 'NOT_APPLICABLE:READ'
  if (!route.mutating) return 'NOT_APPLICABLE:NO_WRITE'
  if (ATOMIC_AUDIT.includes(route.audit)) return `AUDIT_DECLARED_ATOMIC:${route.audit}`
  if (EXEMPT_AUDIT.includes(route.audit)) return `AUDIT_EXEMPT_DECLARED:${route.audit}`
  if (NO_WRITE_AUDIT.includes(route.audit)) return `NOT_APPLICABLE:${route.audit}`
  return `AUDIT_ABSENT:${route.audit}`
}

export function derivePrivacy(rule, disposition) {
  if (ENDPOINT_501.includes(disposition)) return 'NOT_APPLICABLE:501'
  return rule.privacy === 'CAPABILITY' ? 'CAPABILITY' : 'NOT_APPLICABLE:RULE'
}

export function deriveEntry(route, method, rule) {
  const disposition = deriveDisposition(rule, route)
  return [route.route, method, rule.id, rule.capabilityId, disposition, deriveControl(route), deriveAudit(route, method, disposition), derivePrivacy(rule, disposition), rule.actor]
}

export function ownershipHash(entries) {
  return createHash('sha256').update(entries.map((entry) => entry.join('|')).sort().join('\n')).digest('hex')
}

function ruleStructureProblems(ownership, capabilityById, scopeIds, registerIds, registryIds, exists, readText) {
  const problems = []
  const seen = new Set()
  for (const rule of ownership.rules ?? []) {
    const label = `route ownership rule ${rule.id ?? '(missing id)'}`
    if (!rule.id || seen.has(rule.id)) problems.push(`${label} has a missing or duplicate id`)
    seen.add(rule.id)
    if (!DISPOSITIONS.includes(rule.disposition)) problems.push(`${label} has an invalid disposition`)
    if (!Array.isArray(rule.prefixes) || rule.prefixes.length === 0) problems.push(`${label} has no route prefix`)
    if (rule.methods !== undefined && (!Array.isArray(rule.methods) || rule.methods.length === 0 || !rule.methods.every((item) => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(item)))) {
      problems.push(`${label} has an invalid method filter`)
    }
    if (!capabilityById.has(rule.capabilityId)) problems.push(`${label} names an invalid owner ${rule.capabilityId}`)
    if (typeof rule.actor !== 'string' || rule.actor.trim() === '') problems.push(`${label} has no persona or system actor`)
    if (!['CAPABILITY', 'NOT_APPLICABLE'].includes(rule.privacy)) problems.push(`${label} has an invalid privacy obligation`)
    if (rule.privacy === 'NOT_APPLICABLE' && (typeof rule.privacyJustification !== 'string' || rule.privacyJustification.trim().length < 20)) {
      problems.push(`${label} marks privacy not applicable without a justification`)
    }
    if (SCOPE_DISPOSITIONS.includes(rule.disposition)) {
      if (!rule.scopeRef || !scopeIds.has(rule.scopeRef)) problems.push(`${label} uses ${rule.disposition} without a recorded out-of-scope decision`)
    }
    if (!Array.isArray(rule.evidence) || rule.evidence.length === 0) problems.push(`${label} has no evidence`)
    for (const item of rule.evidence ?? []) {
      if (!EVIDENCE_KINDS.includes(item.kind) || typeof item.ref !== 'string') {
        problems.push(`${label} has malformed evidence`)
        continue
      }
      if (item.kind === 'register' && !registerIds.has(item.ref)) problems.push(`${label} cites unknown register entry ${item.ref}`)
      if (item.kind === 'registry' && !registryIds.has(item.ref)) problems.push(`${label} cites unknown capability-registry record ${item.ref}`)
      if (item.kind === 'file') {
        if (!exists(item.ref)) problems.push(`${label} cites a missing file ${item.ref}`)
        else if (item.quote && !readText(item.ref).includes(item.quote)) problems.push(`${label} cites ${item.ref} but the quoted text is not in the file`)
      }
    }
  }
  return problems
}

export function validateRouteOwnership({ ownership, capabilityById, routes, diskRouteKeys, scopeIds, registerIds, registryIds, exists, readText, justifiedUnauthenticated = new Set(), decisionBoundExceptions = new Set() }) {
  const problems = []
  const exceptions = { scopeUndecided: [], unauthenticated: [], auditAbsent: [], uninventoried: [] }
  const blockers = []
  if (!ownership || ownership.schemaVersion !== 1) {
    return { problems: ['route ownership file is missing or has the wrong schemaVersion'], summary: null, exceptions, blockers }
  }
  const rules = Array.isArray(ownership.rules) ? ownership.rules : []
  problems.push(...ruleStructureProblems({ ...ownership, rules }, capabilityById, scopeIds, registerIds, registryIds, exists, readText))

  const entries = Array.isArray(ownership.entries) ? ownership.entries : []
  const byKey = new Map()
  for (const entry of entries) {
    const key = `${entry[0]}|${entry[1]}`
    if (byKey.has(key)) {
      const first = byKey.get(key)
      if (first[3] !== entry[3]) problems.push(`conflicting owners for ${key}: ${first[3]} and ${entry[3]}`)
      else problems.push(`duplicate ownership entry for ${key}`)
    } else byKey.set(key, entry)
  }

  const liveKeys = new Set()
  const dispositionCounts = {}
  const capabilityCounts = {}
  const ruleCounts = {}
  for (const route of routes) {
    for (const method of [].concat(route.methods)) {
      const selected = selectRule(rules, route, method)
      const key = `${route.route}|${method}`
      liveKeys.add(key)
      if (!selected.rule) {
        problems.push(`route ${key} matches no ownership rule`)
        continue
      }
      if (selected.ambiguous.length > 0) problems.push(`route ${key} matches ownership rules ${[selected.rule.id, ...selected.ambiguous].join(' and ')} equally`)
      const entry = byKey.get(key)
      if (!entry) {
        problems.push(`route ${key} has no ownership entry`)
        continue
      }
      if (!entry[3] || typeof entry[3] !== 'string') {
        problems.push(`route ${key} has no capability owner`)
        continue
      }
      if (!capabilityById.has(entry[3])) {
        problems.push(`route ${key} names an invalid owner ${entry[3]}`)
        continue
      }
      const expected = deriveEntry(route, method, selected.rule)
      for (let index = 2; index < ENTRY_COLUMNS.length; index += 1) {
        if (entry[index] !== expected[index]) {
          problems.push(`route ${key} ${ENTRY_COLUMNS[index]} is ${JSON.stringify(entry[index])} but the ownership rule and manifest derive ${JSON.stringify(expected[index])}`)
        }
      }
      if (selected.rule.privacy === 'NOT_APPLICABLE' && !ENDPOINT_501.includes(expected[4])) {
        const readOnly = !route.mutating && ['NONE', 'AMBIENT_DB'].includes(route.data)
        if (!readOnly) problems.push(`route ${key} cannot use a privacy non-applicability justification because the manifest records a write or tenant data access`)
      }
      dispositionCounts[expected[4]] = (dispositionCounts[expected[4]] ?? 0) + 1
      capabilityCounts[expected[3]] = (capabilityCounts[expected[3]] ?? 0) + 1
      ruleCounts[selected.rule.id] = (ruleCounts[selected.rule.id] ?? 0) + 1
      if (expected[4] === 'SCOPE_UNDECIDED') exceptions.scopeUndecided.push(key)
      if (expected[5] === 'NO_AUTHENTICATION_DECLARED' && expected[4] !== 'SYSTEM' && !ENDPOINT_501.includes(expected[4]) && !justifiedUnauthenticated.has(key)) exceptions.unauthenticated.push(key)
      if (expected[6].startsWith('AUDIT_ABSENT')) exceptions.auditAbsent.push(key)
    }
  }
  for (const key of byKey.keys()) {
    if (!liveKeys.has(key)) problems.push(`orphan ownership entry ${key} does not exist in the route-coverage manifest`)
  }

  const uninventoried = Array.isArray(ownership.uninventoriedRoutes) ? ownership.uninventoriedRoutes : []
  const uninventoriedKeys = new Set(uninventoried.map((item) => item.route))
  for (const key of diskRouteKeys ?? []) {
    if (routes.some((route) => route.route === key)) continue
    const record = uninventoried.find((item) => item.route === key)
    if (!record) {
      problems.push(`route file ${key} exists but is neither in the route-coverage manifest nor recorded as uninventoried`)
      continue
    }
    if (!capabilityById.has(record.capabilityId)) problems.push(`uninventoried route ${key} names an invalid owner ${record.capabilityId}`)
    if (typeof record.reason !== 'string' || record.reason.trim().length < 20) problems.push(`uninventoried route ${key} needs a reason`)
    exceptions.uninventoried.push(key)
  }
  for (const key of uninventoriedKeys) {
    if ((diskRouteKeys ?? []).length > 0 && !(diskRouteKeys ?? []).includes(key)) problems.push(`uninventoried route record ${key} has no route file`)
    if (routes.some((route) => route.route === key)) problems.push(`uninventoried route record ${key} is already in the manifest and must be removed`)
  }

  const bound = exceptions.scopeUndecided.filter((key) => decisionBoundExceptions.has(key))
  const awaiting = exceptions.scopeUndecided.filter((key) => !decisionBoundExceptions.has(key))
  if (awaiting.length > 0) {
    blockers.push({ code: 'ROUTE_SCOPE_UNDECIDED', operations: awaiting.length, owner: UNDECIDED_OWNER })
  }
  if (bound.length > 0) {
    blockers.push({ code: 'ROUTE_DECISION_BOUND_SCOPE_EXCEPTION', operations: bound.length, owner: UNDECIDED_OWNER })
  }
  if (exceptions.uninventoried.length > 0) {
    blockers.push({ code: 'ROUTE_UNINVENTORIED', routes: exceptions.uninventoried.slice().sort() })
  }

  const summary = {
    routes: routes.length,
    operations: liveKeys.size,
    entries: entries.length,
    rules: rules.length,
    dispositionCounts,
    capabilityCounts,
    ruleCounts,
    scopeUndecided: exceptions.scopeUndecided.length,
    scopeUndecidedAwaitingClassification: awaiting.length,
    decisionBoundScopeExceptions: bound.length,
    unauthenticatedWithoutRecordedJustification: exceptions.unauthenticated.length,
    mutatingWithoutDeclaredAudit: exceptions.auditAbsent.length,
    uninventoriedRoutes: exceptions.uninventoried.length,
  }
  return { problems, summary, exceptions, blockers }
}

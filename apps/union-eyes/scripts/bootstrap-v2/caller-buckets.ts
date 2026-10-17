import { readFileSync } from 'node:fs'
import path from 'node:path'
import { root } from './source'

export type RootCallerForBucket = {
  id: string
  kind: string
  sourcePath: string
  export: string
  tables: { name: string }[]
  runtimeQualification: string
}

export type CallerBucketKey =
  | 'QUALIFIED_BY_EXECUTED_CASES'
  | 'READ_ONLY_FALSE_POSITIVE_GET'
  | 'NOT_IMPLEMENTED_501'
  | 'HTTP_SHARED_GUARD_MUTATION'
  | 'HTTP_GET_NEEDS_EXPLICIT_FIXTURE'
  | 'HTTP_MUTATION_NEEDS_EXPLICIT_FIXTURE'
  | 'SERVER_ACTION_NEEDS_EXPLICIT_FIXTURE'
  | 'FINANCIAL_PROCESS_BOOTSTRAP'
  | 'OTHER_NEEDS_REVIEW'

export type CallerBucket = {
  bucket: CallerBucketKey
  reason: string
  sourceEvidence: string[]
}

const SIDE_EFFECT_ONLY_TABLES = new Set([
  'user_sessions',
  'auth_audit_log',
  'mfa_challenges',
  'mfa_totp',
  'organization_members',
  'users',
  'UNRESOLVED_DYNAMIC_SQL',
  'UNRESOLVED_TABLE:auditLogs',
])

function sourceText(sourcePath: string) {
  return readFileSync(path.join(root, ...sourcePath.split('/')), 'utf8')
}

export function classifyRootCaller(caller: RootCallerForBucket): CallerBucket {
  if (caller.runtimeQualification === 'QUALIFIED_BY_EXECUTED_CASES')
    return {
      bucket: 'QUALIFIED_BY_EXECUTED_CASES',
      reason: 'Caller already has an executed receipt bound in the qualification registry.',
      sourceEvidence: [],
    }
  if (caller.kind === 'DECLARED_PROCESS')
    return {
      bucket: 'FINANCIAL_PROCESS_BOOTSTRAP',
      reason:
        'Process bootstrap root requires service-level startup/role proof, not per-handler HTTP cases.',
      sourceEvidence: [caller.sourcePath],
    }
  if (caller.kind === 'SERVER_ACTION')
    return {
      bucket: 'SERVER_ACTION_NEEDS_EXPLICIT_FIXTURE',
      reason:
        'Server actions require explicit session/request fixtures rather than generic HTTP route probing.',
      sourceEvidence: [caller.sourcePath],
    }
  const source = sourceText(caller.sourcePath)
  if (
    /ApiError\.notImplemented\(/.test(source) ||
    /NOT_IMPLEMENTED/.test(source) ||
    /status:\s*501/.test(source)
  )
    return {
      bucket: 'NOT_IMPLEMENTED_501',
      reason:
        'Route source explicitly returns a 501/NOT_IMPLEMENTED path and qualifies via actual 501 response.',
      sourceEvidence: [caller.sourcePath],
    }
  const tableNames = (caller.tables ?? []).map((table) => table.name)
  if (
    caller.export === 'GET' &&
    tableNames.length > 0 &&
    tableNames.every((name) => SIDE_EFFECT_ONLY_TABLES.has(name))
  )
    return {
      bucket: 'READ_ONLY_FALSE_POSITIVE_GET',
      reason:
        'GET route whose transitive mutations are limited to shared auth/session/audit side-effects; requires actual GET execution to confirm non-mutating business behavior.',
      sourceEvidence: [caller.sourcePath, ...tableNames],
    }
  if (
    /(withApi\(|withRoleAuth\(|withOrganizationAuth\(|withApiAuth\()/.test(source) &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(caller.export)
  )
    return {
      bucket: 'HTTP_SHARED_GUARD_MUTATION',
      reason:
        'HTTP mutator wrapped by a shared auth/organization guard; generic harness should derive cases from the route source and validation shape.',
      sourceEvidence: [caller.sourcePath, caller.export],
    }
  if (caller.sourcePath.startsWith('apps/union-eyes/app/api/'))
    return {
      bucket:
        caller.export === 'GET'
          ? 'HTTP_GET_NEEDS_EXPLICIT_FIXTURE'
          : 'HTTP_MUTATION_NEEDS_EXPLICIT_FIXTURE',
      reason:
        caller.export === 'GET'
          ? 'HTTP GET route is not trivially classifiable as read-only false positive or 501; it needs generic authenticated/unauthenticated execution and possible explicit fixture follow-up.'
          : 'HTTP mutating route is not yet covered by the shared-guard generic bucket and needs route-specific fixture/body generation.',
      sourceEvidence: [caller.sourcePath, caller.export],
    }
  return {
    bucket: 'OTHER_NEEDS_REVIEW',
    reason:
      'Caller falls outside the generic HTTP buckets and still needs explicit reconciliation.',
    sourceEvidence: [caller.sourcePath],
  }
}

export function summarizeBuckets(callers: readonly RootCallerForBucket[]) {
  const summary = new Map<CallerBucketKey, { count: number; reason: string }>()
  for (const caller of callers) {
    const classification = classifyRootCaller(caller)
    const current = summary.get(classification.bucket) ?? {
      count: 0,
      reason: classification.reason,
    }
    current.count += 1
    summary.set(classification.bucket, current)
  }
  return [...summary.entries()]
    .map(([bucket, value]) => ({ bucket, ...value }))
    .sort((left, right) => right.count - left.count || left.bucket.localeCompare(right.bucket))
}

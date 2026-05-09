/**
 * @nzila/doctrine-enforcement — Evaluator
 *
 * Deterministic policy evaluator. Given (policy, subject, context), returns
 * a citable evaluation output. Evaluation is pure; all state (timestamp,
 * cited reason) flows through arguments where possible.
 *
 * @module @nzila/doctrine-enforcement/evaluator
 */
import type {
  GovernancePolicy,
  PolicyCondition,
  PolicyContext,
  PolicyEvaluationOutput,
  PolicySubject,
} from './types'

interface EvaluatorOptions {
  /** Provide an explicit timestamp for deterministic tests. Defaults to `new Date().toISOString()`. */
  readonly evaluatedAt?: string
}

export function evaluatePolicy(
  policy: GovernancePolicy,
  subject: PolicySubject,
  context: PolicyContext,
  options: EvaluatorOptions = {},
): PolicyEvaluationOutput {
  const matched = policy.conditions.every((cond) =>
    matchCondition(cond, subject, context),
  )

  // No conditions => unconditionally applies (matched=true).
  // If conditions matched, the policy effect applies.
  // If not, the policy yields its default-pass posture: 'allow'.
  const decision = matched ? policy.effect : 'allow'

  const reason = matched
    ? `policy "${policy.id}@${policy.version}" matched ${policy.conditions.length} condition(s); effect=${policy.effect}`
    : `policy "${policy.id}@${policy.version}" did not match; default allow`

  return {
    policyId: policy.id,
    policyVersion: policy.version,
    decision,
    reason,
    doctrineCitations: policy.doctrineCitations,
    severity: matched ? policy.severity : 'info',
    subject,
    evaluatedAt: options.evaluatedAt ?? new Date().toISOString(),
  }
}

function matchCondition(
  cond: PolicyCondition,
  subject: PolicySubject,
  context: PolicyContext,
): boolean {
  const value = readField(cond.field, subject, context)
  switch (cond.operator) {
    case 'present':
      return value !== undefined && value !== null
    case 'absent':
      return value === undefined || value === null
    case 'eq':
      return value === cond.value
    case 'neq':
      return value !== cond.value
    case 'in':
      return Array.isArray(cond.value) && cond.value.includes(value as never)
    case 'not_in':
      return Array.isArray(cond.value) && !cond.value.includes(value as never)
    case 'gt':
      return typeof value === 'number' && typeof cond.value === 'number' && value > cond.value
    case 'gte':
      return typeof value === 'number' && typeof cond.value === 'number' && value >= cond.value
    case 'lt':
      return typeof value === 'number' && typeof cond.value === 'number' && value < cond.value
    case 'lte':
      return typeof value === 'number' && typeof cond.value === 'number' && value <= cond.value
    case 'matches': {
      if (typeof value !== 'string' || typeof cond.value !== 'string') return false
      try {
        return new RegExp(cond.value).test(value)
      } catch {
        return false
      }
    }
  }
}

/**
 * Field path resolution. Supports dotted paths, scoped to either:
 *   - "subject.<field>" — looks up subject.attributes
 *   - "subject.kind" / "subject.id" — top-level subject fields
 *   - "context.<field>" — looks up context.attributes
 *   - "context.product" / "context.environment" / "context.releaseId" — top-level context fields
 */
function readField(
  path: string,
  subject: PolicySubject,
  context: PolicyContext,
): unknown {
  const [root, ...rest] = path.split('.')
  if (rest.length === 0) return undefined

  if (root === 'subject') {
    if (rest.length === 1) {
      const head = rest[0]
      if (head === 'kind') return subject.kind
      if (head === 'id') return subject.id
      return subject.attributes[head]
    }
    return readNested(subject.attributes, rest)
  }

  if (root === 'context') {
    if (rest.length === 1) {
      const head = rest[0]
      if (head === 'product') return context.product
      if (head === 'environment') return context.environment
      if (head === 'releaseId') return context.releaseId
      return context.attributes[head]
    }
    return readNested(context.attributes, rest)
  }

  return undefined
}

function readNested(
  source: Readonly<Record<string, unknown>>,
  path: readonly string[],
): unknown {
  let current: unknown = source
  for (const segment of path) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

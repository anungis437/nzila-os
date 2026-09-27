/**
 * TREASURER kernel.
 *
 * Deterministic primitives shared by the personal-capital agent.
 * No clocks, no I/O, no transaction path.
 */
import { createHash } from 'node:crypto'

export const TREASURER_IDENTITY = {
  key: 'treasurer',
  name: 'TREASURER',
  role: 'Personal Capital & Investment Intelligence',
  principalName: 'Aubert Nungisa',
  principalId: 'principal:aubert-nungisa',
  productionAuthority: 'NO',
  financialTransactionAuthority: 'NEVER',
  capitalDomain: 'PERSONAL',
  version: '1.0.0',
} as const

export const PRICE_MAX_AGE_DAYS = 7
export const IMPOSSIBLE_RETURN_ABS_BPS = 100_000

export const EPISTEMIC_CLASSES = [
  'FACT',
  'ASSUMPTION',
  'ESTIMATE',
  'SCENARIO',
  'THESIS',
  'DECISION',
  'AUTHORIZATION',
] as const

export type EpistemicClass = (typeof EPISTEMIC_CLASSES)[number]

/** Confidence is integer basis points from 0 to 10000. Floats are rejected. */
export const CONFIDENCE_CEILING_BPS: Record<EpistemicClass, number> = {
  FACT: 10_000,
  ASSUMPTION: 4_000,
  ESTIMATE: 7_000,
  SCENARIO: 5_000,
  THESIS: 6_000,
  DECISION: 10_000,
  AUTHORIZATION: 10_000,
}

export const PROHIBITED_AUTHORITIES = [
  'EXECUTE_FINANCIAL_TRANSACTION',
  'FABRICATE_HOLDINGS',
  'FABRICATE_PRICES',
  'FABRICATE_BALANCES',
  'FABRICATE_TAX',
  'FABRICATE_RETURNS',
  'REPRESENT_ESTIMATE_AS_QUOTE',
  'AUTONOMOUS_INVESTMENT_AUTHORITY',
  'SILENT_RISK_CHANGE',
  'TREAT_SPECULATION_AS_WEALTH',
  'OPTIMIZE_RETURN_ONLY',
  'CONFUSE_CORPORATE_AND_PERSONAL_CAPITAL',
] as const

export type ProhibitedAuthority = (typeof PROHIBITED_AUTHORITIES)[number]

export const PERMITTED_AUTHORITIES = [
  'ANALYZE',
  'CLASSIFY_EPISTEMIC_STATE',
  'MAINTAIN_ENVELOPE_PLAN',
  'PREPARE_DECISION_RECORD',
  'RECORD_HUMAN_AUTHORIZATION',
  'RECORD_EXTERNAL_CONFIRMATION',
  'REPORT_TO_NORTHSTAR',
] as const

export type PermittedAuthority = (typeof PERMITTED_AUTHORITIES)[number]

export const FLEET_PEERS = [
  'CAPITAL',
  'COMMAND',
  'COUNCIL',
  'ORACLE',
  'SCOUT',
  'RED_TEAM',
  'VERIFIER',
  'CHRONICLE',
  'COUNSEL',
  'NORTHSTAR',
] as const

export type FleetPeer = (typeof FLEET_PEERS)[number]

export const LIFECYCLE_STAGES = [
  'IDEA',
  'RESEARCH',
  'THESIS',
  'UNDERWRITING',
  'EVIDENCE_GATE',
  'HUMAN_DECISION',
  'AUTHORIZED',
  'REJECTED',
  'DEFERRED',
  'MONITORING',
  'THESIS_REVIEW',
  'EXIT',
  'REALLOCATION',
  'HOLD',
] as const

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

export const ANALYSIS_STATES = [
  'ANALYSIS_COMPLETE',
  'DECISION_READY',
  'HUMAN_AUTHORIZED',
  'TRANSACTION_EXTERNALLY_CONFIRMED',
] as const

export type AnalysisState = (typeof ANALYSIS_STATES)[number]

export const REFUSAL_CODES = [
  'MISSING_EVIDENCE',
  'STALE_EVIDENCE',
  'CONTRADICTORY_EVIDENCE',
  'MALFORMED',
  'DUPLICATE_POSITION',
  'INCONSISTENT_CURRENCY',
  'INVALID_DATE',
  'ILLOGICAL_QUANTITY',
  'EPISTEMIC_CONFLATION',
  'EXCESSIVE_CONFIDENCE',
  'TRANSACTION_AUTHORITY_NEVER',
  'AUTHORIZATION_REQUIRED',
  'ENVELOPE_IS_NOT_AUTHORIZATION',
  'ENVELOPE_IS_NOT_COMMITTED_CAPITAL',
  'INVESTMENT_AUTHORIZED_NOT_EXECUTED',
  'AUTHORITY_NOT_INHERITED',
  'PROXY_FORBIDDEN',
  'CORPORATE_CAPITAL_BOUNDARY',
  'PERSONAL_CAPITAL_ONLY',
  'NORTHSTAR_CANNOT_FABRICATE_CAPACITY',
  'DREAM_DECISION_OUT_OF_SCOPE',
  'INJECTION_REJECTED',
  'SPECULATIVE_AS_FACT',
  'IMPOSSIBLE_RETURN',
  'SURVIVORSHIP_BIAS',
  'CONCENTRATION_BREACH',
  'LIQUIDITY_CONSTRAINT',
  'THESIS_IMMUTABLE',
  'BENCHMARK_LOCKED',
  'ILLEGAL_TRANSITION',
  'FAIL_CLOSED',
  'NOT_A_CURRENT_QUOTE',
  'RISK_CONSTRAINT_CHANGE_DENIED',
  'MISSING_RISK_CONSTRAINT',
] as const

export type RefusalCode = (typeof REFUSAL_CODES)[number]

export interface Refusal {
  readonly ok: false
  readonly failClosed: true
  readonly code: RefusalCode
  readonly reason: string
}

export interface Success<T> {
  readonly ok: true
  readonly failClosed: false
  readonly value: T
}

export type Result<T> = Success<T> | Refusal

export function ok<T>(value: T): Success<T> {
  return { ok: true, failClosed: false, value }
}

export function fail(code: RefusalCode, reason: string): Refusal {
  return { ok: false, failClosed: true, code, reason }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function assertSafeInt(value: number, reason: string): Result<number> {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    return fail('MALFORMED', reason)
  }
  return ok(value)
}

export function parseIsoDate(value: string): Result<string> {
  if (typeof value !== 'string') return fail('INVALID_DATE', 'date must be a string')
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return fail('INVALID_DATE', `invalid date ${value}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return fail('INVALID_DATE', `impossible date ${value}`)
  }
  return ok(value)
}

export function addDays(isoDate: string, days: number): Result<string> {
  const parsed = parseIsoDate(isoDate)
  if (!parsed.ok) return parsed
  const daysOk = assertSafeInt(days, 'day offset must be an integer')
  if (!daysOk.ok) return daysOk
  const [year, month, day] = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  return ok(utc.toISOString().slice(0, 10))
}

export function isStale(observedAt: string, asOf: string, maxAgeDays: number): Result<boolean> {
  const observed = parseIsoDate(observedAt)
  if (!observed.ok) return observed
  const decision = parseIsoDate(asOf)
  if (!decision.ok) return decision
  if (observedAt > asOf) return fail('INVALID_DATE', 'evidence is dated after the decision date')
  const horizon = addDays(observedAt, maxAgeDays)
  if (!horizon.ok) return horizon
  return ok(horizon.value < asOf)
}

/**
 * Half-away-from-zero integer division of (numerator * multiplier) / denominator.
 */
export function mulDivRound(numerator: number, multiplier: number, denominator: number): Result<number> {
  for (const [value, label] of [
    [numerator, 'numerator'],
    [multiplier, 'multiplier'],
    [denominator, 'denominator'],
  ] as const) {
    const checked = assertSafeInt(value, `${label} must be an integer`)
    if (!checked.ok) return checked
  }
  if (denominator === 0) return fail('MALFORMED', 'division by zero')
  const sign = Math.sign(numerator) * Math.sign(multiplier) * Math.sign(denominator)
  const absolute = Math.abs(numerator) * Math.abs(multiplier)
  if (!Number.isSafeInteger(absolute)) return fail('MALFORMED', 'integer overflow')
  const divisor = Math.abs(denominator)
  const quotient = Math.floor(absolute / divisor)
  const remainder = absolute % divisor
  const rounded = remainder * 2 >= divisor ? quotient + 1 : quotient
  const signed = sign < 0 ? -rounded : rounded
  if (!Number.isSafeInteger(signed)) return fail('MALFORMED', 'integer overflow')
  return ok(signed)
}

export function rationalToBps(numerator: number, denominator: number): Result<number> {
  if (denominator === 0) return fail('MALFORMED', 'return denominator is zero')
  return mulDivRound(numerator, 10_000, denominator)
}

const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+|any\s+|previous\s+)?instructions/i,
  /\byou are now\b/i,
  /\bsystem\s*:/i,
  /\bmark\b[\s\S]{0,80}\bexecuted\b/i,
  /\bauthorized to (buy|sell|execute|transfer)\b/i,
  /\boverride\b[\s\S]{0,40}\brisk\b/i,
  /financial transaction authority\s*:\s*yes/i,
  /production authority\s*:\s*yes/i,
  /<\s*script/i,
  /\bdo not tell the principal\b/i,
]

export function scanInjection(texts: readonly string[]): string | null {
  for (const text of texts) {
    if (typeof text !== 'string' || text.length === 0) continue
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) return `prompt injection rejected: ${pattern.source}`
    }
  }
  return null
}

export function hasAuthority(authority: string): boolean {
  return (PERMITTED_AUTHORITIES as readonly string[]).includes(authority)
}

export function isProhibited(authority: string): boolean {
  return (PROHIBITED_AUTHORITIES as readonly string[]).includes(authority)
}

export interface Claim {
  readonly epistemicClass: EpistemicClass
  readonly confidenceBps: number
  readonly statement: string
  readonly evidenceIds: readonly string[]
}

export function makeClaim(input: {
  epistemicClass: EpistemicClass
  confidenceBps: number
  statement: string
  evidenceIds?: readonly string[]
}): Result<Claim> {
  if (!(EPISTEMIC_CLASSES as readonly string[]).includes(input.epistemicClass)) {
    return fail('EPISTEMIC_CONFLATION', 'unknown epistemic class')
  }
  const confidence = assertSafeInt(input.confidenceBps, 'confidence must be integer basis points')
  if (!confidence.ok) return confidence
  if (confidence.value < 0 || confidence.value > 10_000) {
    return fail('MALFORMED', 'confidence must be between 0 and 10000')
  }
  const ceiling = CONFIDENCE_CEILING_BPS[input.epistemicClass]
  if (confidence.value > ceiling) {
    return fail(
      'EXCESSIVE_CONFIDENCE',
      `${input.epistemicClass} confidence ceiling is ${ceiling} bps`,
    )
  }
  if (typeof input.statement !== 'string' || input.statement.trim().length === 0) {
    return fail('MISSING_EVIDENCE', 'claim statement is empty')
  }
  const injection = scanInjection([input.statement])
  if (injection) return fail('INJECTION_REJECTED', injection)
  const evidenceIds = input.evidenceIds ?? []
  if (input.epistemicClass === 'FACT' && evidenceIds.length === 0) {
    return fail('MISSING_EVIDENCE', 'FACT requires evidence')
  }
  if (/\bguaranteed\b/i.test(input.statement) && input.epistemicClass === 'FACT') {
    return fail('SPECULATIVE_AS_FACT', 'a guaranteed outcome cannot be classified as FACT')
  }
  return ok({
    epistemicClass: input.epistemicClass,
    confidenceBps: confidence.value,
    statement: input.statement,
    evidenceIds,
  })
}

export function assertNotConflated(claimed: EpistemicClass, actual: EpistemicClass): Result<EpistemicClass> {
  if (claimed !== actual) {
    return fail('EPISTEMIC_CONFLATION', `cannot treat ${actual} as ${claimed}`)
  }
  return ok(actual)
}

/**
 * Derived epistemic class. Opportunity-cost callers must pass counterfactual=true,
 * which forbids FACT even when every input is FACT.
 */
export function deriveEpistemicClass(
  inputs: readonly EpistemicClass[],
  options?: { readonly counterfactual?: boolean },
): Result<EpistemicClass> {
  if (inputs.length === 0) return fail('MISSING_EVIDENCE', 'no epistemic inputs')
  for (const input of inputs) {
    if (!(EPISTEMIC_CLASSES as readonly string[]).includes(input)) {
      return fail('EPISTEMIC_CONFLATION', 'unknown epistemic class')
    }
  }
  if (inputs.includes('SCENARIO')) return ok('SCENARIO')
  if (inputs.includes('ASSUMPTION')) return ok('ASSUMPTION')
  if (options?.counterfactual) return ok('ESTIMATE')
  if (inputs.every((input) => input === 'FACT')) return ok('FACT')
  if (inputs.includes('ESTIMATE')) return ok('ESTIMATE')
  if (inputs.includes('THESIS')) return ok('THESIS')
  return ok(inputs[0])
}

export function assertPerformanceClaim(input: {
  epistemicClass: EpistemicClass
  returnBps: number
  narrative?: string
}): Result<{ readonly epistemicClass: EpistemicClass; readonly returnBps: number }> {
  const returnOk = assertSafeInt(input.returnBps, 'return must be integer basis points')
  if (!returnOk.ok) return returnOk
  if (input.narrative) {
    const injection = scanInjection([input.narrative])
    if (injection) return fail('INJECTION_REJECTED', injection)
    if (/\bguaranteed\b/i.test(input.narrative) && input.epistemicClass === 'FACT') {
      return fail('SPECULATIVE_AS_FACT', 'guaranteed performance cannot be FACT')
    }
  }
  if (input.epistemicClass === 'FACT' && Math.abs(returnOk.value) > IMPOSSIBLE_RETURN_ABS_BPS) {
    return fail('IMPOSSIBLE_RETURN', 'return exceeds the FACT bound and cannot be treated as fact')
  }
  if (input.epistemicClass !== 'SCENARIO' && input.epistemicClass !== 'FACT' && input.epistemicClass !== 'ESTIMATE' && input.epistemicClass !== 'ASSUMPTION') {
    return fail('EPISTEMIC_CONFLATION', 'performance claims use FACT, ESTIMATE, ASSUMPTION, or SCENARIO')
  }
  return ok({ epistemicClass: input.epistemicClass, returnBps: returnOk.value })
}

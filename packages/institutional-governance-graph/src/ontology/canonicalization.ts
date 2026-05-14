/**
 * Institutional Governance Graph — Canonicalization Discipline (Workstream I)
 *
 * This module is the *intent declaration* for what may and may not be
 * promoted into the canonical `@nzila/platform-ontology` registry from
 * IGG-local kinds. It is a **classification and inspection** layer; it does
 * not mutate any ontology, perform any IO, or enforce anything at runtime
 * outside of test-time helpers.
 *
 * Doctrine (see reports/governance-graph/workstream-i-ontology-reconciliation-audit.md):
 *
 *   - Tier 1 — Absolute deny-list. Protected governance metadata
 *     (Class B / golden-share / reserved-matter / their relationships /
 *     their event kinds / their decision categories) MUST NEVER be promoted
 *     into the canonical ontology.
 *
 *   - Tier 2 — Forbidden semantic shapes. Names that imply analytics,
 *     scoring, ranking, prediction, surveillance, command-and-control, or
 *     behavioural governance MUST NEVER be promoted, regardless of demand.
 *     The guard inspects names case-insensitively for these tokens.
 *
 *   - Tier 3 — Hold-for-demand. IGG-local structural kinds (Congress,
 *     Federation, Union, Local, BargainingUnit, Committee, REPRESENTS,
 *     AFFILIATED_WITH, GOVERNED_BY, …) may only be promoted via an
 *     explicit substrate proposal that re-runs the ten audit questions.
 *     They are NOT denied here — they are simply not auto-promotable.
 *
 * IMPORTANT: This module performs no canonicalization. It only inspects
 * inputs and reports. Use `assertCanonicalizationAllowed` in tests or
 * promotion tooling to fail loudly when a deny-listed shape is proposed.
 */

import {
  IGG_PROTECTED_DECISION_CATEGORIES,
  IGG_PROTECTED_ENTITY_KINDS,
  IGG_PROTECTED_EVENT_KINDS,
  IGG_PROTECTED_RELATIONSHIP_KINDS,
} from '../governance/protected.js'
import { IggEntityKinds } from './kinds.js'

// ── Tier 1 — Absolute deny-list (protected governance metadata) ────────────

/**
 * Workstream I gap-fill: kinds that the canonicalization layer treats as
 * protected even though the read-surface fence in `protected.ts` may not yet
 * include them. UMRC (Union Member Representation Council) was classified as
 * Protected by the WS-I audit but is not part of the read-surface fence,
 * which exists to redact veto/golden-share telemetry. Including it here
 * ensures it can never be silently promoted into the canonical ontology.
 */
export const IGG_NEVER_CANONICALIZE_GAP_FILL: readonly string[] = Object.freeze([
  IggEntityKinds.UMRC,
])

/**
 * Protected IGG kinds and event/decision categories that MUST NEVER appear
 * in the canonical ontology under any name. Sourced from the existing
 * protected-semantics fence (so the two layers cannot drift) plus the
 * WS-I gap-fill list above.
 */
export const ABSOLUTE_DENY_LIST: readonly string[] = Object.freeze([
  ...IGG_PROTECTED_ENTITY_KINDS,
  ...IGG_PROTECTED_RELATIONSHIP_KINDS,
  ...IGG_PROTECTED_EVENT_KINDS,
  ...IGG_PROTECTED_DECISION_CATEGORIES,
  ...IGG_NEVER_CANONICALIZE_GAP_FILL,
])

// ── Tier 2 — Forbidden semantic shape tokens ──────────────────────────────

/**
 * Lower-case substrings that, when present in a proposed canonical name,
 * indicate an analytics / surveillance / command-shaped concept. Such
 * concepts MUST NEVER be promoted regardless of who proposes them.
 *
 * The list is deliberately broad — a false positive is preferable to a
 * silently promoted analytics surface.
 */
export const FORBIDDEN_SEMANTIC_TOKENS: readonly string[] = Object.freeze([
  'score',
  'rank',
  'ranking',
  'weight',
  'weighted',
  'weighting',
  'ratio',
  'percent',
  'percentage',
  'average',
  'mean',
  'efficiency',
  'stability',
  'caucus',
  'prediction',
  'forecast',
  'recommendation',
  'topology',
  'influence',
  'surveillance',
  'commandsystem',
  'command-system',
  'behavioural-governance',
  'behavioral-governance',
  'governance-ai',
  'governance-optimization',
  'organizational-intelligence',
  'predictive-governance',
  'institutional-scoring',
])

// ── Tier 3 — Hold-for-demand (informational only) ─────────────────────────

/**
 * IGG-local kinds that are NOT denied but require an explicit substrate
 * proposal before promotion. Listed here so promotion tooling can surface
 * the requirement instead of letting promotions happen silently.
 */
export const HOLD_FOR_DEMAND: readonly string[] = Object.freeze([
  'igg:congress',
  'igg:federation',
  'igg:union',
  'igg:local',
  'igg:region',
  'igg:district',
  'igg:employer',
  'igg:worksite',
  'igg:bargaining_unit',
  'igg:committee',
  // 'igg:umrc' intentionally excluded — see IGG_NEVER_CANONICALIZE_GAP_FILL.
  'igg:bylaw',
  'igg:cba',
  'igg:motion',
  'igg:proposal',
  'igg:represents',
  'igg:affiliated_with',
  'igg:governed_by',
  'igg:delegates_to',
  'igg:escalated_to',
  'igg:member_of',
  'igg:supersedes',
  'igg:bargains_for',
  'igg:negotiates',
  'igg:eligible_to_vote_in',
  'igg:casts',
  'igg:approves',
  'igg:tenured_as',
  'igg:informed_by',
  'igg:triggered_by',
])

// ── Public types ──────────────────────────────────────────────────────────

export type CanonicalizationVerdict =
  | { readonly allowed: true; readonly reason: 'no-objection' }
  | {
      readonly allowed: false
      readonly reason:
        | 'protected-metadata'
        | 'forbidden-semantic-shape'
        | 'hold-for-demand'
      readonly matchedToken?: string
    }

// ── Inspection helpers ────────────────────────────────────────────────────

function normalize(name: string): string {
  return name.toLowerCase().trim()
}

/** True if `name` is on the absolute deny-list. */
export function isProtectedCanonicalization(name: string): boolean {
  return ABSOLUTE_DENY_LIST.includes(normalize(name))
}

/**
 * Tokenise a candidate canonical name into lower-case word atoms.
 *
 * Splits on whitespace, hyphens, underscores, and camelCase boundaries so
 * "InstitutionalScore" → ["institutional","score"] and
 * "governance-command-system" → ["governance","command","system"]. This
 * lets us test forbidden tokens by exact word match instead of substring
 * match, which avoids false positives like "Federation" matching "ratio".
 */
function tokenize(name: string): readonly string[] {
  return name
    .trim()
    // Split a camelCase / PascalCase boundary by inserting a delimiter.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_\-]+/)
    .filter(Boolean)
}

/**
 * True if `name` contains a forbidden semantic-shape token. Uses word-atom
 * matching (not substring matching) so unrelated words like "Federation"
 * don't accidentally match "ratio". Multi-token forbidden phrases (e.g.
 * "command-system", "behavioural-governance") are matched against the
 * hyphenated form of the name.
 */
export function hasForbiddenSemanticShape(name: string): {
  readonly matched: boolean
  readonly token?: string
} {
  const atoms = tokenize(name)
  const atomSet = new Set(atoms)
  const hyphenated = atoms.join('-')
  for (const token of FORBIDDEN_SEMANTIC_TOKENS) {
    if (token.includes('-')) {
      // Multi-word phrase — require it to appear as a contiguous run of
      // atoms inside the normalised hyphenated form.
      if (hyphenated.includes(token)) {
        return { matched: true, token }
      }
      continue
    }
    if (atomSet.has(token)) {
      return { matched: true, token }
    }
  }
  return { matched: false }
}

/** True if `name` is in the hold-for-demand IGG-local list. */
export function isHoldForDemand(name: string): boolean {
  return HOLD_FOR_DEMAND.includes(normalize(name))
}

/**
 * Classify a proposed canonical name. Returns a structured verdict so that
 * test or tooling code can report exactly which deny-rule fired.
 *
 * Order of checks:
 *   1. Protected governance metadata (Tier 1, hardest deny).
 *   2. Forbidden semantic shape (Tier 2, hardest deny).
 *   3. Hold-for-demand (Tier 3, soft deny — promotion requires an RFC).
 *   4. Otherwise allowed.
 */
export function classifyCanonicalizationProposal(
  name: string,
): CanonicalizationVerdict {
  if (isProtectedCanonicalization(name)) {
    return { allowed: false, reason: 'protected-metadata' }
  }
  const shape = hasForbiddenSemanticShape(name)
  if (shape.matched) {
    return {
      allowed: false,
      reason: 'forbidden-semantic-shape',
      matchedToken: shape.token,
    }
  }
  if (isHoldForDemand(name)) {
    return { allowed: false, reason: 'hold-for-demand' }
  }
  return { allowed: true, reason: 'no-objection' }
}

/**
 * Throwing variant intended for test or promotion-tooling use. Throws an
 * `Error` with a precise reason if the proposed name is not allowed.
 */
export function assertCanonicalizationAllowed(name: string): void {
  const verdict = classifyCanonicalizationProposal(name)
  if (verdict.allowed) return
  switch (verdict.reason) {
    case 'protected-metadata':
      throw new Error(
        `Canonicalization denied: "${name}" is protected governance metadata and must never appear in the canonical ontology.`,
      )
    case 'forbidden-semantic-shape':
      throw new Error(
        `Canonicalization denied: "${name}" matches forbidden semantic-shape token "${verdict.matchedToken ?? ''}". Analytics/surveillance/command-shaped concepts may not be canonicalized.`,
      )
    case 'hold-for-demand':
      throw new Error(
        `Canonicalization deferred: "${name}" is hold-for-demand. Promotion requires an explicit substrate RFC re-running the Workstream I ten-question audit.`,
      )
  }
}

/**
 * Inspect an entire candidate canonical-ontology registry (entity types,
 * relationship types, and any other named registry) for absolute or
 * forbidden-shape violations. Hold-for-demand entries are NOT reported as
 * violations — they require RFC review, not blocking.
 *
 * Returns the list of violating names with the matching reason. Empty
 * array means the registry is clean.
 */
export function findCanonicalizationViolations(
  names: readonly string[],
): ReadonlyArray<{
  readonly name: string
  readonly reason: 'protected-metadata' | 'forbidden-semantic-shape'
  readonly matchedToken?: string
}> {
  const violations: Array<{
    name: string
    reason: 'protected-metadata' | 'forbidden-semantic-shape'
    matchedToken?: string
  }> = []
  for (const name of names) {
    if (isProtectedCanonicalization(name)) {
      violations.push({ name, reason: 'protected-metadata' })
      continue
    }
    const shape = hasForbiddenSemanticShape(name)
    if (shape.matched) {
      violations.push({
        name,
        reason: 'forbidden-semantic-shape',
        matchedToken: shape.token,
      })
    }
  }
  return violations
}

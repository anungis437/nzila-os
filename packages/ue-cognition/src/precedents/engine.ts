/**
 * @nzila/ue-cognition/precedents — Module 4: Precedent memory engine.
 *
 * Surfaces similar prior cases for a new grievance / claim. Phase-1 scoring
 * is interpretable: tag overlap (Jaccard) + type match + a recency-decay
 * tiebreaker. This deliberately AVOIDS embeddings for now — interpretability
 * matters in a union-rep context where every recommendation may be reviewed
 * by a member or arbitrator.
 *
 * Org scoping is enforced by the caller (descriptors.subject.orgId must
 * match `forSubject.orgId`); the engine refuses to mix orgs.
 */
import type { CognitionSubject } from '@nzila/platform-cognition-core'
import { precedentMatchSchema } from '../schemas'
import type { PrecedentCaseDescriptor, PrecedentMatch } from '../types'
import { listRecords, makeId, nowISO, writeRecord } from '../utils'

const ENTITY = 'precedent-matches'

export class CrossOrgPrecedentLeakError extends Error {
  constructor(public readonly caseId: string) {
    super(`ue-cognition: precedent ${caseId} is from a different organization`)
    this.name = 'CrossOrgPrecedentLeakError'
  }
}

export interface PrecedentSearchInput {
  readonly forCaseId: string
  readonly forSubject: CognitionSubject
  readonly forType: string
  readonly forTags: readonly string[]
  readonly candidates: ReadonlyArray<{
    readonly subject: CognitionSubject
    readonly descriptor: PrecedentCaseDescriptor
  }>
  readonly limit?: number
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 0
  const setA = new Set(a.map((t) => t.toLowerCase()))
  const setB = new Set(b.map((t) => t.toLowerCase()))
  let intersect = 0
  for (const t of setA) if (setB.has(t)) intersect += 1
  const union = setA.size + setB.size - intersect
  return union === 0 ? 0 : intersect / union
}

function isSuccessful(d: PrecedentCaseDescriptor): boolean {
  if (!d.resolutionOutcome) return false
  const lower = d.resolutionOutcome.toLowerCase()
  return (
    lower.includes('settled') ||
    lower.includes('resolved') ||
    lower.includes('granted') ||
    lower.includes('monetary') ||
    lower.includes('reinstate')
  )
}

export function findPrecedents(input: PrecedentSearchInput): PrecedentMatch {
  const limit = Math.max(1, input.limit ?? 5)

  for (const c of input.candidates) {
    if (c.subject.orgId !== input.forSubject.orgId || c.subject.tenantId !== input.forSubject.tenantId) {
      throw new CrossOrgPrecedentLeakError(c.descriptor.caseId)
    }
  }

  const ranked = input.candidates
    .filter((c) => c.descriptor.caseId !== input.forCaseId)
    .map((c) => {
      const tagOverlap = jaccard(input.forTags, c.descriptor.tags)
      const typeMatch = c.descriptor.type === input.forType
      // Composite: 60% tag overlap, 25% type match, 15% successful-resolution bonus.
      const successful = isSuccessful(c.descriptor)
      const score =
        0.6 * tagOverlap +
        (typeMatch ? 0.25 : 0) +
        (successful ? 0.15 : 0)
      return {
        caseId: c.descriptor.caseId,
        score: Math.max(0, Math.min(1, score)),
        tagOverlap,
        typeMatch,
        successful,
        summary: c.descriptor.summary,
        resolutionOutcome: c.descriptor.resolutionOutcome,
        daysToResolve: c.descriptor.daysToResolve,
        settlementAmount: c.descriptor.settlementAmount,
      }
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  // Aggregate stats across matches that have data.
  const resolvedDays = ranked.map((m) => m.daysToResolve).filter((n): n is number => typeof n === 'number')
  const settlements = ranked.map((m) => m.settlementAmount).filter((n): n is number => typeof n === 'number')
  const successes = ranked.filter((m) => m.successful).length

  const result: PrecedentMatch = {
    id: makeId('pcm'),
    forCaseId: input.forCaseId,
    subject: input.forSubject,
    matches: ranked,
    typicalDaysToResolve: resolvedDays.length > 0
      ? resolvedDays.reduce((s, x) => s + x, 0) / resolvedDays.length
      : null,
    typicalSettlementAmount: settlements.length > 0
      ? settlements.reduce((s, x) => s + x, 0) / settlements.length
      : null,
    successRate: ranked.length > 0 ? successes / ranked.length : 0,
    retrievedAt: nowISO(),
  }
  return writeRecord(ENTITY, result.id, result, precedentMatchSchema) as PrecedentMatch
}

export function listPrecedentMatches(): PrecedentMatch[] {
  return listRecords(ENTITY, precedentMatchSchema) as PrecedentMatch[]
}

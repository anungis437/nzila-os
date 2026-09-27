/**
 * Personal-ledger integrity. Missing, stale, contradictory, malformed,
 * duplicate, cross-currency, invalid-date, and illogical inputs fail closed.
 * Nothing here defaults a missing price or balance to zero.
 */
import {
  PRICE_MAX_AGE_DAYS,
  TREASURER_IDENTITY,
  assertSafeInt,
  canonicalJson,
  fail,
  isStale,
  ok,
  parseIsoDate,
  sha256,
  type Result,
} from './kernel'
import {
  MARKET_FACT_SOURCES,
  portfolioSnapshotSchema,
  type EvidenceRef,
  type PortfolioSnapshot,
  type Position,
  type RiskConstraints,
} from './schemas'

const CORPORATE_INSTRUMENT = /^(corp:|product:|nzila-product:|org:)/i

export interface WeightRow {
  readonly id: string
  readonly weightBps: number
  readonly groupId: string
  readonly marketValueMinor: number
}

export interface ValidatedSnapshot {
  readonly snapshot: PortfolioSnapshot
  readonly totalMinor: number
  readonly weights: readonly WeightRow[]
  readonly groupWeightsBps: Readonly<Record<string, number>>
  readonly cashIsFact: boolean
}

export function evidenceHashMaterial(evidence: Omit<EvidenceRef, 'contentHash' | 'id'> & { id?: string }): string {
  return canonicalJson({
    epistemicClass: evidence.epistemicClass,
    sourceType: evidence.sourceType,
    sourceName: evidence.sourceName,
    observedAt: evidence.observedAt,
    origin: evidence.origin,
    payload: evidence.payload,
  })
}

export function buildEvidence(
  input: Omit<EvidenceRef, 'contentHash'> & { contentHash?: string },
): EvidenceRef {
  const { contentHash: _ignored, ...rest } = input
  return { ...rest, contentHash: sha256(evidenceHashMaterial(rest)) }
}

export function verifyEvidence(evidence: EvidenceRef, asOf: string): Result<EvidenceRef> {
  const observed = parseIsoDate(evidence.observedAt)
  if (!observed.ok) return observed
  const decisionDate = parseIsoDate(asOf)
  if (!decisionDate.ok) return decisionDate
  if (evidence.observedAt > asOf) {
    return fail('INVALID_DATE', 'evidence is dated after the decision date')
  }
  const expected = sha256(evidenceHashMaterial(evidence))
  if (expected !== evidence.contentHash) {
    return fail('MALFORMED', `evidence ${evidence.id} hash does not match payload`)
  }
  if (evidence.epistemicClass === 'FACT') {
    if (evidence.origin !== 'EXTERNAL') {
      return fail('SPECULATIVE_AS_FACT', 'FACT requires external origin')
    }
    if (evidence.sourceType === 'VALUATION_MODEL' || evidence.sourceType === 'PRINCIPAL_ATTESTATION') {
      return fail('SPECULATIVE_AS_FACT', `${evidence.sourceType} cannot support FACT`)
    }
  }
  return ok(evidence)
}

function payloadNumber(payload: EvidenceRef['payload'], key: string): Result<number> {
  const value = payload[key]
  if (typeof value !== 'number') return fail('MISSING_EVIDENCE', `evidence payload missing ${key}`)
  return assertSafeInt(value, `${key} must be an integer`)
}

function findEvidence(snapshot: PortfolioSnapshot, id: string): Result<EvidenceRef> {
  const matches = snapshot.evidence.filter((item) => item.id === id)
  if (matches.length === 0) return fail('MISSING_EVIDENCE', `missing evidence ${id}`)
  if (matches.length > 1) return fail('CONTRADICTORY_EVIDENCE', `duplicate evidence id ${id}`)
  return ok(matches[0])
}

export function assertCurrentMarketValue(
  position: Position,
  evidence: EvidenceRef,
  asOf: string,
): Result<EvidenceRef> {
  const verified = verifyEvidence(evidence, asOf)
  if (!verified.ok) return verified
  if (evidence.epistemicClass !== 'FACT') {
    return fail('NOT_A_CURRENT_QUOTE', `${evidence.epistemicClass} is not a current market quote`)
  }
  if (!(MARKET_FACT_SOURCES as readonly string[]).includes(evidence.sourceType)) {
    return fail('NOT_A_CURRENT_QUOTE', `${evidence.sourceType} is not a market quote source`)
  }
  const stale = isStale(evidence.observedAt, asOf, PRICE_MAX_AGE_DAYS)
  if (!stale.ok) return stale
  if (stale.value) return fail('STALE_EVIDENCE', `price evidence ${evidence.id} is stale`)
  const instrument = evidence.payload.instrumentId
  const currency = evidence.payload.currency
  const value = payloadNumber(evidence.payload, 'marketValueMinor')
  if (!value.ok) return value
  if (instrument !== position.instrumentId || currency !== position.currency || value.value !== position.marketValueMinor) {
    return fail('CONTRADICTORY_EVIDENCE', `price evidence does not match position ${position.id}`)
  }
  return ok(evidence)
}

function checkContradictions(snapshot: PortfolioSnapshot): Result<true> {
  const seen = new Map<string, number>()
  for (const evidence of snapshot.evidence) {
    if (evidence.epistemicClass !== 'FACT') continue
    const instrument = evidence.payload.instrumentId
    if (typeof instrument !== 'string') continue
    const amount = evidence.payload.marketValueMinor
    if (typeof amount !== 'number') continue
    const key = `${instrument}|${evidence.observedAt}|marketValueMinor`
    const prior = seen.get(key)
    if (prior !== undefined && prior !== amount) {
      return fail('CONTRADICTORY_EVIDENCE', `contradictory FACT values for ${instrument} on ${evidence.observedAt}`)
    }
    seen.set(key, amount)
  }
  return ok(true)
}

function largestRemainder(total: number, parts: readonly { id: string; value: number }[]): Result<Map<string, number>> {
  if (total === 0) return fail('ILLOGICAL_QUANTITY', 'cannot weight an empty portfolio')
  const rows = parts.map((part) => {
    const exact = part.value * 10_000
    const floor = Math.floor(exact / total)
    return { id: part.id, floor, remainder: exact % total }
  })
  let leftover = 10_000 - rows.reduce((sum, row) => sum + row.floor, 0)
  const ranked = [...rows].sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id))
  const weights = new Map<string, number>()
  for (const row of rows) weights.set(row.id, row.floor)
  for (const row of ranked) {
    if (leftover <= 0) break
    weights.set(row.id, (weights.get(row.id) ?? 0) + 1)
    leftover -= 1
  }
  return ok(weights)
}

export function validateSnapshot(
  input: unknown,
  asOf: string,
  constraints: RiskConstraints,
): Result<ValidatedSnapshot> {
  const decisionDate = parseIsoDate(asOf)
  if (!decisionDate.ok) return decisionDate
  const parsed = portfolioSnapshotSchema.safeParse(input)
  if (!parsed.success) {
    return fail('MALFORMED', parsed.error.issues.map((issue) => issue.message).join('; '))
  }
  const snapshot = parsed.data
  if (snapshot.ownerPrincipalId !== TREASURER_IDENTITY.principalId) {
    return fail('PERSONAL_CAPITAL_ONLY', 'snapshot owner is not the Principal')
  }
  if (snapshot.capitalDomain !== 'PERSONAL') {
    return fail('CORPORATE_CAPITAL_BOUNDARY', 'corporate capital cannot enter the personal ledger')
  }
  if (snapshot.asOf !== asOf) {
    return fail('STALE_EVIDENCE', 'snapshot asOf does not match the decision date')
  }
  if (snapshot.cashCurrency !== snapshot.baseCurrency || constraints.currency !== snapshot.baseCurrency) {
    return fail('INCONSISTENT_CURRENCY', 'cash, base, and risk currencies must match')
  }
  const ids = new Set<string>()
  for (const evidence of snapshot.evidence) {
    if (ids.has(evidence.id)) return fail('CONTRADICTORY_EVIDENCE', `duplicate evidence id ${evidence.id}`)
    ids.add(evidence.id)
    const verified = verifyEvidence(evidence, asOf)
    if (!verified.ok) return verified
  }
  const contradictions = checkContradictions(snapshot)
  if (!contradictions.ok) return contradictions

  const positionKeys = new Set<string>()
  for (const position of snapshot.positions) {
    if (position.ownerPrincipalId !== TREASURER_IDENTITY.principalId) {
      return fail('PERSONAL_CAPITAL_ONLY', `position ${position.id} is not owned by the Principal`)
    }
    if (CORPORATE_INSTRUMENT.test(position.instrumentId) || CORPORATE_INSTRUMENT.test(position.accountId)) {
      return fail('CORPORATE_CAPITAL_BOUNDARY', `position ${position.id} carries a corporate identifier`)
    }
    const key = `${position.accountId}|${position.instrumentId}`
    if (positionKeys.has(key)) return fail('DUPLICATE_POSITION', `duplicate position ${key}`)
    positionKeys.add(key)
    if (position.quantity === 0 && position.marketValueMinor !== 0) {
      return fail('ILLOGICAL_QUANTITY', `position ${position.id} has value without quantity`)
    }
    if (position.currency !== snapshot.baseCurrency) {
      return fail('INCONSISTENT_CURRENCY', `position ${position.id} currency has no evidenced conversion`)
    }
    const evidence = findEvidence(snapshot, position.priceEvidenceId)
    if (!evidence.ok) return evidence
    const quote = assertCurrentMarketValue(position, evidence.value, asOf)
    if (!quote.ok) return quote
    if (position.asOf !== asOf) return fail('STALE_EVIDENCE', `position ${position.id} asOf is not current`)
  }

  const cashEvidence = findEvidence(snapshot, snapshot.cashEvidenceId)
  if (!cashEvidence.ok) return cashEvidence
  const cashVerified = verifyEvidence(cashEvidence.value, asOf)
  if (!cashVerified.ok) return cashVerified
  if (cashEvidence.value.epistemicClass !== 'FACT' || cashEvidence.value.payload.kind !== 'CASH') {
    return fail('MISSING_EVIDENCE', 'cash requires external FACT cash evidence')
  }
  const cashAmount = payloadNumber(cashEvidence.value.payload, 'amountMinor')
  if (!cashAmount.ok) return cashAmount
  if (cashAmount.value !== snapshot.cashMinor || cashEvidence.value.payload.currency !== snapshot.cashCurrency) {
    return fail('CONTRADICTORY_EVIDENCE', 'cash evidence does not match the snapshot')
  }
  const cashStale = isStale(cashEvidence.value.observedAt, asOf, PRICE_MAX_AGE_DAYS)
  if (!cashStale.ok) return cashStale
  if (cashStale.value) return fail('STALE_EVIDENCE', 'cash evidence is stale')

  const positionTotal = snapshot.positions.reduce((sum, position) => sum + position.marketValueMinor, 0)
  const total = positionTotal + snapshot.cashMinor
  if (!Number.isSafeInteger(total)) return fail('MALFORMED', 'portfolio total overflow')
  const parts = [
    ...snapshot.positions.map((position) => ({
      id: position.id,
      value: position.marketValueMinor,
      groupId: position.exposureGroupId,
    })),
    { id: 'cash', value: snapshot.cashMinor, groupId: 'cash' },
  ]
  const weights = largestRemainder(total, parts)
  if (!weights.ok) return weights
  const rows: WeightRow[] = parts.map((part) => ({
    id: part.id,
    weightBps: weights.value.get(part.id) ?? 0,
    groupId: part.groupId,
    marketValueMinor: part.value,
  }))
  const groupWeightsBps: Record<string, number> = {}
  for (const row of rows) {
    if (row.id === 'cash') continue
    groupWeightsBps[row.groupId] = (groupWeightsBps[row.groupId] ?? 0) + row.weightBps
  }
  for (const row of rows) {
    if (row.id === 'cash') continue
    if (row.weightBps > constraints.maxPositionWeightBps) {
      return fail('CONCENTRATION_BREACH', `position ${row.id} weight ${row.weightBps} exceeds ceiling`)
    }
  }
  for (const [groupId, weight] of Object.entries(groupWeightsBps)) {
    if (weight > constraints.maxGroupWeightBps) {
      return fail('CONCENTRATION_BREACH', `exposure group ${groupId} weight ${weight} exceeds ceiling`)
    }
  }
  if (snapshot.cashMinor < constraints.minLiquidityMinor) {
    return fail('LIQUIDITY_CONSTRAINT', 'cash is below the authorized liquidity floor')
  }
  return ok({
    snapshot,
    totalMinor: total,
    weights: rows,
    groupWeightsBps,
    cashIsFact: true,
  })
}

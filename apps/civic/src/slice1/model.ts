import {
  CivicDiagnostic,
  validateConfiguration,
  type Seed,
  type Principal,
  type Authority,
  type Evidence,
  type Interpretation,
  type Item,
  type Measure,
  type HumanDecision,
  type Action,
} from '../kernel'

export interface Snapshot {
  actor: Seed['actors'][number]
  membership: Seed['memberships'][number]
  position: Seed['positions'][number]
  authority: Authority
  instrument: Seed['instruments'][number]
  configuration: Seed['config']
  evaluatedAt: string
}
export interface Decision extends HumanDecision {
  supersedes: string | null
  snapshot: Snapshot
  evidence: Evidence[]
  interpretations: Interpretation[]
}
export interface State {
  syntheticOnly: true
  seed: Seed
  approval: { actorId: string; authorityId: string; at: string } | null
  decisions: Decision[]
}
interface Base {
  at: string
  resourceId: string
}
export type Operation =
  | (Base & { kind: 'authorize' })
  | (Base & { kind: 'evidence'; evidence: Evidence })
  | (Base & { kind: 'interpretation'; interpretation: Interpretation })
  | (Base & { kind: 'commitment'; commitment: NonNullable<Item['commitment']> })
  | (Base & { kind: 'execution'; execution: NonNullable<Item['execution']> })
  | (Base & { kind: 'outcome'; outcome: Measure })
  | (Base & {
      kind: 'decision'
      id: string
      disposition: HumanDecision['disposition']
      rationale: string
      supersedes: string | null
    })
  | (Base & { kind: 'revoke'; authorityId: string })
  | (Base & { kind: 'membership'; actorId: string; status: 'active' | 'suspended' })
  | (Base & { kind: 'configuration'; configuration: Seed['config'] })

export function reject(code: string, message: string): never {
  throw new CivicDiagnostic(code, message)
}
export function instant(value: string): number {
  const n = Date.parse(value)
  if (
    !Number.isFinite(n) ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) ||
    new Date(n).toISOString() !== (value.includes('.') ? value : value.replace('Z', '.000Z'))
  )
    reject('INVALID_INPUT', 'Valid UTC instant required')
  return n
}
function nonempty(value: string): void {
  if (typeof value !== 'string' || !value.trim())
    reject('INVALID_INPUT', 'Required statement missing')
}
function identifier(value: string): void {
  if (typeof value !== 'string' || !/^SYN-[A-Z0-9-]+$/.test(value))
    reject('SYNTHETIC_SCOPE_INVALID', 'Synthetic identifier required')
}
function scope(value: { syntheticOnly: true; orgId: string; id: string }, orgId: string): void {
  identifier(value.id)
  if (value.syntheticOnly !== true || value.orgId !== orgId)
    reject('SYNTHETIC_SCOPE_INVALID', 'Synthetic institution-bound record required')
}
export function genesis(seed: Seed): State {
  if (
    seed.syntheticOnly !== true ||
    !seed.institution.name.startsWith('Fictional ') ||
    seed.institution.status !== 'active'
  )
    reject('SYNTHETIC_SCOPE_INVALID', 'Fictional active seed required')
  identifier(seed.institution.id)
  const org = seed.institution.id
  validateConfiguration(seed.config, org)
  for (const records of [
    seed.actors,
    seed.positions,
    seed.instruments,
    seed.authorities,
    seed.items,
    seed.evidence,
    seed.interpretations,
  ]) {
    if (new Set(records.map((x) => x.id)).size !== records.length)
      reject('INVALID_INPUT', 'Duplicate seed identifiers')
    records.forEach((x) => scope(x, org))
  }
  if (seed.items.length !== 1)
    reject('INVALID_INPUT', 'Slice 1 has one bounded item per institution')
  for (const actor of seed.actors) {
    if (
      !['human', 'system'].includes(actor.kind) ||
      !seed.positions.some((p) => p.id === actor.positionId) ||
      actor.session.user.userId !== actor.id ||
      actor.session.activeOrgId !== org ||
      !actor.session.user.email.endsWith('@example.invalid') ||
      !actor.session.user.displayName.startsWith('Fictional ')
    )
      reject('INVALID_ACTOR', 'Fictional bound actor required')
    instant(actor.session.issuedAt)
    instant(actor.session.expiresAt)
  }
  for (const instrument of seed.instruments) {
    if (
      instrument.category !== 'authoritative_record' ||
      !instrument.sourceSystem.startsWith('synthetic:') ||
      !instrument.recordId.startsWith('SYN-')
    )
      reject('INVALID_AUTHORITY', 'Fictional authority instrument required')
    nonempty(instrument.version)
  }
  for (const authority of seed.authorities) {
    const actor = seed.actors.find((a) => a.id === authority.actorId)
    if (
      !actor ||
      actor.kind !== 'human' ||
      actor.positionId !== authority.positionId ||
      !seed.instruments.some((i) => i.id === authority.instrumentId) ||
      !seed.items.some((i) => i.id === authority.resourceId) ||
      !authority.actions.length ||
      authority.actions.some(
        (a) =>
          !['decide', 'record_evidence', 'grant_authority', 'authorize_intervention'].includes(a),
      ) ||
      instant(authority.effectiveAt) >= instant(authority.expiresAt)
    )
      reject('INVALID_AUTHORITY', 'Invalid delegation')
    if (authority.revokedAt !== null) instant(authority.revokedAt)
  }
  if (
    new Set(seed.memberships.map((m) => m.userId)).size !== seed.memberships.length ||
    seed.memberships.some(
      (m) =>
        m.orgId !== org ||
        !seed.actors.some((a) => a.id === m.userId) ||
        m.role !== seed.config.operatorRole,
    )
  )
    reject('INVALID_MEMBERSHIP', 'Institution-bound membership required')
  const state: State = {
    syntheticOnly: true,
    seed: structuredClone(seed),
    approval: null,
    decisions: [],
  }
  for (const evidence of seed.evidence) validateEvidence(state, evidence)
  const item = seed.items[0]
  const target = seed.evidence.find((e) => e.id === item.expected.evidenceId)
  if (!target || target.category !== 'decision_artifact')
    reject('INVALID_OUTCOME', 'Decision target evidence required')
  validateMeasure(state, item.expected)
  instant(item.reviewDue)
  if (!seed.actors.some((a) => a.id === item.ownerId && a.kind === 'human'))
    reject('ACCOUNTABLE_OWNER_REQUIRED', 'Human owner required')
  if (item.commitment || item.execution || item.observed || seed.interpretations.length)
    reject('INVALID_INPUT', 'Persist the operating chain as events, not precompleted genesis')
  return state
}
export function authenticate(state: State, principal: Principal, at: string): void {
  const seed = state.seed
  const actor = seed.actors.find((a) => a.id === principal.actorId)
  const member = seed.memberships.find((m) => m.userId === principal.actorId)
  if (
    principal.orgId !== seed.institution.id ||
    !actor ||
    actor.session.sessionId !== principal.sessionId ||
    !member ||
    member.status !== 'active'
  )
    reject('NOT_FOUND', 'Institutional record unavailable')
  if (
    instant(at) < instant(actor.session.issuedAt) ||
    instant(at) >= instant(actor.session.expiresAt)
  )
    reject('AUTHENTICATION_REQUIRED', 'Session inactive')
}
export function authoritySnapshot(
  state: State,
  principal: Principal,
  at: string,
  action: Action,
): Snapshot {
  authenticate(state, principal, at)
  const seed = state.seed
  const actor = seed.actors.find((a) => a.id === principal.actorId)!
  if (actor.kind !== 'human') reject('HUMAN_REQUIRED', 'Only a human may act consequentially')
  const authority = seed.authorities.find(
    (a) =>
      a.actorId === actor.id &&
      a.positionId === actor.positionId &&
      a.resourceId === seed.items[0].id &&
      a.actions.includes(action) &&
      instant(a.effectiveAt) <= instant(at) &&
      instant(at) < instant(a.expiresAt) &&
      (a.revokedAt === null || instant(at) < instant(a.revokedAt)),
  )
  if (!authority) reject('MISSING_AUTHORITY', 'No currently effective institutional delegation')
  return structuredClone({
    actor,
    membership: seed.memberships.find((m) => m.userId === actor.id)!,
    position: seed.positions.find((p) => p.id === actor.positionId)!,
    authority,
    instrument: seed.instruments.find((i) => i.id === authority.instrumentId)!,
    configuration: seed.config,
    evaluatedAt: at,
  })
}
function linked(state: State, id: string): Evidence {
  const record = state.seed.evidence.find((e) => e.id === id)
  if (!record || record.resourceId !== state.seed.items[0].id)
    reject('PROVENANCE_REQUIRED', 'Evidence must belong to this item')
  return record
}
function validateEvidence(state: State, evidence: Evidence): void {
  scope(evidence, state.seed.institution.id)
  if (
    evidence.resourceId !== state.seed.items[0].id ||
    !state.seed.config.requiredEvidence.includes(evidence.requirement) ||
    ![
      'authoritative_record',
      'referenced_authoritative_record',
      'derived_evidence',
      'institutional_interpretation',
      'decision_artifact',
    ].includes(evidence.category) ||
    !['reference', 'manual'].includes(evidence.mode) ||
    !evidence.sourceSystem.startsWith('synthetic:') ||
    !evidence.recordId.startsWith('SYN-') ||
    !evidence.sourceOwner.startsWith('SYN-')
  )
    reject('INVALID_EVIDENCE', 'Bound synthetic provenance required')
  nonempty(evidence.statement)
  nonempty(evidence.version)
  nonempty(evidence.claimKey)
  instant(evidence.occurredAt)
  if (evidence.mode === 'reference' && evidence.content !== undefined)
    reject('CANONICAL_DUPLICATION', 'Reference-only record cannot copy documents')
  if (evidence.category === 'referenced_authoritative_record' && evidence.mode !== 'reference')
    reject('INVALID_EVIDENCE', 'Referenced authority must remain a reference')
  if ((evidence.category === 'derived_evidence') !== evidence.derivedFrom.length > 0)
    reject('SOURCE_AUTHORITY_INVALID', 'Derived evidence must retain inputs without promotion')
  const visit = (id: string, visited: Set<string>): void => {
    if (visited.has(id)) reject('PROVENANCE_REQUIRED', 'Provenance cycle')
    const record = id === evidence.id ? evidence : linked(state, id)
    for (const parent of record.derivedFrom) visit(parent, new Set([...visited, id]))
  }
  visit(evidence.id, new Set())
  if (
    state.seed.evidence.some(
      (e) =>
        e.id !== evidence.id &&
        e.sourceSystem === evidence.sourceSystem &&
        e.recordId === evidence.recordId &&
        e.version === evidence.version &&
        e.category !== evidence.category,
    )
  )
    reject('SOURCE_AUTHORITY_INVALID', 'Referenced source category cannot be relabelled')
}
function validateMeasure(state: State, measure: Measure): void {
  if (!Number.isFinite(measure.value) || measure.value < 0 || measure.unit !== 'working_days')
    reject('INVALID_OUTCOME', 'Finite nonnegative working-day value required')
  nonempty(measure.window)
  linked(state, measure.evidenceId)
}
export function brief(state: State, at: string) {
  const seed = state.seed,
    item = seed.items[0]
  const missing = seed.config.requiredEvidence.filter(
    (r) => !seed.evidence.some((e) => e.requirement === r),
  )
  const conflicts =
    seed.evidence.some((e) =>
      seed.evidence.some(
        (other) =>
          e.id !== other.id && e.claimKey === other.claimKey && e.statement !== other.statement,
      ),
    ) || new Set(seed.interpretations.map((i) => i.statement)).size > 1
  const comparable =
    !!item.observed &&
    item.expected.unit === item.observed.unit &&
    item.expected.window === item.observed.window
  const variance = comparable ? item.observed!.value - item.expected.value : null
  const latest = state.decisions.at(-1) ?? null
  const reasons = [
    ...(instant(at) >= instant(item.reviewDue) ? ['Review due'] : []),
    ...(variance !== null && variance > seed.config.materialVarianceDays
      ? ['Material outcome variance']
      : []),
    ...(missing.length ? ['Required evidence missing'] : []),
    ...(!item.observed ? ['Observed outcome missing'] : []),
    ...(item.observed && !comparable ? ['Outcome measures incomparable'] : []),
    ...(!item.commitment ? ['Commitment missing'] : []),
    ...(!item.execution ||
    !item.commitment ||
    item.execution.receivedDeliverables < item.commitment.expectedDeliverables
      ? ['Deliverables incomplete']
      : []),
    ...(conflicts ? ['Conflicting evidence or interpretation unresolved'] : []),
  ]
  return structuredClone({
    orgId: seed.institution.id,
    item,
    approval: state.approval,
    status: latest
      ? 'DECIDED'
      : state.approval && reasons.length
        ? 'DECISION_REQUIRED'
        : 'COLLECTING',
    missingEvidence: missing,
    varianceDays: variance,
    conflictStatus: conflicts ? 'UNRESOLVED' : 'NONE',
    risks: reasons,
    decisions: state.decisions,
    evidence: seed.evidence,
    interpretations: seed.interpretations,
    nextAction: latest
      ? `Human disposition: ${latest.disposition}`
      : 'Authorized human review required',
  })
}
export function apply(
  state: State,
  principal: Principal,
  operation: Operation,
): { state: State; snapshot: Snapshot } {
  const next = structuredClone(state)
  const op = operation,
    seed = next.seed,
    item = seed.items[0]
  instant(op.at)
  if (op.resourceId !== item.id) reject('NOT_FOUND', 'Item unavailable')
  const action: Action =
    op.kind === 'authorize'
      ? 'authorize_intervention'
      : ['revoke', 'membership', 'configuration'].includes(op.kind)
        ? 'grant_authority'
        : op.kind === 'decision'
          ? 'decide'
          : 'record_evidence'
  const snapshot = authoritySnapshot(next, principal, op.at, action)
  const previous = next.decisions.at(-1)
  if (previous && !['decision', 'revoke', 'membership', 'configuration'].includes(op.kind))
    reject('INVALID_WORKFLOW_STATE', 'Decided operating record is immutable')
  if (!next.approval && !['authorize', 'revoke', 'membership', 'configuration'].includes(op.kind))
    reject('INVALID_WORKFLOW_STATE', 'Human intervention approval required')
  switch (op.kind) {
    case 'authorize':
      if (next.approval) reject('INVALID_WORKFLOW_STATE', 'Already authorized')
      next.approval = { actorId: principal.actorId, authorityId: snapshot.authority.id, at: op.at }
      break
    case 'evidence':
      if (seed.evidence.some((e) => e.id === op.evidence.id))
        reject('INVALID_EVIDENCE', 'Evidence identifier exists')
      validateEvidence(next, op.evidence)
      seed.evidence.push(structuredClone(op.evidence))
      break
    case 'interpretation':
      scope(op.interpretation, seed.institution.id)
      if (
        op.interpretation.authorId !== principal.actorId ||
        op.interpretation.resourceId !== item.id ||
        !op.interpretation.evidenceIds.length ||
        seed.interpretations.some((i) => i.id === op.interpretation.id)
      )
        reject('PROVENANCE_REQUIRED', 'New attributable same-item interpretation required')
      op.interpretation.evidenceIds.forEach((id) => linked(next, id))
      nonempty(op.interpretation.statement)
      seed.interpretations.push(structuredClone(op.interpretation))
      break
    case 'commitment':
      if (
        item.commitment ||
        !Number.isFinite(op.commitment.ceilingCad) ||
        op.commitment.ceilingCad < 0 ||
        !Number.isInteger(op.commitment.expectedDeliverables) ||
        op.commitment.expectedDeliverables < 1
      )
        reject('INVALID_COMMITMENT', 'New bounded commitment required')
      linked(next, op.commitment.sourceId)
      item.commitment = structuredClone(op.commitment)
      break
    case 'execution':
      if (
        !item.commitment ||
        item.execution ||
        !Number.isInteger(op.execution.receivedDeliverables) ||
        op.execution.receivedDeliverables < 0 ||
        op.execution.receivedDeliverables > item.commitment.expectedDeliverables
      )
        reject('INVALID_EXECUTION', 'Execution within active commitment required')
      linked(next, op.execution.sourceId)
      item.execution = structuredClone(op.execution)
      break
    case 'outcome':
      if (item.observed) reject('INVALID_WORKFLOW_STATE', 'Observation already recorded')
      validateMeasure(next, op.outcome)
      if (
        !['authoritative_record', 'referenced_authoritative_record', 'derived_evidence'].includes(
          linked(next, op.outcome.evidenceId).category,
        )
      )
        reject('INVALID_OUTCOME', 'Actual observation must not use target/interpretation')
      if (op.outcome.window !== item.expected.window)
        reject('INCOMPARABLE_OUTCOME', 'Measurement window differs')
      item.observed = structuredClone(op.outcome)
      break
    case 'decision': {
      identifier(op.id)
      nonempty(op.rationale)
      if (
        !['change', 'terminate', 'request_evidence'].includes(op.disposition) ||
        next.decisions.some((d) => d.id === op.id) ||
        op.supersedes !== (previous?.id ?? null) ||
        (!previous && brief(next, op.at).status !== 'DECISION_REQUIRED')
      )
        reject(
          'INVALID_WORKFLOW_STATE',
          'Explicit new decision or latest-decision supersession required',
        )
      next.decisions.push({
        id: op.id,
        syntheticOnly: true,
        orgId: principal.orgId,
        resourceId: item.id,
        actorId: principal.actorId,
        authorityId: snapshot.authority.id,
        instrumentId: snapshot.instrument.id,
        disposition: op.disposition,
        rationale: op.rationale,
        supersedes: op.supersedes,
        snapshot,
        evidenceIds: seed.evidence.map((e) => e.id),
        interpretationIds: seed.interpretations.map((i) => i.id),
        evidence: structuredClone(seed.evidence),
        interpretations: structuredClone(seed.interpretations),
        unresolvedConflict: brief(next, op.at).conflictStatus === 'UNRESOLVED',
        occurredAt: op.at,
      })
      break
    }
    case 'revoke': {
      const grant = seed.authorities.find((a) => a.id === op.authorityId)
      if (!grant || grant.revokedAt !== null)
        reject('INVALID_AUTHORITY', 'Active same-institution authority required')
      grant.revokedAt = op.at
      break
    }
    case 'membership': {
      const member = seed.memberships.find((m) => m.userId === op.actorId)
      if (!member || !['active', 'suspended'].includes(op.status))
        reject('INVALID_MEMBERSHIP', 'Bound member/status required')
      member.status = op.status
      break
    }
    case 'configuration':
      validateConfiguration(op.configuration, seed.institution.id)
      if (op.configuration.version !== seed.config.version + 1)
        reject('STALE_STATE', 'Next configuration version required')
      seed.config = structuredClone(op.configuration)
      break
    default:
      reject('INVALID_INPUT', 'Unsupported operation')
  }
  return { state: next, snapshot }
}

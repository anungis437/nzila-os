import { sessionIdentitySchema, type SessionIdentity } from '@nzila/platform-contracts/identity'
import {
  orgScopeSchema,
  orgScopeMembershipSchema,
  type OrgScope,
  type OrgScopeMembership,
} from '@nzila/platform-contracts/org-scope'
import { roleDefinitionSchema } from '@nzila/platform-contracts/role'
import {
  platformAuditEventSchema,
  type PlatformAuditEvent,
} from '@nzila/platform-contracts/audit-event'
import { assertRuntimeAuthorization } from './authorization'

export type Category =
  | 'authoritative_record'
  | 'referenced_authoritative_record'
  | 'derived_evidence'
  | 'institutional_interpretation'
  | 'decision_artifact'
export type Action = 'grant_authority' | 'authorize_intervention' | 'record_evidence' | 'decide'
type Scoped = { syntheticOnly: true; orgId: string; id: string }

export interface Position extends Scoped {
  label: string
}
export interface Actor extends Scoped {
  kind: 'human' | 'system'
  positionId: string
  session: SessionIdentity
}
export interface Instrument extends Scoped {
  sourceSystem: string
  recordId: string
  version: string
  category: 'authoritative_record'
}
export interface Authority extends Scoped {
  actorId: string
  positionId: string
  instrumentId: string
  resourceId: string
  actions: Action[]
  effectiveAt: string
  expiresAt: string
  revokedAt: string | null
}
export interface Evidence extends Scoped {
  resourceId: string
  requirement: string
  category: Category
  mode: 'manual' | 'reference'
  sourceSystem: string
  recordId: string
  version: string
  sourceOwner: string
  occurredAt: string
  content?: string
  derivedFrom: string[]
  claimKey: string
  statement: string
}
export interface Interpretation extends Scoped {
  resourceId: string
  authorId: string
  evidenceIds: string[]
  statement: string
}
export interface Configuration extends Scoped {
  version: number
  itemLabel: string
  ownerLabel: string
  operatorRole: string
  requiredEvidence: string[]
  stages: { collecting: string; decisionRequired: string; decided: string }
  materialVarianceDays: number
}
export interface Measure {
  value: number
  unit: 'working_days'
  window: string
  evidenceId: string
}
export interface Item extends Scoped {
  objective: string
  ownerId: string
  intervention: string
  reviewDue: string
  commitment: { sourceId: string; ceilingCad: number; expectedDeliverables: number } | null
  execution: { sourceId: string; receivedDeliverables: number } | null
  expected: Measure
  observed: Measure | null
}
export interface Seed {
  syntheticOnly: true
  institution: OrgScope
  config: Configuration
  positions: Position[]
  actors: Actor[]
  memberships: OrgScopeMembership[]
  instruments: Instrument[]
  authorities: Authority[]
  items: Item[]
  evidence: Evidence[]
  interpretations: Interpretation[]
}
export interface Principal {
  orgId: string
  actorId: string
  sessionId: string
}
export interface HumanDecision {
  id: string
  syntheticOnly: true
  orgId: string
  resourceId: string
  actorId: string
  authorityId: string
  instrumentId: string
  disposition: 'change' | 'terminate' | 'request_evidence'
  rationale: string
  evidenceIds: string[]
  interpretationIds: string[]
  unresolvedConflict: boolean
  occurredAt: string
}

export class CivicDiagnostic extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(`${code}: ${message}`)
    this.name = 'CivicDiagnostic'
  }
}
function fail(code: string, message: string): never {
  throw new CivicDiagnostic(code, message)
}
function text(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_INPUT', `${field} is required`)
}
function date(value: string): number {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail('INVALID_INPUT', 'A valid UTC timestamp is required')
  if (new Date(value).toISOString() !== (value.includes('.') ? value : value.replace('Z', '.000Z')))
    fail('INVALID_INPUT', 'Calendar date is invalid')
  return Date.parse(value)
}
function scoped(object: Scoped, orgId: string): void {
  if (object.syntheticOnly !== true || !object.id.startsWith('SYN-') || object.orgId !== orgId)
    fail('SYNTHETIC_SCOPE_INVALID', 'Only synthetic records in this institution are permitted')
}
function requireUnique<T extends { id: string }>(entries: T[], label: string): Map<string, T> {
  const map = new Map(entries.map((entry) => [entry.id, entry]))
  if (map.size !== entries.length) fail('INVALID_INPUT', `Duplicate ${label} identifier`)
  return map
}

export function validateConfiguration(config: Configuration, orgId: string): void {
  scoped(config, orgId)
  const keys = [
    'syntheticOnly',
    'orgId',
    'id',
    'version',
    'itemLabel',
    'ownerLabel',
    'operatorRole',
    'requiredEvidence',
    'stages',
    'materialVarianceDays',
  ]
  if (
    Object.keys(config).some((key) => !keys.includes(key)) ||
    Object.keys(config.stages ?? {}).some(
      (key) => !['collecting', 'decisionRequired', 'decided'].includes(key),
    )
  )
    fail('INVALID_CONFIGURATION', 'Unsupported institutional configuration field')
  if (
    !Number.isInteger(config.version) ||
    config.version < 1 ||
    !Number.isFinite(config.materialVarianceDays) ||
    config.materialVarianceDays < 0 ||
    !config.requiredEvidence.length ||
    new Set(config.requiredEvidence).size !== config.requiredEvidence.length ||
    config.requiredEvidence.some((label) => typeof label !== 'string' || !label.trim()) ||
    !config.stages ||
    new Set(Object.values(config.stages)).size !== 3 ||
    Object.values(config.stages).some((label) => !label.trim())
  ) {
    fail(
      'INVALID_CONFIGURATION',
      'Check version, evidence requirements, distinct workflow labels and variance threshold',
    )
  }
  for (const value of [config.itemLabel, config.ownerLabel, config.operatorRole])
    text(value, 'configuration label')
  roleDefinitionSchema.parse({
    id: config.operatorRole,
    name: config.operatorRole,
    permissions: ['civic.read'],
    level: 0,
  })
}

export class CivicKernel {
  private readonly seed: Seed
  private readonly positions: Map<string, Position>
  private readonly actors: Map<string, Actor>
  private readonly memberships: Map<string, OrgScopeMembership>
  private readonly instruments: Map<string, Instrument>
  private readonly authorities: Map<string, Authority>
  private readonly items: Map<string, Item>
  private readonly evidence: Map<string, Evidence>
  private readonly interpretations: Map<string, Interpretation>
  private readonly decisions = new Map<string, HumanDecision>()
  private readonly interventionApprovals = new Map<
    string,
    { actorId: string; authorityId: string; occurredAt: string }
  >()
  private readonly audit: PlatformAuditEvent[] = []

  constructor(
    seed: Seed,
    private readonly clock: () => Date = () => new Date(),
  ) {
    assertRuntimeAuthorization()
    this.seed = structuredClone(seed)
    if (seed.syntheticOnly !== true) fail('SYNTHETIC_SCOPE_INVALID', 'Synthetic seed required')
    const institution = orgScopeSchema.parse(seed.institution)
    if (
      !institution.id.startsWith('SYN-') ||
      !institution.name.startsWith('Fictional ') ||
      institution.status !== 'active'
    )
      fail('SYNTHETIC_SCOPE_INVALID', 'Active fictional institution required')
    validateConfiguration(this.seed.config, institution.id)
    this.positions = requireUnique(this.seed.positions, 'position')
    this.actors = requireUnique(this.seed.actors, 'actor')
    this.memberships = new Map(
      this.seed.memberships.map((membership) => [
        membership.userId,
        orgScopeMembershipSchema.parse(membership),
      ]),
    )
    if (
      this.memberships.size !== this.seed.memberships.length ||
      [...this.memberships.values()].some(
        (membership) =>
          membership.orgId !== institution.id ||
          !this.actors.has(membership.userId) ||
          membership.role !== this.seed.config.operatorRole,
      )
    )
      fail(
        'INVALID_MEMBERSHIP',
        'Unique, institution-scoped membership with configured application role required',
      )
    this.instruments = requireUnique(this.seed.instruments, 'instrument')
    this.authorities = requireUnique(this.seed.authorities, 'authority')
    this.items = requireUnique(this.seed.items, 'item')
    this.evidence = requireUnique(this.seed.evidence, 'evidence')
    this.interpretations = requireUnique(this.seed.interpretations, 'interpretation')
    for (const entries of [
      this.seed.positions,
      this.seed.actors,
      this.seed.instruments,
      this.seed.authorities,
      this.seed.items,
      this.seed.evidence,
      this.seed.interpretations,
    ]) {
      for (const entry of entries) scoped(entry, institution.id)
    }
    for (const actor of this.actors.values()) {
      if (!['human', 'system'].includes(actor.kind) || !this.positions.has(actor.positionId))
        fail('INVALID_ACTOR', 'Actor kind and accountable position are required')
      const session = sessionIdentitySchema.parse(actor.session)
      if (
        session.user.userId !== actor.id ||
        session.activeOrgId !== institution.id ||
        !session.user.email.endsWith('@example.invalid') ||
        !session.user.displayName.startsWith('Fictional ')
      )
        fail('SYNTHETIC_SCOPE_INVALID', 'Fictional identity must match institution and actor')
      date(session.issuedAt)
      date(session.expiresAt)
    }
    for (const position of this.positions.values()) {
      if (!position.label.startsWith('Fictional '))
        fail('SYNTHETIC_SCOPE_INVALID', 'Fictional position label required')
    }
    for (const instrument of this.instruments.values()) this.validateInstrument(instrument)
    for (const authority of this.authorities.values()) this.validateAuthority(authority)
    for (const evidence of this.evidence.values()) this.validateEvidence(evidence)
    for (const interpretation of this.interpretations.values())
      this.validateInterpretation(interpretation)
    for (const item of this.items.values()) this.validateItem(item)
  }

  private now(): string {
    const time = this.clock()
    if (!Number.isFinite(time.getTime())) fail('INVALID_INPUT', 'Valid proof clock required')
    return time.toISOString().replace('.000Z', 'Z')
  }
  private authenticate(principal: Principal, resourceId: string): { actor: Actor; item: Item } {
    assertRuntimeAuthorization()
    if (principal.orgId !== this.seed.institution.id)
      fail('NOT_FOUND', 'Institutional item not available')
    const actor = this.actors.get(principal.actorId)
    const item = this.items.get(resourceId)
    if (!actor || !item || actor.session.sessionId !== principal.sessionId)
      fail('NOT_FOUND', 'Institutional item not available')
    const now = date(this.now())
    if (now < date(actor.session.issuedAt) || now >= date(actor.session.expiresAt))
      fail('AUTHENTICATION_REQUIRED', 'Synthetic session is not active')
    const membership = this.memberships.get(actor.id)
    if (!membership || membership.status !== 'active')
      fail('NOT_FOUND', 'Institutional item not available')
    return { actor, item }
  }
  private authorize(
    principal: Principal,
    resourceId: string,
    action: Action,
  ): { actor: Actor; item: Item; authority: Authority } {
    const { actor, item } = this.authenticate(principal, resourceId)
    if (actor.kind !== 'human')
      fail('HUMAN_REQUIRED', 'A human actor is required for this institutional action')
    const now = date(this.now())
    const authority = [...this.authorities.values()].find(
      (grant) =>
        grant.actorId === actor.id &&
        grant.positionId === actor.positionId &&
        grant.orgId === principal.orgId &&
        grant.resourceId === item.id &&
        grant.actions.includes(action) &&
        grant.revokedAt === null &&
        date(grant.effectiveAt) <= now &&
        now < date(grant.expiresAt),
    )
    if (!authority)
      fail('MISSING_AUTHORITY', 'No effective delegated authority for this item and action')
    return { actor, item, authority }
  }
  private validateInstrument(instrument: Instrument): void {
    if (
      instrument.category !== 'authoritative_record' ||
      !instrument.sourceSystem.startsWith('synthetic:') ||
      !instrument.recordId.startsWith('SYN-')
    )
      fail('INVALID_AUTHORITY', 'Synthetic authority instrument required')
    text(instrument.version, 'instrument version')
  }
  private validateAuthority(grant: Authority): void {
    scoped(grant, this.seed.institution.id)
    const actor = this.actors.get(grant.actorId)
    if (
      !actor ||
      actor.kind !== 'human' ||
      actor.positionId !== grant.positionId ||
      !this.instruments.has(grant.instrumentId) ||
      !this.items.has(grant.resourceId) ||
      !grant.actions.length ||
      grant.actions.some(
        (action) =>
          !['grant_authority', 'authorize_intervention', 'record_evidence', 'decide'].includes(
            action,
          ),
      ) ||
      date(grant.effectiveAt) >= date(grant.expiresAt)
    )
      fail(
        'INVALID_AUTHORITY',
        'Delegation must bind human position, instrument, item, actions and valid period',
      )
    if (grant.revokedAt !== null) date(grant.revokedAt)
  }
  private validateEvidence(evidence: Evidence): void {
    scoped(evidence, this.seed.institution.id)
    if (
      !this.items.has(evidence.resourceId) ||
      !this.seed.config.requiredEvidence.includes(evidence.requirement) ||
      ![
        'authoritative_record',
        'referenced_authoritative_record',
        'derived_evidence',
        'institutional_interpretation',
        'decision_artifact',
      ].includes(evidence.category) ||
      !['manual', 'reference'].includes(evidence.mode) ||
      !evidence.sourceSystem.startsWith('synthetic:') ||
      !evidence.recordId.startsWith('SYN-') ||
      !evidence.sourceOwner.startsWith('SYN-')
    )
      fail('INVALID_EVIDENCE', 'Bound synthetic evidence source and requirement are required')
    for (const value of [evidence.version, evidence.claimKey, evidence.statement])
      text(value, 'evidence provenance/claim')
    date(evidence.occurredAt)
    if (evidence.mode === 'reference' && evidence.content !== undefined)
      fail('CANONICAL_DUPLICATION', 'Reference metadata must not copy source content')
    if (evidence.mode === 'manual') text(evidence.statement, 'manual capture')
    if (evidence.category === 'referenced_authoritative_record' && evidence.mode !== 'reference')
      fail('INVALID_EVIDENCE', 'Referenced authoritative record must remain a reference')
    if (evidence.category === 'derived_evidence' && !evidence.derivedFrom.length)
      fail('PROVENANCE_REQUIRED', 'Derived evidence needs its input evidence links')
    if (evidence.derivedFrom.length && evidence.category !== 'derived_evidence')
      fail('SOURCE_AUTHORITY_INVALID', 'Derived inputs cannot be promoted to authoritative truth')
    const prior = [...this.evidence.values()].find(
      (entry) =>
        entry.id !== evidence.id &&
        entry.sourceSystem === evidence.sourceSystem &&
        entry.recordId === evidence.recordId &&
        entry.version === evidence.version &&
        entry.category !== evidence.category,
    )
    if (prior)
      fail(
        'SOURCE_AUTHORITY_INVALID',
        'Source category is immutable for a referenced record version',
      )
    for (const id of evidence.derivedFrom) {
      const source = this.evidence.get(id)
      if (!source || source.id === evidence.id || source.resourceId !== evidence.resourceId)
        fail('PROVENANCE_REQUIRED', 'Derived input is missing or belongs to another item')
    }
    const visit = (id: string, path: Set<string>): void => {
      if (path.has(id)) fail('PROVENANCE_REQUIRED', 'Derived evidence provenance cannot be cyclic')
      const entry = id === evidence.id ? evidence : this.evidence.get(id)
      if (entry) for (const parent of entry.derivedFrom) visit(parent, new Set([...path, id]))
    }
    visit(evidence.id, new Set())
  }
  private validateInterpretation(interpretation: Interpretation): void {
    scoped(interpretation, this.seed.institution.id)
    if (
      !this.items.has(interpretation.resourceId) ||
      !this.actors.has(interpretation.authorId) ||
      !interpretation.evidenceIds.length ||
      interpretation.evidenceIds.some(
        (id) => this.evidence.get(id)?.resourceId !== interpretation.resourceId,
      )
    )
      fail(
        'PROVENANCE_REQUIRED',
        'Interpretation requires an accountable author and same-item evidence',
      )
    text(interpretation.statement, 'interpretation')
  }
  private linked(id: string, itemId: string): Evidence {
    const source = this.evidence.get(id)
    if (!source || source.resourceId !== itemId)
      fail('PROVENANCE_REQUIRED', 'Evidence link is missing or outside this item')
    return source
  }
  private validateMeasure(measure: Measure, itemId: string): void {
    if (!Number.isFinite(measure.value) || measure.value < 0 || measure.unit !== 'working_days')
      fail('INVALID_OUTCOME', 'Outcome must use finite working-day values')
    text(measure.window, 'measurement window')
    this.linked(measure.evidenceId, itemId)
  }
  private validateItem(item: Item): void {
    if (!this.actors.has(item.ownerId) || this.actors.get(item.ownerId)?.kind !== 'human')
      fail('ACCOUNTABLE_OWNER_REQUIRED', 'Explicit human owner is required')
    text(item.objective, 'objective')
    text(item.intervention, 'intervention')
    date(item.reviewDue)
    if (item.commitment) this.validateCommitment(item.commitment, item.id)
    this.validateMeasure(item.expected, item.id)
    if (this.linked(item.expected.evidenceId, item.id).category !== 'decision_artifact')
      fail('INVALID_OUTCOME', 'Expected outcome needs its approving decision artifact')
    if (item.observed) this.validateObservation(item.observed, item.id)
    if (item.execution) {
      this.linked(item.execution.sourceId, item.id)
      if (
        !Number.isInteger(item.execution.receivedDeliverables) ||
        item.execution.receivedDeliverables < 0 ||
        !item.commitment ||
        item.execution.receivedDeliverables > item.commitment.expectedDeliverables
      )
        fail('INVALID_EXECUTION', 'Received deliverables must be within commitment')
    }
  }
  private validateCommitment(
    commitment: NonNullable<Item['commitment']>,
    resourceId: string,
  ): void {
    if (
      !Number.isFinite(commitment.ceilingCad) ||
      commitment.ceilingCad < 0 ||
      !Number.isInteger(commitment.expectedDeliverables) ||
      commitment.expectedDeliverables < 1
    )
      fail('INVALID_COMMITMENT', 'Bounded commitment ceiling and deliverable count required')
    this.linked(commitment.sourceId, resourceId)
  }
  private validateObservation(measure: Measure, resourceId: string): void {
    this.validateMeasure(measure, resourceId)
    if (
      !['authoritative_record', 'referenced_authoritative_record', 'derived_evidence'].includes(
        this.linked(measure.evidenceId, resourceId).category,
      )
    )
      fail(
        'INVALID_OUTCOME',
        'Observed outcome requires observation evidence, not an expectation or interpretation',
      )
  }
  private emit(
    principal: Principal,
    resourceId: string,
    action: string,
    authorityId?: string,
  ): void {
    const id = `00000000-0000-4000-8000-${String(this.audit.length + 1).padStart(12, '0')}`
    this.audit.push(
      platformAuditEventSchema.parse({
        id,
        timestamp: this.now(),
        actorId: principal.actorId,
        orgId: principal.orgId,
        moduleId: 'civic-synthetic-slice0',
        action,
        resource: 'institutional_item',
        resourceId,
        payload: { syntheticOnly: true, ...(authorityId ? { authorityId } : {}) },
        evidenceGrade: false,
      }),
    )
  }
  grantAuthority(principal: Principal, resourceId: string, grant: Authority): void {
    const { authority } = this.authorize(principal, resourceId, 'grant_authority')
    this.validateAuthority(grant)
    if (
      grant.resourceId !== resourceId ||
      grant.actions.some((action) => !authority.actions.includes(action)) ||
      date(grant.effectiveAt) < date(authority.effectiveAt) ||
      date(grant.expiresAt) > date(authority.expiresAt)
    )
      fail('INVALID_AUTHORITY', 'Delegation cannot exceed granting authority scope or period')
    if (this.authorities.has(grant.id)) fail('INVALID_INPUT', 'Authority identifier already exists')
    this.authorities.set(grant.id, structuredClone(grant))
    this.emit(principal, resourceId, 'authority.granted', authority.id)
  }
  authorizeIntervention(principal: Principal, resourceId: string): void {
    const { actor, authority } = this.authorize(principal, resourceId, 'authorize_intervention')
    if (this.interventionApprovals.has(resourceId))
      fail('INVALID_WORKFLOW_STATE', 'Intervention already authorized')
    this.interventionApprovals.set(resourceId, {
      actorId: actor.id,
      authorityId: authority.id,
      occurredAt: this.now(),
    })
    this.emit(principal, resourceId, 'intervention.authorized', authority.id)
  }
  recordCommitment(
    principal: Principal,
    resourceId: string,
    commitment: NonNullable<Item['commitment']>,
  ): void {
    const { item, authority } = this.authorize(principal, resourceId, 'record_evidence')
    if (
      !this.interventionApprovals.has(resourceId) ||
      this.decisions.has(resourceId) ||
      item.commitment
    )
      fail(
        'INVALID_WORKFLOW_STATE',
        'An authorized intervention without a prior commitment is required',
      )
    this.validateCommitment(commitment, resourceId)
    item.commitment = structuredClone(commitment)
    this.emit(principal, resourceId, 'commitment.recorded', authority.id)
  }
  recordExecution(
    principal: Principal,
    resourceId: string,
    execution: NonNullable<Item['execution']>,
  ): void {
    const { item, authority } = this.authorize(principal, resourceId, 'record_evidence')
    if (
      !this.interventionApprovals.has(resourceId) ||
      this.decisions.has(resourceId) ||
      !item.commitment ||
      item.execution
    )
      fail(
        'INVALID_WORKFLOW_STATE',
        'An active commitment without a prior execution observation is required',
      )
    this.linked(execution.sourceId, resourceId)
    if (
      !Number.isInteger(execution.receivedDeliverables) ||
      execution.receivedDeliverables < 0 ||
      execution.receivedDeliverables > item.commitment.expectedDeliverables
    )
      fail('INVALID_EXECUTION', 'Received deliverables must be within commitment')
    item.execution = structuredClone(execution)
    this.emit(principal, resourceId, 'execution.recorded', authority.id)
  }
  submitEvidence(principal: Principal, resourceId: string, evidence: Evidence): void {
    const { authority } = this.authorize(principal, resourceId, 'record_evidence')
    if (!this.interventionApprovals.has(resourceId) || this.decisions.has(resourceId))
      fail(
        'INVALID_WORKFLOW_STATE',
        'Authorize intervention before evidence capture; decided items are immutable',
      )
    if (evidence.resourceId !== resourceId || this.evidence.has(evidence.id))
      fail('INVALID_EVIDENCE', 'Evidence ID must be new and bound to this item')
    this.validateEvidence(evidence)
    this.evidence.set(evidence.id, structuredClone(evidence))
    this.emit(principal, resourceId, 'evidence.recorded', authority.id)
  }
  captureNote(
    principal: Principal,
    resourceId: string,
    input: {
      id: string
      requirement: string
      note: string
      recordedAt: string
    },
  ): void {
    this.submitEvidence(principal, resourceId, {
      syntheticOnly: true,
      orgId: principal.orgId,
      id: input.id,
      resourceId,
      requirement: input.requirement,
      category: 'institutional_interpretation',
      mode: 'manual',
      sourceSystem: 'synthetic:operator-notes',
      recordId: input.id,
      version: '1',
      sourceOwner: principal.orgId,
      occurredAt: input.recordedAt,
      derivedFrom: [],
      claimKey: input.requirement,
      statement: input.note,
    })
  }
  referenceRecord(
    principal: Principal,
    resourceId: string,
    input: {
      id: string
      requirement: string
      sourceSystem: string
      recordId: string
      version: string
      sourceOwner: string
      recordedAt: string
      description: string
    },
  ): void {
    this.submitEvidence(principal, resourceId, {
      syntheticOnly: true,
      orgId: principal.orgId,
      id: input.id,
      resourceId,
      requirement: input.requirement,
      category: 'referenced_authoritative_record',
      mode: 'reference',
      sourceSystem: input.sourceSystem,
      recordId: input.recordId,
      version: input.version,
      sourceOwner: input.sourceOwner,
      occurredAt: input.recordedAt,
      derivedFrom: [],
      claimKey: input.requirement,
      statement: input.description,
    })
  }
  observeOutcome(principal: Principal, resourceId: string, observed: Measure): void {
    const { item, authority } = this.authorize(principal, resourceId, 'record_evidence')
    if (
      !this.interventionApprovals.has(resourceId) ||
      this.decisions.has(resourceId) ||
      item.observed
    )
      fail('INVALID_WORKFLOW_STATE', 'An active item with no prior observation is required')
    this.validateObservation(observed, resourceId)
    if (observed.unit !== item.expected.unit || observed.window !== item.expected.window)
      fail('INCOMPARABLE_OUTCOME', 'Expected and observed measures must share unit and window')
    item.observed = structuredClone(observed)
    this.emit(principal, resourceId, 'outcome.observed', authority.id)
  }
  addInterpretation(
    principal: Principal,
    resourceId: string,
    interpretation: Interpretation,
  ): void {
    const { actor, authority } = this.authorize(principal, resourceId, 'record_evidence')
    if (
      interpretation.authorId !== actor.id ||
      interpretation.resourceId !== resourceId ||
      this.interpretations.has(interpretation.id) ||
      this.decisions.has(resourceId)
    )
      fail('INVALID_INPUT', 'New interpretation must be attributed to its authenticated author')
    this.validateInterpretation(interpretation)
    this.interpretations.set(interpretation.id, structuredClone(interpretation))
    this.emit(principal, resourceId, 'interpretation.recorded', authority.id)
  }
  brief(principal: Principal, resourceId: string) {
    const { item } = this.authenticate(principal, resourceId)
    const sources = [...this.evidence.values()].filter((entry) => entry.resourceId === item.id)
    const interpretations = [...this.interpretations.values()].filter(
      (entry) => entry.resourceId === item.id,
    )
    const missingEvidence = this.seed.config.requiredEvidence.filter(
      (key) => !sources.some((entry) => entry.requirement === key),
    )
    const outcomeComparable =
      item.observed &&
      item.observed.unit === item.expected.unit &&
      item.observed.window === item.expected.window
    const variance =
      outcomeComparable && item.observed ? item.observed.value - item.expected.value : null
    const competingEvidence = sources.filter((entry) =>
      sources.some(
        (other) =>
          other.id !== entry.id &&
          other.claimKey === entry.claimKey &&
          other.statement !== entry.statement,
      ),
    )
    const conflict =
      competingEvidence.length > 0 ||
      new Set(interpretations.map((entry) => entry.statement)).size > 1
    const decision = this.decisions.get(item.id) ?? null
    const approval = this.interventionApprovals.get(item.id) ?? null
    const reasons: string[] = []
    if (date(this.now()) >= date(item.reviewDue)) reasons.push('Review due')
    if (variance !== null && variance > this.seed.config.materialVarianceDays)
      reasons.push('Material outcome variance')
    if (missingEvidence.length) reasons.push('Required evidence missing')
    if (!item.observed) reasons.push('Observed outcome missing')
    if (item.observed && !outcomeComparable) reasons.push('Outcome measures incomparable')
    if (!item.commitment) reasons.push('Commitment missing')
    if (
      !item.execution ||
      !item.commitment ||
      item.execution.receivedDeliverables < item.commitment.expectedDeliverables
    )
      reasons.push('Deliverables incomplete')
    if (conflict) reasons.push('Conflicting evidence or interpretation unresolved')
    const status = decision
      ? 'DECIDED'
      : approval && reasons.length
        ? 'DECISION_REQUIRED'
        : 'COLLECTING'
    const grant = approval ? this.authorities.get(approval.authorityId)! : null
    return structuredClone({
      syntheticOnly: true,
      orgId: item.orgId,
      resourceId: item.id,
      status,
      objective: item.objective,
      intervention: item.intervention,
      owner: this.actors.get(item.ownerId)!,
      approval,
      authority: grant,
      authorityInstrument: grant ? this.instruments.get(grant.instrumentId)! : null,
      commitment: item.commitment,
      execution: item.execution,
      evidence: sources,
      missingEvidence,
      expectedOutcome: item.expected,
      observedOutcome: item.observed,
      varianceDays: variance,
      materialVariance: variance !== null && variance > this.seed.config.materialVarianceDays,
      interpretations,
      competingEvidence,
      conflictStatus: conflict ? 'UNRESOLVED' : 'NONE',
      risks: reasons,
      decisionRequired: status === 'DECISION_REQUIRED',
      humanDecision: decision,
      nextAction: decision
        ? `Human disposition: ${decision.disposition}`
        : !approval
          ? 'An authorized human must approve this intervention'
          : status === 'DECISION_REQUIRED'
            ? 'An authorized human must review evidence and record the next decision'
            : 'Collect or reference required evidence',
      diagnostics: reasons.map((message) => ({ code: 'OPEN_REVIEW_REQUIREMENT', message })),
    })
  }
  operator(principal: Principal, resourceId: string) {
    const brief = this.brief(principal, resourceId)
    const now = date(this.now())
    const hasDecisionAuthority = [...this.authorities.values()].some(
      (grant) =>
        grant.actorId === principal.actorId &&
        grant.resourceId === resourceId &&
        grant.actions.includes('decide') &&
        grant.revokedAt === null &&
        date(grant.effectiveAt) <= now &&
        now < date(grant.expiresAt),
    )
    return {
      label: this.seed.config.itemLabel,
      why: brief.objective,
      responsibility: `${this.seed.config.ownerLabel}: ${brief.owner.session.user.displayName}`,
      requiredEvidence: [...this.seed.config.requiredEvidence],
      missingEvidence: brief.missingEvidence,
      stage:
        brief.status === 'DECIDED'
          ? this.seed.config.stages.decided
          : brief.status === 'DECISION_REQUIRED'
            ? this.seed.config.stages.decisionRequired
            : this.seed.config.stages.collecting,
      nextAction: brief.nextAction,
      diagnostics: [
        ...brief.diagnostics,
        ...(!hasDecisionAuthority
          ? [
              {
                code: 'MISSING_AUTHORITY',
                message: 'This viewer cannot make the final decision; route to an authorized human',
              },
            ]
          : []),
      ],
    }
  }
  decide(
    principal: Principal,
    resourceId: string,
    disposition: HumanDecision['disposition'],
    rationale: string,
  ): HumanDecision {
    const { authority } = this.authorize(principal, resourceId, 'decide')
    if (!['change', 'terminate', 'request_evidence'].includes(disposition))
      fail('INVALID_INPUT', 'Bounded human disposition required')
    text(rationale, 'human decision rationale')
    const brief = this.brief(principal, resourceId)
    if (brief.status !== 'DECISION_REQUIRED')
      fail('INVALID_WORKFLOW_STATE', 'An open decision requirement is required')
    const decision: HumanDecision = {
      id: `SYN-DECISION-${resourceId}`,
      syntheticOnly: true,
      orgId: principal.orgId,
      resourceId,
      actorId: principal.actorId,
      authorityId: authority.id,
      instrumentId: authority.instrumentId,
      disposition,
      rationale,
      evidenceIds: brief.evidence.map((entry) => entry.id),
      interpretationIds: brief.interpretations.map((entry) => entry.id),
      unresolvedConflict: brief.conflictStatus === 'UNRESOLVED',
      occurredAt: this.now(),
    }
    this.decisions.set(resourceId, decision)
    this.emit(principal, resourceId, 'human.disposition', authority.id)
    return structuredClone(decision)
  }
  auditTrail(principal: Principal, resourceId: string): PlatformAuditEvent[] {
    this.authenticate(principal, resourceId)
    return structuredClone(
      this.audit.filter(
        (event) => event.resourceId === resourceId && event.orgId === principal.orgId,
      ),
    )
  }
}

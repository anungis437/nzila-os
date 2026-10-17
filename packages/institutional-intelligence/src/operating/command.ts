import { z } from 'zod'
import {
  institutionalReferenceSchema, type InstitutionalActor, type InstitutionalScope,
  type InstitutionalReference, type InstitutionalMutationContext,
} from '@nzila/platform-contracts'
import type { InstitutionalMutationBoundary } from '../foundation/audit'
import { engagementSchema } from '../foundation/runtime'
import { foundationHash } from '../foundation/authority'
import { OperatingGuard, sourceQuality, sourceReadSchema, qualityStates, type OperatingSourcePorts, type Quality } from './sources'
import { estateStoredSchema, edgeStoredSchema, estateTraversal } from './estate'
import { raidStoredSchema, missionBlockers } from './raid'
import { laneStoredSchema, specialistVisibility } from './operations'
import { benefitStoredSchema, observationSchema } from './value'
import { institutionalRationalePayloadSchema, verifyInstitutionalRationale } from '@nzila/governance-rationale'

export const commandContracts = [
  { item: 'active-missions', view: 'TODAY', error: 'MISSION_READ_FAILED' },
  { item: 'pending-decisions', view: 'TODAY', error: 'DECISION_READ_FAILED' },
  { item: 'blocked-changes', view: 'TODAY', error: 'CHANGE_GATE_READ_FAILED' },
  { item: 'high-risks', view: 'TODAY', error: 'RISK_READ_FAILED' },
  { item: 'open-incidents', view: 'TODAY', error: 'INCIDENT_READ_FAILED' },
  { item: 'human-approvals', view: 'TODAY', error: 'APPROVAL_READ_FAILED' },
  { item: 'failed-controls', view: 'TODAY', error: 'CONTROL_READ_FAILED' },
  { item: 'active-specialist-engagements', view: 'TODAY', error: 'ENGAGEMENT_READ_FAILED' },
  { item: 'capacity-constraints', view: 'TODAY', error: 'CAPACITY_READ_FAILED' },
  { item: 'products', view: 'PORTFOLIO', error: 'PRODUCT_REGISTRY_FAILED' },
  { item: 'capabilities', view: 'PORTFOLIO', error: 'CAPABILITY_READ_FAILED' },
  { item: 'health', view: 'PORTFOLIO', error: 'HEALTH_READ_FAILED' },
  { item: 'active-changes', view: 'PORTFOLIO', error: 'CHANGE_READ_FAILED' },
  { item: 'risk', view: 'PORTFOLIO', error: 'RISK_READ_FAILED' },
  { item: 'dependencies', view: 'PORTFOLIO', error: 'GRAPH_READ_FAILED' },
  { item: 'value-status', view: 'PORTFOLIO', error: 'VALUE_READ_FAILED' },
  { item: 'shared-primitives', view: 'ESTATE', error: 'PRIMITIVE_REGISTRY_FAILED' },
  { item: 'external-dependencies', view: 'ESTATE', error: 'EXTERNAL_DEPENDENCY_READ_FAILED' },
  { item: 'ownership-gaps', view: 'ESTATE', error: 'ASSIGNMENT_READ_FAILED' },
  { item: 'platform-health', view: 'ESTATE', error: 'PLATFORM_HEALTH_READ_FAILED' },
  { item: 'technical-debt', view: 'ESTATE', error: 'DEBT_READ_FAILED' },
  { item: 'evidence-status', view: 'ESTATE', error: 'EVIDENCE_READ_FAILED' },
] as const
export type CommandItem = typeof commandContracts[number]['item']
const commandItemSchema = z.enum(commandContracts.map(c => c.item) as [CommandItem, ...CommandItem[]])
const collectionSchema = z.object({
  reads: z.array(sourceReadSchema), status: z.enum(qualityStates), complete: z.boolean(),
  observedAt: z.string().datetime().nullable(), watermark: z.string().nullable(),
  freshness: z.object({ policyRef: z.string(), maxAgeMs: z.number().nonnegative() }).nullable(),
  error: z.string().nullable(),
}).strict()
export type CommandSourceCollection = z.infer<typeof collectionSchema>
export interface CommandReadPorts extends OperatingSourcePorts {
  commandSource(actor: InstitutionalActor, scope: InstitutionalScope, item: CommandItem): CommandSourceCollection
}
export interface CommandRow {
  ref: InstitutionalReference
  title: string
  state: string
  owner: string | null
  evidenceRefs: InstitutionalReference[]
  relatedRefs: InstitutionalReference[]
  mission?: { desiredOutcome: string, acceptanceCriteria: string[], executionOwner: string }
  raid?: { category: string, priority: string, sourceScale: string, normalizationRule: string | null, blockingRuleRef: string | null,
    dispositionExpiresAt: string | null, dispositionCurrent: 'CURRENT' | 'EXPIRED' | 'NOT_APPLICABLE', closureDisposition: string | null }
  estate?: { classification: string, lifecycle: string, sourceRef: InstitutionalReference }
  capacity?: { knowledge: 'KNOWN' | 'UNKNOWN', free: number | null, unit: string, dependencyPressure: 'BLOCKED' | 'CLEAR' | 'UNKNOWN' }
  benefit?: { forecast: number | null, observed: number | null, variance: number | null, unit: string,
    observationRefs: InstitutionalReference[], acceptanceRefs: InstitutionalReference[],
    metric: string, methodVersion: string, windowStart: string, windowEnd: string }
  specialist?: ReturnType<typeof specialistVisibility>
  graph?: Awaited<ReturnType<typeof estateTraversal>>
  authorityMeaning: 'SOURCE' | 'PROJECTION' | 'DERIVED'
  quality?: Quality
  sourceObservedAt?: string | null
}
export interface CommandReadItem {
  kind: CommandItem
  value: CommandRow[] | null
  sourceRefs: InstitutionalReference[]
  sourceScopes: InstitutionalScope[]
  sourceRevisions: number[]
  sourceObservedAt: string | null
  sourceWatermark: string | null
  fetchedAt: string
  freshnessPolicyRef: string | null
  status: Quality
  complete: boolean
  uncertainty: string[]
  authorityMeaning: 'PROJECTION'
  policyDecisionRef: string
  cursor: string | null
  illustrative: boolean
  operational: boolean
}
const requestSchema = z.object({
  view: z.enum(['TODAY', 'PORTFOLIO', 'ESTATE', 'ALL']),
  illustrative: z.boolean(),
  at: z.string().datetime().optional(),
  filters: z.object({ item: commandItemSchema.optional(), seed: institutionalReferenceSchema.optional(),
    direction: z.enum(['incoming', 'outgoing']).optional() }).strict(),
  pageSize: z.number().int().positive().max(100),
  cursor: z.string().regex(/^\d+$/).optional(),
}).strict()
function parentQuality(states: Quality[]): Quality {
  for (const state of ['ERROR', 'UNAVAILABLE', 'STALE', 'INCOMPLETE', 'UNKNOWN', 'ILLUSTRATIVE'] as const) {
    if (states.includes(state)) return state
  }
  return 'OBSERVED'
}

/** Read composition only. No source command, mutation boundary or write port is exposed. */
export class InstitutionalCommandReadModel {
  readonly #g: OperatingGuard
  constructor(boundary: InstitutionalMutationBoundary, readonly sources: CommandReadPorts) {
    this.#g = new OperatingGuard(boundary, sources)
  }

  async read(session: string, raw: unknown) {
    const { context: ctx, command } = this.#g.boundary.authority.resolve(session, 'command.read', raw)
    const request = requestSchema.parse(command.payload)
    if (request.at && request.at !== ctx.occurredAt) this.#g.deny(ctx, 'COMMAND_HISTORICAL_SNAPSHOT_UNAVAILABLE_USE_ESTATE_HISTORY')
    const contracts = commandContracts.filter(c => (request.view === 'ALL' || c.view === request.view)
      && (!request.filters.item || request.filters.item === c.item))
    if (!contracts.length) this.#g.deny(ctx, 'COMMAND_ITEM_VIEW_MISMATCH')
    const items: CommandReadItem[] = []
    for (const contract of contracts) {
      try {
        const item = await this.#item(ctx, contract.item, request)
        items.push(item)
      } catch (error) {
        // Projection errors are not success-shaped empty source reads.
        this.#g.boundary.authority.ports.reportFailure(contract.error, ctx.requestId)
        items.push(this.#envelope(ctx, contract.item, null, 'ERROR', false, null, null, [contract.error]))
        if (error instanceof Error && ['ILLUSTRATIVE_REQUIRES_OPT_IN', 'ILLUSTRATIVE_OPERATIONAL_MIX_DENIED'].includes(error.message)) throw error
      }
    }
    const states = items.map(i => i.status)
    if (items.some(i => i.illustrative) && items.some(i => i.operational)) this.#g.deny(ctx, 'ILLUSTRATIVE_OPERATIONAL_MIX_DENIED')
    const complete = items.every(i => i.complete)
    const status = parentQuality(states)
    return structuredClone({
      requestedScope: ctx.target.scope, generatedAt: ctx.occurredAt, projectionVersion: 'cp4-v1', status,
      items, complete, cursor: items.some(i => i.cursor !== null) ? String(Number(request.cursor ?? 0) + request.pageSize) : null,
      counts: { value: items.length === 1 && complete && status === 'OBSERVED' ? items[0]!.value?.length ?? null : null,
        coverage: complete ? 'COMPLETE_AUTHORIZED' : 'INCOMPLETE' },
      sourceWatermarks: items.map(i => ({ kind: i.kind, refs: i.sourceRefs, observedAt: i.sourceObservedAt, watermark: i.sourceWatermark })),
      errors: items.filter(i => ['ERROR', 'UNAVAILABLE'].includes(i.status)).map(i => ({ kind: i.kind, code: i.uncertainty[0], requestId: ctx.requestId })),
      visibilityDisposition: complete ? 'COMPLETE_AUTHORIZED' : 'RESTRICTED_OR_UNRESOLVED',
    })
  }

  #envelope(ctx: InstitutionalMutationContext, kind: CommandItem, value: CommandRow[] | null, status: Quality,
    complete: boolean, sourceObservedAt: string | null, freshnessPolicyRef: string | null, uncertainty: string[]): CommandReadItem {
    const refs = value?.flatMap(v => [v.ref, ...v.relatedRefs, ...v.evidenceRefs]) ?? []
    return {
      kind, value, sourceRefs: refs, sourceScopes: [...new Map(refs.map(r => [JSON.stringify(r.scope), r.scope])).values()],
      sourceRevisions: refs.map(r => r.revision), sourceObservedAt, fetchedAt: ctx.occurredAt,
      sourceWatermark: value === null ? null : foundationHash(refs),
      freshnessPolicyRef, status, complete, uncertainty, authorityMeaning: 'PROJECTION', policyDecisionRef: ctx.authorityRef, cursor: null,
      illustrative: status === 'ILLUSTRATIVE', operational: ['OBSERVED', 'STALE'].includes(status),
    }
  }

  async #item(ctx: InstitutionalMutationContext, item: CommandItem, request: z.infer<typeof requestSchema>): Promise<CommandReadItem> {
    const localKind: Partial<Record<CommandItem, string>> = {
      'active-missions': 'Mission', 'pending-decisions': 'DecisionAnalysis', 'high-risks': 'Raid', risk: 'Raid',
      'active-specialist-engagements': 'SpecialistEngagement', 'capacity-constraints': 'Lane',
      products: 'EstateReference', capabilities: 'EstateReference', dependencies: 'InstitutionalRelationship',
      'value-status': 'Benefit', 'shared-primitives': 'EstateReference', 'external-dependencies': 'EstateReference',
      'ownership-gaps': 'EstateReference', 'technical-debt': 'Raid',
    }
    let complete = true
    const rows: CommandRow[] = []
    const qualities: Quality[] = []
    let observedAt: string | null = null, policy: string | null = null, watermark: string | null = null, sourceError: string | null = null
    const refsAllowed = (refs: InstitutionalReference[]) => {
      const visible = refs.filter(ref => this.#g.visible(ctx, ref))
      if (visible.length !== refs.length) complete = false
      return visible
    }
    if (localKind[item]) {
      if (!request.illustrative) this.#g.deny(ctx, 'ILLUSTRATIVE_REQUIRES_OPT_IN')
      qualities.push('ILLUSTRATIVE')
      policy = 'cp4-local-immutable-revision-not-live-observation'
      const records = this.#g.boundary.store.list(ctx.target.scope, localKind[item]!)
      const rationales = item === 'pending-decisions' ? this.#g.boundary.store.list(ctx.target.scope, 'GovernanceRationale')
        .filter(r => !this.#g.boundary.store.successor(r.scope, r.id)) : []
      if (item === 'pending-decisions') records.push(...rationales)
      for (const row of records) {
        const ref = this.#g.localRef(row)
        if (!this.#g.visible(ctx, ref)) { complete = false; continue }
        this.#g.recorded(row)
        const projected: CommandRow = { ref, title: '', state: '', owner: null, evidenceRefs: [], relatedRefs: [],
          authorityMeaning: 'PROJECTION', quality: 'ILLUSTRATIVE' }
        if (row.kind === 'Mission') {
          const d = z.object({ title: z.string(), status: z.string(), accountableOwner: z.string(), evidenceRefs: z.array(institutionalReferenceSchema),
            desiredOutcome: z.string(), acceptanceCriteria: z.array(z.string()), executionOwner: z.string() }).parse(row.data)
          if (!['authorized', 'active', 'blocked', 'completed'].includes(d.status)) continue
          projected.title = d.title; projected.state = d.status; projected.owner = d.accountableOwner
          projected.mission = { desiredOutcome: d.desiredOutcome, acceptanceCriteria: d.acceptanceCriteria, executionOwner: d.executionOwner }
          projected.evidenceRefs = refsAllowed(d.evidenceRefs)
          if (missionBlockers(this.#g, { ...ctx, target: ref }).length) projected.state = 'blocked'
        } else if (row.kind === 'DecisionAnalysis') {
          const d = z.object({ analysis: z.object({ title: z.string(), status: z.string(), ownerId: z.string() }),
            evidenceRefs: z.array(institutionalReferenceSchema) }).parse(row.data)
          if (!['drafting', 'under-review'].includes(d.analysis.status)) continue
          if (rationales.some(r => z.object({ record: z.object({ payload: institutionalRationalePayloadSchema }) })
            .parse(r.data).record.payload.analysisRef.sourceId === row.id)) continue
          projected.title = d.analysis.title; projected.state = d.analysis.status; projected.owner = d.analysis.ownerId
          projected.evidenceRefs = refsAllowed(d.evidenceRefs)
        } else if (row.kind === 'GovernanceRationale') {
          const d = z.object({ record: z.object({ payload: institutionalRationalePayloadSchema,
            hashVersion: z.literal(1), payloadHash: z.string() }) }).parse(row.data)
          verifyInstitutionalRationale(d.record)
          const p = d.record.payload
          if (p.effectiveAt <= ctx.occurredAt && (!p.reviewAt || p.reviewAt > ctx.occurredAt)) continue
          projected.title = p.rationale.decisionTitle
          projected.state = p.effectiveAt > ctx.occurredAt ? 'AWAITING_EFFECTIVE_DATE' : 'REVIEW_DUE'
          projected.owner = p.decidedBy; projected.evidenceRefs = refsAllowed(p.evidenceRefs)
        } else if (row.kind === 'Raid') {
          const d = raidStoredSchema.parse(row.data)
          if (item === 'high-risks' && (d.category !== 'RISK' || !['HIGH', 'CRITICAL', 'UNKNOWN'].includes(d.priority) || d.status === 'closed')) continue
          if (item === 'technical-debt' && !d.technicalDebt) continue
          projected.title = d.title; projected.state = d.status; projected.owner = d.owner
          projected.raid = { category: d.category, priority: d.priority, sourceScale: d.sourceScale,
            normalizationRule: d.normalizationRule, blockingRuleRef: d.blockingRuleRef,
            dispositionExpiresAt: d.dispositionExpiresAt, closureDisposition: d.closureDisposition,
            dispositionCurrent: ['accepted', 'waived'].includes(d.status) || d.closureDisposition === 'WAIVED'
              ? d.dispositionExpiresAt && d.dispositionExpiresAt > ctx.occurredAt ? 'CURRENT' : 'EXPIRED' : 'NOT_APPLICABLE' }
          if (projected.raid.dispositionCurrent === 'EXPIRED') { complete = false; qualities.push('UNKNOWN') }
          projected.evidenceRefs = refsAllowed([...d.evidenceRefs, ...d.closureEvidenceRefs])
          projected.relatedRefs = refsAllowed([...d.missionRefs, ...d.changeRefs, ...d.decisionRefs, ...d.estateRefs])
          if (d.priority === 'UNKNOWN') { qualities.push('UNKNOWN'); complete = false }
        } else if (row.kind === 'SpecialistEngagement') {
          const d = engagementSchema.parse(row.data)
          if (d.status !== 'ACTIVE' || d.expiresAt <= ctx.occurredAt || d.effectiveAt > ctx.occurredAt) continue
          projected.title = 'Specialist engagement'; projected.state = d.status; projected.owner = d.sponsor
          projected.specialist = specialistVisibility(this.#g, ctx, row.id)
          complete &&= projected.specialist.complete
        } else if (row.kind === 'Lane') {
          const d = laneStoredSchema.parse(row.data)
          if (d.status !== 'ACTIVE') continue
          projected.title = d.purpose; projected.state = d.status; projected.owner = d.owner
          projected.relatedRefs = refsAllowed([...d.missionRefs, ...d.engagementRefs])
          const pressure = d.missionRefs.some(m => missionBlockers(this.#g, { ...ctx, target: m }).length > 0)
          projected.capacity = { knowledge: d.capacity.knowledge,
            free: d.capacity.availableChangeCapacity === null || d.capacity.committedCapacity === null
              ? null : d.capacity.availableChangeCapacity - d.capacity.committedCapacity,
            unit: d.capacity.unit, dependencyPressure: pressure ? 'BLOCKED' : 'CLEAR' }
          if (d.capacity.knowledge === 'UNKNOWN' || d.capacity.windowEnd <= ctx.occurredAt) { complete = false; qualities.push('UNKNOWN') }
          projected.evidenceRefs = refsAllowed(d.capacity.sourceRefs)
        } else if (row.kind === 'EstateReference') {
          const d = estateStoredSchema.parse(row.data)
          const classify: Partial<Record<CommandItem, string>> = { products: 'InstitutionalProduct', capabilities: 'Capability',
            'shared-primitives': 'SharedPlatformPrimitive', 'external-dependencies': 'ExternalDependency' }
          if (classify[item] && d.classification !== classify[item]) continue
          if (!this.#g.visible(ctx, d.sourceRef)) { complete = false; continue }
          const read = sourceReadSchema.parse(this.sources.read(ctx.actor, d.sourceRef))
          if (foundationHash(read.ref) !== foundationHash(d.sourceRef)) this.#g.deny(ctx, 'SOURCE_REFERENCE_MISMATCH')
          qualities.push(sourceQuality(read, ctx.occurredAt))
          complete &&= read.complete && ['OBSERVED', 'ILLUSTRATIVE'].includes(sourceQuality(read, ctx.occurredAt))
          if (item === 'ownership-gaps' && d.steward && this.#g.boundary.authority.ports.assignedInternalHuman(d.steward, row.scope)) continue
          projected.title = read.value?.title ?? d.classification; projected.state = item === 'ownership-gaps' ? 'GAP' : d.lifecycle
          projected.owner = d.steward; projected.relatedRefs = [d.sourceRef]
          projected.estate = { classification: d.classification, lifecycle: d.lifecycle, sourceRef: d.sourceRef }
          projected.quality = sourceQuality(read, ctx.occurredAt); projected.sourceObservedAt = read.observedAt
          projected.evidenceRefs = refsAllowed(d.evidenceRefs)
          if (read.observedAt && (!observedAt || read.observedAt < observedAt)) observedAt = read.observedAt
          policy = read.freshness?.policyRef ?? null
        } else if (row.kind === 'InstitutionalRelationship') {
          const d = edgeStoredSchema.parse(row.data)
          if (d.status !== 'CURRENT' || !['DEPENDS_ON', 'CONSUMES'].includes(d.relation)) continue
          if (!this.#g.visible(ctx, d.from) || !this.#g.visible(ctx, d.to)) { complete = false; continue }
          projected.title = d.relation; projected.state = d.binding ? 'BINDING' : 'OPTIONAL'
          projected.relatedRefs = [d.from, d.to]
          if (request.filters.seed) {
            projected.graph = await estateTraversal(this.#g, ctx, { seed: request.filters.seed,
              direction: request.filters.direction ?? 'incoming', mode: 'CURRENT_OPERATING', depthLimit: 10, nodeBudget: 100, edgeBudget: 100 })
            complete &&= projected.graph.complete
          }
        } else if (row.kind === 'Benefit') {
          const d = benefitStoredSchema.parse(row.data)
          projected.title = d.benefit.title; projected.state = d.status; projected.owner = d.benefit.owner
          projected.relatedRefs = refsAllowed([...d.benefit.missionRefs, ...d.benefit.decisionRefs, ...d.benefit.changeRefs, ...d.benefit.estateRefs])
          const observationRefs = refsAllowed(d.observationRefs), acceptanceRefs = refsAllowed(d.acceptanceRefs)
          let measuresVisible = [d.benefit.baselineRef, d.benefit.forecast.basisRef].every(ref => !ref || this.#g.visible(ctx, ref))
          const latest = observationRefs.at(-1)
          let measured: number | null = null
          if (latest) {
            const observation = this.#g.reference(ctx, latest)
            if ('kind' in observation) {
              const value = observationSchema.parse(observation.data)
              measuresVisible &&= [...value.sourceRefs, ...value.evidenceRefs].every(r => this.#g.visible(ctx, r))
              const inputs = [...value.sourceRefs, ...value.evidenceRefs, ...(value.baselineRef ? [value.baselineRef] : [])]
              for (const input of inputs) {
                if (!this.#g.visible(ctx, input)) { measuresVisible = false; continue }
                if (input.namespace !== this.sources.localNamespace) {
                  const inputRead = sourceReadSchema.parse(this.sources.read(ctx.actor, input))
                  if (foundationHash(inputRead.ref) !== foundationHash(input)) this.#g.deny(ctx, 'SOURCE_REFERENCE_MISMATCH')
                  const inputQuality = sourceQuality(inputRead, ctx.occurredAt)
                  qualities.push(inputQuality)
                  if (!['OBSERVED', 'ILLUSTRATIVE'].includes(inputQuality)) measuresVisible = false
                }
              }
              measured = value.value
              projected.evidenceRefs = refsAllowed(value.evidenceRefs)
            }
          }
          if (!measuresVisible) { measured = null; complete = false }
          const forecast = measuresVisible ? d.benefit.forecast.value : null
          projected.benefit = { forecast, observed: measured,
            variance: measured === null || forecast === null ? null : measured - forecast,
            unit: d.benefit.unit, observationRefs, acceptanceRefs, metric: d.benefit.metric, methodVersion: d.benefit.methodVersion,
            windowStart: d.benefit.windowStart, windowEnd: d.benefit.windowEnd }
        }
        rows.push(projected)
      }
    } else {
      const collection = collectionSchema.parse(this.sources.commandSource(ctx.actor, ctx.target.scope, item))
      qualities.push(collection.status)
      complete &&= collection.complete
      observedAt = collection.observedAt
      watermark = collection.watermark
      sourceError = collection.error
      policy = collection.freshness?.policyRef ?? null
      if (collection.status === 'ILLUSTRATIVE' && !request.illustrative) this.#g.deny(ctx, 'ILLUSTRATIVE_REQUIRES_OPT_IN')
      if (!collection.freshness || !collection.observedAt || !collection.watermark) { complete = false; qualities.push('UNKNOWN') }
      else if (collection.status === 'OBSERVED' && Date.parse(ctx.occurredAt) - Date.parse(collection.observedAt) > collection.freshness.maxAgeMs) qualities.push('STALE')
      for (const read of collection.reads) {
        if (!this.#g.visible(ctx, read.ref)) { complete = false; continue }
        const quality = sourceQuality(read, ctx.occurredAt)
        qualities.push(quality)
        if (quality === 'ILLUSTRATIVE' && !request.illustrative) this.#g.deny(ctx, 'ILLUSTRATIVE_REQUIRES_OPT_IN')
        complete &&= read.complete && ['OBSERVED', 'ILLUSTRATIVE'].includes(quality)
        if (!read.value) continue
        const d = read.value
        const expectedKinds: Partial<Record<CommandItem, string[]>> = {
          'blocked-changes': ['OperationalChange', 'DeploymentChange'], 'open-incidents': ['Incident'],
          'human-approvals': ['Approval'], 'failed-controls': ['Control'], health: ['OperationalHealthState'],
          'active-changes': ['OperationalChange', 'DeploymentChange'], 'platform-health': ['OperationalHealthState'],
          'evidence-status': ['Evidence', 'EvidencePack', 'Recommendation', 'OutputAcceptance'],
        }
        if (!expectedKinds[item]?.includes(read.ref.kind)) this.#g.deny(ctx, 'COMMAND_SOURCE_KIND_MISMATCH')
        if (item === 'open-incidents' && ['closed', 'resolved'].includes(d.status)) continue
        if (item === 'active-changes' && ['closed', 'cancelled', 'rejected'].includes(d.status)) continue
        rows.push({ ref: read.ref, title: d.title, state: d.status, owner: d.owner,
          evidenceRefs: refsAllowed(d.evidenceRefs), relatedRefs: refsAllowed(d.affectedRefs), authorityMeaning: 'SOURCE',
          quality, sourceObservedAt: read.observedAt })
      }
      if (collection.error) this.#g.boundary.authority.ports.reportFailure(collection.error, ctx.requestId)
    }
    if (qualities.includes('ILLUSTRATIVE') && qualities.some(q => ['OBSERVED', 'STALE'].includes(q))) this.#g.deny(ctx, 'ILLUSTRATIVE_OPERATIONAL_MIX_DENIED')
    if (!complete && !qualities.some(q => ['ERROR', 'UNAVAILABLE', 'STALE', 'UNKNOWN'].includes(q))) qualities.push('INCOMPLETE')
    const status = parentQuality(qualities)
    const offset = Number(request.cursor ?? 0)
    if (!Number.isSafeInteger(offset) || offset > 1000000) this.#g.deny(ctx, 'INVALID_CURSOR')
    const sorted = rows.sort((a, b) => foundationHash(a.ref).localeCompare(foundationHash(b.ref)))
    const page = sorted.slice(offset, offset + request.pageSize)
    const paginated = offset > 0 || offset + request.pageSize < sorted.length
    const uncertainty = sourceError ? [sourceError] : complete ? [] : ['SOURCE_OR_VISIBILITY_COVERAGE_INCOMPLETE']
    if (paginated) uncertainty.push('PAGINATED')
    const envelope = this.#envelope(ctx, item, ['ERROR', 'UNAVAILABLE'].includes(status) ? null : page, status,
      complete && !paginated && ['OBSERVED', 'ILLUSTRATIVE'].includes(status), observedAt, policy, uncertainty)
    if (watermark) envelope.sourceWatermark = watermark
    envelope.illustrative = qualities.includes('ILLUSTRATIVE')
    envelope.operational = qualities.some(q => ['OBSERVED', 'STALE'].includes(q))
    envelope.cursor = offset + request.pageSize < sorted.length ? String(offset + request.pageSize) : null
    return envelope
  }
}

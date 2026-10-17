import { randomUUID } from 'node:crypto'
import { createNarRecord, verifyNarRecord, type NarRecord } from '@nzila/nar'
import type { InstitutionalReference, InstitutionalActor, InstitutionalScope } from '@nzila/platform-contracts'
import { bindingRegistryScope, ScopedBindingAdapter } from './bindings'
import { LocalInstitutionalStore } from './local-store'
import {
  InstitutionalAuthority, foundationHash,
  type AuthenticatedInstitutionalSession, type PersistedInstitutionalAuthorization,
} from './authority'
import { InstitutionalMutationBoundary, type InstitutionalAuditIntent } from './audit'

export const fictionalScope: InstitutionalScope = { type: 'PLATFORM_INSTITUTION', id: 'fictional-I' }
export const fictionalOrg = '00000000-0000-4000-8000-000000000001'
export const fictionalStart = '2026-10-12T20:00:00.000Z'

/** Fixture adapters stand in for identity/CP/approvals/NAR storage, never production. */
export function syntheticFoundation(filename = ':memory:', seedBinding = true) {
  const store = new LocalInstitutionalStore(filename)
  const controls = {
    now: '2026-10-12T21:00:00.000Z', entitled: true, approvals: true,
    auditUnavailable: false, intentFailure: false, decisionMode: 'valid',
  }
  const sessions = new Map<string, AuthenticatedInstitutionalSession>()
  const targets = new Map<string, InstitutionalReference>()
  const failures: string[] = []
  const assigned = new Set(['fictional-H1', 'fictional-H2'])
  for (const [handle, classification] of [
    ['fictional-H1', 'INTERNAL_HUMAN'], ['fictional-H2', 'INTERNAL_HUMAN'],
    ['fictional-agent', 'AGENT'], ['fictional-specialist', 'EXTERNAL_HUMAN'],
    ['fictional-system', 'SYSTEM'],
  ] as const) sessions.set(handle, {
    actor: { id: handle, classification, internalAffiliation: classification === 'INTERNAL_HUMAN' },
    actingScope: fictionalScope, roles: [classification], authenticated: true,
  })
  const institutionBinding = {
    institutionId: fictionalScope.id, governanceOrgId: fictionalOrg, status: 'EFFECTIVE',
    version: 1, approvedBy: 'fictional-H2', authorityRef: 'fictional-enrollment',
    effectiveAt: fictionalStart, revokedAt: null,
  }
  if (seedBinding) store.transaction(() => store.append(bindingRegistryScope, 'InstitutionBinding', 'fictional-I', 0, institutionBinding))
  const bindings = new ScopedBindingAdapter(store)
  const authority = new InstitutionalAuthority({
    now: () => controls.now,
    authenticate: handle => {
      const session = sessions.get(handle)
      if (!session) throw new Error('AUTH_REQUIRED')
      return session
    },
    resolveTarget: locator => {
      const target = targets.get(locator)
      if (!target) throw new Error('TARGET_NOT_REGISTERED')
      return target
    },
    registeredPolicy: action => ({
      id: `fictional-policy-${action}`, version: '1', name: 'Fixture action policy',
      type: 'access', description: 'Synthetic only', enabled: true,
      scope: { orgId: fictionalOrg }, metadata: {},
      rules: [{ id: 'fixture-explicit-allow', description: 'Narrow synthetic registered action', conditions: [
        { field: 'action', operator: 'eq', value: action },
      ], effect: 'allow', severity: 'info' }],
    }),
    entitled: () => controls.entitled,
    crossScopeAllowed: () => false,
    approvalsSatisfied: () => controls.approvals,
    controlPlaneAuthorize: request => {
      const decision: PersistedInstitutionalAuthorization = {
        id: randomUUID(), actorId: request.actor.id, action: request.action, target: request.target,
        payloadHash: request.payloadHash, policyId: request.policyId, policyVersion: request.policyVersion,
        issuedAt: fictionalStart, expiresAt: '2026-10-13T00:00:00.000Z',
        revoked: controls.decisionMode === 'revoked', allowed: true, proofRecorded: true,
      }
      if (controls.decisionMode === 'stale') decision.expiresAt = fictionalStart
      if (controls.decisionMode === 'deployment-substitute') decision.action = 'operational-change.approve'
      if (controls.decisionMode === 'mission-substitute') decision.action = 'mission.authorized'
      if (controls.decisionMode === 'rationale-substitute') decision.action = 'rationale.record'
      store.transaction(() => store.append(fictionalScope, 'Authorization', decision.id, 0, decision))
      return decision
    },
    persistedAuthorization: id => {
      const row = store.get(fictionalScope, 'Authorization', id)
      return row?.data as PersistedInstitutionalAuthorization | undefined
    },
    assignedInternalHuman: (id, scope) => {
      if (scope.type !== fictionalScope.type || scope.id !== fictionalScope.id) return false
      if (assigned.has(id)) return true
      return store.list(scope, 'HumanAssignment').some(row => {
        const assignment = row.data as { principalId: string, effectiveAt: string, expiresAt: string, auditEventId: string }
        const proofState = store.get(scope, 'AuditProofState', assignment.auditEventId)?.data as { status: string } | undefined
        return assignment.principalId === id && assignment.effectiveAt <= controls.now
          && assignment.expiresAt > controls.now && proofState?.status === 'RECORDED'
      })
    },
    principal: id => sessions.get(id)?.actor,
    canReadReference: () => true,
    enrollmentBinding: target => target.scope.id === fictionalScope.id
      ? { ...institutionBinding, status: 'EFFECTIVE' } : undefined,
    reportFailure: code => failures.push(code),
  }, bindings)
  const proof = {
    async record(intent: InstitutionalAuditIntent) {
      if (controls.auditUnavailable) throw new Error('FIXTURE_NAR_UNAVAILABLE')
      let record = store.get(intent.context.target.scope, 'NarRecord', intent.eventId)?.data as NarRecord | undefined
      if (!record) {
        const head = store.get(intent.context.target.scope, 'NarChainHead', 'fixture')
        const previous = head?.data as { hash: string } | undefined
        record = await createNarRecord({
          recordId: intent.eventId, decisionType: 'institutional.mutation', actionType: intent.context.action,
          previousHash: previous?.hash, isGenesis: !previous,
          createdAt: intent.context.occurredAt, secret: 'fictional-local-proof-key-not-production',
          decision: {
            id: intent.context.authorityRef, organizationId: intent.context.governanceOrgId,
            domain: 'platform', resourceType: intent.context.target.kind, resourceId: intent.context.target.sourceId,
            actor: { id: intent.context.actor.id, type: intent.context.actor.classification === 'INTERNAL_HUMAN' ? 'user' : 'system' },
            input: intent, policy: { id: intent.context.authorityRef, version: intent.context.policyVersion, domain: 'platform' },
            outcome: { status: 'approved' }, createdAt: intent.context.occurredAt,
          },
        })
        const sealed = record
        store.transaction(() => {
          store.append(intent.context.target.scope, 'NarChainHead', 'fixture', head?.version ?? 0, { hash: sealed.seal.hash })
          store.append(intent.context.target.scope, 'NarRecord', intent.eventId, 0, sealed)
        })
      }
      return { eventId: intent.eventId, intentHash: foundationHash(intent), receiptRef: record.id }
    },
    async verify(receiptRef: string, intent: InstitutionalAuditIntent) {
      const record = store.get(intent.context.target.scope, 'NarRecord', receiptRef)?.data as NarRecord | undefined
      return !!record && record.id === intent.eventId && foundationHash(record.payload.input) === foundationHash(intent)
        && (await verifyNarRecord(record, 'fictional-local-proof-key-not-production')).valid
    },
  }
  const boundary = new InstitutionalMutationBoundary(store, authority, proof, () => {
    if (controls.intentFailure) throw new Error('FIXTURE_INTENT_FAILURE')
  })
  function target(kind: string, id: string, revision = 1, scope = fictionalScope): string {
    const locator = `${scope.type}:${scope.id}:${kind}:${id}`
    targets.set(locator, { scope, kind, namespace: 'fictional-local', sourceId: id, revision })
    return locator
  }
  function command(locator: string, payload: unknown = {}, expectedVersion = 0) {
    return { locator, payload, expectedVersion, requestId: randomUUID(), reason: 'Synthetic Checkpoint 3 proof' }
  }
  function human(id: string): InstitutionalActor {
    const actor = sessions.get(id)?.actor
    if (!actor) throw new Error('FIXTURE_ACTOR_NOT_FOUND')
    return actor
  }
  return { store, controls, sessions, targets, failures, assigned, bindings, authority, boundary, target, command, human, institutionBinding }
}

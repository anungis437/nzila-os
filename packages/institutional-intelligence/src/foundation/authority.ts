import { createHash } from 'node:crypto'
import { z } from 'zod'
import { canonicalStringify } from '@nzila/nar'
import { evaluatePolicy } from '@nzila/platform-policy-engine/evaluator'
import type { PolicyDefinition } from '@nzila/platform-policy-engine/types'
import {
  institutionalActorSchema, institutionalReferenceSchema, institutionalScopeSchema,
  sameInstitutionalScope,
  type InstitutionalActor, type InstitutionalScope, type InstitutionalReference,
  type InstitutionalMutationContext,
  type InstitutionBinding,
} from '@nzila/platform-contracts'
import { ScopedBindingAdapter } from './bindings'

export function foundationHash(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex')
}

export interface AuthenticatedInstitutionalSession {
  actor: InstitutionalActor
  actingScope: InstitutionalScope
  roles: string[]
  authenticated: boolean
}

export interface PersistedInstitutionalAuthorization {
  id: string
  actorId: string
  action: string
  target: InstitutionalReference
  payloadHash: string
  policyId: string
  policyVersion: string
  issuedAt: string
  expiresAt: string
  revoked: boolean
  allowed: boolean
  proofRecorded: boolean
}

/** Server-composed ports; no HTTP/client implementation is exported. */
export interface InstitutionalAuthorityPorts {
  now(): string
  authenticate(sessionHandle: string): AuthenticatedInstitutionalSession
  resolveTarget(locator: string): InstitutionalReference
  registeredPolicy(action: string): PolicyDefinition | undefined
  entitled(actor: InstitutionalActor, scope: InstitutionalScope, action: string): boolean
  crossScopeAllowed(actor: InstitutionalActor, acting: InstitutionalScope, target: InstitutionalScope, action: string): boolean
  approvalsSatisfied(actor: InstitutionalActor, target: InstitutionalReference, action: string): boolean
  controlPlaneAuthorize(request: {
    actor: InstitutionalActor, action: string, target: InstitutionalReference,
    payloadHash: string, policyId: string, policyVersion: string,
  }): PersistedInstitutionalAuthorization
  persistedAuthorization(id: string): PersistedInstitutionalAuthorization | undefined
  assignedInternalHuman(actorId: string, scope: InstitutionalScope): boolean
  principal(actorId: string): InstitutionalActor | undefined
  canReadReference(actor: InstitutionalActor, reference: InstitutionalReference): boolean
  enrollmentBinding(target: InstitutionalReference): InstitutionBinding | undefined
  reportFailure(code: string, requestId: string): void
}

export const institutionalCommandSchema = z.object({
  locator: z.string().min(1),
  requestId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  reason: z.string().min(1),
  payload: z.unknown(),
}).strict()
export type InstitutionalCommand = z.infer<typeof institutionalCommandSchema>

export class InstitutionalAuthority {
  readonly #issued = new WeakMap<InstitutionalMutationContext, { session: string, digest: string }>()

  constructor(readonly ports: InstitutionalAuthorityPorts, readonly bindings: ScopedBindingAdapter) {}

  resolve(sessionHandle: string, action: string, raw: unknown): {
    command: InstitutionalCommand, context: InstitutionalMutationContext,
  } {
    const command = institutionalCommandSchema.parse(raw)
    const session = this.#session(sessionHandle, command.requestId)
    const target = institutionalReferenceSchema.parse(this.ports.resolveTarget(command.locator))
    const binding = this.#binding(target, action, command.requestId)
    this.#checkScope(session, target, action, command.requestId)
    const policy = this.ports.registeredPolicy(action)
    if (!policy?.enabled) this.deny('NO_POLICY_REGISTERED', command.requestId)
    if (policy.scope.orgId && policy.scope.orgId !== binding.governanceOrgId) this.deny('POLICY_SCOPE_MISMATCH', command.requestId)
    if (policy.scope.environments && !policy.scope.environments.includes('SYNTHETIC')) this.deny('POLICY_SCOPE_MISMATCH', command.requestId)
    if (policy.scope.resources && !policy.scope.resources.includes(target.kind)) this.deny('POLICY_SCOPE_MISMATCH', command.requestId)
    const output = evaluatePolicy(policy, {
      policyId: policy.id, actor: { userId: session.actor.id, roles: session.roles },
      action, resource: target.kind, orgId: binding.governanceOrgId, environment: 'SYNTHETIC',
      context: { classification: session.actor.classification, internalAffiliation: session.actor.internalAffiliation },
    })
    if (output.overallResult === 'fail' || !output.decisions.some(decision => decision.effect === 'allow')) {
      this.deny('POLICY_DENIED', command.requestId)
    }
    if (!this.ports.approvalsSatisfied(session.actor, target, action)) this.deny('HUMAN_GATE_REQUIRED', command.requestId)
    const payloadHash = foundationHash({ action, target, command })
    const decision = this.ports.controlPlaneAuthorize({
      actor: session.actor, action, target, payloadHash, policyId: policy.id, policyVersion: policy.version,
    })
    const context: InstitutionalMutationContext = {
      actor: session.actor, actingScope: session.actingScope, target,
      governanceOrgId: binding.governanceOrgId, bindingVersion: binding.version,
      requestId: command.requestId, authorityRef: decision.id, policyVersion: policy.version,
      action, payloadHash, reason: command.reason, source: 'cp3-local-runtime', occurredAt: this.ports.now(),
    }
    this.#issued.set(context, { session: sessionHandle, digest: foundationHash(context) })
    this.revalidate(context)
    return { command, context }
  }

  revalidate(context: InstitutionalMutationContext): void {
    const issued = this.#issued.get(context)
    if (!issued || issued.digest !== foundationHash(context)) this.deny('UNTRUSTED_CONTEXT', context.requestId)
    const session = this.#session(issued.session, context.requestId)
    if (foundationHash(session.actor) !== foundationHash(context.actor)
      || !sameInstitutionalScope(session.actingScope, context.actingScope)) this.deny('IDENTITY_CHANGED', context.requestId)
    const binding = this.#binding(context.target, context.action, context.requestId)
    if (binding.version !== context.bindingVersion || binding.governanceOrgId !== context.governanceOrgId) {
      this.deny('BINDING_CHANGED', context.requestId)
    }
    this.#checkScope(session, context.target, context.action, context.requestId)
    const policy = this.ports.registeredPolicy(context.action)
    if (!policy?.enabled || policy.version !== context.policyVersion) this.deny('STALE_POLICY', context.requestId)
    const currentEvaluation = evaluatePolicy(policy, {
      policyId: policy.id, actor: { userId: session.actor.id, roles: session.roles },
      action: context.action, resource: context.target.kind, orgId: binding.governanceOrgId,
      environment: 'SYNTHETIC',
      context: { classification: session.actor.classification, internalAffiliation: session.actor.internalAffiliation },
    })
    if (currentEvaluation.overallResult === 'fail'
      || !currentEvaluation.decisions.some(decision => decision.effect === 'allow')) this.deny('POLICY_DENIED', context.requestId)
    const decision = this.ports.persistedAuthorization(context.authorityRef)
    if (!decision || !decision.allowed || !decision.proofRecorded || decision.revoked
      || decision.actorId !== context.actor.id || decision.action !== context.action
      || foundationHash(decision.target) !== foundationHash(context.target)
      || decision.payloadHash !== context.payloadHash || decision.policyId !== policy.id
      || decision.policyVersion !== policy.version
      || decision.issuedAt > this.ports.now() || decision.expiresAt <= this.ports.now()) {
      this.deny('INVALID_OR_STALE_AUTHORIZATION', context.requestId)
    }
    if (!this.ports.approvalsSatisfied(context.actor, context.target, context.action)) this.deny('HUMAN_GATE_REQUIRED', context.requestId)
  }

  internalHuman(context: InstitutionalMutationContext, differentFrom?: string): void {
    if (context.actor.classification !== 'INTERNAL_HUMAN' || !context.actor.internalAffiliation
      || !this.ports.assignedInternalHuman(context.actor.id, context.target.scope)) {
      this.deny('ASSIGNED_INTERNAL_HUMAN_REQUIRED', context.requestId)
    }
    if (differentFrom === context.actor.id) this.deny('INDEPENDENT_ACCEPTOR_REQUIRED', context.requestId)
  }

  deny(code: string, requestId: string): never {
    this.ports.reportFailure(code, requestId)
    throw new Error(code)
  }

  #session(handle: string, requestId: string): AuthenticatedInstitutionalSession {
    const session = structuredClone(this.ports.authenticate(handle))
    if (!session.authenticated) this.deny('AUTH_REQUIRED', requestId)
    session.actor = institutionalActorSchema.parse(session.actor)
    session.actingScope = institutionalScopeSchema.parse(session.actingScope)
    return session
  }

  #binding(target: InstitutionalReference, action: string, requestId: string): InstitutionBinding {
    if (action === 'institution.enroll') {
      const enrolled = this.ports.enrollmentBinding(target)
      if (!enrolled || enrolled.institutionId !== target.scope.id
        || target.scope.type !== 'PLATFORM_INSTITUTION' || target.kind !== 'InstitutionBinding'
        || enrolled.status !== 'EFFECTIVE' || enrolled.revokedAt !== null
        || enrolled.effectiveAt > this.ports.now()) this.deny('ENROLLMENT_NOT_APPROVED', requestId)
      return enrolled
    }
    return this.bindings.institution(target.scope, this.ports.now())
  }

  #checkScope(session: AuthenticatedInstitutionalSession, target: InstitutionalReference, action: string, requestId: string): void {
    if (target.scope.type === 'SYSTEM') this.deny('SYSTEM_NOT_A_WILDCARD', requestId)
    if (!sameInstitutionalScope(session.actingScope, target.scope)
      && !this.ports.crossScopeAllowed(session.actor, session.actingScope, target.scope, action)) {
      this.deny('CROSS_SCOPE_DENIED', requestId)
    }
    if (!this.ports.entitled(session.actor, target.scope, action)) this.deny('NOT_ENTITLED', requestId)
  }
}

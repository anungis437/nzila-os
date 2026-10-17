import type { DbContext, OrgContext } from '@nzila/org/context'
import {
  assertSameOrg,
  OrgAccessDeniedError,
  requireOrgScope,
  requirePermission,
} from '@nzila/org/guards'
import { toDbContext } from '@nzila/org/context'
import type { PolicyEvaluationInput, PolicyEvaluationOutput } from '@nzila/platform-policy-engine'
import type {
  SourceDisclosureDecisionResult,
  SourceDisclosureEvaluationInput,
} from '@nzila/platform-auth/source-disclosure'
import {
  coraEnterpriseContextInputSchema,
  emptyFarmer360Sections,
  farmer360DataGapSchema,
  farmer360SectionNameSchema,
  farmer360SectionSchema,
  farmerAssertionInputSchema,
  type CoraEnterpriseContextInput,
  type Farmer360Assertion,
  type Farmer360Conflict,
  type Farmer360DataGap,
  type Farmer360Fact,
  type Farmer360Profile,
  type Farmer360ReadModel,
  type Farmer360Section,
  type Farmer360SectionName,
  type FarmerAssertionInput,
} from './contracts'

export const CORA_FARMER360_READ_PERMISSION = 'cora:farmer360:read'
export const CORA_ENTERPRISE_CONTEXT_WRITE_PERMISSION = 'cora:enterprise-context:write'
export const CORA_FARMER_ASSERTION_WRITE_PERMISSION = 'cora:farmer-assertion:write'

import type {
  Farmer360WriteAction,
  Farmer360AuditIntent,
  Farmer360PersistencePort,
} from '@nzila/db/cora-farmer360-contracts'
export type {
  Farmer360AuditIntent,
  Farmer360PersistencePort,
} from '@nzila/db/cora-farmer360-contracts'

export interface Farmer360SourceSnapshot {
  readonly sections: readonly Farmer360Section[]
  readonly gaps?: readonly Farmer360DataGap[]
}

export interface Farmer360RequestContext extends OrgContext {
  readonly appId: 'cora'
  readonly identityBindingId: string
  readonly identityBindingState: 'active' | 'disabled' | 'revoked'
  readonly membershipId: string
  readonly membershipState: 'active' | 'invited' | 'suspended' | 'revoked'
  readonly membershipRoleSource?: 'canonical' | 'fallback'
  readonly identityProvider: string
}

export interface Farmer360ServicePorts {
  readonly persistence: Farmer360PersistencePort
  readonly getAuthorizedSources: (
    context: DbContext,
    profile: Farmer360Profile,
  ) => Promise<Farmer360SourceSnapshot>
  readonly authorizeConsentUse: (request: {
    readonly orgId: string
    readonly actorId: string
    readonly consentRef: string
    readonly purpose: string
    readonly recipient: 'cora'
    readonly source: FarmerAssertionInput['source']
  }) => Promise<{
    readonly status: 'granted' | 'denied' | 'unknown'
    readonly consentRef: string
    readonly evaluatedAt: string
  }>
  readonly evaluateAndAuditPolicy: (
    input: PolicyEvaluationInput,
  ) => Promise<readonly PolicyEvaluationOutput[]>
  readonly evaluateSourceDisclosure: (
    input: SourceDisclosureEvaluationInput,
  ) => Promise<SourceDisclosureDecisionResult>
  readonly environment: string
}

export class Farmer360AuthorizationError extends Error {
  readonly code = 'CORA_FARMER360_AUTHORIZATION_DENIED' as const

  constructor(message: string) {
    super(message)
    this.name = 'Farmer360AuthorizationError'
  }
}

function makePolicyInput(
  context: OrgContext,
  environment: string,
  action: Farmer360WriteAction,
  resourceId: string,
): PolicyEvaluationInput {
  return {
    policyId: 'cora-farmer360-write',
    actor: {
      userId: context.actorId,
      roles: [context.role],
      orgRole: context.role,
    },
    action: `cora:${action.replace('.', ':')}`,
    resource: 'cora:farmer360',
    context: { resourceId, requestId: context.requestId },
    orgId: context.orgId,
    environment,
  }
}

function requirePassingPolicy(
  outputs: readonly PolicyEvaluationOutput[],
  expected: PolicyEvaluationInput,
): readonly string[] {
  if (outputs.length === 0) {
    throw new Farmer360AuthorizationError(
      'No canonical policy evaluation authorized this operation',
    )
  }
  for (const output of outputs) {
    const actual = output.input
    if (
      output.overallResult !== 'pass' ||
      output.policyId !== expected.policyId ||
      actual.policyId !== expected.policyId ||
      actual.orgId !== expected.orgId ||
      actual.actor.userId !== expected.actor.userId ||
      actual.action !== expected.action ||
      actual.resource !== expected.resource ||
      actual.environment !== expected.environment
    ) {
      throw new Farmer360AuthorizationError('Canonical policy did not authorize this operation')
    }
  }
  return outputs.map((output) => output.evaluationId)
}

function assertProfileScope(context: OrgContext, profile: Farmer360Profile): void {
  assertSameOrg(context, profile.orgId)
}

function validateSnapshot(
  snapshot: Farmer360SourceSnapshot,
  profile: Farmer360Profile,
): {
  readonly sections: Record<Farmer360SectionName, Farmer360Section>
  readonly gaps: readonly Farmer360DataGap[]
} {
  const sections = emptyFarmer360Sections()
  const seen = new Set<Farmer360SectionName>()
  for (const rawSection of snapshot.sections) {
    const section = farmer360SectionSchema.parse(rawSection)
    if (!farmer360SectionNameSchema.safeParse(section.name).success || seen.has(section.name)) {
      throw new Error(`Invalid or duplicate Farmer 360 section: ${section.name}`)
    }
    seen.add(section.name)
    for (const fact of [
      ...section.facts,
      ...section.conflicts.flatMap((conflict) => conflict.competingFacts),
    ]) {
      assertSameOrg({ orgId: profile.orgId, actorId: 'farmer360-source' }, fact.orgId)
      if (fact.profileId !== profile.id) {
        throw new Error('Farmer 360 source returned a fact for a different profile')
      }
    }
    const allFacts = [
      ...section.facts,
      ...section.conflicts.flatMap((conflict) => conflict.competingFacts),
    ]
    if (allFacts.some((fact) => fact.valueKind === 'estimated' || fact.valueKind === 'derived')) {
      if (section.status === 'KNOWN') {
        throw new Error(`Section ${section.name} cannot be KNOWN while it contains modeled facts`)
      }
      sections[section.name] = { ...section, status: 'ESTIMATED' }
    } else {
      sections[section.name] = section
    }
  }
  const gaps = (snapshot.gaps ?? []).map((rawGap) => {
    const gap = farmer360DataGapSchema.parse(rawGap)
    assertSameOrg({ orgId: profile.orgId, actorId: 'farmer360-source' }, gap.orgId)
    if (gap.profileId !== profile.id) {
      throw new Error('Farmer 360 source returned a gap for a different profile')
    }
    return gap
  })
  return { sections, gaps }
}

function deriveGaps(
  sections: Readonly<Record<Farmer360SectionName, Farmer360Section>>,
  supplied: readonly Farmer360DataGap[],
  profile: Farmer360Profile,
): Farmer360DataGap[] {
  const gaps = new Map(supplied.map((gap) => [gap.id, gap]))
  for (const section of Object.values(sections)) {
    if (section.status === 'UNKNOWN') {
      const gap: Farmer360DataGap = {
        orgId: profile.orgId,
        profileId: profile.id,
        id: `unknown-${section.name}`,
        subject: section.name,
        missingOrWeakEvidence: [],
        impact: `The ${section.name} context is not evidenced; do not treat it as zero or absent in the operation.`,
        importance: 'medium',
        affectedCapability: 'Farmer 360',
      }
      gaps.set(gap.id, gap)
    }
    for (const fact of [
      ...section.facts,
      ...section.conflicts.flatMap((conflict) => conflict.competingFacts),
    ]) {
      if (fact.freshness === 'stale' || fact.freshness === 'unknown') {
        const gap: Farmer360DataGap = {
          orgId: profile.orgId,
          profileId: profile.id,
          id: `freshness-${section.name}-${fact.key}`,
          subject: fact.label,
          missingOrWeakEvidence: [fact.source],
          impact: `The ${fact.label} evidence is ${fact.freshness}.`,
          importance: fact.freshness === 'stale' ? 'high' : 'medium',
          affectedCapability: 'Farmer 360',
        }
        gaps.set(gap.id, gap)
      }
    }
    for (const conflict of section.conflicts) {
      const gap: Farmer360DataGap = {
        orgId: profile.orgId,
        profileId: profile.id,
        id: `conflict-${section.name}-${conflict.key}`,
        subject: conflict.key,
        missingOrWeakEvidence: conflict.competingFacts.map((fact) => fact.source),
        impact: conflict.description,
        importance: 'high',
        affectedCapability: 'Farmer 360',
      }
      gaps.set(gap.id, gap)
    }
  }
  return [...gaps.values()]
}

function flattenConflicts(
  sections: Readonly<Record<Farmer360SectionName, Farmer360Section>>,
): Farmer360Conflict[] {
  return Object.values(sections).flatMap((section) => section.conflicts)
}

async function filterSourceDisclosure(
  context: Farmer360RequestContext,
  snapshot: {
    readonly sections: Readonly<Record<Farmer360SectionName, Farmer360Section>>
    readonly gaps: readonly Farmer360DataGap[]
  },
  evaluate: Farmer360ServicePorts['evaluateSourceDisclosure'],
): Promise<{
  readonly sections: Record<Farmer360SectionName, Farmer360Section>
  readonly gaps: readonly Farmer360DataGap[]
}> {
  const recipient = {
    platformUserId: context.actorId,
    identityBindingId: context.identityBindingId,
    identityBindingState: context.identityBindingState,
    organizationId: context.orgId,
    membershipId: context.membershipId,
    membershipState: context.membershipState,
    membershipRole: context.role,
    membershipRoleSource: context.membershipRoleSource ?? 'unknown',
    applicationId: context.appId,
    permissions: context.permissions,
    requestId: context.requestId,
    correlationId: context.correlationId ?? context.requestId,
  } as const
  const withheldSourceRefs = new Set<string>()
  const sections = emptyFarmer360Sections()

  async function keepFact(fact: Farmer360Fact): Promise<boolean> {
    const result = await evaluate({
      recipient,
      surface: 'farmer360',
      action: 'read',
      purpose: 'farmer360.operational-read',
      fact: {
        organizationId: fact.orgId,
        sourceSystem: fact.source.system,
        sourceRecordId: fact.source.recordId,
        factClass: fact.key,
        observedAt: fact.observedAt,
        value: fact.value,
        contractVersion: fact.contractVersion,
      },
      provenance: fact.provenance,
    })
    if (result.decision === 'DENY') {
      throw new OrgAccessDeniedError('Source-disclosure policy denied this Farmer 360 read')
    }
    if (result.decision === 'WITHHOLD') {
      withheldSourceRefs.add(`${fact.source.system}\u0000${fact.source.recordId}`)
      return false
    }
    return true
  }

  for (const [name, section] of Object.entries(snapshot.sections) as [
    Farmer360SectionName,
    Farmer360Section,
  ][]) {
    const facts: Farmer360Fact[] = []
    for (const fact of section.facts) {
      if (await keepFact(fact)) facts.push(fact)
    }

    const conflicts: Farmer360Conflict[] = []
    for (const conflict of section.conflicts) {
      const competingFacts: Farmer360Fact[] = []
      for (const fact of conflict.competingFacts) {
        if (await keepFact(fact)) competingFacts.push(fact)
      }
      if (competingFacts.length > 1) {
        conflicts.push({ ...conflict, competingFacts })
      } else if (competingFacts.length === 1) {
        const remainingFact = competingFacts[0]
        if (
          !facts.some(
            (fact) =>
              fact.key === remainingFact.key &&
              fact.source.system === remainingFact.source.system &&
              fact.source.recordId === remainingFact.source.recordId,
          )
        ) {
          facts.push(remainingFact)
        }
      }
    }

    const withheldCount =
      section.facts.length +
      section.conflicts.reduce((count, conflict) => count + conflict.competingFacts.length, 0) -
      facts.length -
      conflicts.reduce((count, conflict) => count + conflict.competingFacts.length, 0)
    const hasRemainingFacts = facts.length > 0 || conflicts.length > 0
    const status =
      withheldCount === 0
        ? section.status
        : !hasRemainingFacts
          ? 'UNKNOWN'
          : section.status === 'KNOWN'
            ? 'PARTIAL'
            : section.status

    sections[name] = { ...section, status, facts, conflicts }
  }

  return {
    sections,
    gaps: snapshot.gaps.filter(
      (gap) =>
        !gap.missingOrWeakEvidence.some((source) =>
          withheldSourceRefs.has(`${source.system}\u0000${source.recordId}`),
        ),
    ),
  }
}

export function createFarmer360Service(ports: Farmer360ServicePorts) {
  if (!ports.environment.trim()) {
    throw new Error('Farmer 360 environment must be explicitly configured')
  }

  async function requireProfile(context: OrgContext, profileId: string): Promise<Farmer360Profile> {
    requireOrgScope(context)
    requirePermission(context, CORA_FARMER360_READ_PERMISSION)
    const profile = await ports.persistence.getProfile(toDbContext(context), profileId)
    if (!profile) throw new Error(`Farmer 360 profile not found: ${profileId}`)
    assertProfileScope(context, profile)
    return profile
  }

  async function assemble(
    context: Farmer360RequestContext,
    profileId: string,
  ): Promise<Farmer360ReadModel> {
    const profile = await requireProfile(context, profileId)
    const snapshot = await ports.getAuthorizedSources(toDbContext(context), profile)
    const validated = await filterSourceDisclosure(
      context,
      validateSnapshot(snapshot, profile),
      ports.evaluateSourceDisclosure,
    )
    return {
      profile,
      sections: validated.sections,
      gaps: deriveGaps(validated.sections, validated.gaps, profile),
      conflicts: flattenConflicts(validated.sections),
    }
  }

  async function authorizeWrite(
    context: OrgContext,
    permission: string,
    action: Farmer360WriteAction,
    resourceId: string,
    consent?: {
      readonly purpose: string
      readonly consentRef: string
      readonly source: FarmerAssertionInput['source']
    },
  ): Promise<Farmer360AuditIntent['authorization']> {
    requireOrgScope(context)
    requirePermission(context, permission)
    let consentDecision: { readonly consentRef: string; readonly evaluatedAt: string } | undefined
    if (consent) {
      const decision = await ports.authorizeConsentUse({
        orgId: context.orgId,
        actorId: context.actorId,
        consentRef: consent.consentRef,
        purpose: consent.purpose,
        recipient: 'cora',
        source: consent.source,
      })
      if (decision.status !== 'granted' || decision.consentRef !== consent.consentRef) {
        throw new Farmer360AuthorizationError('Canonical consent did not authorize this assertion')
      }
      consentDecision = { consentRef: decision.consentRef, evaluatedAt: decision.evaluatedAt }
    }
    const expected = makePolicyInput(context, ports.environment, action, resourceId)
    const policyEvaluationIds = requirePassingPolicy(
      await ports.evaluateAndAuditPolicy(expected),
      expected,
    )
    return {
      policyEvaluationIds,
      ...(consentDecision
        ? {
            consentRef: consentDecision.consentRef,
            consentEvaluatedAt: consentDecision.evaluatedAt,
          }
        : {}),
    }
  }

  return {
    async getFarmer360(
      context: Farmer360RequestContext,
      profileId: string,
    ): Promise<Farmer360ReadModel> {
      return assemble(context, profileId)
    },

    async getFarmer360Section(
      context: Farmer360RequestContext,
      profileId: string,
      sectionName: Farmer360SectionName,
    ): Promise<Farmer360Section> {
      const section = (await assemble(context, profileId)).sections[sectionName]
      if (!section) throw new Error(`Unknown Farmer 360 section: ${sectionName}`)
      return section
    },

    async getFarmer360Evidence(
      context: Farmer360RequestContext,
      profileId: string,
    ): Promise<readonly Farmer360Fact[]> {
      const model = await assemble(context, profileId)
      return Object.values(model.sections).flatMap((section) => [
        ...section.facts,
        ...section.conflicts.flatMap((conflict) => conflict.competingFacts),
      ])
    },

    async getFarmer360Gaps(
      context: Farmer360RequestContext,
      profileId: string,
    ): Promise<readonly Farmer360DataGap[]> {
      return (await assemble(context, profileId)).gaps
    },

    async getFarmer360Assertions(
      context: OrgContext,
      profileId: string,
    ): Promise<readonly Farmer360Assertion[]> {
      const profile = await requireProfile(context, profileId)
      const assertions = await ports.persistence.listFarmerAssertions(
        toDbContext(context),
        profile.id,
      )
      for (const assertion of assertions) assertSameOrg(context, assertion.orgId)
      return assertions
    },

    async upsertCoraEnterpriseContext(
      context: OrgContext,
      input: CoraEnterpriseContextInput,
    ): Promise<Farmer360Profile> {
      const parsed = coraEnterpriseContextInputSchema.parse(input)
      const dbContext = toDbContext(context)
      const existing = parsed.profileId
        ? await ports.persistence.getProfile(dbContext, parsed.profileId)
        : await ports.persistence.getProfileBySubject(dbContext, parsed.subjectRef)
      if (parsed.profileId && !existing) {
        throw new Error(`Farmer 360 profile not found: ${parsed.profileId}`)
      }
      if (existing) {
        assertProfileScope(context, existing)
        if (
          existing.subjectRef.system !== parsed.subjectRef.system ||
          existing.subjectRef.recordId !== parsed.subjectRef.recordId
        ) {
          throw new Error('Farmer 360 profile cannot be rebound to a different source subject')
        }
      }
      const authorization = await authorizeWrite(
        context,
        CORA_ENTERPRISE_CONTEXT_WRITE_PERMISSION,
        'enterprise-context.write',
        parsed.profileId ?? parsed.subjectRef.recordId,
      )
      const record = await ports.persistence.appendEnterpriseContextVersion(dbContext, parsed, {
        action: 'enterprise-context.write',
        orgId: context.orgId,
        actorId: context.actorId,
        requestId: context.requestId,
        resourceId: parsed.profileId ?? parsed.subjectRef.recordId,
        authorization,
      })
      assertProfileScope(context, record)
      return record
    },

    async recordFarmerAssertion(
      context: OrgContext,
      input: FarmerAssertionInput,
    ): Promise<Farmer360Assertion> {
      const parsed = farmerAssertionInputSchema.parse(input)
      const profile = await requireProfile(context, parsed.profileId)
      assertProfileScope(context, profile)
      const authorization = await authorizeWrite(
        context,
        CORA_FARMER_ASSERTION_WRITE_PERMISSION,
        'farmer-assertion.record',
        parsed.profileId,
        parsed,
      )
      const assertion = await ports.persistence.appendFarmerAssertion(
        toDbContext(context),
        {
          profileId: parsed.profileId,
          subject: parsed.subject,
          statement: parsed.statement,
          purpose: parsed.purpose,
          consentRef: parsed.consentRef,
          source: parsed.source,
          observedAt: parsed.observedAt,
        },
        {
          action: 'farmer-assertion.record',
          orgId: context.orgId,
          actorId: context.actorId,
          requestId: context.requestId,
          resourceId: parsed.profileId,
          authorization,
        },
      )
      assertSameOrg(context, assertion.orgId)
      if (
        assertion.profileId !== profile.id ||
        assertion.evidence.system !== 'cora-evidence' ||
        !assertion.evidence.evidenceId ||
        !assertion.evidence.payloadSha256
      ) {
        throw new Error('Farmer assertion must link to its atomically recorded Cora evidence')
      }
      if (assertion.verificationState !== 'unverified') {
        throw new Error('Farmer assertions must begin in the unverified state')
      }
      return assertion
    },
  }
}

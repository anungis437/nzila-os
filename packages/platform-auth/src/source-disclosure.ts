import { randomUUID } from 'node:crypto'
import { z } from 'zod'

export const sourceDisclosurePolicySchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    status: z.enum(['draft', 'active', 'inactive', 'revoked']),
    effectiveFrom: z.string().datetime(),
    effectiveTo: z.string().datetime(),
    reviewBy: z.string().datetime(),
    governingAuthorityRef: z.string().min(1),
    governanceEvidenceRef: z.string().min(1),
    rationale: z.string().min(1),
    source: z
      .object({
        system: z.string().min(1),
        domain: z.string().min(1),
        entity: z.string().min(1),
        authorityRef: z.string().min(1),
        factClass: z.string().min(1),
      })
      .strict(),
    recipient: z
      .object({
        applicationId: z.string().min(1),
        surface: z.string().min(1),
        action: z.string().min(1),
        purpose: z.string().min(1),
        organizationRelationship: z.literal('same-organization'),
        requiredPermission: z.string().min(1),
        requiredMembershipState: z.literal('active'),
        eligibilityPrimitive: z.literal('canonical-membership-role'),
        roles: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    factContract: z
      .object({
        id: z.string().min(1),
        version: z.string().min(1),
      })
      .strict(),
    freshnessPolicy: z
      .object({
        id: z.string().min(1),
        version: z.string().min(1),
      })
      .strict(),
    activationEvidence: z
      .object({
        sourceAuthority: z.string().min(1),
        privacyLegal: z.string().min(1),
        governanceApproval: z.string().min(1),
        cacheRetentionDisposition: z.string().min(1),
        auditDisposition: z.string().min(1),
        recipientEligibility: z.string().min(1),
        exportOnwardDisclosure: z.string().min(1),
        conditionAttestation: z.string().min(1),
        suspensionProcedure: z.string().min(1),
        revocationProcedure: z.string().min(1),
        revocationAuthority: z.string().min(1),
      })
      .strict(),
    decision: z.enum(['ALLOW', 'DENY']),
  })
  .strict()
  .refine((policy) => Date.parse(policy.effectiveTo) > Date.parse(policy.effectiveFrom), {
    message: 'effectiveTo must be later than effectiveFrom',
  })
  .refine(
    (policy) =>
      Date.parse(policy.reviewBy) > Date.parse(policy.effectiveFrom) &&
      Date.parse(policy.reviewBy) <= Date.parse(policy.effectiveTo),
    { message: 'reviewBy must fall after effectiveFrom and on or before effectiveTo' },
  )

export const sourceDisclosureFactContractSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    sourceSystem: z.string().min(1),
    factClass: z.string().min(1),
    allowedValues: z.array(z.union([z.string().min(1), z.number().finite(), z.boolean()])).min(1),
    evidenceRef: z.string().min(1),
  })
  .strict()

export const sourceDisclosureFreshnessPolicySchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    maxAgeMs: z.number().int().positive(),
    evidenceRef: z.string().min(1),
    staleBehavior: z.literal('withhold'),
    invalidTimestampBehavior: z.literal('withhold'),
    futureTimestampBehavior: z.literal('withhold'),
    withheldValues: z.array(z.string().min(1)).optional(),
  })
  .strict()

const sourceDisclosureVerifiedEvidenceSchema = z
  .object({
    reference: z.string().min(1),
    state: z.literal('approved'),
    effectiveFrom: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict()

export const sourceDisclosureEvidenceRecordSchema = sourceDisclosureVerifiedEvidenceSchema
export type SourceDisclosureEvidenceRecord = z.infer<typeof sourceDisclosureEvidenceRecordSchema>

const sourceDisclosureActivationPackageSchema = z
  .object({
    policy: sourceDisclosurePolicySchema,
    contracts: z.array(sourceDisclosureFactContractSchema),
    freshnessPolicies: z.array(sourceDisclosureFreshnessPolicySchema),
    evidence: z
      .object({
        sourceAuthority: sourceDisclosureVerifiedEvidenceSchema,
        privacyLegal: sourceDisclosureVerifiedEvidenceSchema,
        governanceApproval: sourceDisclosureVerifiedEvidenceSchema,
        cacheRetentionDisposition: sourceDisclosureVerifiedEvidenceSchema,
        auditDisposition: sourceDisclosureVerifiedEvidenceSchema,
        recipientEligibility: sourceDisclosureVerifiedEvidenceSchema,
        exportOnwardDisclosure: sourceDisclosureVerifiedEvidenceSchema,
        conditionAttestation: sourceDisclosureVerifiedEvidenceSchema,
        suspensionProcedure: sourceDisclosureVerifiedEvidenceSchema,
        revocationProcedure: sourceDisclosureVerifiedEvidenceSchema,
        revocationAuthority: sourceDisclosureVerifiedEvidenceSchema,
        factContract: sourceDisclosureVerifiedEvidenceSchema,
        freshnessPolicy: sourceDisclosureVerifiedEvidenceSchema,
      })
      .strict(),
  })
  .strict()

export const sourceDisclosureProvenanceSchema = z
  .object({
    sourceSystem: z.string().min(1),
    sourceDomain: z.string().min(1),
    sourceEntity: z.string().min(1),
    sourceAuthorityRef: z.string().min(1),
    sourceRecordId: z.string().min(1),
    sourceOrganizationId: z.string().min(1),
    factClass: z.string().min(1),
    observedAt: z.string().datetime().optional(),
    provenanceRef: z.string().min(1),
  })
  .strict()

export type SourceDisclosurePolicy = z.infer<typeof sourceDisclosurePolicySchema>
export type SourceDisclosureProvenance = z.infer<typeof sourceDisclosureProvenanceSchema>
export type SourceDisclosureFactContract = z.infer<typeof sourceDisclosureFactContractSchema>
export type SourceDisclosureFreshnessPolicy = z.infer<typeof sourceDisclosureFreshnessPolicySchema>

export interface SourceDisclosureRecipient {
  readonly platformUserId: string
  readonly identityBindingId: string
  readonly identityBindingState: 'active' | 'disabled' | 'revoked'
  readonly organizationId: string
  readonly membershipId: string
  readonly membershipState: 'active' | 'invited' | 'suspended' | 'revoked'
  readonly membershipRole: string
  readonly membershipRoleSource: 'canonical' | 'fallback' | 'unknown'
  readonly applicationId: string
  readonly permissions: readonly string[]
  readonly requestId: string
  readonly correlationId: string
}

export interface SourceDisclosureFactIdentity {
  readonly organizationId: string
  readonly sourceSystem: string
  readonly sourceRecordId: string
  readonly factClass: string
  readonly observedAt?: string
  readonly value?: unknown
  readonly contractVersion?: string
}

export interface SourceDisclosureEvaluationInput {
  readonly recipient: SourceDisclosureRecipient
  readonly surface: string
  readonly action: string
  readonly purpose: string
  readonly fact: SourceDisclosureFactIdentity
  readonly provenance?: unknown
}

export type SourceDisclosureDecision = 'ALLOW' | 'WITHHOLD' | 'DENY'

export type SourceDisclosureReason =
  | 'NO_GOVERNED_POLICY'
  | 'SOURCE_ORGANIZATION_MISMATCH'
  | 'RECIPIENT_AUTHORITY_INVALID'
  | 'APPLICATION_PERMISSION_REQUIRED'
  | 'MISSING_OR_INVALID_PROVENANCE'
  | 'PROVENANCE_FACT_MISMATCH'
  | 'POLICY_CONFIGURATION_INVALID'
  | 'POLICY_INACTIVE'
  | 'POLICY_NOT_YET_EFFECTIVE'
  | 'POLICY_EXPIRED'
  | 'POLICY_VERSION_MISMATCH'
  | 'RECIPIENT_NOT_EXPLICITLY_ELIGIBLE'
  | 'STATUS_CONTRACT_REQUIRED'
  | 'STATUS_NOT_ALLOWED'
  | 'FACT_CONTRACT_VERSION_MISMATCH'
  | 'FRESHNESS_POLICY_REQUIRED'
  | 'FRESHNESS_POLICY_VERSION_MISMATCH'
  | 'FACT_STALE'
  | 'FACT_TIMESTAMP_INVALID'
  | 'FACT_TIMESTAMP_IN_FUTURE'
  | 'ACTIVATION_EVIDENCE_INCOMPLETE'
  | 'AMBIGUOUS_POLICY'
  | 'POLICY_ALLOW'
  | 'POLICY_DENY'

export interface SourceDisclosureAuditEvent {
  readonly decisionId: string
  readonly decision: SourceDisclosureDecision
  readonly reason: SourceDisclosureReason
  readonly actorId: string
  readonly identityBindingId: string
  readonly membershipId: string
  readonly organizationId: string
  readonly applicationId: string
  readonly surface: string
  readonly action: string
  readonly purpose: string
  readonly sourceSystem: string
  readonly sourceDomain?: string
  readonly sourceEntity?: string
  readonly sourceOrganizationId?: string
  readonly factClass: string
  readonly policyId?: string
  readonly policyVersion?: string
  readonly occurredAt: string
  readonly correlationId: string
}

export interface SourceDisclosureDecisionResult {
  readonly decision: SourceDisclosureDecision
  readonly reason: SourceDisclosureReason
  readonly decisionId: string
  readonly policyId?: string
  readonly policyVersion?: string
  readonly evaluatedAt: string
}

export interface SourceDisclosureAuthorityPorts {
  readonly loadPolicies: () => Promise<readonly unknown[]>
  readonly loadFactContracts?: () => Promise<readonly unknown[]>
  readonly loadFreshnessPolicies?: () => Promise<readonly unknown[]>
  readonly loadApprovedEvidence?: () => Promise<readonly unknown[]>
  readonly recordAudit: (event: SourceDisclosureAuditEvent) => Promise<void>
  readonly now?: () => Date
}

export interface SourceDisclosureActivationPreflightResult {
  readonly decision: 'PREACTIVATION_VALIDATED' | 'ACTIVATION_REJECTED'
  readonly installsPolicy: false
  readonly issues: readonly string[]
}

export function preflightSourceDisclosureActivation(
  candidate: unknown,
  now = new Date(),
): SourceDisclosureActivationPreflightResult {
  const parsed = sourceDisclosureActivationPackageSchema.safeParse(candidate)
  if (!parsed.success) {
    return {
      decision: 'ACTIVATION_REJECTED',
      installsPolicy: false,
      issues: parsed.error.issues.map((issue) => issue.path.join('.') || 'package'),
    }
  }

  const { policy, contracts, freshnessPolicies, evidence } = parsed.data
  const issues: string[] = []
  const nowTime = now.getTime()
  const references = policy.activationEvidence
  if (policy.status !== 'draft') issues.push('policy.status')

  for (const key of [
    'sourceAuthority',
    'privacyLegal',
    'governanceApproval',
    'cacheRetentionDisposition',
    'auditDisposition',
    'recipientEligibility',
    'exportOnwardDisclosure',
    'conditionAttestation',
    'suspensionProcedure',
    'revocationProcedure',
    'revocationAuthority',
  ] as const) {
    const proof = evidence[key]
    if (
      proof.reference !== references[key] ||
      Date.parse(proof.effectiveFrom) > nowTime ||
      Date.parse(proof.expiresAt) <= nowTime ||
      Date.parse(proof.expiresAt) <= Date.parse(proof.effectiveFrom)
    ) {
      issues.push(`evidence.${key}`)
    }
  }

  const contractMatches = contracts.filter(
    (item) => item.id === policy.factContract.id && item.version === policy.factContract.version,
  )
  const contract = contractMatches.length === 1 ? contractMatches[0] : undefined
  if (
    !contract ||
    contract.sourceSystem !== policy.source.system ||
    contract.factClass !== policy.source.factClass ||
    evidence.factContract.reference !== contract.evidenceRef
  ) {
    issues.push('factContract')
  }

  const freshnessMatches = freshnessPolicies.filter(
    (item) =>
      item.id === policy.freshnessPolicy.id && item.version === policy.freshnessPolicy.version,
  )
  const freshness = freshnessMatches.length === 1 ? freshnessMatches[0] : undefined
  if (!freshness || evidence.freshnessPolicy.reference !== freshness.evidenceRef) {
    issues.push('freshnessPolicy')
  }

  for (const key of ['factContract', 'freshnessPolicy'] as const) {
    const proof = evidence[key]
    if (
      Date.parse(proof.effectiveFrom) > nowTime ||
      Date.parse(proof.expiresAt) <= nowTime ||
      Date.parse(proof.expiresAt) <= Date.parse(proof.effectiveFrom)
    ) {
      issues.push(`evidence.${key}`)
    }
  }

  if (
    Date.parse(policy.effectiveFrom) > nowTime ||
    Date.parse(policy.effectiveTo) <= nowTime ||
    Date.parse(policy.reviewBy) <= nowTime
  ) {
    issues.push('policy.effectiveDates')
  }

  return {
    decision: issues.length === 0 ? 'PREACTIVATION_VALIDATED' : 'ACTIVATION_REJECTED',
    installsPolicy: false,
    issues,
  }
}

export function createSourceDisclosureAuthority(ports: SourceDisclosureAuthorityPorts) {
  return {
    async evaluate(
      input: SourceDisclosureEvaluationInput,
    ): Promise<SourceDisclosureDecisionResult> {
      const evaluatedAt = (ports.now?.() ?? new Date()).toISOString()
      const nowTime = Date.parse(evaluatedAt)
      const provenanceResult = sourceDisclosureProvenanceSchema.safeParse(input.provenance)
      const provenance = provenanceResult.success ? provenanceResult.data : undefined
      let auditedProvenance = provenance
      let decision: SourceDisclosureDecision = 'WITHHOLD'
      let reason: SourceDisclosureReason = 'NO_GOVERNED_POLICY'
      let policyId: string | undefined
      let policyVersion: string | undefined

      if (
        input.recipient.identityBindingState !== 'active' ||
        input.recipient.membershipState !== 'active' ||
        !input.recipient.platformUserId.trim() ||
        !input.recipient.identityBindingId.trim() ||
        !input.recipient.membershipId.trim() ||
        !input.recipient.organizationId.trim()
      ) {
        reason = 'RECIPIENT_AUTHORITY_INVALID'
      } else if (!input.fact.observedAt || !Number.isFinite(Date.parse(input.fact.observedAt))) {
        reason = 'FACT_TIMESTAMP_INVALID'
      } else if (!provenance) {
        reason = 'MISSING_OR_INVALID_PROVENANCE'
      } else if (input.recipient.membershipRoleSource !== 'canonical') {
        reason = 'RECIPIENT_NOT_EXPLICITLY_ELIGIBLE'
      } else if (
        provenance.sourceSystem !== input.fact.sourceSystem ||
        provenance.sourceRecordId !== input.fact.sourceRecordId ||
        provenance.sourceOrganizationId !== input.fact.organizationId ||
        provenance.factClass !== input.fact.factClass ||
        provenance.observedAt !== input.fact.observedAt
      ) {
        reason = 'PROVENANCE_FACT_MISMATCH'
        auditedProvenance = undefined
      } else if (provenance.sourceOrganizationId !== input.recipient.organizationId) {
        reason = 'SOURCE_ORGANIZATION_MISMATCH'
      } else {
        const parsedPolicies = (await ports.loadPolicies()).map((policy) =>
          sourceDisclosurePolicySchema.safeParse(policy),
        )
        const policiesValid = parsedPolicies.every((result) => result.success)
        if (!policiesValid) {
          reason = 'POLICY_CONFIGURATION_INVALID'
        } else {
          const policies = parsedPolicies.flatMap((result) => (result.success ? [result.data] : []))
          const applicable = policies.filter((policy) =>
            matchesDisclosureRequest(policy, input, provenance),
          )

          if (applicable.length === 1) {
            const [policy] = applicable
            policyId = policy.id
            policyVersion = policy.version
            const versions = policies.filter((candidate) => candidate.id === policy.id)
            if (new Set(versions.map((candidate) => candidate.version)).size > 1) {
              reason = 'POLICY_VERSION_MISMATCH'
            } else if (policy.status !== 'active') {
              reason = 'POLICY_INACTIVE'
            } else if (Date.parse(policy.effectiveFrom) > Date.parse(evaluatedAt)) {
              reason = 'POLICY_NOT_YET_EFFECTIVE'
            } else if (
              Date.parse(policy.effectiveTo) <= nowTime ||
              Date.parse(policy.reviewBy) <= nowTime
            ) {
              reason = 'POLICY_EXPIRED'
            } else if (
              input.recipient.applicationId !== policy.recipient.applicationId ||
              !input.recipient.permissions.includes(policy.recipient.requiredPermission)
            ) {
              decision = 'DENY'
              reason = 'APPLICATION_PERMISSION_REQUIRED'
            } else if (!policy.recipient.roles.includes(input.recipient.membershipRole)) {
              reason = 'RECIPIENT_NOT_EXPLICITLY_ELIGIBLE'
            } else {
              const contractResult = await loadContract(
                ports.loadFactContracts,
                policy.factContract.id,
                policy.factContract.version,
              )
              if (!contractResult.contract) {
                reason = contractResult.reason
              } else if (
                contractResult.contract.sourceSystem !== input.fact.sourceSystem ||
                contractResult.contract.factClass !== input.fact.factClass ||
                input.fact.contractVersion !== contractResult.contract.version
              ) {
                reason = 'FACT_CONTRACT_VERSION_MISMATCH'
              } else if (
                !contractResult.contract.allowedValues.some((value) =>
                  Object.is(value, input.fact.value),
                )
              ) {
                reason = 'STATUS_NOT_ALLOWED'
              } else {
                const freshnessResult = await loadFreshnessPolicy(
                  ports.loadFreshnessPolicies,
                  policy.freshnessPolicy.id,
                  policy.freshnessPolicy.version,
                )
                if (!freshnessResult.policy) {
                  reason = freshnessResult.reason
                } else {
                  const approvedEvidence = await loadCurrentApprovedEvidence(
                    ports.loadApprovedEvidence,
                    policy,
                    contractResult.contract.evidenceRef,
                    freshnessResult.policy.evidenceRef,
                    nowTime,
                  )
                  if (!approvedEvidence) {
                    reason = 'ACTIVATION_EVIDENCE_INCOMPLETE'
                  } else {
                    const observedAt = Date.parse(input.fact.observedAt)
                    const ageMs = nowTime - observedAt
                    if (!Number.isFinite(observedAt)) {
                      reason = 'FACT_TIMESTAMP_INVALID'
                    } else if (ageMs < 0) {
                      reason = 'FACT_TIMESTAMP_IN_FUTURE'
                    } else if (ageMs > freshnessResult.policy.maxAgeMs) {
                      reason = 'FACT_STALE'
                    } else if (
                      typeof input.fact.value === 'string' &&
                      freshnessResult.policy.withheldValues?.includes(input.fact.value)
                    ) {
                      reason = 'STATUS_NOT_ALLOWED'
                    } else {
                      decision = policy.decision
                      reason = policy.decision === 'ALLOW' ? 'POLICY_ALLOW' : 'POLICY_DENY'
                    }
                  }
                }
              }
            }
          } else if (applicable.length > 1) {
            const samePolicyVersions = new Map<string, Set<string>>()
            for (const policy of applicable) {
              const versions = samePolicyVersions.get(policy.id) ?? new Set<string>()
              versions.add(policy.version)
              samePolicyVersions.set(policy.id, versions)
            }
            const versionConflict = [...samePolicyVersions.values()].some(
              (versions) => versions.size > 1,
            )
            reason = versionConflict ? 'POLICY_VERSION_MISMATCH' : 'AMBIGUOUS_POLICY'
          }
        }
      }

      const result: SourceDisclosureDecisionResult = {
        decision,
        reason,
        decisionId: randomUUID(),
        ...(policyId ? { policyId } : {}),
        ...(policyVersion ? { policyVersion } : {}),
        evaluatedAt,
      }
      await ports.recordAudit({
        decisionId: result.decisionId,
        decision,
        reason,
        actorId: input.recipient.platformUserId,
        identityBindingId: input.recipient.identityBindingId,
        membershipId: input.recipient.membershipId,
        organizationId: input.recipient.organizationId,
        applicationId: input.recipient.applicationId,
        surface: input.surface,
        action: input.action,
        purpose: input.purpose,
        sourceSystem: auditedProvenance?.sourceSystem ?? input.fact.sourceSystem,
        ...(auditedProvenance
          ? {
              sourceDomain: auditedProvenance.sourceDomain,
              sourceEntity: auditedProvenance.sourceEntity,
              sourceOrganizationId: auditedProvenance.sourceOrganizationId,
            }
          : {}),
        factClass: auditedProvenance?.factClass ?? input.fact.factClass,
        ...(policyId ? { policyId } : {}),
        ...(policyVersion ? { policyVersion } : {}),
        occurredAt: evaluatedAt,
        correlationId: input.recipient.correlationId,
      })
      return result
    },
  }
}

async function loadContract(
  load: SourceDisclosureAuthorityPorts['loadFactContracts'],
  id: string,
  version: string,
): Promise<{
  readonly contract?: z.infer<typeof sourceDisclosureFactContractSchema>
  readonly reason: 'STATUS_CONTRACT_REQUIRED' | 'FACT_CONTRACT_VERSION_MISMATCH'
}> {
  const parsed = ((await load?.()) ?? []).map((contract) =>
    sourceDisclosureFactContractSchema.safeParse(contract),
  )
  if (parsed.some((result) => !result.success)) return { reason: 'STATUS_CONTRACT_REQUIRED' }
  const matches = parsed
    .flatMap((result) => (result.success ? [result.data] : []))
    .filter((contract) => contract.id === id)
  if (matches.length === 0) return { reason: 'STATUS_CONTRACT_REQUIRED' }
  if (matches.length !== 1 || matches[0].version !== version) {
    return { reason: 'FACT_CONTRACT_VERSION_MISMATCH' }
  }
  return { contract: matches[0], reason: 'STATUS_CONTRACT_REQUIRED' }
}

async function loadFreshnessPolicy(
  load: SourceDisclosureAuthorityPorts['loadFreshnessPolicies'],
  id: string,
  version: string,
): Promise<{
  readonly policy?: z.infer<typeof sourceDisclosureFreshnessPolicySchema>
  readonly reason: 'FRESHNESS_POLICY_REQUIRED' | 'FRESHNESS_POLICY_VERSION_MISMATCH'
}> {
  const parsed = ((await load?.()) ?? []).map((policy) =>
    sourceDisclosureFreshnessPolicySchema.safeParse(policy),
  )
  if (parsed.some((result) => !result.success)) return { reason: 'FRESHNESS_POLICY_REQUIRED' }
  const matches = parsed
    .flatMap((result) => (result.success ? [result.data] : []))
    .filter((policy) => policy.id === id)
  if (matches.length === 0) return { reason: 'FRESHNESS_POLICY_REQUIRED' }
  if (matches.length !== 1 || matches[0].version !== version) {
    return { reason: 'FRESHNESS_POLICY_VERSION_MISMATCH' }
  }
  return { policy: matches[0], reason: 'FRESHNESS_POLICY_REQUIRED' }
}

async function loadCurrentApprovedEvidence(
  load: SourceDisclosureAuthorityPorts['loadApprovedEvidence'],
  policy: z.infer<typeof sourceDisclosurePolicySchema>,
  factContractRef: string,
  freshnessPolicyRef: string,
  now: number,
): Promise<boolean> {
  const parsed = ((await load?.()) ?? []).map((evidence) =>
    sourceDisclosureEvidenceRecordSchema.safeParse(evidence),
  )
  if (parsed.some((result) => !result.success)) return false
  const evidence = parsed.flatMap((result) => (result.success ? [result.data] : []))
  const references = [
    policy.activationEvidence.sourceAuthority,
    policy.activationEvidence.privacyLegal,
    policy.activationEvidence.governanceApproval,
    policy.activationEvidence.cacheRetentionDisposition,
    policy.activationEvidence.auditDisposition,
    factContractRef,
    freshnessPolicyRef,
  ]
  return references.every((reference) => {
    const matches = evidence.filter((entry) => entry.reference === reference)
    return (
      matches.length === 1 &&
      Date.parse(matches[0].effectiveFrom) <= now &&
      Date.parse(matches[0].expiresAt) > now
    )
  })
}

function matchesDisclosureRequest(
  policy: z.infer<typeof sourceDisclosurePolicySchema>,
  input: SourceDisclosureEvaluationInput,
  provenance: z.infer<typeof sourceDisclosureProvenanceSchema>,
): boolean {
  return (
    policy.source.system === provenance.sourceSystem &&
    policy.source.domain === provenance.sourceDomain &&
    policy.source.entity === provenance.sourceEntity &&
    policy.source.authorityRef === provenance.sourceAuthorityRef &&
    policy.source.factClass === provenance.factClass &&
    policy.recipient.applicationId === input.recipient.applicationId &&
    policy.recipient.surface === input.surface &&
    policy.recipient.action === input.action &&
    policy.recipient.purpose === input.purpose &&
    policy.recipient.organizationRelationship === 'same-organization' &&
    provenance.sourceOrganizationId === input.recipient.organizationId
  )
}

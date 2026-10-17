import { describe, expect, it, vi } from 'vitest'
import {
  createSourceDisclosureAuthority,
  preflightSourceDisclosureActivation,
  type SourceDisclosureAuditEvent,
  type SourceDisclosureEvaluationInput,
  type SourceDisclosurePolicy,
  type SourceDisclosureProvenance,
} from './source-disclosure'

const now = new Date('2026-10-07T16:00:00.000Z')

const provenance: SourceDisclosureProvenance = {
  sourceSystem: 'agrimo',
  sourceDomain: 'agriculture',
  sourceEntity: 'producer',
  sourceAuthorityRef: 'agrimo:operational-producer-record',
  sourceRecordId: 'producer-1',
  sourceOrganizationId: 'org-a',
  factClass: 'producer.status',
  observedAt: '2026-10-01T12:00:00.000Z',
  provenanceRef: 'agrimo:producer:producer-1:2026-10-01T12:00:00.000Z',
}

const input: SourceDisclosureEvaluationInput = {
  recipient: {
    platformUserId: 'user-a',
    identityBindingId: 'binding-a',
    identityBindingState: 'active',
    organizationId: 'org-a',
    membershipId: 'membership-a',
    membershipState: 'active',
    membershipRole: 'viewer',
    membershipRoleSource: 'canonical',
    applicationId: 'cora',
    permissions: ['cora:farmer360:read'],
    requestId: 'request-a',
    correlationId: 'correlation-a',
  },
  surface: 'farmer360',
  action: 'read',
  purpose: 'farmer360.operational-read',
  fact: {
    organizationId: 'org-a',
    sourceSystem: 'agrimo',
    sourceRecordId: 'producer-1',
    factClass: 'producer.status',
    observedAt: provenance.observedAt,
    value: 'active',
    contractVersion: '1.0.0',
  },
  provenance,
}

const factContract = {
  id: 'test-producer-status',
  version: '1.0.0',
  sourceSystem: 'agrimo',
  factClass: 'producer.status',
  allowedValues: ['active'],
  evidenceRef: 'test-evidence:fact-contract',
}

const freshnessPolicy = {
  id: 'test-freshness',
  version: '1.0.0',
  maxAgeMs: 90 * 24 * 60 * 60 * 1000,
  evidenceRef: 'test-evidence:freshness',
  staleBehavior: 'withhold' as const,
  invalidTimestampBehavior: 'withhold' as const,
  futureTimestampBehavior: 'withhold' as const,
}

const approvedEvidence = [
  'test-evidence:source-authority',
  'test-evidence:privacy-legal',
  'test-evidence:governance-approval',
  'test-evidence:cache-retention',
  'test-evidence:audit',
  'test-evidence:recipient-eligibility',
  'test-evidence:export-onward-disclosure',
  'test-evidence:condition-attestation',
  'test-evidence:suspension',
  'test-evidence:revocation',
  'test-evidence:revocation-authority',
  factContract.evidenceRef,
  freshnessPolicy.evidenceRef,
].map((reference) => ({
  reference,
  state: 'approved' as const,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  expiresAt: '2027-01-01T00:00:00.000Z',
}))

function policy(overrides: Partial<SourceDisclosurePolicy> = {}): SourceDisclosurePolicy {
  return {
    id: 'disclosure-policy-a',
    version: '1.0.0',
    status: 'active',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
    reviewBy: '2026-12-01T00:00:00.000Z',
    governingAuthorityRef: 'institutional-authority:pending-test',
    governanceEvidenceRef: 'governance-decision:test-fixture',
    rationale: 'Test-only policy with explicit source and recipient semantics',
    source: {
      system: 'agrimo',
      domain: 'agriculture',
      entity: 'producer',
      authorityRef: 'agrimo:operational-producer-record',
      factClass: 'producer.status',
    },
    recipient: {
      applicationId: 'cora',
      surface: 'farmer360',
      action: 'read',
      purpose: 'farmer360.operational-read',
      organizationRelationship: 'same-organization',
      requiredPermission: 'cora:farmer360:read',
      requiredMembershipState: 'active',
      eligibilityPrimitive: 'canonical-membership-role',
      roles: ['viewer'],
    },
    factContract: { id: factContract.id, version: factContract.version },
    freshnessPolicy: { id: freshnessPolicy.id, version: freshnessPolicy.version },
    activationEvidence: {
      sourceAuthority: 'test-evidence:source-authority',
      privacyLegal: 'test-evidence:privacy-legal',
      governanceApproval: 'test-evidence:governance-approval',
      cacheRetentionDisposition: 'test-evidence:cache-retention',
      auditDisposition: 'test-evidence:audit',
      recipientEligibility: 'test-evidence:recipient-eligibility',
      exportOnwardDisclosure: 'test-evidence:export-onward-disclosure',
      conditionAttestation: 'test-evidence:condition-attestation',
      suspensionProcedure: 'test-evidence:suspension',
      revocationProcedure: 'test-evidence:revocation',
      revocationAuthority: 'test-evidence:revocation-authority',
    },
    decision: 'ALLOW',
    ...overrides,
  }
}

function authority(
  policies: readonly unknown[] = [],
  config: {
    readonly contracts?: readonly unknown[]
    readonly freshnessPolicies?: readonly unknown[]
    readonly evidence?: readonly unknown[]
  } = {},
) {
  const recordAudit = vi.fn(async (_event: SourceDisclosureAuditEvent) => undefined)
  return {
    recordAudit,
    evaluator: createSourceDisclosureAuthority({
      loadPolicies: async () => policies,
      loadFactContracts: async () => config.contracts ?? [factContract],
      loadFreshnessPolicies: async () => config.freshnessPolicies ?? [freshnessPolicy],
      loadApprovedEvidence: async () => config.evidence ?? approvedEvidence,
      recordAudit,
      now: () => now,
    }),
  }
}

function inputObservedAt(observedAt: string | undefined): SourceDisclosureEvaluationInput {
  return {
    ...input,
    fact: { ...input.fact, observedAt },
    provenance: {
      ...provenance,
      observedAt,
      provenanceRef: `agrimo:producer:producer-1:${observedAt}`,
    },
  }
}

describe('governed source disclosure authority', () => {
  it('withholds an absent observation timestamp even with a complete synthetic policy', async () => {
    const { evaluator } = authority([policy()])
    await expect(evaluator.evaluate(inputObservedAt(undefined))).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'FACT_TIMESTAMP_INVALID',
    })
  })

  it('allows only one active, effective exact-match policy', async () => {
    const { evaluator, recordAudit } = authority([policy()])

    const result = await evaluator.evaluate(input)

    expect(result).toMatchObject({
      decision: 'ALLOW',
      reason: 'POLICY_ALLOW',
      policyId: 'disclosure-policy-a',
      policyVersion: '1.0.0',
    })
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'ALLOW',
        policyId: 'disclosure-policy-a',
        policyVersion: '1.0.0',
        actorId: 'user-a',
        identityBindingId: 'binding-a',
        membershipId: 'membership-a',
      }),
    )
  })

  it('withholds when no policy exists', async () => {
    const { evaluator } = authority()

    await expect(evaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'NO_GOVERNED_POLICY',
    })
  })

  it('returns DENY only for one matching, active explicit deny policy', async () => {
    const { evaluator } = authority([policy({ decision: 'DENY' })])

    await expect(evaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'POLICY_DENY',
    })
  })

  it.each([
    ['source', { provenance: { ...provenance, sourceSystem: 'other' } }],
    ['application', { recipient: { ...input.recipient, applicationId: 'other' } }],
    ['surface', { surface: 'other' }],
    ['action', { action: 'export' }],
    ['purpose', { purpose: 'other-purpose' }],
  ])('withholds for a wrong %s', async (_label, override) => {
    const { evaluator } = authority([policy()])
    const reason = _label === 'source' ? 'PROVENANCE_FACT_MISMATCH' : 'NO_GOVERNED_POLICY'

    await expect(evaluator.evaluate({ ...input, ...override })).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason,
    })
  })

  it('withholds when the source is outside the recipient organization', async () => {
    const { evaluator } = authority([policy()])
    const crossOrg = {
      ...input,
      fact: { ...input.fact, organizationId: 'org-b' },
      provenance: { ...provenance, sourceOrganizationId: 'org-b' },
    }

    await expect(evaluator.evaluate(crossOrg)).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'SOURCE_ORGANIZATION_MISMATCH',
    })
  })

  it('rejects fallback, unknown, and explicitly ineligible recipient roles', async () => {
    const { evaluator } = authority([policy()])
    const fallback = {
      ...input,
      recipient: {
        ...input.recipient,
        membershipRole: 'viewer',
        membershipRoleSource: 'fallback' as const,
      },
    }
    const unknown = {
      ...input,
      recipient: {
        ...input.recipient,
        membershipRole: 'viewer',
        membershipRoleSource: 'unknown' as const,
      },
    }
    const ineligible = {
      ...input,
      recipient: { ...input.recipient, membershipRole: 'admin' },
    }

    for (const candidate of [fallback, unknown, ineligible]) {
      await expect(evaluator.evaluate(candidate)).resolves.toMatchObject({
        decision: 'WITHHOLD',
        reason: 'RECIPIENT_NOT_EXPLICITLY_ELIGIBLE',
      })
    }
  })

  it('withholds when provenance is missing or does not describe the fact', async () => {
    const { evaluator } = authority([policy()])

    await expect(evaluator.evaluate({ ...input, provenance: undefined })).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'MISSING_OR_INVALID_PROVENANCE',
    })
    await expect(
      evaluator.evaluate({
        ...input,
        provenance: { ...provenance, sourceRecordId: 'another-producer' },
      }),
    ).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'PROVENANCE_FACT_MISMATCH',
    })
  })

  it.each([
    ['inactive', policy({ status: 'inactive' }), 'POLICY_INACTIVE'],
    [
      'not yet effective',
      policy({ effectiveFrom: '2026-11-01T00:00:00.000Z' }),
      'POLICY_NOT_YET_EFFECTIVE',
    ],
    [
      'expired',
      policy({
        effectiveTo: '2026-10-01T00:00:00.000Z',
        reviewBy: '2026-09-01T00:00:00.000Z',
      }),
      'POLICY_EXPIRED',
    ],
  ] as const)('withholds an %s policy', async (_label, rule, reason) => {
    const { evaluator } = authority([rule])

    await expect(evaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason,
    })
  })

  it('denies a matching policy when its required application grant is absent', async () => {
    const { evaluator } = authority([policy()])

    await expect(
      evaluator.evaluate({
        ...input,
        recipient: { ...input.recipient, permissions: [] },
      }),
    ).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'APPLICATION_PERMISSION_REQUIRED',
    })
  })

  it('withholds on conflicting rules and policy-version ambiguity', async () => {
    const { evaluator: conflictEvaluator } = authority([
      policy(),
      policy({ id: 'disclosure-policy-b', decision: 'DENY' }),
    ])
    const { evaluator: versionEvaluator } = authority([
      policy(),
      policy({ version: '2.0.0', decision: 'DENY' }),
    ])

    await expect(conflictEvaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'AMBIGUOUS_POLICY',
    })
    await expect(versionEvaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'POLICY_VERSION_MISMATCH',
    })
  })

  it('requires an exact, versioned status contract and allowlisted value', async () => {
    const noContract = authority([policy()], { contracts: [] })
    const versionMismatch = authority([policy()], {
      contracts: [{ ...factContract, version: '2.0.0' }],
    })
    const { evaluator } = authority([policy()])

    await expect(noContract.evaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'STATUS_CONTRACT_REQUIRED',
    })
    await expect(versionMismatch.evaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'FACT_CONTRACT_VERSION_MISMATCH',
    })
    await expect(
      evaluator.evaluate({ ...input, fact: { ...input.fact, value: 'future-status' } }),
    ).resolves.toMatchObject({ decision: 'WITHHOLD', reason: 'STATUS_NOT_ALLOWED' })
    await expect(evaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'ALLOW',
      reason: 'POLICY_ALLOW',
    })
  })

  it('enforces freshness boundaries and fails closed without a valid timestamp or policy', async () => {
    const { evaluator } = authority([policy()])
    const noPolicy = authority([policy()], { freshnessPolicies: [] })
    const maxAgeMs = freshnessPolicy.maxAgeMs
    const nowTime = now.getTime()

    await expect(
      evaluator.evaluate(inputObservedAt(new Date(nowTime - maxAgeMs + 1).toISOString())),
    ).resolves.toMatchObject({ decision: 'ALLOW', reason: 'POLICY_ALLOW' })
    await expect(
      evaluator.evaluate(inputObservedAt(new Date(nowTime - maxAgeMs).toISOString())),
    ).resolves.toMatchObject({ decision: 'ALLOW', reason: 'POLICY_ALLOW' })
    await expect(
      evaluator.evaluate(inputObservedAt(new Date(nowTime - maxAgeMs - 1).toISOString())),
    ).resolves.toMatchObject({ decision: 'WITHHOLD', reason: 'FACT_STALE' })
    await expect(evaluator.evaluate(inputObservedAt('invalid-timestamp'))).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'FACT_TIMESTAMP_INVALID',
    })
    await expect(
      evaluator.evaluate(inputObservedAt(new Date(nowTime + 1).toISOString())),
    ).resolves.toMatchObject({ decision: 'WITHHOLD', reason: 'FACT_TIMESTAMP_IN_FUTURE' })
    await expect(noPolicy.evaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'FRESHNESS_POLICY_REQUIRED',
    })
  })

  it('requires current approved evidence and never installs a preflighted policy', async () => {
    const noEvidence = authority([policy()], { evidence: [] })
    await expect(noEvidence.evaluator.evaluate(input)).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'ACTIVATION_EVIDENCE_INCOMPLETE',
    })

    const candidate = policy({ status: 'draft' })
    const packageInput = {
      policy: candidate,
      contracts: [factContract],
      freshnessPolicies: [freshnessPolicy],
      evidence: {
        sourceAuthority: approvedEvidence[0],
        privacyLegal: approvedEvidence[1],
        governanceApproval: approvedEvidence[2],
        cacheRetentionDisposition: approvedEvidence[3],
        auditDisposition: approvedEvidence[4],
        recipientEligibility: approvedEvidence[5],
        exportOnwardDisclosure: approvedEvidence[6],
        conditionAttestation: approvedEvidence[7],
        suspensionProcedure: approvedEvidence[8],
        revocationProcedure: approvedEvidence[9],
        revocationAuthority: approvedEvidence[10],
        factContract: approvedEvidence[11],
        freshnessPolicy: approvedEvidence[12],
      },
    }
    expect(preflightSourceDisclosureActivation(packageInput, now)).toEqual({
      decision: 'PREACTIVATION_VALIDATED',
      installsPolicy: false,
      issues: [],
    })

    expect(
      preflightSourceDisclosureActivation(
        {
          ...packageInput,
          evidence: { ...packageInput.evidence, sourceAuthority: undefined },
        },
        now,
      ),
    ).toMatchObject({ decision: 'ACTIVATION_REJECTED', installsPolicy: false })
    expect(
      preflightSourceDisclosureActivation(
        {
          ...packageInput,
          evidence: {
            ...packageInput.evidence,
            privacyLegal: { ...approvedEvidence[1], expiresAt: '2026-10-01T00:00:00.000Z' },
          },
        },
        now,
      ),
    ).toMatchObject({ decision: 'ACTIVATION_REJECTED', installsPolicy: false })
    expect(
      preflightSourceDisclosureActivation(
        {
          ...packageInput,
          evidence: { ...packageInput.evidence, recipientEligibility: undefined },
        },
        now,
      ),
    ).toMatchObject({ decision: 'ACTIVATION_REJECTED', installsPolicy: false })
    expect(
      preflightSourceDisclosureActivation(
        {
          ...packageInput,
          evidence: { ...packageInput.evidence, conditionAttestation: undefined },
        },
        now,
      ),
    ).toMatchObject({ decision: 'ACTIVATION_REJECTED', installsPolicy: false })
    expect(
      preflightSourceDisclosureActivation(
        { id: candidate.id, status: 'APPROVE_WITH_CONDITIONS' },
        now,
      ),
    ).toMatchObject({ decision: 'ACTIVATION_REJECTED', installsPolicy: false })
  })

  it('ignores client-supplied policy claims and audits without fact values or source record IDs', async () => {
    const { evaluator, recordAudit } = authority()
    const forgedInput = Object.assign({}, input, {
      policy: policy(),
      sourceAuthorityRef: 'client-asserted-authority',
    })

    const result = await evaluator.evaluate(forgedInput)
    const audit = recordAudit.mock.calls[0]?.[0]

    expect(result.decision).toBe('WITHHOLD')
    expect(recordAudit).toHaveBeenCalledOnce()
    expect(JSON.stringify(audit)).not.toContain('producer-1')
    expect(JSON.stringify(audit)).not.toContain('confidential-value')
    expect(audit).not.toHaveProperty('policy')
  })

  it('fails closed when the canonical recipient authority is inactive', async () => {
    const { evaluator } = authority([policy()])

    await expect(
      evaluator.evaluate({
        ...input,
        recipient: { ...input.recipient, membershipState: 'suspended' },
      }),
    ).resolves.toMatchObject({
      decision: 'WITHHOLD',
      reason: 'RECIPIENT_AUTHORITY_INVALID',
    })
  })
})

import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest'
import type { PolicyEvaluationOutput } from '@nzila/platform-policy-engine'
import {
  createSourceDisclosureAuthority,
  type SourceDisclosurePolicy,
} from '@nzila/platform-auth/source-disclosure'
import {
  CORA_ENTERPRISE_CONTEXT_WRITE_PERMISSION,
  CORA_FARMER360_READ_PERMISSION,
  CORA_FARMER_ASSERTION_WRITE_PERMISSION,
  createFarmer360Service,
  type Farmer360PersistencePort,
  type Farmer360RequestContext,
  type Farmer360ServicePorts,
  type Farmer360SourceSnapshot,
} from './service'
import {
  emptyFarmer360Sections,
  farmer360FactSchema,
  type CoraEnterpriseContextInput,
  type Farmer360Fact,
  type Farmer360Profile,
  type FarmerAssertionInput,
} from './contracts'

const orgId = '00000000-0000-0000-0000-000000000001'
const profileId = '00000000-0000-0000-0000-000000000002'
const digest = 'a'.repeat(64)
const subjectRef = { system: 'agrimo', recordId: 'producer-1' }
const baseContext: Farmer360RequestContext = {
  orgId,
  actorId: 'actor-1',
  role: 'analyst',
  permissions: [CORA_FARMER360_READ_PERMISSION],
  requestId: 'request-1',
  appId: 'cora',
  identityBindingId: 'identity-binding-1',
  identityBindingState: 'active',
  membershipId: 'membership-1',
  membershipState: 'active',
  membershipRoleSource: 'canonical',
  identityProvider: 'clerk',
}
const profile: Farmer360Profile = {
  id: profileId,
  orgId,
  subjectRef,
  context: null,
  contextEffectiveFrom: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

function fact(overrides: Partial<Farmer360Fact> = {}): Farmer360Fact {
  const source = overrides.source ?? { system: 'agrimo', recordId: 'harvest-1' }
  const key = overrides.key ?? 'crop-yield'
  const observedAt = overrides.observedAt ?? '2026-09-01T12:00:00.000Z'
  return {
    orgId,
    profileId,
    key,
    label: 'Crop yield',
    value: 1200,
    valueKind: 'observed',
    unit: 'kg',
    source,
    provenance: overrides.provenance ?? {
      sourceSystem: source.system,
      sourceDomain: 'agriculture',
      sourceEntity: 'test-record',
      sourceAuthorityRef: `${source.system}:test-approved-source`,
      sourceRecordId: source.recordId,
      sourceOrganizationId: orgId,
      factClass: key,
      observedAt,
      provenanceRef: `${source.system}:${source.recordId}:${observedAt}`,
    },
    contractVersion: '1.0.0',
    observedAt,
    freshness: 'current',
    confidence: { level: 'high', basis: 'Recorded harvest transaction' },
    quality: {
      completeness: 'complete',
      traceability: 'direct',
      limitations: [],
    },
    ...overrides,
  }
}

function testPolicy(system: string, factClass: string): SourceDisclosurePolicy {
  return {
    id: `test-only:${system}:${factClass}`,
    version: '1.0.0',
    status: 'active',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
    reviewBy: '2026-12-01T00:00:00.000Z',
    governingAuthorityRef: 'test-only:approved-authority',
    governanceEvidenceRef: 'test-only://source-disclosure/explicit-allow',
    rationale: 'An explicit test policy exercises the authorized disclosure path.',
    source: {
      system,
      domain: 'agriculture',
      entity: 'test-record',
      authorityRef: `${system}:test-approved-source`,
      factClass,
    },
    recipient: {
      applicationId: 'cora',
      surface: 'farmer360',
      action: 'read',
      purpose: 'farmer360.operational-read',
      organizationRelationship: 'same-organization',
      requiredPermission: CORA_FARMER360_READ_PERMISSION,
      requiredMembershipState: 'active',
      eligibilityPrimitive: 'canonical-membership-role',
      roles: ['analyst'],
    },
    factContract: { id: `test-fact:${system}:${factClass}`, version: '1.0.0' },
    freshnessPolicy: { id: `test-freshness:${system}:${factClass}`, version: '1.0.0' },
    activationEvidence: {
      sourceAuthority: 'test-evidence:source-authority',
      privacyLegal: 'test-evidence:privacy',
      governanceApproval: 'test-evidence:governance',
      cacheRetentionDisposition: 'test-evidence:cache',
      auditDisposition: 'test-evidence:audit',
      recipientEligibility: 'test-evidence:recipient-eligibility',
      exportOnwardDisclosure: 'test-evidence:export-onward-disclosure',
      conditionAttestation: 'test-evidence:condition-attestation',
      suspensionProcedure: 'test-evidence:suspension',
      revocationProcedure: 'test-evidence:revocation',
      revocationAuthority: 'test-evidence:revocation-authority',
    },
    decision: 'ALLOW',
  }
}

function snapshot(): Farmer360SourceSnapshot {
  return { sections: [] }
}

describe('Farmer 360 service boundary', () => {
  let persistence: Farmer360PersistencePort
  let getAuthorizedSources: MockedFunction<Farmer360ServicePorts['getAuthorizedSources']>
  let authorizeConsentUse: Farmer360ServicePorts['authorizeConsentUse']
  let evaluateAndAuditPolicy: Farmer360ServicePorts['evaluateAndAuditPolicy']
  let evaluateSourceDisclosure: Farmer360ServicePorts['evaluateSourceDisclosure']
  let service: ReturnType<typeof createFarmer360Service>

  beforeEach(() => {
    persistence = {
      getProfile: vi.fn(async () => profile),
      getProfileBySubject: vi.fn(async () => null),
      appendEnterpriseContextVersion: vi.fn(async () => profile),
      appendFarmerAssertion: vi.fn(async (_context, input) => ({
        id: 'assertion-1',
        orgId,
        profileId: input.profileId,
        subject: input.subject,
        statement: input.statement,
        evidence: {
          system: 'cora-evidence',
          recordId: 'assertion-evidence-1',
          evidenceId: '00000000-0000-0000-0000-000000000003',
          payloadSha256: digest,
        },
        verificationState: 'unverified' as const,
        assertedBy: 'actor-1',
        assertedAt: input.observedAt,
      })),
      listFarmerAssertions: vi.fn(async () => []),
    }
    getAuthorizedSources = vi.fn<Farmer360ServicePorts['getAuthorizedSources']>(async () =>
      snapshot(),
    )
    authorizeConsentUse = vi.fn(async (request) => ({
      status: 'granted' as const,
      consentRef: request.consentRef,
      evaluatedAt: '2026-09-01T12:00:00.000Z',
    }))
    evaluateAndAuditPolicy = vi.fn(async (input) => [
      {
        evaluationId: 'evaluation-1',
        policyId: input.policyId,
        input,
        decisions: [],
        overallResult: 'pass',
        evaluatedAt: '2026-09-01T12:00:00.000Z',
        durationMs: 1,
      } satisfies PolicyEvaluationOutput,
    ])
    const sourceDisclosureAuthority = createSourceDisclosureAuthority({
      loadPolicies: async () => {
        return [
          testPolicy('agrimo', 'crop-yield'),
          testPolicy('weighbridge', 'crop-yield'),
          testPolicy('agrimo', 'price'),
        ]
      },
      loadFactContracts: async () => [
        {
          id: 'test-fact:agrimo:crop-yield',
          version: '1.0.0',
          sourceSystem: 'agrimo',
          factClass: 'crop-yield',
          allowedValues: [1200, 980, 3.5],
          evidenceRef: 'test-evidence:fact:agrimo:crop-yield',
        },
        {
          id: 'test-fact:weighbridge:crop-yield',
          version: '1.0.0',
          sourceSystem: 'weighbridge',
          factClass: 'crop-yield',
          allowedValues: [1200, 980, 3.5],
          evidenceRef: 'test-evidence:fact:weighbridge:crop-yield',
        },
        {
          id: 'test-fact:agrimo:price',
          version: '1.0.0',
          sourceSystem: 'agrimo',
          factClass: 'price',
          allowedValues: [1200, 980, 3.5],
          evidenceRef: 'test-evidence:fact:agrimo:price',
        },
      ],
      loadFreshnessPolicies: async () => [
        ...['agrimo:crop-yield', 'weighbridge:crop-yield', 'agrimo:price'].map((key) => ({
          id: `test-freshness:${key.replace(':', ':')}`,
          version: '1.0.0',
          maxAgeMs: 365 * 24 * 60 * 60 * 1000,
          evidenceRef: `test-evidence:freshness:${key}`,
          staleBehavior: 'withhold' as const,
          invalidTimestampBehavior: 'withhold' as const,
          futureTimestampBehavior: 'withhold' as const,
        })),
      ],
      loadApprovedEvidence: async () => [
        ...[
          'test-evidence:source-authority',
          'test-evidence:privacy',
          'test-evidence:governance',
          'test-evidence:cache',
          'test-evidence:audit',
          'test-evidence:recipient-eligibility',
          'test-evidence:export-onward-disclosure',
          'test-evidence:condition-attestation',
          'test-evidence:suspension',
          'test-evidence:revocation',
          'test-evidence:revocation-authority',
          'test-evidence:fact:agrimo:crop-yield',
          'test-evidence:fact:weighbridge:crop-yield',
          'test-evidence:fact:agrimo:price',
          'test-evidence:freshness:agrimo:crop-yield',
          'test-evidence:freshness:weighbridge:crop-yield',
          'test-evidence:freshness:agrimo:price',
        ].map((reference) => ({
          reference,
          state: 'approved' as const,
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          expiresAt: '2027-01-01T00:00:00.000Z',
        })),
      ],
      recordAudit: vi.fn(async () => {}),
      now: () => new Date('2026-09-01T12:00:00.000Z'),
    })
    evaluateSourceDisclosure = sourceDisclosureAuthority.evaluate
    service = createFarmer360Service({
      persistence,
      getAuthorizedSources,
      authorizeConsentUse,
      evaluateAndAuditPolicy,
      evaluateSourceDisclosure,
      environment: 'test',
    })
  })

  it('returns an empty profile as unknown, never as zero or known', async () => {
    const result = await service.getFarmer360(baseContext, profileId)
    expect(result.sections.production).toEqual({
      name: 'production',
      status: 'UNKNOWN',
      facts: [],
      conflicts: [],
    })
    expect(result.gaps.some((gap) => gap.subject === 'economics')).toBe(true)
  })

  it('preserves observed lineage, conflict alternatives, and generated completeness gaps', async () => {
    const sections = emptyFarmer360Sections()
    sections.production = {
      name: 'production',
      status: 'PARTIAL',
      facts: [fact()],
      conflicts: [
        {
          key: 'crop-yield',
          description: 'Two source records disagree.',
          competingFacts: [
            fact({ value: 1200 }),
            fact({ value: 980, source: { system: 'weighbridge', recordId: 'ticket-9' } }),
          ],
        },
      ],
    }
    getAuthorizedSources.mockResolvedValue({ sections: [sections.production] })
    const result = await service.getFarmer360(baseContext, profileId)
    expect(result.sections.production.facts[0]).toMatchObject({
      source: { system: 'agrimo', recordId: 'harvest-1' },
      value: 1200,
    })
    expect(result.conflicts[0]?.competingFacts.map((item) => item.value)).toEqual([1200, 980])
    expect(result.gaps.some((gap) => gap.id === 'conflict-production-crop-yield')).toBe(true)
  })

  it('labels estimated economic values and requires their methodology and modeled price basis', async () => {
    const estimated = fact({
      key: 'price',
      label: 'Expected price',
      value: 3.5,
      valueKind: 'estimated',
      methodology: {
        authorityId: 'cora',
        methodologyId: 'farm-price-model',
        version: '1',
        definitionSha256: digest,
      },
      economic: { kind: 'estimated-price', priceBasis: 'modeled' },
    })
    const invalid = { ...estimated, economic: { kind: 'estimated-price', priceBasis: 'realized' } }
    const sections = emptyFarmer360Sections()
    sections.economics = {
      name: 'economics',
      status: 'PARTIAL',
      facts: [estimated],
      conflicts: [],
    }
    getAuthorizedSources.mockResolvedValue({ sections: [sections.economics] })
    await expect(service.getFarmer360(baseContext, profileId)).resolves.toMatchObject({
      sections: { economics: { status: 'ESTIMATED' } },
    })
    expect(farmer360FactSchema.safeParse(invalid).success).toBe(false)
  })

  it('withholds source facts when no matching governed policy exists', async () => {
    const noPolicyAuthority = createSourceDisclosureAuthority({
      loadPolicies: async () => [],
      recordAudit: vi.fn(async () => {}),
      now: () => new Date('2026-09-01T12:00:00.000Z'),
    })
    evaluateSourceDisclosure = noPolicyAuthority.evaluate
    service = createFarmer360Service({
      persistence,
      getAuthorizedSources,
      authorizeConsentUse,
      evaluateAndAuditPolicy,
      evaluateSourceDisclosure,
      environment: 'test',
    })
    const sections = emptyFarmer360Sections()
    sections.production = {
      name: 'production',
      status: 'PARTIAL',
      facts: [fact()],
      conflicts: [],
    }
    getAuthorizedSources.mockResolvedValue({ sections: [sections.production] })

    await expect(service.getFarmer360(baseContext, profileId)).resolves.toMatchObject({
      sections: { production: { status: 'UNKNOWN', facts: [] } },
      gaps: expect.arrayContaining([expect.objectContaining({ subject: 'production' })]),
    })
  })

  it('rejects cross-org or cross-profile source facts before returning a read model', async () => {
    const sections = emptyFarmer360Sections()
    sections.production = {
      name: 'production',
      status: 'PARTIAL',
      facts: [fact({ orgId: '00000000-0000-0000-0000-000000000099' })],
      conflicts: [],
    }
    getAuthorizedSources.mockResolvedValue({ sections: [sections.production] })
    await expect(service.getFarmer360(baseContext, profileId)).rejects.toThrow()

    sections.production.facts = [fact({ profileId: '00000000-0000-0000-0000-000000000099' })]
    getAuthorizedSources.mockResolvedValue({ sections: [sections.production] })
    await expect(service.getFarmer360(baseContext, profileId)).rejects.toThrow('different profile')
  })

  it('checks profile organization and read permission before consulting sources', async () => {
    vi.mocked(persistence.getProfile).mockResolvedValue({ ...profile, orgId: 'other-org' })
    await expect(service.getFarmer360(baseContext, profileId)).rejects.toThrow()
    expect(getAuthorizedSources).not.toHaveBeenCalled()

    await expect(
      service.getFarmer360({ ...baseContext, permissions: [] }, profileId),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' })
    expect(getAuthorizedSources).not.toHaveBeenCalled()
  })

  it('prevalidates the existing enterprise profile and records versioned context with audit intent', async () => {
    const contextInput: CoraEnterpriseContextInput = {
      profileId,
      subjectRef,
      context: {
        enterpriseName: 'Green Valley',
        operatingModel: 'independent',
        geography: { countryCode: 'KE' },
        farmReferences: [{ system: 'agrimo', recordId: 'farm-1', kind: 'farm' }],
      },
      effectiveFrom: '2026-09-01T00:00:00.000Z',
    }
    vi.mocked(persistence.getProfile).mockResolvedValue(profile)
    await service.upsertCoraEnterpriseContext(
      {
        ...baseContext,
        permissions: [...baseContext.permissions, CORA_ENTERPRISE_CONTEXT_WRITE_PERMISSION],
      },
      contextInput,
    )
    expect(persistence.appendEnterpriseContextVersion).toHaveBeenCalledWith(
      expect.objectContaining({ orgId }),
      expect.anything(),
      expect.objectContaining({
        action: 'enterprise-context.write',
        orgId,
        actorId: baseContext.actorId,
        requestId: baseContext.requestId,
        authorization: { policyEvaluationIds: ['evaluation-1'] },
      }),
    )

    vi.mocked(persistence.appendEnterpriseContextVersion).mockClear()
    vi.mocked(persistence.getProfile).mockResolvedValue(null)
    await expect(
      service.upsertCoraEnterpriseContext(
        {
          ...baseContext,
          permissions: [...baseContext.permissions, CORA_ENTERPRISE_CONTEXT_WRITE_PERMISSION],
        },
        contextInput,
      ),
    ).rejects.toThrow('profile not found')

    vi.mocked(persistence.getProfile).mockResolvedValue({ ...profile, orgId: 'other-org' })
    await expect(
      service.upsertCoraEnterpriseContext(
        {
          ...baseContext,
          permissions: [...baseContext.permissions, CORA_ENTERPRISE_CONTEXT_WRITE_PERMISSION],
        },
        contextInput,
      ),
    ).rejects.toThrow()
    expect(persistence.appendEnterpriseContextVersion).not.toHaveBeenCalled()
  })

  it('records assertions only after consent and policy, retaining source facts and exact evidence lineage', async () => {
    const input: FarmerAssertionInput = {
      profileId,
      subject: 'Harvest quantity',
      statement: 'The recorded quantity should be 1,250 kg.',
      purpose: 'farmer-profile-correction',
      consentRef: 'consent-1',
      source: { system: 'farmer', recordId: 'submission-1' },
      observedAt: '2026-09-01T12:00:00.000Z',
    }
    const assertion = await service.recordFarmerAssertion(
      {
        ...baseContext,
        permissions: [...baseContext.permissions, CORA_FARMER_ASSERTION_WRITE_PERMISSION],
      },
      input,
    )
    expect(assertion.verificationState).toBe('unverified')
    expect(assertion.evidence).toMatchObject({
      system: 'cora-evidence',
      evidenceId: expect.any(String),
      payloadSha256: digest,
    })
    expect(authorizeConsentUse).toHaveBeenCalledWith(
      expect.objectContaining({
        consentRef: input.consentRef,
        purpose: input.purpose,
        recipient: 'cora',
      }),
    )
    expect(persistence.appendFarmerAssertion).toHaveBeenCalledWith(
      expect.objectContaining({ orgId }),
      expect.objectContaining({ source: input.source, statement: input.statement }),
      expect.objectContaining({
        action: 'farmer-assertion.record',
        authorization: expect.objectContaining({
          consentRef: input.consentRef,
          consentEvaluatedAt: expect.any(String),
          policyEvaluationIds: ['evaluation-1'],
        }),
      }),
    )
  })

  it('fails closed on denied consent and propagates persistence errors', async () => {
    const input: FarmerAssertionInput = {
      profileId,
      subject: 'Farm name',
      statement: 'Please use the corrected farm name.',
      purpose: 'farmer-profile-correction',
      consentRef: 'consent-1',
      source: subjectRef,
      observedAt: '2026-09-01T12:00:00.000Z',
    }
    vi.mocked(authorizeConsentUse).mockResolvedValue({
      status: 'unknown',
      consentRef: input.consentRef,
      evaluatedAt: '2026-09-01T12:00:00.000Z',
    })
    const permittedContext = {
      ...baseContext,
      permissions: [...baseContext.permissions, CORA_FARMER_ASSERTION_WRITE_PERMISSION],
    }
    await expect(service.recordFarmerAssertion(permittedContext, input)).rejects.toThrow(
      'Canonical consent',
    )
    expect(persistence.appendFarmerAssertion).not.toHaveBeenCalled()

    vi.mocked(authorizeConsentUse).mockResolvedValue({
      status: 'granted',
      consentRef: input.consentRef,
      evaluatedAt: '2026-09-01T12:00:00.000Z',
    })
    vi.mocked(persistence.appendFarmerAssertion).mockRejectedValue(new Error('store unavailable'))
    await expect(service.recordFarmerAssertion(permittedContext, input)).rejects.toThrow(
      'store unavailable',
    )
  })

  it('fails closed when audited policy authorization is empty or mismatched', async () => {
    const input: FarmerAssertionInput = {
      profileId,
      subject: 'Farm name',
      statement: 'Please use the corrected farm name.',
      purpose: 'farmer-profile-correction',
      consentRef: 'consent-1',
      source: subjectRef,
      observedAt: '2026-09-01T12:00:00.000Z',
    }
    const permittedContext = {
      ...baseContext,
      permissions: [...baseContext.permissions, CORA_FARMER_ASSERTION_WRITE_PERMISSION],
    }

    vi.mocked(evaluateAndAuditPolicy).mockResolvedValue([])
    await expect(service.recordFarmerAssertion(permittedContext, input)).rejects.toThrow(
      'No canonical policy',
    )
    expect(persistence.appendFarmerAssertion).not.toHaveBeenCalled()
  })
})

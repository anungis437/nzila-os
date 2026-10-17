import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSourceDisclosureAuthority,
  type SourceDisclosurePolicy,
} from '@nzila/platform-auth/source-disclosure'

const { getProducerById } = vi.hoisted(() => ({ getProducerById: vi.fn() }))
vi.mock('@nzila/agri-db/readonly', () => ({ getProducerById }))
vi.mock('@nzila/db/authorization-audit', () => ({
  writeSourceDisclosureDecisionAudit: vi.fn(async () => undefined),
}))

import { createFarmer360RuntimePorts, getProducerFarmer360Snapshot } from './adapters'
import type { Farmer360Profile } from './contracts'
import { farmer360FactSchema } from './contracts'
import {
  createFarmer360Service,
  type Farmer360RequestContext,
  type Farmer360PersistencePort,
} from './service'

const orgId = '00000000-0000-0000-0000-000000000001'
const producerId = '00000000-0000-4000-8000-000000000004'
const profile: Farmer360Profile = {
  id: '00000000-0000-0000-0000-000000000002',
  orgId,
  subjectRef: { system: 'agrimo', recordId: producerId },
  context: null,
  contextEffectiveFrom: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

const now = new Date('2026-10-07T16:00:00.000Z')
const createdAt = '2026-10-07T15:59:00.000Z'
const maxAgeMs = 60_000

function syntheticAuthority() {
  const activationEvidence = {
    sourceAuthority: 'test-only:source',
    privacyLegal: 'test-only:privacy',
    governanceApproval: 'test-only:governance',
    cacheRetentionDisposition: 'test-only:cache',
    auditDisposition: 'test-only:audit',
    recipientEligibility: 'test-only:recipient',
    exportOnwardDisclosure: 'test-only:onward',
    conditionAttestation: 'test-only:conditions',
    suspensionProcedure: 'test-only:suspension',
    revocationProcedure: 'test-only:revocation',
    revocationAuthority: 'test-only:revoker',
  }
  const policy: SourceDisclosurePolicy = {
    id: 'test-only:producer-status',
    version: '1.0.0',
    status: 'active',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
    reviewBy: '2026-12-01T00:00:00.000Z',
    governingAuthorityRef: 'test-only:authority',
    governanceEvidenceRef: 'test-only:approval',
    rationale: 'Synthetic timestamp regression policy, never installed in runtime',
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
    factContract: { id: 'test-only:contract', version: '1.0.0' },
    freshnessPolicy: { id: 'test-only:freshness', version: '1.0.0' },
    activationEvidence,
    decision: 'ALLOW',
  }
  return createSourceDisclosureAuthority({
    loadPolicies: async () => [policy],
    loadFactContracts: async () => [
      {
        ...policy.factContract,
        sourceSystem: 'agrimo',
        factClass: 'producer.status',
        allowedValues: ['active'],
        evidenceRef: 'test-only:contract-evidence',
      },
    ],
    loadFreshnessPolicies: async () => [
      {
        ...policy.freshnessPolicy,
        maxAgeMs,
        evidenceRef: 'test-only:freshness-evidence',
        staleBehavior: 'withhold',
        invalidTimestampBehavior: 'withhold',
        futureTimestampBehavior: 'withhold',
      },
    ],
    loadApprovedEvidence: async () =>
      [
        ...Object.values(activationEvidence),
        'test-only:contract-evidence',
        'test-only:freshness-evidence',
      ].map((reference) => ({
        reference,
        state: 'approved',
        effectiveFrom: policy.effectiveFrom,
        expiresAt: policy.effectiveTo,
      })),
    recordAudit: async () => undefined,
    now: () => now,
  })
}

const readContext: Farmer360RequestContext = {
  orgId,
  actorId: 'actor-1',
  role: 'viewer',
  permissions: ['cora:farmer360:read'],
  requestId: 'test-only:timestamp',
  appId: 'cora',
  identityBindingId: 'test-only:binding',
  identityBindingState: 'active',
  membershipId: 'test-only:membership',
  membershipState: 'active',
  membershipRoleSource: 'canonical',
  identityProvider: 'clerk',
}

describe('Farmer 360 canonical producer adapter', () => {
  beforeEach(() => {
    getProducerById.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => vi.useRealTimers())

  it.each([
    ['missing', undefined, undefined, 'FACT_TIMESTAMP_INVALID'],
    ['null', null, undefined, 'FACT_TIMESTAMP_INVALID'],
    ['invalid', 'not-a-timestamp', undefined, 'FACT_TIMESTAMP_INVALID'],
    ['future', '2026-10-07T16:00:01.000Z', '2026-10-07T16:00:01.000Z', 'FACT_TIMESTAMP_IN_FUTURE'],
    ['stale', '2026-10-07T15:58:59.999Z', '2026-10-07T15:58:59.999Z', 'FACT_STALE'],
    ['exact boundary', createdAt, createdAt, 'POLICY_ALLOW'],
    ['current', now.toISOString(), now.toISOString(), 'POLICY_ALLOW'],
  ])(
    'preserves %s update-time authority through service filtering',
    async (_label, updatedAt, observedAt, reason) => {
      getProducerById.mockResolvedValue({
        id: producerId,
        orgId,
        status: 'active',
        createdAt,
        updatedAt,
      })
      const snapshot = await getProducerFarmer360Snapshot(readContext, profile)
      const fact = snapshot.sections[0].facts[0]
      expect(farmer360FactSchema.safeParse(fact).success).toBe(true)
      expect(fact.observedAt).toBe(observedAt)
      expect(fact.provenance?.observedAt).toBe(observedAt)
      if (!observedAt) {
        expect(fact.freshness).toBe('unknown')
        expect(fact.provenance?.provenanceRef).not.toContain(createdAt)
      }
      const authority = syntheticAuthority()
      const evaluate = vi.fn(authority.evaluate)
      const persistence: Farmer360PersistencePort = {
        getProfile: vi.fn(async () => profile),
        getProfileBySubject: vi.fn(),
        appendEnterpriseContextVersion: vi.fn(),
        appendFarmerAssertion: vi.fn(),
        listFarmerAssertions: vi.fn(async () => []),
      }
      const service = createFarmer360Service({
        persistence,
        getAuthorizedSources: async () => ({
          sections: snapshot.sections.map((section) => ({
            ...section,
            facts: section.facts.map((entry) => ({ ...entry, contractVersion: '1.0.0' })),
          })),
        }),
        authorizeConsentUse: vi.fn(),
        evaluateAndAuditPolicy: vi.fn(),
        evaluateSourceDisclosure: evaluate,
        environment: 'test',
      })
      const response = await service.getFarmer360(readContext, profile.id)
      expect(evaluate).toHaveBeenCalledOnce()
      expect(await evaluate.mock.results[0].value).toMatchObject({
        decision: reason === 'POLICY_ALLOW' ? 'ALLOW' : 'WITHHOLD',
        reason,
      })
      const section = response.sections['evidence-confidence']
      if (reason === 'POLICY_ALLOW') {
        expect(section.facts).toMatchObject([
          { key: 'producer.status', value: 'active', observedAt },
        ])
      } else {
        expect(section).toMatchObject({ status: 'UNKNOWN', facts: [], conflicts: [] })
        expect(JSON.stringify(response)).not.toContain('producer.status')
        expect(JSON.stringify(response)).not.toContain('"active"')
      }
      const runtimePorts = createFarmer360RuntimePorts(persistence)
      const runtimeEvaluate = vi.fn(runtimePorts.evaluateSourceDisclosure)
      const runtimeService = createFarmer360Service({
        ...runtimePorts,
        evaluateSourceDisclosure: runtimeEvaluate,
      })
      const withheldResponse = await runtimeService.getFarmer360(readContext, profile.id)
      expect(await runtimeEvaluate.mock.results[0].value).toMatchObject({
        decision: 'WITHHOLD',
        reason: observedAt ? 'NO_GOVERNED_POLICY' : 'FACT_TIMESTAMP_INVALID',
      })
      expect(withheldResponse.sections['evidence-confidence']).toMatchObject({
        status: 'UNKNOWN',
        facts: [],
        conflicts: [],
      })
    },
  )

  it('uses an org-scoped read and preserves source lineage without inventing facts', async () => {
    getProducerById.mockResolvedValue({
      id: producerId,
      orgId,
      name: 'Local test producer',
      contactPhone: null,
      contactEmail: null,
      location: null,
      cooperativeId: null,
      status: 'active',
      metadata: {},
      createdAt: '2026-08-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
    })

    const result = await getProducerFarmer360Snapshot({ orgId, actorId: 'actor-1' }, profile)

    expect(getProducerById).toHaveBeenCalledWith({ orgId }, producerId)
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0]).toMatchObject({
      name: 'evidence-confidence',
      status: 'PARTIAL',
      facts: [
        {
          orgId,
          profileId: profile.id,
          key: 'producer.status',
          value: 'active',
          valueKind: 'observed',
          source: { system: 'agrimo', recordId: producerId },
          provenance: {
            sourceSystem: 'agrimo',
            sourceDomain: 'agriculture',
            sourceEntity: 'producer',
            sourceAuthorityRef: 'agrimo:operational-producer-record',
            sourceRecordId: producerId,
            sourceOrganizationId: orgId,
            factClass: 'producer.status',
            observedAt: '2026-09-01T12:00:00.000Z',
            provenanceRef: `agrimo:producer:${producerId}:2026-09-01T12:00:00.000Z`,
          },
          freshness: 'current',
          quality: {
            completeness: 'partial',
            limitations: [
              'Producer status does not establish production, economic, or capacity facts',
            ],
          },
        },
      ],
    })
  })

  it('returns no facts when the canonical producer is missing', async () => {
    getProducerById.mockResolvedValue(null)

    await expect(
      getProducerFarmer360Snapshot({ orgId, actorId: 'actor-1' }, profile),
    ).resolves.toEqual({ sections: [] })
  })

  it('does not resolve records from an unrecognized source system', async () => {
    await expect(
      getProducerFarmer360Snapshot(
        { orgId, actorId: 'actor-1' },
        { ...profile, subjectRef: { system: 'unknown-source', recordId: producerId } },
      ),
    ).resolves.toEqual({ sections: [] })
    expect(getProducerById).not.toHaveBeenCalled()
  })

  it('does not query the UUID-only source with a malformed record ID', async () => {
    await expect(
      getProducerFarmer360Snapshot(
        { orgId, actorId: 'actor-1' },
        { ...profile, subjectRef: { system: 'agrimo', recordId: 'not-a-uuid' } },
      ),
    ).resolves.toEqual({ sections: [] })
    expect(getProducerById).not.toHaveBeenCalled()
  })

  it('rejects a profile from another organization before source access', async () => {
    await expect(
      getProducerFarmer360Snapshot(
        { orgId: '00000000-0000-0000-0000-000000000003', actorId: 'actor-1' },
        profile,
      ),
    ).rejects.toThrow('outside the authorized org')
    expect(getProducerById).not.toHaveBeenCalled()
  })
})

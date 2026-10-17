import { describe, expect, it } from 'vitest'
import {
  certificationStatusChangedEventSchema,
  classifyOrganicEvidenceConflict,
  evaluateOrganicFreshness,
  normalizeOrganicStatus,
  organicCertificationObservationSchema,
  organicEvidencePassportSchema,
  organicSectorMembershipEvidenceSchema,
  organicSourceRegistryEntrySchema,
  organicSourceRightsSchema,
  organicStandardInterpretationSchema,
  organicStatusNormalizationMappingSchema,
  type OrganicCertificationObservation,
} from './contracts'
import { adaptProCertDirectoryRecord } from './pro-cert-directory'
import { syntheticProCertDirectoryRecord } from './pro-cert-directory.fixture'
import {
  createCoraEvidenceService,
  type CoraEvidencePersistencePort,
  type CoraEvidenceServicePorts,
} from '../evidence-foundation/service'
import type { OrgContext } from '@nzila/org/context'
import type { PolicyEvaluationOutput } from '@nzila/platform-policy-engine'
import { vi } from 'vitest'

const hash = 'a'.repeat(64)
const sourceRights = {
  publicationAuthority: {
    state: 'ESTABLISHED' as const,
    basis: 'REGULATORY_PUBLICATION_MANDATE' as const,
    evidenceRef: 'cfia-cor-publication-policy',
  },
  sourceAccessMethod: 'PUBLIC_WEB' as const,
  automatedAccess: 'UNKNOWN' as const,
  reuseRights: 'UNKNOWN' as const,
  republicationRights: 'UNKNOWN' as const,
}

function observation(
  overrides: Partial<OrganicCertificationObservation> = {},
): OrganicCertificationObservation {
  return organicCertificationObservationSchema.parse({
    evidenceId: 'evidence-1',
    factClass: 'organic.certification.status',
    subject: { operatorRef: 'operator-test-1' },
    source: {
      institutionId: 'certifier-1',
      role: 'CERTIFICATION_BODY',
      system: 'synthetic-directory',
      reference: 'record-1',
    },
    rawStatus: 'Certified',
    normalizedStatus: {
      status: 'CERTIFIED',
      authorityId: 'test-normalization-authority',
      mappingId: 'synthetic-cor-status',
      version: 'test-1',
    },
    observationTime: { state: 'KNOWN', observedAt: '2026-01-01T00:00:00.000Z' },
    sourceAvailability: 'AVAILABLE',
    freshness: 'CURRENT',
    provenance: [],
    rights: sourceRights,
    ...overrides,
  })
}

describe('organic public evidence contracts', () => {
  it('adapts the synthetic Pro-Cert directory shape without retaining extra personal fields', () => {
    const record = adaptProCertDirectoryRecord(syntheticProCertDirectoryRecord, {
      evidenceId: 'synthetic-pro-cert-1',
    })

    expect(record).toMatchObject({
      subject: { operatorRef: 'synthetic-operator-001' },
      source: {
        institutionId: 'pro-cert',
        role: 'CERTIFICATION_BODY',
        system: 'pro-cert-client-directory',
        reference: 'synthetic://pro-cert/client-directory/operators/001',
      },
      rawStatus: 'Certified',
      evidenceLevel: 'DIRECTORY_STATUS',
      certificationContext: {
        program: 'COR',
        scope: ['crop production'],
        products: ['synthetic oats'],
      },
      observationTime: { state: 'KNOWN', observedAt: '2026-01-02T00:00:00.000Z' },
      sourceRecordMetadata: {
        registryRef: 'synthetic-operator-001',
        sourceCreatedAt: '2025-10-01T00:00:00.000Z',
        sourceUpdatedAt: '2026-01-02T00:00:00.000Z',
      },
    })
    expect(record.normalizedStatus).toBeUndefined()
    expect(record.evidenceLevel).not.toBe('CERTIFICATE')
    expect(
      organicCertificationObservationSchema.safeParse({
        ...record,
        evidenceLevel: 'CERTIFICATE',
      }).success,
    ).toBe(false)
    expect(record).not.toHaveProperty('operatorName')
    expect(record).not.toHaveProperty('contactName')
    expect(record).not.toHaveProperty('contactEmail')
    expect(record).not.toHaveProperty('phone')
    expect(record).not.toHaveProperty('address')
  })

  it('does not substitute record creation or update time for a status observation time', () => {
    const record = adaptProCertDirectoryRecord(
      { ...syntheticProCertDirectoryRecord, statusObservedAt: undefined },
      { evidenceId: 'synthetic-pro-cert-missing-status-time' },
    )

    expect(record.sourceRecordMetadata).toMatchObject({
      sourceCreatedAt: '2025-10-01T00:00:00.000Z',
      sourceUpdatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(record.observationTime).toEqual({ state: 'UNKNOWN' })
    expect(record.freshness).toBe('OBSERVATION_TIME_UNKNOWN')
  })

  it('keeps a null status observation unresolved even when record timestamps exist', () => {
    const record = adaptProCertDirectoryRecord(
      { ...syntheticProCertDirectoryRecord, statusObservedAt: null },
      { evidenceId: 'synthetic-pro-cert-null-status-time' },
    )

    expect(record.observationTime).toEqual({ state: 'UNKNOWN' })
    expect(record.freshness).toBe('OBSERVATION_TIME_UNKNOWN')
  })

  it('preserves an invalid status observation time rather than falling back to record metadata', () => {
    const record = adaptProCertDirectoryRecord(
      { ...syntheticProCertDirectoryRecord, statusObservedAt: 'not-a-timestamp' },
      { evidenceId: 'synthetic-pro-cert-invalid-status-time' },
    )

    expect(record.observationTime).toEqual({
      state: 'INVALID',
      rawTimestamp: 'not-a-timestamp',
    })
    expect(record.freshness).toBe('INVALID_OBSERVATION_TIME')
    expect(record.sourceRecordMetadata?.sourceCreatedAt).toBe('2025-10-01T00:00:00.000Z')
    expect(record.rawStatus).toBe('Certified')
  })

  it('does not use an invalid source update time as the status observation time', () => {
    const record = adaptProCertDirectoryRecord(
      {
        ...syntheticProCertDirectoryRecord,
        statusObservedAt: undefined,
        sourceUpdatedAt: 'not-a-timestamp',
      },
      { evidenceId: 'synthetic-pro-cert-invalid-record-update' },
    )

    expect(record.sourceRecordMetadata?.sourceUpdatedAt).toBe('not-a-timestamp')
    expect(record.observationTime).toEqual({ state: 'UNKNOWN' })
    expect(record.freshness).toBe('OBSERVATION_TIME_UNKNOWN')
  })

  it('keeps future source status time unchanged for the existing future-time control', () => {
    const record = adaptProCertDirectoryRecord(
      { ...syntheticProCertDirectoryRecord, statusObservedAt: '2026-01-03T00:00:00.000Z' },
      {
        evidenceId: 'synthetic-pro-cert-future-status-time',
        freshnessEvaluation: {
          now: '2026-01-02T00:00:00.000Z',
          maxAgeMs: 24 * 60 * 60 * 1000,
        },
      },
    )

    expect(record.observationTime).toEqual({
      state: 'KNOWN',
      observedAt: '2026-01-03T00:00:00.000Z',
    })
    expect(record.freshness).toBe('FUTURE_OBSERVATION_TIME')
  })

  it('requires an isolated, complete synthetic mapping and policy to classify a record current', () => {
    const record = adaptProCertDirectoryRecord(syntheticProCertDirectoryRecord, {
      evidenceId: 'synthetic-pro-cert-policy-test',
      statusMappings: [
        {
          rawStatus: 'Certified',
          normalizedStatus: 'CERTIFIED',
          authorityId: 'synthetic-test-authority',
          mappingId: 'synthetic-pro-cert-map',
          version: 'test-1',
        },
      ],
      freshnessEvaluation: {
        now: '2026-01-02T01:00:00.000Z',
        maxAgeMs: 60 * 60 * 1000,
      },
    })

    expect(record.normalizedStatus).toMatchObject({
      status: 'CERTIFIED',
      authorityId: 'synthetic-test-authority',
      mappingId: 'synthetic-pro-cert-map',
      version: 'test-1',
    })
    expect(record.freshness).toBe('CURRENT')
  })

  it('does not let directory daily-refresh metadata become a freshness threshold', () => {
    const directory = organicSourceRegistryEntrySchema.parse({
      institutionId: 'pro-cert',
      institutionName: 'Pro-Cert Organic Systems Ltd.',
      roles: ['CERTIFICATION_BODY'],
      sourceClass: 'Public client directory',
      sourceUrl: 'https://www.pro-cert.org/client-directory/',
      rights: {
        publicationAuthority: {
          state: 'ESTABLISHED',
          basis: 'REGULATORY_PUBLICATION_MANDATE',
          evidenceRef: 'cfia-cor-publication-policy',
        },
        sourceAccessMethod: 'PUBLIC_WEB',
        automatedAccess: 'REQUIRES_CONFIRMATION',
        reuseRights: 'REQUIRES_CONFIRMATION',
        republicationRights: 'REQUIRES_CONFIRMATION',
      },
      exposedDataClasses: ['program', 'scope', 'products', 'certification status'],
      expectedRefreshMetadata: { sourceClaim: 'Updated daily per directory page' },
    })

    expect(directory.expectedRefreshMetadata.sourceClaim).toContain('daily')
    expect(
      organicSourceRegistryEntrySchema.safeParse({
        ...directory,
        expectedRefreshMetadata: {
          ...directory.expectedRefreshMetadata,
          maxAgeMs: 24 * 60 * 60 * 1000,
        },
      }).success,
    ).toBe(false)
  })

  it('supports explicit rights states without inferring them from publication authority', () => {
    const rights = organicSourceRightsSchema.parse({
      publicationAuthority: {
        state: 'ESTABLISHED',
        basis: 'REGULATORY_PUBLICATION_MANDATE',
        evidenceRef: 'cfia-cor-publication-policy',
      },
      sourceAccessMethod: 'PUBLIC_WEB',
      automatedAccess: 'REQUIRES_CONFIRMATION',
      reuseRights: 'REQUIRES_CONFIRMATION',
      republicationRights: 'REQUIRES_CONFIRMATION',
    })

    expect(rights.publicationAuthority.state).toBe('ESTABLISHED')
    expect(rights.automatedAccess).toBe('REQUIRES_CONFIRMATION')
    expect(rights.reuseRights).toBe('REQUIRES_CONFIRMATION')
    expect(rights.republicationRights).toBe('REQUIRES_CONFIRMATION')
  })

  it('does not extend COR publication authority to other directory programs', () => {
    const record = adaptProCertDirectoryRecord(
      { ...syntheticProCertDirectoryRecord, program: 'NOP' },
      { evidenceId: 'synthetic-pro-cert-nop' },
    )

    expect(record.rights.publicationAuthority).toEqual({
      state: 'UNKNOWN',
      basis: 'UNKNOWN',
    })
    expect(record.rights.automatedAccess).toBe('REQUIRES_CONFIRMATION')
  })

  it.each([
    'ESTABLISHED_ALLOWED',
    'ESTABLISHED_PROHIBITED',
    'NOT_ESTABLISHED',
    'REQUIRES_CONFIRMATION',
    'NOT_APPLICABLE',
  ] as const)('accepts explicit source-rights state %s', (state) => {
    expect(
      organicSourceRightsSchema.parse({
        publicationAuthority: { state: 'UNKNOWN', basis: 'UNKNOWN' },
        sourceAccessMethod: 'UNKNOWN',
        automatedAccess: state,
        reuseRights: state,
        republicationRights: state,
      }).automatedAccess,
    ).toBe(state)
  })

  it('composes a directory-only Passport without declaring certification', () => {
    const passport = organicEvidencePassportSchema.parse({
      operatorRef: 'synthetic-operator-001',
      observations: [
        adaptProCertDirectoryRecord(
          { ...syntheticProCertDirectoryRecord, statusObservedAt: undefined },
          { evidenceId: 'synthetic-pro-cert-passport' },
        ),
      ],
      conflictState: 'UNRESOLVED_FRESHNESS',
      disclaimer: 'Cora presents source evidence. Cora is not the certification body.',
    })

    expect(passport.observations[0]?.evidenceLevel).toBe('DIRECTORY_STATUS')
    expect(passport.observations[0]?.rawStatus).toBe('Certified')
    expect(passport.observations[0]?.freshness).toBe('OBSERVATION_TIME_UNKNOWN')
    expect(passport).not.toHaveProperty('isCertified')
  })

  it('cannot identify Cora as the certifying source', () => {
    const candidate = {
      ...observation(),
      source: { ...observation().source, role: 'CORA_CERTIFICATION_AUTHORITY' },
    }
    expect(organicCertificationObservationSchema.safeParse(candidate).success).toBe(false)
  })

  it('requires a source institution for a certification observation', () => {
    const candidate = observation()
    expect(
      organicCertificationObservationSchema.safeParse({
        ...candidate,
        source: { ...candidate.source, institutionId: '' },
      }).success,
    ).toBe(false)
  })

  it('retains raw source status separately from any normalized concept', () => {
    const record = observation({ rawStatus: 'Certified - scope restricted' })
    expect(record.rawStatus).toBe('Certified - scope restricted')
    expect(record.normalizedStatus?.status).toBe('CERTIFIED')
  })

  it('leaves unknown source vocabulary unknown', () => {
    const mapping = organicStatusNormalizationMappingSchema.parse({
      rawStatus: 'In good standing',
      normalizedStatus: 'CERTIFIED',
      authorityId: 'synthetic-test-authority',
      mappingId: 'synthetic-map',
      version: 'test-1',
    })
    expect(normalizeOrganicStatus('Current', [mapping])).toEqual({
      state: 'UNKNOWN',
      rawStatus: 'Current',
    })
  })

  it('requires explicit authority and version for synthetic normalization', () => {
    const mapping = organicStatusNormalizationMappingSchema.parse({
      rawStatus: 'Certified',
      normalizedStatus: 'CERTIFIED',
      authorityId: 'synthetic-test-authority',
      mappingId: 'synthetic-map',
      version: 'test-1',
    })
    expect(normalizeOrganicStatus('Certified', [mapping])).toMatchObject({
      state: 'MAPPED',
      rawStatus: 'Certified',
      status: 'CERTIFIED',
      authorityId: 'synthetic-test-authority',
      version: 'test-1',
    })
  })

  it('does not let an aggregator replace certification-body provenance', () => {
    const candidate = {
      ...observation(),
      source: {
        ...observation().source,
        institutionId: 'aggregator-1',
        role: 'EVIDENCE_AGGREGATOR',
      },
      provenance: [
        {
          fromInstitutionId: 'other-source',
          fromRole: 'SCHEME_AUTHORITY',
          relationship: 'aggregates',
          toInstitutionId: 'aggregator-1',
          toRole: 'EVIDENCE_AGGREGATOR',
          evidenceRef: 'edge-1',
        },
      ],
    }
    expect(organicCertificationObservationSchema.safeParse(candidate).success).toBe(false)
  })

  it('retains the certification-body edge when an aggregator republishes a source fact', () => {
    const aggregated = observation({
      source: {
        ...observation().source,
        institutionId: 'aggregator-1',
        role: 'EVIDENCE_AGGREGATOR',
      },
      provenance: [
        {
          fromInstitutionId: 'certifier-1',
          fromRole: 'CERTIFICATION_BODY',
          relationship: 'aggregates',
          toInstitutionId: 'aggregator-1',
          toRole: 'EVIDENCE_AGGREGATOR',
          evidenceRef: 'certifier-publication-1',
        },
      ],
    })
    expect(aggregated.source.institutionId).toBe('aggregator-1')
    expect(aggregated.provenance[0]?.fromInstitutionId).toBe('certifier-1')
  })

  it('retains conflicting source observations without choosing a winner', () => {
    const suspended = observation({
      evidenceId: 'evidence-2',
      source: {
        ...observation().source,
        institutionId: 'certifier-2',
      },
      rawStatus: 'Suspended',
      normalizedStatus: {
        status: 'SUSPENDED',
        authorityId: 'test-normalization-authority',
        mappingId: 'synthetic-cor-status',
        version: 'test-1',
      },
    })
    const records = [observation(), suspended]
    expect(records).toHaveLength(2)
    expect(classifyOrganicEvidenceConflict(records)).toBe('CONFLICTING_AUTHORITIES')
  })

  it('represents source disappearance without fabricating cancellation', () => {
    const unavailable = observation({
      rawStatus: undefined,
      normalizedStatus: undefined,
      sourceAvailability: 'UNAVAILABLE',
      freshness: 'SOURCE_UNAVAILABLE',
    })
    expect(unavailable.rawStatus).toBeUndefined()
    expect(unavailable.normalizedStatus).toBeUndefined()
    expect(classifyOrganicEvidenceConflict([unavailable])).toBe('SOURCE_UNAVAILABLE')
    expect(
      organicCertificationObservationSchema.safeParse({
        ...unavailable,
        rawStatus: 'Cancelled',
      }).success,
    ).toBe(false)
  })

  it('keeps stale source status while marking it stale rather than replacing its value', () => {
    const stale = observation({ freshness: 'STALE' })
    expect(stale.rawStatus).toBe('Certified')
    expect(classifyOrganicEvidenceConflict([stale])).toBe('STALE_SOURCE')
  })

  it('represents a standard identifier and version without embedding standards text', () => {
    expect(
      organicCertificationObservationSchema.parse({
        ...observation(),
        standard: { identifier: 'CAN/CGSB-32.310', version: '2026' },
      }).standard,
    ).toEqual({ identifier: 'CAN/CGSB-32.310', version: '2026' })
  })

  it('keeps standards interpretations separate from certification observations', () => {
    const interpretation = organicStandardInterpretationSchema.parse({
      interpretationId: 'interpretation-1',
      kind: 'STANDARD_INTERPRETATION',
      authorityInstitutionId: 'interpretation-authority-1',
      standard: {
        identifier: 'CAN/CGSB-32.310',
        version: '2026',
        sourceRef: 'official-standard-reference',
      },
      reference: 'interpretation-reference-1',
    })
    expect(interpretation.kind).toBe('STANDARD_INTERPRETATION')
    expect(
      organicCertificationObservationSchema.safeParse({
        ...observation(),
        interpretation,
      }).success,
    ).toBe(false)
  })

  it('does not turn COTA membership evidence into certification evidence', () => {
    const membership = organicSectorMembershipEvidenceSchema.parse({
      membershipEvidenceId: 'membership-1',
      institutionId: 'cota',
      institutionRole: 'SECTOR_CONVENOR',
      memberRef: 'member-1',
      sourceRef: 'cota-directory-entry',
    })
    expect(membership.institutionRole).toBe('SECTOR_CONVENOR')
    expect(organicCertificationObservationSchema.safeParse(membership).success).toBe(false)
  })

  it('keeps publication authority, automated access, reuse, and republication rights distinct', () => {
    const source = organicSourceRegistryEntrySchema.parse({
      institutionId: 'cfia',
      institutionName: 'Canadian Food Inspection Agency',
      roles: ['SCHEME_AUTHORITY'],
      sourceClass: 'COR accredited certification body listing',
      sourceUrl:
        'https://inspection.canada.ca/en/food-labels/organic-products/certification-bodies/list-certification-bodies',
      rights: sourceRights,
      exposedDataClasses: ['certification-body identity', 'accreditation scope'],
      expectedRefreshMetadata: {},
    })
    expect(source.rights.publicationAuthority.state).toBe('ESTABLISHED')
    expect(source.rights.automatedAccess).toBe('UNKNOWN')
    expect(source.rights.reuseRights).toBe('UNKNOWN')
    expect(source.rights.republicationRights).toBe('UNKNOWN')
  })

  it('represents a read-only passport and a separate recipient institutional disposition', () => {
    const passport = organicEvidencePassportSchema.parse({
      operatorRef: 'operator-test-1',
      observations: [observation()],
      conflictState: 'CONSISTENT',
      recipientDisposition: {
        recipientInstitutionId: 'buyer-institution',
        recipientOrganizationId: 'buyer-org',
        recipientRole: 'compliance-reviewer',
        disposition: 'REQUIRES_VERIFICATION',
        evidenceRefs: ['evidence-1'],
      },
      disclaimer: 'Cora presents source evidence. Cora is not the certification body.',
    })
    expect(passport.recipientDisposition?.disposition).toBe('REQUIRES_VERIFICATION')
    expect('isCertified' in passport).toBe(false)
  })

  it('defines status-change events with source observations rather than activating notifications', () => {
    expect(
      certificationStatusChangedEventSchema.parse({
        eventType: 'CERTIFICATION_STATUS_CHANGED',
        operatorRef: 'operator-test-1',
        evidenceSource: {
          institutionId: 'certifier-1',
          role: 'CERTIFICATION_BODY',
          reference: 'directory-entry',
        },
        previousObservationRef: 'observation-old',
        newObservationRef: 'observation-new',
        observedAt: '2026-01-02T00:00:00.000Z',
        evidenceRefs: ['observation-old', 'observation-new'],
        previous: { rawStatus: 'Certified', normalizedStatus: 'CERTIFIED' },
        current: { rawStatus: 'Suspended', normalizedStatus: 'SUSPENDED' },
      }).eventType,
    ).toBe('CERTIFICATION_STATUS_CHANGED')
  })

  it.each([
    [{ state: 'UNKNOWN' as const }, 'OBSERVATION_TIME_UNKNOWN'],
    [{ state: 'INVALID' as const, rawTimestamp: 'not-a-date' }, 'INVALID_OBSERVATION_TIME'],
    [{ state: 'KNOWN' as const, observedAt: '2026-01-01T00:00:00.000Z' }, 'FRESHNESS_POLICY_UNSET'],
  ])('fails closed on unresolved freshness inputs', (observationTime, expected) => {
    expect(
      evaluateOrganicFreshness({
        observationTime,
        sourceAvailability: 'AVAILABLE',
        now: '2026-01-02T00:00:00.000Z',
      }),
    ).toBe(expected)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'fails closed when a synthetic freshness threshold is invalid: %s',
    (maxAgeMs) => {
      expect(
        evaluateOrganicFreshness({
          observationTime: { state: 'KNOWN', observedAt: '2026-01-01T00:00:00.000Z' },
          sourceAvailability: 'AVAILABLE',
          now: '2026-01-02T00:00:00.000Z',
          maxAgeMs,
        }),
      ).toBe('FRESHNESS_POLICY_UNSET')
    },
  )

  it('reports unavailable, stale, and future evidence without changing the source status', () => {
    const now = '2026-01-02T00:00:00.000Z'
    expect(
      evaluateOrganicFreshness({
        observationTime: { state: 'KNOWN', observedAt: '2026-01-01T00:00:00.000Z' },
        sourceAvailability: 'AVAILABLE',
        now,
        maxAgeMs: 60 * 60 * 1000,
      }),
    ).toBe('STALE')
    expect(
      evaluateOrganicFreshness({
        observationTime: { state: 'KNOWN', observedAt: '2026-01-03T00:00:00.000Z' },
        sourceAvailability: 'AVAILABLE',
        now,
        maxAgeMs: 60 * 60 * 1000,
      }),
    ).toBe('FUTURE_OBSERVATION_TIME')
    expect(
      evaluateOrganicFreshness({
        observationTime: { state: 'UNKNOWN' },
        sourceAvailability: 'UNAVAILABLE',
        now,
        maxAgeMs: 60 * 60 * 1000,
      }),
    ).toBe('SOURCE_UNAVAILABLE')
  })

  it('treats the explicitly supplied freshness boundary as current at equality', () => {
    expect(
      evaluateOrganicFreshness({
        observationTime: { state: 'KNOWN', observedAt: '2026-01-01T23:00:00.000Z' },
        sourceAvailability: 'AVAILABLE',
        now: '2026-01-02T00:00:00.000Z',
        maxAgeMs: 60 * 60 * 1000,
      }),
    ).toBe('CURRENT')
  })

  it('requires the existing private evidence authorization boundary for organic evidence writes', async () => {
    const context: OrgContext = {
      orgId: '00000000-0000-0000-0000-000000000001',
      actorId: 'actor-1',
      role: 'analyst',
      permissions: [],
      requestId: 'request-1',
    }
    const persistence: CoraEvidencePersistencePort = {
      appendEvidence: vi.fn(async (_ctx, record) => record),
      appendConclusion: vi.fn(async (_ctx, record) => record),
    }
    const ports: CoraEvidenceServicePorts = {
      persistence,
      authorizeConsentUse: vi.fn(async (request) => ({
        status: 'granted' as const,
        consentRef: request.consentRef,
        evaluatedAt: '2026-01-01T00:00:00.000Z',
      })),
      evaluateAndAuditPolicy: vi.fn(async (): Promise<readonly PolicyEvaluationOutput[]> => []),
      environment: 'test',
    }
    const service = createCoraEvidenceService(ports)
    await expect(
      service.recordEvidence(context, {
        evidenceType: 'organic.certification.status',
        purpose: 'institutional-verification',
        consentRef: 'consent-test-only',
        source: { system: 'synthetic-directory', recordId: 'record-1' },
        temporalScope: { observedAt: '2026-01-01T00:00:00.000Z' },
        methodology: {
          id: '00000000-0000-0000-0000-000000000002',
          authorityId: 'test-authority',
          methodologyId: 'test-method',
          version: 'test-1',
          definitionSha256: hash,
        },
        provenanceRef: 'synthetic-provenance',
        payloadSha256: hash,
        confidence: { level: 'unknown', basis: 'Synthetic isolated authorization test' },
        dataQuality: {
          completeness: 'unknown',
          freshness: 'unknown',
          traceability: 'unknown',
          limitations: ['Test only'],
        },
      }),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' })
    expect(persistence.appendEvidence).not.toHaveBeenCalled()
    expect(ports.authorizeConsentUse).not.toHaveBeenCalled()
  })
})

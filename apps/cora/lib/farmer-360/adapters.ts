import type { DbContext } from '@nzila/org/context'
import { farmer360Persistence } from '@nzila/db/cora-farmer360'
export { farmer360Persistence } from '@nzila/db/cora-farmer360'
import { writeSourceDisclosureDecisionAudit } from '@nzila/db/authorization-audit'
import { getProducerById } from '@nzila/agri-db/readonly'
import { createSourceDisclosureAuthority } from '@nzila/platform-auth/source-disclosure'
import type { SourceDisclosurePolicy } from '@nzila/platform-auth/source-disclosure'
import type { Farmer360PersistencePort, Farmer360ServicePorts } from './service'
import type { Farmer360Fact, Farmer360Profile, Farmer360Section } from './contracts'

const PRODUCER_FRESHNESS_WINDOW_MS = 90 * 24 * 60 * 60 * 1000
const governedSourceDisclosurePolicies: readonly SourceDisclosurePolicy[] = []
const governedFactContracts: readonly unknown[] = []
const governedFreshnessPolicies: readonly unknown[] = []
const approvedSourceDisclosureEvidence: readonly unknown[] = []

const sourceDisclosureAuthority = createSourceDisclosureAuthority({
  loadPolicies: async () => governedSourceDisclosurePolicies,
  loadFactContracts: async () => governedFactContracts,
  loadFreshnessPolicies: async () => governedFreshnessPolicies,
  loadApprovedEvidence: async () => approvedSourceDisclosureEvidence,
  recordAudit: writeSourceDisclosureDecisionAudit,
})

export async function getProducerFarmer360Snapshot(
  context: DbContext,
  profile: Farmer360Profile,
): Promise<{ sections: readonly Farmer360Section[] }> {
  if (context.orgId !== profile.orgId) {
    throw new Error('Farmer 360 source profile is outside the authorized org')
  }
  if (profile.subjectRef.system !== 'agrimo') {
    return { sections: [] }
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      profile.subjectRef.recordId,
    )
  ) {
    return { sections: [] }
  }
  const producer = await getProducerById({ orgId: context.orgId }, profile.subjectRef.recordId)
  if (!producer) return { sections: [] }

  const updatedAt =
    typeof producer.updatedAt === 'string' ? Date.parse(producer.updatedAt) : Number.NaN
  const sourceObservedAt = Number.isFinite(updatedAt)
    ? new Date(updatedAt).toISOString()
    : undefined
  const ageMs = Date.now() - updatedAt
  const freshness =
    !Number.isFinite(updatedAt) || ageMs < 0
      ? 'unknown'
      : ageMs <= PRODUCER_FRESHNESS_WINDOW_MS
        ? 'current'
        : 'stale'
  const fact: Farmer360Fact = {
    orgId: producer.orgId,
    profileId: profile.id,
    key: 'producer.status',
    label: 'Producer record status',
    value: producer.status,
    valueKind: 'observed',
    source: { system: profile.subjectRef.system, recordId: producer.id },
    observedAt: sourceObservedAt,
    provenance: {
      sourceSystem: 'agrimo',
      sourceDomain: 'agriculture',
      sourceEntity: 'producer',
      sourceAuthorityRef: 'agrimo:operational-producer-record',
      sourceRecordId: producer.id,
      sourceOrganizationId: producer.orgId,
      factClass: 'producer.status',
      observedAt: sourceObservedAt,
      provenanceRef: `agrimo:producer:${producer.id}:${sourceObservedAt ?? 'observation-time-unresolved'}`,
    },
    freshness,
    confidence: {
      level: 'high',
      basis: 'Direct status field from the organization-scoped canonical producer record',
    },
    quality: {
      completeness: 'partial',
      traceability: 'direct',
      limitations: ['Producer status does not establish production, economic, or capacity facts'],
    },
  }

  return {
    sections: [
      {
        name: 'evidence-confidence',
        status: 'PARTIAL',
        facts: [fact],
        conflicts: [],
      },
    ],
  }
}

export function createFarmer360RuntimePorts(
  persistence: Farmer360PersistencePort = farmer360Persistence,
): Farmer360ServicePorts {
  return {
    persistence,
    getAuthorizedSources: getProducerFarmer360Snapshot,
    authorizeConsentUse: async (request) => ({
      status: 'unknown',
      consentRef: request.consentRef,
      evaluatedAt: new Date().toISOString(),
    }),
    evaluateAndAuditPolicy: async () => [],
    evaluateSourceDisclosure: (input) => sourceDisclosureAuthority.evaluate(input),
    environment: process.env.NODE_ENV ?? 'development',
  }
}

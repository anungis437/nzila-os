import { closeAuthClients } from '../../packages/db/src/auth-client'
import { createHash } from 'node:crypto'
import { and, count, eq, sql } from 'drizzle-orm'
import { createSourceDisclosureAuthority } from '../../packages/platform-auth/src/source-disclosure.ts'
import { writeSourceDisclosureDecisionAudit } from '../../packages/db/src/authorization-audit.ts'
import type { Farmer360RequestContext } from '../../apps/cora/lib/farmer-360/service'
import type {
  PolicyEvaluationInput,
  PolicyEvaluationOutput,
} from '../../packages/platform-policy-engine/src/index.ts'
import { db } from '../../packages/db/src/client.ts'
import {
  agriProducers,
  auditEvents,
  coraEvidenceRecords,
  coraFarmer360Assertions,
  coraFarmer360ContextVersions,
  platformMethodologyVersions,
} from '../../packages/db/src/schema/index.ts'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getProducerById } from '../../packages/agri-db/src/readonly/index.ts'
import {
  CORA_ENTERPRISE_CONTEXT_WRITE_PERMISSION,
  CORA_FARMER360_READ_PERMISSION,
  CORA_FARMER_ASSERTION_WRITE_PERMISSION,
  createFarmer360Service,
} from '../../apps/cora/lib/farmer-360/service'
import {
  farmer360Persistence,
  getProducerFarmer360Snapshot,
} from '../../apps/cora/lib/farmer-360/adapters'

const FIXTURE_ORG_ID = '36000000-0000-4000-8000-000000000001'
const OTHER_ORG_ID = '36000000-0000-4000-8000-000000000002'
const PRODUCER_ID = '36000000-0000-4000-8000-000000000101'
const ACTOR_ID = 'cora-farmer360-acceptance-actor'
const CONSENT_REF = 'test-only-consent:cora-farmer360-acceptance'
const EXPECTED_DATABASE_URL =
  'postgres://cora_acceptance:cora_acceptance_local_only@127.0.0.1:55441/cora_farmer360_acceptance'
const isAcceptanceDatabase =
  process.env.CORA_FARMER360_ACCEPTANCE_DATABASE_URL === EXPECTED_DATABASE_URL &&
  process.env.DATABASE_URL === EXPECTED_DATABASE_URL

const authMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}))

vi.mock('../../packages/platform-auth/src/entra/server.ts', () => ({
  auth: authMocks.auth,
  currentUser: authMocks.currentUser,
}))
vi.mock('../../packages/os-core/src/config/super-admins.ts', () => ({
  isSuperAdmin: () => false,
}))

import { GET } from '../../apps/cora/app/api/farmer-360/[profileId]/route'

type ConsentMode = 'CONSENT_ALLOW' | 'CONSENT_DENY'
type PolicyMode = 'POLICY_ALLOW' | 'POLICY_DENY'

const readContext: Farmer360RequestContext = {
  orgId: FIXTURE_ORG_ID,
  actorId: ACTOR_ID,
  role: 'viewer',
  permissions: [CORA_FARMER360_READ_PERMISSION],
  requestId: 'cora-farmer360-acceptance-read',
  appId: 'cora',
  identityBindingId: 'test-only-identity-binding',
  identityBindingState: 'active',
  membershipId: 'test-only-membership',
  membershipState: 'active',
  identityProvider: 'clerk',
}

const writeContext: Farmer360RequestContext = {
  ...readContext,
  role: 'admin',
  permissions: [
    CORA_FARMER360_READ_PERMISSION,
    CORA_ENTERPRISE_CONTEXT_WRITE_PERMISSION,
    CORA_FARMER_ASSERTION_WRITE_PERMISSION,
  ],
  requestId: 'cora-farmer360-acceptance-write',
}

function testService(consentMode: ConsentMode, policyMode: PolicyMode) {
  const sourceDisclosureAuthority = createSourceDisclosureAuthority({
    loadPolicies: async () => [],
    recordAudit: writeSourceDisclosureDecisionAudit,
  })
  return createFarmer360Service({
    persistence: farmer360Persistence,
    getAuthorizedSources: getProducerFarmer360Snapshot,
    authorizeConsentUse: async (request) => {
      const requestIsValid =
        request.orgId === FIXTURE_ORG_ID &&
        request.actorId === ACTOR_ID &&
        request.recipient === 'cora' &&
        request.consentRef === CONSENT_REF &&
        request.purpose === 'Farmer-entered correction' &&
        request.source.system === 'agrimo' &&
        request.source.recordId === PRODUCER_ID
      return {
        status: consentMode === 'CONSENT_ALLOW' && requestIsValid ? 'granted' : 'denied',
        consentRef: request.consentRef,
        evaluatedAt: new Date().toISOString(),
      }
    },
    evaluateAndAuditPolicy: async (input: PolicyEvaluationInput) => {
      const inputIsValid =
        input.policyId === 'cora-farmer360-write' &&
        input.orgId === FIXTURE_ORG_ID &&
        input.actor.userId === ACTOR_ID &&
        input.resource === 'cora:farmer360' &&
        input.environment === 'local-acceptance-test' &&
        Boolean(input.context.requestId)
      const allowed = policyMode === 'POLICY_ALLOW' && inputIsValid
      const output: PolicyEvaluationOutput = {
        evaluationId: `test-only:${input.action}`,
        policyId: input.policyId,
        input,
        decisions: [
          {
            policyId: input.policyId,
            ruleId: 'test-only-explicit-acceptance-decision',
            result: allowed ? 'pass' : 'fail',
            effect: allowed ? 'allow' : 'deny',
            severity: allowed ? 'info' : 'critical',
            reason: allowed
              ? 'Explicit local acceptance allow decision'
              : 'Explicit local acceptance deny decision or invalid request context',
          },
        ],
        overallResult: allowed ? 'pass' : 'fail',
        evaluatedAt: new Date().toISOString(),
        durationMs: 0,
      }
      return [output]
    },
    evaluateSourceDisclosure: sourceDisclosureAuthority.evaluate,
    environment: 'local-acceptance-test',
  })
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalStringify(entry)}`).join(',')}}`
}

async function rowCount(
  table: typeof auditEvents | typeof coraEvidenceRecords | typeof coraFarmer360Assertions,
) {
  const [{ value }] = await db.select({ value: count() }).from(table)
  return Number(value)
}

async function expectDatabaseFailure(operation: PromiseLike<unknown>, expectedMessage: string) {
  let failure: unknown
  try {
    await operation
  } catch (error) {
    failure = error
  }
  expect(failure).toBeDefined()
  const messages: string[] = []
  let cause = failure
  while (cause instanceof Error) {
    messages.push(cause.message)
    cause = cause.cause
  }
  expect(messages.join('\n')).toContain(expectedMessage)
}

describe.skipIf(!isAcceptanceDatabase)('Farmer 360 local DB acceptance', () => {
  beforeAll(async () => {
    const [org] = await db
      .select({ id: agriProducers.orgId })
      .from(agriProducers)
      .where(and(eq(agriProducers.orgId, FIXTURE_ORG_ID), eq(agriProducers.id, PRODUCER_ID)))
      .limit(1)
    const [methodology] = await db
      .select()
      .from(platformMethodologyVersions)
      .where(
        and(
          eq(platformMethodologyVersions.authorityId, 'cora'),
          eq(platformMethodologyVersions.methodologyId, 'farmer-assertion'),
          eq(platformMethodologyVersions.version, '1.0.0'),
        ),
      )
      .limit(1)
    expect(org?.id).toBe(FIXTURE_ORG_ID)
    expect(methodology?.definitionRef).toBe(
      'test-only://cora-farmer360-acceptance/cora/farmer-assertion/1.0.0',
    )
    expect(methodology?.createdBy).toBe('test-only:cora-farmer360-acceptance')
  })

  afterAll(async () => {
    await closeAuthClients()
    await db.$client.end({ timeout: 5 })
    authMocks.auth.mockReset()
    authMocks.currentUser.mockReset()
  })

  it('proves scoped persistence, explicit authorization, live reads, route auth, and source/history separation', async () => {
    const sourceBefore = await getProducerById({ orgId: FIXTURE_ORG_ID }, PRODUCER_ID)
    expect(sourceBefore).toMatchObject({
      id: PRODUCER_ID,
      orgId: FIXTURE_ORG_ID,
      name: 'TEST ONLY - Synthetic Producer',
      status: 'active',
    })
    expect(sourceBefore?.metadata).toMatchObject({
      fixture: 'cora-farmer360-acceptance',
      synthetic: true,
    })

    const acceptedService = testService('CONSENT_ALLOW', 'POLICY_ALLOW')
    const profile = await acceptedService.upsertCoraEnterpriseContext(writeContext, {
      subjectRef: { system: 'agrimo', recordId: PRODUCER_ID },
      context: {
        enterpriseName: 'TEST ONLY - Synthetic Producer',
        operatingModel: 'independent',
        geography: { countryCode: 'CA', region: 'ON' },
        farmReferences: [{ system: 'agrimo', recordId: PRODUCER_ID, kind: 'producer' }],
      },
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    })
    expect(profile.orgId).toBe(FIXTURE_ORG_ID)
    expect(profile.context?.enterpriseName).toBe('TEST ONLY - Synthetic Producer')
    const profileId = profile.id

    const sourceSnapshot = await getProducerFarmer360Snapshot(readContext, profile)
    expect(sourceSnapshot.sections[0].facts[0]).toMatchObject({
      key: 'producer.status',
      observedAt: sourceBefore?.updatedAt,
      provenance: { observedAt: sourceBefore?.updatedAt },
    })
    await expectDatabaseFailure(
      db
        .update(agriProducers)
        .set({ updatedAt: sql`NULL` })
        .where(and(eq(agriProducers.orgId, FIXTURE_ORG_ID), eq(agriProducers.id, PRODUCER_ID))),
      'not-null constraint',
    )
    expect(await getProducerById({ orgId: FIXTURE_ORG_ID }, PRODUCER_ID)).toEqual(sourceBefore)
    await expect(
      getProducerFarmer360Snapshot(readContext, {
        ...profile,
        subjectRef: { system: 'agrimo', recordId: '36000000-0000-4000-8000-000000000999' },
      }),
    ).resolves.toEqual({ sections: [] })

    const acceptedRead = await acceptedService.getFarmer360(readContext, profileId)
    expect(acceptedRead.profile.id).toBe(profileId)
    expect(acceptedRead.sections['evidence-confidence']).toMatchObject({
      status: 'UNKNOWN',
      facts: [],
    })
    for (const section of [
      'production',
      'economics',
      'assets-capacity',
      'labour-capacity',
      'sustainability-standards',
      'markets-exposure',
      'risk-resilience',
      'historical-decisions',
    ] as const) {
      expect(acceptedRead.sections[section].status).toBe('UNKNOWN')
    }

    authMocks.currentUser.mockResolvedValue({
      primaryEmailAddress: { emailAddress: 'acceptance@example.test' },
      emailAddresses: [],
    })
    authMocks.auth.mockResolvedValue({
      userId: ACTOR_ID,
      orgId: FIXTURE_ORG_ID,
      orgRole: 'org:member',
      identityProvider: 'cora-acceptance',
      providerSubject: 'farmer360-route-actor',
      sessionClaims: null,
    })
    const routeRequest = () =>
      GET(new Request(`http://localhost/api/farmer-360/${profileId}`), {
        params: Promise.resolve({ profileId }),
      })
    const routeResponse = await routeRequest()
    expect(routeResponse.status).toBe(200)
    expect(routeResponse.headers.get('Cache-Control')).toContain('no-store')
    expect(routeResponse.headers.get('Pragma')).toBe('no-cache')
    expect(routeResponse.headers.get('Vary')).toBe('Cookie, Authorization')
    const routeBody = await routeResponse.json()
    expect(routeBody.profile.id).toBe(profileId)
    expect(routeBody.sections.economics.status).toBe('UNKNOWN')
    expect(routeBody.sections['evidence-confidence']).toMatchObject({
      status: 'UNKNOWN',
      facts: [],
    })
    expect(JSON.stringify(routeBody.sections['evidence-confidence'])).not.toContain('"active"')

    authMocks.auth.mockResolvedValue({
      userId: ACTOR_ID,
      orgId: OTHER_ORG_ID,
      orgRole: 'org:member',
      identityProvider: 'cora-acceptance',
      providerSubject: 'farmer360-route-actor',
      sessionClaims: null,
    })
    const routeWithUntrustedOrgClaim = await routeRequest()
    expect(routeWithUntrustedOrgClaim.status).toBe(200)
    expect((await routeWithUntrustedOrgClaim.json()).profile.orgId).toBe(FIXTURE_ORG_ID)

    authMocks.auth.mockResolvedValue({
      userId: null,
      orgId: null,
      orgRole: null,
      sessionClaims: null,
    })
    expect((await routeRequest()).status).toBe(401)

    await expect(
      acceptedService.getFarmer360(
        {
          ...readContext,
          permissions: [],
        },
        profileId,
      ),
    ).rejects.toThrow('cora:farmer360:read')

    const contextVersions = await db
      .select()
      .from(coraFarmer360ContextVersions)
      .where(
        and(
          eq(coraFarmer360ContextVersions.orgId, FIXTURE_ORG_ID),
          eq(coraFarmer360ContextVersions.profileId, profileId),
        ),
      )
    expect(contextVersions).toHaveLength(1)
    await expectDatabaseFailure(
      db
        .update(coraFarmer360ContextVersions)
        .set({ createdBy: 'tamper-attempt' })
        .where(eq(coraFarmer360ContextVersions.id, contextVersions[0].id)),
      'CORA_FARMER360_HISTORY_IMMUTABLE',
    )

    const assertionInput = {
      profileId,
      subject: 'Production status',
      statement: 'TEST ONLY - Farmer reported the producer remains active.',
      purpose: 'Farmer-entered correction',
      consentRef: CONSENT_REF,
      source: { system: 'agrimo', recordId: PRODUCER_ID },
      observedAt: new Date().toISOString(),
    }

    const beforeDeniedWrites = {
      assertions: await rowCount(coraFarmer360Assertions),
      evidence: await rowCount(coraEvidenceRecords),
      audit: await rowCount(auditEvents),
    }
    await expect(
      testService('CONSENT_DENY', 'POLICY_ALLOW').recordFarmerAssertion(
        writeContext,
        assertionInput,
      ),
    ).rejects.toThrow('Canonical consent did not authorize')
    expect({
      assertions: await rowCount(coraFarmer360Assertions),
      evidence: await rowCount(coraEvidenceRecords),
      audit: await rowCount(auditEvents),
    }).toEqual(beforeDeniedWrites)

    await expect(
      testService('CONSENT_ALLOW', 'POLICY_DENY').recordFarmerAssertion(
        writeContext,
        assertionInput,
      ),
    ).rejects.toThrow('Canonical policy did not authorize')
    expect({
      assertions: await rowCount(coraFarmer360Assertions),
      evidence: await rowCount(coraEvidenceRecords),
      audit: await rowCount(auditEvents),
    }).toEqual(beforeDeniedWrites)

    const assertion = await acceptedService.recordFarmerAssertion(writeContext, assertionInput)
    expect(assertion).toMatchObject({
      orgId: FIXTURE_ORG_ID,
      profileId,
      verificationState: 'unverified',
      evidence: { system: 'cora-evidence' },
    })
    expect(assertion.evidence.evidenceId).toBeTruthy()
    expect(assertion.evidence.payloadSha256).toMatch(/^[a-f0-9]{64}$/)

    const [persistedEvidence] = await db
      .select()
      .from(coraEvidenceRecords)
      .where(
        and(
          eq(coraEvidenceRecords.orgId, FIXTURE_ORG_ID),
          eq(coraEvidenceRecords.id, assertion.evidence.evidenceId!),
        ),
      )
      .limit(1)
    expect(persistedEvidence).toMatchObject({
      methodologyAuthorityId: 'cora',
      methodologyId: 'farmer-assertion',
      methodologyVersion: '1.0.0',
      consentRef: CONSENT_REF,
      payloadSha256: assertion.evidence.payloadSha256,
    })

    const [assertionRow] = await db
      .select()
      .from(coraFarmer360Assertions)
      .where(eq(coraFarmer360Assertions.id, assertion.id))
      .limit(1)
    expect(assertionRow.evidenceId).toBe(persistedEvidence.id)
    expect(assertionRow.evidencePayloadSha256).toBe(persistedEvidence.payloadSha256)
    await expectDatabaseFailure(
      db
        .update(coraFarmer360Assertions)
        .set({ statement: 'tampered' })
        .where(eq(coraFarmer360Assertions.id, assertion.id)),
      'CORA_FARMER360_HISTORY_IMMUTABLE',
    )

    await expectDatabaseFailure(
      db.insert(coraFarmer360Assertions).values({
        orgId: FIXTURE_ORG_ID,
        profileId,
        subject: 'Invalid evidence linkage',
        statement: 'TEST ONLY - Must fail the composite evidence FK.',
        purpose: 'test',
        consentRef: CONSENT_REF,
        evidenceId: persistedEvidence.id,
        evidencePayloadSha256: '0'.repeat(64),
        assertedBy: ACTOR_ID,
        assertedAt: new Date(),
      }),
      'cora_farmer360_assertions_evidence_fk',
    )

    const assertionHistory = await acceptedService.getFarmer360Assertions(readContext, profileId)
    expect(assertionHistory).toHaveLength(1)
    const auditRows = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.orgId, FIXTURE_ORG_ID))
    expect(
      auditRows.filter((row) => row.action === 'source_disclosure.withhold').length,
    ).toBeGreaterThanOrEqual(2)
    const sourceDisclosureAudits = auditRows.filter((row) =>
      row.action.startsWith('source_disclosure.'),
    )
    expect(sourceDisclosureAudits.length).toBeGreaterThan(0)
    for (const event of sourceDisclosureAudits) {
      const metadata = JSON.stringify(event.afterJson)
      expect(metadata).not.toContain('"active"')
      expect(metadata).not.toContain('"sourceRecordId"')
      expect(metadata).not.toContain('"value"')
    }
    const assertionAudit = auditRows.find((row) => row.action === 'cora:farmer-assertion:record')
    expect(assertionAudit).toMatchObject({
      actorClerkUserId: ACTOR_ID,
      targetType: 'cora_farmer360',
      targetId: profileId,
      hashVersion: 'canonical-v1',
    })
    const canonicalPayload = {
      action: assertionAudit!.action,
      actorClerkUserId: assertionAudit!.actorClerkUserId,
      actorRole: assertionAudit!.actorRole,
      afterJson: assertionAudit!.afterJson,
      hashTimestamp: assertionAudit!.occurredAt.toISOString(),
      hashVersion: assertionAudit!.hashVersion,
      orgId: assertionAudit!.orgId,
      targetId: assertionAudit!.targetId,
      targetType: assertionAudit!.targetType,
    }
    const reconstructedHash = createHash('sha256')
      .update(
        canonicalStringify({
          payload: canonicalPayload,
          previousHash: assertionAudit!.previousHash,
        }),
        'utf8',
      )
      .digest('hex')
    expect(assertionAudit!.hash).toBe(reconstructedHash)
    await expectDatabaseFailure(
      db
        .update(auditEvents)
        .set({ action: 'tampered' })
        .where(eq(auditEvents.id, assertionAudit!.id)),
      'audit_events rows are immutable',
    )

    const [otherOrgProfile] = await farmer360Persistence
      .getProfileBySubject(
        { orgId: OTHER_ORG_ID, actorId: ACTOR_ID },
        { system: 'agrimo', recordId: PRODUCER_ID },
      )
      .then((value) => [value])
    expect(otherOrgProfile).toBeNull()
    await expect(
      acceptedService.getFarmer360(
        {
          ...readContext,
          orgId: OTHER_ORG_ID,
        },
        profileId,
      ),
    ).rejects.toThrow('Farmer 360 profile not found')

    const sourceAfterCoraWrites = await getProducerById({ orgId: FIXTURE_ORG_ID }, PRODUCER_ID)
    expect(sourceAfterCoraWrites).toEqual(sourceBefore)

    const historyBeforeSourceChange = {
      contexts: await db
        .select()
        .from(coraFarmer360ContextVersions)
        .where(eq(coraFarmer360ContextVersions.profileId, profileId)),
      assertions: await acceptedService.getFarmer360Assertions(readContext, profileId),
    }
    await db
      .update(agriProducers)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(and(eq(agriProducers.orgId, FIXTURE_ORG_ID), eq(agriProducers.id, PRODUCER_ID)))
    const afterSourceChange = await acceptedService.getFarmer360(readContext, profileId)
    expect(afterSourceChange.sections['evidence-confidence']).toMatchObject({
      status: 'UNKNOWN',
      facts: [],
    })
    expect(
      await db
        .select()
        .from(coraFarmer360ContextVersions)
        .where(eq(coraFarmer360ContextVersions.profileId, profileId)),
    ).toEqual(historyBeforeSourceChange.contexts)
    expect(await acceptedService.getFarmer360Assertions(readContext, profileId)).toEqual(
      historyBeforeSourceChange.assertions,
    )
  })
})

if (!isAcceptanceDatabase) {
  afterAll(() => {
    if (process.env.CORA_FARMER360_ACCEPTANCE_DATABASE_URL) {
      throw new Error('Farmer 360 acceptance test refused a non-harness database URL')
    }
  })
}

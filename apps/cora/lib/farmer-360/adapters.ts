import { createHash, randomUUID } from 'node:crypto'
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm'
import type { DbContext } from '@nzila/org/context'
import { db, type Database } from '@nzila/db'
import { writeSourceDisclosureDecisionAudit } from '@nzila/db/authorization-audit'
import {
  auditEvents,
  coraEvidenceRecords,
  coraFarmer360Assertions,
  coraFarmer360ContextVersions,
  coraFarmer360Profiles,
  platformMethodologyVersions,
} from '@nzila/db/schema'
import { getProducerById } from '@nzila/agri-db/readonly'
import { createSourceDisclosureAuthority } from '@nzila/platform-auth/source-disclosure'
import type { SourceDisclosurePolicy } from '@nzila/platform-auth/source-disclosure'
import type { Farmer360PersistencePort, Farmer360ServicePorts } from './service'
import { coraEnterpriseContextSchema, farmer360SourceRefSchema } from './contracts'
import type {
  Farmer360Assertion,
  Farmer360Fact,
  Farmer360Profile,
  Farmer360Section,
} from './contracts'

const FARMER_ASSERTION_METHOD = {
  authorityId: 'cora',
  methodologyId: 'farmer-assertion',
  version: '1.0.0',
} as const

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

function profileFromRow(
  row: typeof coraFarmer360Profiles.$inferSelect,
  contextRow?: typeof coraFarmer360ContextVersions.$inferSelect,
): Farmer360Profile {
  return {
    id: row.id,
    orgId: row.orgId,
    subjectRef: farmer360SourceRefSchema.parse(row.subjectRef),
    context: contextRow ? coraEnterpriseContextSchema.parse(contextRow.enterpriseContext) : null,
    contextEffectiveFrom: contextRow?.effectiveFrom.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function getProfileWithContext(
  executor: Pick<Database, 'select'>,
  orgId: string,
  profileId: string,
): Promise<Farmer360Profile | null> {
  const [row] = await executor
    .select()
    .from(coraFarmer360Profiles)
    .where(and(eq(coraFarmer360Profiles.orgId, orgId), eq(coraFarmer360Profiles.id, profileId)))
    .limit(1)
  if (!row) return null

  const now = new Date()
  const [contextRow] = await executor
    .select()
    .from(coraFarmer360ContextVersions)
    .where(
      and(
        eq(coraFarmer360ContextVersions.orgId, orgId),
        eq(coraFarmer360ContextVersions.profileId, profileId),
        lte(coraFarmer360ContextVersions.effectiveFrom, now),
        or(
          isNull(coraFarmer360ContextVersions.effectiveTo),
          gte(coraFarmer360ContextVersions.effectiveTo, now),
        ),
      ),
    )
    .orderBy(desc(coraFarmer360ContextVersions.effectiveFrom))
    .limit(1)

  return profileFromRow(row, contextRow)
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalStringify(item ?? null)).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalStringify(item)}`).join(',')}}`
}

async function appendAuditIntent(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  context: DbContext,
  audit: Parameters<Farmer360PersistencePort['appendEnterpriseContextVersion']>[2],
): Promise<void> {
  if (audit.orgId !== context.orgId || audit.actorId !== context.actorId) {
    throw new Error('Farmer 360 audit intent does not match the database actor and org scope')
  }
  if (!audit.requestId.trim() || audit.authorization.policyEvaluationIds.length === 0) {
    throw new Error('Farmer 360 writes require a request ID and passing policy evaluation evidence')
  }
  if (
    audit.action === 'farmer-assertion.record' &&
    (!audit.authorization.consentRef || !audit.authorization.consentEvaluatedAt)
  ) {
    throw new Error('Farmer assertion writes require recorded consent authorization')
  }

  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${context.orgId}))`)
  const [latest] = await tx
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.orgId, context.orgId))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(1)
  const previousHash = latest?.hash ?? null
  const hashTimestamp = new Date().toISOString()
  const targetId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      audit.resourceId,
    )
      ? audit.resourceId
      : null
  const afterJson = {
    requestId: audit.requestId,
    resourceId: audit.resourceId,
    authorization: audit.authorization,
  }
  const payload = {
    action: `cora:${audit.action.replace('.', ':')}`,
    actorClerkUserId: context.actorId,
    actorRole: context.actorRole ?? null,
    afterJson,
    hashTimestamp,
    hashVersion: 'canonical-v1',
    orgId: context.orgId,
    targetId,
    targetType: 'cora_farmer360',
  }
  const hash = createHash('sha256')
    .update(canonicalStringify({ payload, previousHash }), 'utf8')
    .digest('hex')

  await tx.insert(auditEvents).values({
    orgId: context.orgId,
    actorClerkUserId: context.actorId,
    actorRole: context.actorRole ?? null,
    action: payload.action,
    targetType: payload.targetType,
    targetId,
    afterJson,
    hash,
    previousHash,
    occurredAt: new Date(hashTimestamp),
    hashVersion: 'canonical-v1',
  })
}

export const farmer360Persistence: Farmer360PersistencePort = {
  getProfile(context, profileId) {
    return getProfileWithContext(db, context.orgId, profileId)
  },

  async getProfileBySubject(context, subjectRef) {
    const [row] = await db
      .select()
      .from(coraFarmer360Profiles)
      .where(
        and(
          eq(coraFarmer360Profiles.orgId, context.orgId),
          sql`${coraFarmer360Profiles.subjectRef}->>'system' = ${subjectRef.system}`,
          sql`${coraFarmer360Profiles.subjectRef}->>'recordId' = ${subjectRef.recordId}`,
        ),
      )
      .limit(1)
    return row ? getProfileWithContext(db, context.orgId, row.id) : null
  },

  async appendEnterpriseContextVersion(context, input, audit) {
    return db.transaction(async (tx) => {
      let profileId = input.profileId
      let profile = profileId ? await getProfileWithContext(tx, context.orgId, profileId) : null
      if (profileId && !profile) throw new Error('Farmer 360 profile is not in the authorized org')
      if (!profile) {
        const [existing] = await tx
          .select()
          .from(coraFarmer360Profiles)
          .where(
            and(
              eq(coraFarmer360Profiles.orgId, context.orgId),
              sql`${coraFarmer360Profiles.subjectRef}->>'system' = ${input.subjectRef.system}`,
              sql`${coraFarmer360Profiles.subjectRef}->>'recordId' = ${input.subjectRef.recordId}`,
            ),
          )
          .limit(1)
        if (existing) {
          profileId = existing.id
          profile = await getProfileWithContext(tx, context.orgId, existing.id)
        } else {
          const [created] = await tx
            .insert(coraFarmer360Profiles)
            .values({
              orgId: context.orgId,
              subjectRef: input.subjectRef,
              createdBy: context.actorId,
            })
            .returning()
          profileId = created.id
          profile = profileFromRow(created)
        }
      }
      if (
        !profile ||
        profile.subjectRef.system !== input.subjectRef.system ||
        profile.subjectRef.recordId !== input.subjectRef.recordId
      ) {
        throw new Error('Farmer 360 profile cannot be rebound to another source subject')
      }
      if (!profileId) throw new Error('Farmer 360 profile ID was not established')

      const effectiveFrom = new Date(input.effectiveFrom)
      await tx.insert(coraFarmer360ContextVersions).values({
        orgId: context.orgId,
        profileId,
        enterpriseContext: input.context,
        effectiveFrom,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        createdBy: context.actorId,
      })
      await tx
        .update(coraFarmer360Profiles)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(coraFarmer360Profiles.orgId, context.orgId),
            eq(coraFarmer360Profiles.id, profileId),
          ),
        )
      await appendAuditIntent(tx, context, audit)

      const updated = await getProfileWithContext(tx, context.orgId, profileId)
      if (!updated) throw new Error('Farmer 360 profile disappeared after context append')
      return updated
    })
  },

  async appendFarmerAssertion(context, input, audit) {
    return db.transaction(async (tx) => {
      const [profile] = await tx
        .select({ id: coraFarmer360Profiles.id })
        .from(coraFarmer360Profiles)
        .where(
          and(
            eq(coraFarmer360Profiles.orgId, context.orgId),
            eq(coraFarmer360Profiles.id, input.profileId),
          ),
        )
        .limit(1)
      if (!profile) throw new Error('Farmer 360 profile is not in the authorized org')

      const [methodology] = await tx
        .select()
        .from(platformMethodologyVersions)
        .where(
          and(
            eq(platformMethodologyVersions.authorityId, FARMER_ASSERTION_METHOD.authorityId),
            eq(platformMethodologyVersions.methodologyId, FARMER_ASSERTION_METHOD.methodologyId),
            eq(platformMethodologyVersions.version, FARMER_ASSERTION_METHOD.version),
            lte(platformMethodologyVersions.effectiveFrom, new Date()),
            or(
              isNull(platformMethodologyVersions.effectiveTo),
              gte(platformMethodologyVersions.effectiveTo, new Date()),
            ),
          ),
        )
        .orderBy(desc(platformMethodologyVersions.effectiveFrom))
        .limit(1)
      if (!methodology) {
        throw new Error(
          `Required canonical methodology is not registered: ${FARMER_ASSERTION_METHOD.authorityId}/${FARMER_ASSERTION_METHOD.methodologyId}@${FARMER_ASSERTION_METHOD.version}`,
        )
      }

      const evidenceId = randomUUID()
      const assertionId = randomUUID()
      const payload = {
        profileId: input.profileId,
        subject: input.subject,
        statement: input.statement,
        purpose: input.purpose,
        consentRef: input.consentRef,
        source: input.source,
        observedAt: input.observedAt,
        assertedBy: context.actorId,
      }
      const payloadSha256 = createHash('sha256')
        .update(canonicalStringify(payload), 'utf8')
        .digest('hex')
      await tx.insert(coraEvidenceRecords).values({
        id: evidenceId,
        orgId: context.orgId,
        evidenceType: 'farmer-assertion',
        purpose: input.purpose,
        consentRef: input.consentRef,
        source: { system: input.source.system, recordId: input.source.recordId },
        observedAt: new Date(input.observedAt),
        methodologyVersionId: methodology.id,
        methodologyAuthorityId: methodology.authorityId,
        methodologyId: methodology.methodologyId,
        methodologyVersion: methodology.version,
        methodologyDefinitionSha256: methodology.definitionSha256,
        provenanceRef: `cora-farmer360-assertion:${assertionId}`,
        payloadSha256,
        confidence: { level: 'unknown', basis: 'Farmer assertion; unverified' },
        dataQuality: {
          completeness: 'partial',
          freshness: 'unknown',
          traceability: 'direct',
          limitations: ['Farmer assertion is unverified'],
        },
        createdBy: context.actorId,
      })
      const [row] = await tx
        .insert(coraFarmer360Assertions)
        .values({
          id: assertionId,
          orgId: context.orgId,
          profileId: input.profileId,
          subject: input.subject,
          statement: input.statement,
          purpose: input.purpose,
          consentRef: input.consentRef,
          evidenceId,
          evidencePayloadSha256: payloadSha256,
          assertedBy: context.actorId,
          assertedAt: new Date(input.observedAt),
        })
        .returning()
      await appendAuditIntent(tx, context, audit)
      return {
        id: row.id,
        orgId: row.orgId,
        profileId: row.profileId,
        subject: row.subject,
        statement: row.statement,
        evidence: {
          system: 'cora-evidence',
          recordId: evidenceId,
          evidenceId,
          payloadSha256,
        },
        verificationState: 'unverified',
        assertedBy: row.assertedBy,
        assertedAt: row.assertedAt.toISOString(),
      } satisfies Farmer360Assertion
    })
  },

  async listFarmerAssertions(context, profileId) {
    const rows = await db
      .select()
      .from(coraFarmer360Assertions)
      .where(
        and(
          eq(coraFarmer360Assertions.orgId, context.orgId),
          eq(coraFarmer360Assertions.profileId, profileId),
        ),
      )
      .orderBy(desc(coraFarmer360Assertions.assertedAt))
    return rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      profileId: row.profileId,
      subject: row.subject,
      statement: row.statement,
      evidence: {
        system: 'cora-evidence',
        recordId: row.evidenceId,
        evidenceId: row.evidenceId,
        payloadSha256: row.evidencePayloadSha256,
      },
      verificationState: 'unverified' as const,
      assertedBy: row.assertedBy,
      assertedAt: row.assertedAt.toISOString(),
    }))
  },
}

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

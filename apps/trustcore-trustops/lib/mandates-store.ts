import { db } from '@nzila/db'
import {
  trustopsCreditors,
  trustopsMandates,
  trustopsMandateStageHistory,
  trustopsProofsOfClaim,
} from '@nzila/db/schema'
import type {
  CreditorClassification,
  ProofOfClaimStatus,
  TrustOpsMandateStage,
} from '@nzila/trustcore-contracts'
import { and, eq } from 'drizzle-orm'

// E5: Drizzle-backed store scoped by org.
// TODO Step F: replace DEMO_ORG_ID with getOrganizationIdForUser(userId) once
// @nzila/platform-auth is wired into this app.
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001'

export interface MandateRecord {
  readonly id: string
  readonly name: string
  readonly debtorName: string
  stage: TrustOpsMandateStage
}

export interface CreditorRecord {
  readonly id: string
  readonly mandateId: string
  readonly name: string
  readonly classification: CreditorClassification
  readonly claimAmountCents: number
}

export interface ProofOfClaimRecord {
  readonly id: string
  readonly mandateId: string
  readonly creditorId: string
  readonly classification: CreditorClassification
  readonly status: ProofOfClaimStatus
  readonly amountCents: number
}

// In-memory dev fallback used when the database is empty (non-production only).
const FIXTURE_MANDATES: MandateRecord[] = [
  {
    id: 'm-001',
    name: 'Acme Industries — Liquidation',
    debtorName: 'Acme Industries Ltd',
    stage: 'claims_classification',
  },
  {
    id: 'm-002',
    name: 'Brightline Logistics — Restructuring',
    debtorName: 'Brightline Logistics SARL',
    stage: 'asset_inventory',
  },
  {
    id: 'm-003',
    name: 'Cobalt Mining — CCAA Filing',
    debtorName: 'Cobalt Mining Corp',
    stage: 'mandate_intake',
  },
]

const FIXTURE_CREDITORS: CreditorRecord[] = [
  { id: 'c-1', mandateId: 'm-001', name: 'First Bank', classification: 'secured', claimAmountCents: 25_000_000 },
  { id: 'c-2', mandateId: 'm-001', name: 'CRA — Tax Authority', classification: 'priority', claimAmountCents: 8_500_000 },
  { id: 'c-3', mandateId: 'm-001', name: 'SupplierCo', classification: 'unsecured', claimAmountCents: 3_200_000 },
  { id: 'c-4', mandateId: 'm-001', name: 'Insider Loan Holdings', classification: 'subordinated', claimAmountCents: 1_500_000 },
  { id: 'c-5', mandateId: 'm-002', name: 'Trade Finance Bank', classification: 'secured', claimAmountCents: 12_000_000 },
  { id: 'c-6', mandateId: 'm-002', name: 'Logistics Vendor Pool', classification: 'unsecured', claimAmountCents: 6_400_000 },
  { id: 'c-7', mandateId: 'm-003', name: 'Equipment Lessor', classification: 'secured', claimAmountCents: 18_750_000 },
]

const FIXTURE_CLAIMS: ProofOfClaimRecord[] = [
  { id: 'p-1', mandateId: 'm-001', creditorId: 'c-1', classification: 'secured', status: 'admitted', amountCents: 25_000_000 },
  { id: 'p-2', mandateId: 'm-001', creditorId: 'c-2', classification: 'priority', status: 'admitted', amountCents: 8_500_000 },
  { id: 'p-3', mandateId: 'm-001', creditorId: 'c-3', classification: 'unsecured', status: 'partially_admitted', amountCents: 2_400_000 },
  { id: 'p-4', mandateId: 'm-001', creditorId: 'c-4', classification: 'subordinated', status: 'under_review', amountCents: 1_500_000 },
  { id: 'p-5', mandateId: 'm-002', creditorId: 'c-5', classification: 'secured', status: 'admitted', amountCents: 12_000_000 },
  { id: 'p-6', mandateId: 'm-002', creditorId: 'c-6', classification: 'unsecured', status: 'submitted', amountCents: 6_400_000 },
]

const shouldUseFallback = (): boolean => process.env.NODE_ENV !== 'production'

export async function listMandates(orgId: string = DEMO_ORG_ID): Promise<ReadonlyArray<MandateRecord>> {
  const rows = await db
    .select({
      id: trustopsMandates.id,
      name: trustopsMandates.name,
      debtorName: trustopsMandates.debtorName,
      stage: trustopsMandates.stage,
    })
    .from(trustopsMandates)
    .where(eq(trustopsMandates.orgId, orgId))

  if (rows.length === 0 && shouldUseFallback()) return FIXTURE_MANDATES
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    debtorName: r.debtorName ?? '',
    stage: r.stage as TrustOpsMandateStage,
  }))
}

export async function getMandate(
  id: string,
  orgId: string = DEMO_ORG_ID,
): Promise<MandateRecord | undefined> {
  const rows = await db
    .select({
      id: trustopsMandates.id,
      name: trustopsMandates.name,
      debtorName: trustopsMandates.debtorName,
      stage: trustopsMandates.stage,
    })
    .from(trustopsMandates)
    .where(and(eq(trustopsMandates.id, id), eq(trustopsMandates.orgId, orgId)))
    .limit(1)

  if (rows.length === 0) {
    if (shouldUseFallback()) return FIXTURE_MANDATES.find((m) => m.id === id)
    return undefined
  }
  const r = rows[0]!
  return {
    id: r.id,
    name: r.name,
    debtorName: r.debtorName ?? '',
    stage: r.stage as TrustOpsMandateStage,
  }
}

export async function getCreditors(
  mandateId: string,
  orgId: string = DEMO_ORG_ID,
): Promise<ReadonlyArray<CreditorRecord>> {
  const rows = await db
    .select({
      id: trustopsCreditors.id,
      mandateId: trustopsCreditors.mandateId,
      name: trustopsCreditors.name,
      classification: trustopsCreditors.classification,
      claimAmountCents: trustopsCreditors.claimAmountCents,
    })
    .from(trustopsCreditors)
    .where(
      and(eq(trustopsCreditors.mandateId, mandateId), eq(trustopsCreditors.orgId, orgId)),
    )

  if (rows.length === 0 && shouldUseFallback()) {
    return FIXTURE_CREDITORS.filter((c) => c.mandateId === mandateId)
  }
  return rows.map((r) => ({
    id: r.id,
    mandateId: r.mandateId,
    name: r.name,
    classification: r.classification as CreditorClassification,
    claimAmountCents: Number(r.claimAmountCents ?? 0n),
  }))
}

export async function getClaims(
  mandateId: string,
  orgId: string = DEMO_ORG_ID,
): Promise<ReadonlyArray<ProofOfClaimRecord>> {
  // proofs_of_claim has no classification column; join creditors to derive it.
  const rows = await db
    .select({
      id: trustopsProofsOfClaim.id,
      mandateId: trustopsProofsOfClaim.mandateId,
      creditorId: trustopsProofsOfClaim.creditorId,
      status: trustopsProofsOfClaim.status,
      amountCents: trustopsProofsOfClaim.amountClaimedCents,
      classification: trustopsCreditors.classification,
    })
    .from(trustopsProofsOfClaim)
    .innerJoin(trustopsCreditors, eq(trustopsProofsOfClaim.creditorId, trustopsCreditors.id))
    .where(
      and(
        eq(trustopsProofsOfClaim.mandateId, mandateId),
        eq(trustopsProofsOfClaim.orgId, orgId),
      ),
    )

  if (rows.length === 0 && shouldUseFallback()) {
    return FIXTURE_CLAIMS.filter((p) => p.mandateId === mandateId)
  }
  return rows.map((r) => ({
    id: r.id,
    mandateId: r.mandateId,
    creditorId: r.creditorId,
    classification: r.classification as CreditorClassification,
    status: r.status as ProofOfClaimStatus,
    amountCents: Number(r.amountCents ?? 0n),
  }))
}

export async function transitionStage(
  mandateId: string,
  toStage: TrustOpsMandateStage,
  actorUserId: string = 'demo-user',
  trigger: 'manual' | 'automatic' | 'deadline' | 'approval' | 'rejection' = 'manual',
  orgId: string = DEMO_ORG_ID,
): Promise<MandateRecord | undefined> {
  const current = await getMandate(mandateId, orgId)
  if (!current) return undefined
  const fromStage = current.stage

  // If row exists in DB, persist; otherwise just update fixture (dev fallback).
  const dbRows = await db
    .select({ id: trustopsMandates.id })
    .from(trustopsMandates)
    .where(and(eq(trustopsMandates.id, mandateId), eq(trustopsMandates.orgId, orgId)))
    .limit(1)

  if (dbRows.length > 0) {
    await db.transaction(async (tx) => {
      await tx
        .update(trustopsMandates)
        .set({ stage: toStage, updatedAt: new Date() })
        .where(and(eq(trustopsMandates.id, mandateId), eq(trustopsMandates.orgId, orgId)))
      await tx.insert(trustopsMandateStageHistory).values({
        orgId,
        mandateId,
        fromStage,
        toStage,
        trigger,
        actorUserId,
      })
    })
  } else if (shouldUseFallback()) {
    const fixture = FIXTURE_MANDATES.find((m) => m.id === mandateId)
    if (fixture) fixture.stage = toStage
  }

  return { ...current, stage: toStage }
}

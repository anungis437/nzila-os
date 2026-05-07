import type {
  CreditorClassification,
  ProofOfClaimStatus,
  TrustOpsMandateStage,
} from '@nzila/trustcore-contracts'

// TODO E5: replace with Drizzle-backed queries against
// mandates / creditors / proofs_of_claim / mandate_stage_history.

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

const MANDATES: MandateRecord[] = [
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

const CREDITORS: CreditorRecord[] = [
  { id: 'c-1', mandateId: 'm-001', name: 'First Bank', classification: 'secured', claimAmountCents: 25_000_000 },
  { id: 'c-2', mandateId: 'm-001', name: 'CRA — Tax Authority', classification: 'priority', claimAmountCents: 8_500_000 },
  { id: 'c-3', mandateId: 'm-001', name: 'SupplierCo', classification: 'unsecured', claimAmountCents: 3_200_000 },
  { id: 'c-4', mandateId: 'm-001', name: 'Insider Loan Holdings', classification: 'subordinated', claimAmountCents: 1_500_000 },
  { id: 'c-5', mandateId: 'm-002', name: 'Trade Finance Bank', classification: 'secured', claimAmountCents: 12_000_000 },
  { id: 'c-6', mandateId: 'm-002', name: 'Logistics Vendor Pool', classification: 'unsecured', claimAmountCents: 6_400_000 },
  { id: 'c-7', mandateId: 'm-003', name: 'Equipment Lessor', classification: 'secured', claimAmountCents: 18_750_000 },
]

const CLAIMS: ProofOfClaimRecord[] = [
  { id: 'p-1', mandateId: 'm-001', creditorId: 'c-1', classification: 'secured', status: 'admitted', amountCents: 25_000_000 },
  { id: 'p-2', mandateId: 'm-001', creditorId: 'c-2', classification: 'priority', status: 'admitted', amountCents: 8_500_000 },
  { id: 'p-3', mandateId: 'm-001', creditorId: 'c-3', classification: 'unsecured', status: 'partially_admitted', amountCents: 2_400_000 },
  { id: 'p-4', mandateId: 'm-001', creditorId: 'c-4', classification: 'subordinated', status: 'under_review', amountCents: 1_500_000 },
  { id: 'p-5', mandateId: 'm-002', creditorId: 'c-5', classification: 'secured', status: 'admitted', amountCents: 12_000_000 },
  { id: 'p-6', mandateId: 'm-002', creditorId: 'c-6', classification: 'unsecured', status: 'submitted', amountCents: 6_400_000 },
]

export function listMandates(): ReadonlyArray<MandateRecord> {
  return MANDATES
}

export function getMandate(id: string): MandateRecord | undefined {
  return MANDATES.find((m) => m.id === id)
}

export function getCreditors(mandateId: string): ReadonlyArray<CreditorRecord> {
  return CREDITORS.filter((c) => c.mandateId === mandateId)
}

export function getClaims(mandateId: string): ReadonlyArray<ProofOfClaimRecord> {
  return CLAIMS.filter((p) => p.mandateId === mandateId)
}

export function transitionStage(mandateId: string, toStage: TrustOpsMandateStage): MandateRecord | undefined {
  const mandate = MANDATES.find((m) => m.id === mandateId)
  if (!mandate) return undefined
  mandate.stage = toStage
  return mandate
}

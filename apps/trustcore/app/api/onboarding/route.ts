/**
 * TrustCore — Onboarding API
 *
 * POST /api/onboarding
 *
 * Accepts the completed onboarding wizard payload and seeds the org with:
 *   1. trustcore_privacy_programs (active, with privacy officer)
 *   2. trustcore_data_assets (from selected data types)
 *   3. trustcore_vendors (from selected tools)
 *   4. trustcore_consent_records (if consent is collected)
 *   5. trustcore_policies (generated privacy policy + data governance)
 *   6. trustcore_compliance_snapshots (initial snapshot)
 *   7. trustcore_evidence_events (onboarding_started, onboarding_completed,
 *                                  policy_generated, initial_snapshot_created)
 *
 * RBAC: org_admin only.
 * Guard: returns 409 if the org already has an active privacy program.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { onboardingSchema } from '@/lib/validation/onboarding'
import { generatePrivacyPolicy, generateDataGovernancePolicy } from '@/lib/compliance/policy-generator'
import { evaluateCompliance } from '@/lib/compliance/engine'
import {
  getActivePrivacyProgram,
  createTrustcorePrivacyProgram,
  createTrustcoreDataAsset,
  createTrustcoreVendor,
  createTrustcoreConsentRecord,
  createTrustcorePolicy,
  createComplianceSnapshot,
  createTrustcoreEvidenceEvent,
} from '@nzila/db/queries/trustcore'
import { generateTrustcoreReminders } from '@/lib/reminders/engine'
import type { OnboardingInput, KnownVendor } from '@/lib/validation/onboarding'

// ── Vendor seed catalogue ──────────────────────────────────────────────────

interface VendorSeed {
  name: string
  serviceDescription: string
  country: string
  crossBorderTransfer: boolean
  riskLevel: 'low' | 'medium' | 'high'
}

const KNOWN_VENDOR_CATALOGUE: Record<KnownVendor, VendorSeed> = {
  google_workspace: {
    name: 'Google Workspace',
    serviceDescription: 'Productivity suite (Gmail, Drive, Meet, Docs)',
    country: 'US',
    crossBorderTransfer: true,
    riskLevel: 'medium',
  },
  microsoft_365: {
    name: 'Microsoft 365',
    serviceDescription: 'Productivity suite (Outlook, Teams, SharePoint)',
    country: 'US',
    crossBorderTransfer: true,
    riskLevel: 'medium',
  },
  stripe: {
    name: 'Stripe',
    serviceDescription: 'Payment processing platform',
    country: 'US',
    crossBorderTransfer: true,
    riskLevel: 'high',
  },
  shopify: {
    name: 'Shopify',
    serviceDescription: 'E-commerce platform',
    country: 'CA',
    crossBorderTransfer: false,
    riskLevel: 'medium',
  },
  other: {
    name: 'Other Third-Party Tool',
    serviceDescription: 'Third-party service (details to be completed)',
    country: 'Unknown',
    crossBorderTransfer: false,
    riskLevel: 'medium',
  },
}

// ── Data asset seed catalogue ──────────────────────────────────────────────

interface AssetSeed {
  name: string
  description: string
  dataCategory: 'contact' | 'financial' | 'health' | 'employment' | 'children' | 'other'
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical'
  processingPurpose: string
}

const DATA_TYPE_ASSET_MAP: Record<string, AssetSeed> = {
  contact: {
    name: 'Customer Contact Data',
    description: 'Names, email addresses, phone numbers, and postal addresses of customers.',
    dataCategory: 'contact',
    sensitivityLevel: 'medium',
    processingPurpose: 'Service delivery, customer communication, and account management',
  },
  financial: {
    name: 'Customer Financial Data',
    description: 'Payment details, billing records, and transaction history.',
    dataCategory: 'financial',
    sensitivityLevel: 'high',
    processingPurpose: 'Payment processing and financial record-keeping',
  },
  health: {
    name: 'Client Health Information',
    description: 'Health, medical, and wellness-related personal information.',
    dataCategory: 'health',
    sensitivityLevel: 'critical',
    processingPurpose: 'Service delivery requiring health context',
  },
  employee: {
    name: 'Employee Records',
    description: 'HR records including employment history, payroll, and performance data.',
    dataCategory: 'employment',
    sensitivityLevel: 'high',
    processingPurpose: 'Human resources management and payroll',
  },
  children: {
    name: "Children's Personal Data",
    description: 'Personal information relating to individuals under 14 years of age.',
    dataCategory: 'children',
    sensitivityLevel: 'critical',
    processingPurpose: 'Service delivery where minors are involved',
  },
  other: {
    name: 'Other Personal Data',
    description: 'Additional personal information collected in the course of business.',
    dataCategory: 'other',
    sensitivityLevel: 'medium',
    processingPurpose: 'General business operations',
  },
}

// ── Serialization helpers ──────────────────────────────────────────────────

function serializeRisks(risks: unknown[]): Record<string, unknown>[] {
  return risks.map((r) => ({ ...(r as Record<string, unknown>) }))
}

function serializeSummary(summary: Record<string, unknown>): Record<string, unknown> {
  return { ...summary }
}

// ── Route handler ──────────────────────────────────────────────────────────

export const POST = withRequiredRole(['org_admin'], async (req: NextRequest, ctx) => {
  // 1. Parse + validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = onboardingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const input: OnboardingInput = parsed.data

  // 2. Guard: prevent re-running if already onboarded
  const existing = await getActivePrivacyProgram(ctx.orgId)
  if (existing?.onboardingCompletedAt) {
    return NextResponse.json(
      {
        success: false,
        error: 'Onboarding already completed for this organization.',
        completedAt: existing.onboardingCompletedAt.toISOString(),
      },
      { status: 409 },
    )
  }

  const actorId = ctx.userId
  const orgId = ctx.orgId

  // 3. Log onboarding_started evidence event
  const startEvent = await createTrustcoreEvidenceEvent({
    orgId,
    actorId,
    entityType: 'onboarding',
    resourceId: orgId,
    action: 'created',
    summary: 'Onboarding wizard started',
    metadata: { step: 'started', orgName: input.step1.orgName },
  })

  const createdIds: string[] = [startEvent.id]

  // 4. Create privacy program
  const now = new Date()
  const program = await createTrustcorePrivacyProgram({
    orgId,
    framework: 'law25',
    privacyOfficerName: input.step2.officerName,
    privacyOfficerEmail: input.step2.officerEmail,
    privacyOfficerRole: input.step2.officerTitle,
    publicContactEmail: input.step2.officerEmail,
    status: 'active',
    lastReviewedAt: now,
    onboardingCompletedAt: now,
  })
  createdIds.push(program.id)

  // 5. Seed data assets
  const assetIds: string[] = []
  if (input.step3.collectsPersonalData && input.step3.dataTypes.length > 0) {
    for (const dtype of input.step3.dataTypes) {
      const seed = DATA_TYPE_ASSET_MAP[dtype]
      if (!seed) continue
      const asset = await createTrustcoreDataAsset({
        orgId,
        name: seed.name,
        description: seed.description,
        dataCategory: seed.dataCategory,
        sensitivityLevel: seed.sensitivityLevel,
        processingPurpose: seed.processingPurpose,
        lawfulBasisOrConsentBasis: input.step5.collectsConsent ? 'Consent' : 'Legitimate interest',
        crossBorderTransfer: input.step3.storesOutsideCanada,
        destinationCountry: input.step3.storesOutsideCanada ? 'Multiple' : null,
        status: 'active',
      })
      assetIds.push(asset.id)
      createdIds.push(asset.id)
    }
  }

  // Always ensure ≥2 data assets for a meaningful compliance posture.
  // If no personal data types were selected, seed the two most common defaults.
  if (assetIds.length < 2) {
    const defaults: (keyof typeof DATA_TYPE_ASSET_MAP)[] = ['contact', 'employee']
    for (const dtype of defaults) {
      if (assetIds.length >= 2) break
      const seed = DATA_TYPE_ASSET_MAP[dtype]
      if (!seed) continue
      const asset = await createTrustcoreDataAsset({
        orgId,
        name: seed.name,
        description: seed.description,
        dataCategory: seed.dataCategory,
        sensitivityLevel: seed.sensitivityLevel,
        processingPurpose: seed.processingPurpose,
        lawfulBasisOrConsentBasis: 'Legitimate interest',
        crossBorderTransfer: false,
        destinationCountry: null,
        status: 'active',
      })
      assetIds.push(asset.id)
      createdIds.push(asset.id)
    }
  }

  // 6. Seed vendors
  const vendorIds: string[] = []
  if (input.step4.usesThirdPartyTools) {
    for (const vendorKey of input.step4.selectedVendors) {
      const seed = KNOWN_VENDOR_CATALOGUE[vendorKey]
      const vendor = await createTrustcoreVendor({
        orgId,
        name: seed.name,
        serviceDescription: seed.serviceDescription,
        country: seed.country,
        riskLevel: seed.riskLevel,
        crossBorderTransfer: seed.crossBorderTransfer,
        piaRequired: seed.riskLevel === 'high',
        contractReviewed: false,
        status: 'active',
      })
      vendorIds.push(vendor.id)
      createdIds.push(vendor.id)
    }

    // Free-text other vendors
    const others = input.step4.otherVendors
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const name of others) {
      const vendor = await createTrustcoreVendor({
        orgId,
        name,
        serviceDescription: 'Third-party service (details to be completed)',
        country: 'Unknown',
        riskLevel: 'medium',
        crossBorderTransfer: false,
        piaRequired: false,
        contractReviewed: false,
        status: 'pending_review',
      })
      vendorIds.push(vendor.id)
      createdIds.push(vendor.id)
    }
  }

  // 7. Seed consent record template
  if (input.step5.collectsConsent) {
    const consent = await createTrustcoreConsentRecord({
      orgId,
      purpose: 'General service delivery and communications',
      consentMethod: 'web_form',
      grantedAt: now,
      consentTextVersion: '1.0',
    })
    createdIds.push(consent.id)
  }

  // 8. Generate and store policies
  const [privacyPolicy, governancePolicy] = await Promise.all([
    generatePrivacyPolicy(input),
    generateDataGovernancePolicy(input),
  ])

  const [storedPrivacy, storedGovernance] = await Promise.all([
    createTrustcorePolicy({
      orgId,
      type: privacyPolicy.type,
      content: privacyPolicy.content,
      version: privacyPolicy.version,
      generatedBy: actorId,
    }),
    createTrustcorePolicy({
      orgId,
      type: governancePolicy.type,
      content: governancePolicy.content,
      version: governancePolicy.version,
      generatedBy: actorId,
    }),
  ])

  await createTrustcoreEvidenceEvent({
    orgId,
    actorId,
    entityType: 'policy',
    resourceId: storedPrivacy.id,
    action: 'created',
    summary: 'Privacy policy generated via onboarding wizard',
    metadata: { policyType: 'privacy_policy', version: 1 },
  })
  await createTrustcoreEvidenceEvent({
    orgId,
    actorId,
    entityType: 'policy',
    resourceId: storedGovernance.id,
    action: 'created',
    summary: 'Data governance policy generated via onboarding wizard',
    metadata: { policyType: 'data_governance', version: 1 },
  })

  createdIds.push(storedPrivacy.id, storedGovernance.id)

  // 9. Run compliance evaluation + persist initial snapshot
  const evaluation = await evaluateCompliance(orgId)

  const blockingCount = evaluation.risks.filter((r) => r.blocking).length
  const snapshot = await createComplianceSnapshot({
    orgId,
    score: evaluation.score,
    confidence: evaluation.confidence,
    status: evaluation.status,
    risks: serializeRisks(evaluation.risks),
    summary: serializeSummary(evaluation.summary as unknown as Record<string, unknown>),
    riskCount: evaluation.risks.length,
    blockingCount,
    triggeredBy: 'onboarding',
  })

  await createTrustcoreEvidenceEvent({
    orgId,
    actorId,
    entityType: 'compliance_snapshot',
    resourceId: snapshot.id,
    action: 'created',
    summary: `Initial compliance snapshot created — score ${evaluation.score}`,
    metadata: { score: evaluation.score, status: evaluation.status, triggeredBy: 'onboarding' },
  })

  // 10. Log onboarding_completed
  await createTrustcoreEvidenceEvent({
    orgId,
    actorId,
    entityType: 'onboarding',
    resourceId: orgId,
    action: 'submitted',
    summary: 'Onboarding wizard completed successfully',
    metadata: {
      programId: program.id,
      assetCount: assetIds.length,
      vendorCount: vendorIds.length,
      snapshotId: snapshot.id,
      initialScore: evaluation.score,
    },
  })

  // 11. Run reminder engine to generate initial Law 25 obligation reminders.
  //     Non-fatal: if reminder generation fails, onboarding is still complete.
  await generateTrustcoreReminders(orgId).catch(() => {})

  return NextResponse.json({
    success: true,
    programId: program.id,
    initialScore: evaluation.score,
    assetsCreated: assetIds.length,
    vendorsCreated: vendorIds.length,
    snapshotId: snapshot.id,
  })
})

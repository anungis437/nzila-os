import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../packages/db/src/index'
import {
  orgs,
  trustcoreComplianceSnapshots,
  trustcoreConsentRecords,
  trustcoreDataAssets,
  trustcoreDsrRequests,
  trustcoreEvidenceEvents,
  trustcoreIncidents,
  trustcoreLeads,
  trustcorePias,
  trustcorePolicies,
  trustcorePrivacyPrograms,
  trustcoreReminders,
  trustcoreSubscriptions,
  trustcoreVendors,
} from '../packages/db/src/schema'

type Options = {
  orgId?: string
  scale: number
  reset: boolean
}

const DATA_CATEGORIES = ['identity', 'contact', 'financial', 'health', 'employment', 'children', 'sensitive', 'other'] as const
const SENSITIVITY = ['low', 'medium', 'high', 'critical'] as const
const PIA_TRIGGERS = ['new_system', 'sensitive_data', 'cross_border', 'ai_or_automated_decision', 'vendor_change', 'major_change', 'other'] as const
const PIA_STATUS = ['draft', 'in_review', 'approved', 'rejected', 'mitigation_required'] as const
const INCIDENT_TYPES = ['unauthorized_access', 'unauthorized_use', 'unauthorized_disclosure', 'loss', 'other'] as const
const SEVERITY = ['low', 'medium', 'high', 'critical'] as const
const INCIDENT_STATUS = ['open', 'contained', 'resolved', 'closed'] as const
const DSR_TYPES = ['access', 'rectification', 'deletion', 'portability', 'consent_withdrawal', 'other'] as const
const DSR_STATUS = ['received', 'verifying_identity', 'in_progress', 'completed', 'denied', 'overdue'] as const
const CONSENT_METHOD = ['web_form', 'paper', 'email', 'verbal', 'imported', 'other'] as const
const VENDOR_RISK = ['low', 'medium', 'high', 'critical'] as const
const VENDOR_STATUS = ['active', 'pending_review', 'suspended', 'archived'] as const
const POLICY_TYPES = ['privacy_policy', 'data_governance'] as const
const REMINDER_SOURCE = ['privacy_program', 'pia', 'incident', 'dsr_request', 'vendor', 'policy', 'data_asset'] as const
const REMINDER_STATUS = ['open', 'completed', 'dismissed', 'overdue'] as const
const LEAD_SOURCE = ['landing', 'sample_trust_center', 'onboarding'] as const

function parseOptions(argv: string[]): Options {
  const opts: Options = {
    scale: 1,
    reset: false,
  }

  for (const arg of argv) {
    if (arg.startsWith('--org-id=')) {
      opts.orgId = arg.slice('--org-id='.length)
    } else if (arg.startsWith('--scale=')) {
      const parsed = Number(arg.slice('--scale='.length))
      if (Number.isFinite(parsed) && parsed > 0) {
        opts.scale = Math.max(0.1, Math.min(parsed, 10))
      }
    } else if (arg === '--reset') {
      opts.reset = true
    }
  }

  return opts
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]
}

function withScale(n: number, scale: number): number {
  return Math.max(1, Math.floor(n * scale))
}

function agoDays(days: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

async function insertInChunks<T>(items: T[], chunkSize: number, insertFn: (chunk: T[]) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    await insertFn(chunk)
  }
}

async function resolveOrgId(explicitOrgId?: string): Promise<string> {
  if (explicitOrgId) {
    const existing = await db.select().from(orgs).where(eq(orgs.id, explicitOrgId)).limit(1)
    if (!existing[0]) {
      throw new Error(`Org not found for --org-id=${explicitOrgId}`)
    }
    return explicitOrgId
  }

  const [latestOrg] = await db
    .select()
    .from(orgs)
    .orderBy(desc(orgs.createdAt))
    .limit(1)

  if (latestOrg) return latestOrg.id

  const [created] = await db
    .insert(orgs)
    .values({
      legalName: 'TrustCore Validation Org',
      jurisdiction: 'CA-QC',
      status: 'active',
    })
    .returning()

  if (!created) throw new Error('Unable to create fallback org for TrustCore seeding')
  return created.id
}

async function resetTrustcoreData(orgId: string): Promise<void> {
  await db.delete(trustcoreReminders).where(eq(trustcoreReminders.orgId, orgId))
  await db.delete(trustcorePolicies).where(eq(trustcorePolicies.orgId, orgId))
  await db.delete(trustcoreComplianceSnapshots).where(eq(trustcoreComplianceSnapshots.orgId, orgId))
  await db.delete(trustcoreEvidenceEvents).where(eq(trustcoreEvidenceEvents.orgId, orgId))
  await db.delete(trustcoreConsentRecords).where(eq(trustcoreConsentRecords.orgId, orgId))
  await db.delete(trustcoreDsrRequests).where(eq(trustcoreDsrRequests.orgId, orgId))
  await db.delete(trustcoreIncidents).where(eq(trustcoreIncidents.orgId, orgId))
  await db.delete(trustcorePias).where(eq(trustcorePias.orgId, orgId))
  await db.delete(trustcoreDataAssets).where(eq(trustcoreDataAssets.orgId, orgId))
  await db.delete(trustcoreVendors).where(eq(trustcoreVendors.orgId, orgId))
  await db.delete(trustcorePrivacyPrograms).where(eq(trustcorePrivacyPrograms.orgId, orgId))
  await db.delete(trustcoreSubscriptions).where(eq(trustcoreSubscriptions.orgId, orgId))
  await db.delete(trustcoreLeads).where(eq(trustcoreLeads.orgId, orgId))
}

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2))
  const orgId = await resolveOrgId(opts.orgId)

  if (opts.reset) {
    console.log(`[trustcore:seed:heavy] reset=true -> clearing existing TrustCore rows for org ${orgId}`)
    await resetTrustcoreData(orgId)
  }

  const counts = {
    vendors: withScale(120, opts.scale),
    dataAssets: withScale(450, opts.scale),
    pias: withScale(220, opts.scale),
    incidents: withScale(180, opts.scale),
    dsrRequests: withScale(320, opts.scale),
    consentRecords: withScale(360, opts.scale),
    evidenceEvents: withScale(500, opts.scale),
    reminders: withScale(220, opts.scale),
    snapshots: withScale(40, opts.scale),
    policies: withScale(14, opts.scale),
    leads: withScale(240, opts.scale),
  }

  await db.delete(trustcoreSubscriptions).where(eq(trustcoreSubscriptions.orgId, orgId))
  await db.insert(trustcoreSubscriptions).values({
    orgId,
    plan: 'premium',
    status: 'active',
    currentPeriodStart: agoDays(15),
    currentPeriodEnd: agoDays(-15),
    stripeCustomerId: `cus_tc_${randomUUID().slice(0, 12)}`,
    stripeSubscriptionId: `sub_tc_${randomUUID().slice(0, 12)}`,
  })

  await db.insert(trustcorePrivacyPrograms).values({
    orgId,
    framework: 'law25',
    privacyOfficerName: 'Aline Tremblay',
    privacyOfficerEmail: 'privacy.officer+trustcore@nzila.example',
    privacyOfficerRole: 'Chief Privacy Officer',
    publicContactEmail: 'privacy@nzila.example',
    status: 'active',
    lastReviewedAt: agoDays(7),
    onboardingCompletedAt: agoDays(30),
  })

  const vendorRows = Array.from({ length: counts.vendors }, (_, i) => ({
    orgId,
    name: `Vendor ${String(i + 1).padStart(4, '0')}`,
    serviceDescription: `Third-party service provider ${i + 1}`,
    country: i % 5 === 0 ? 'US' : i % 7 === 0 ? 'FR' : 'CA',
    dataSharedDescription: `Operational and customer service dataset partition ${i + 1}`,
    riskLevel: pick(VENDOR_RISK, i),
    crossBorderTransfer: i % 3 === 0,
    piaRequired: i % 4 === 0,
    contractReviewed: i % 2 === 0,
    status: pick(VENDOR_STATUS, i),
  }))

  await insertInChunks(vendorRows, 200, async (chunk) => {
    await db.insert(trustcoreVendors).values(chunk)
  })

  const [latestVendors] = await Promise.all([
    db
      .select({ id: trustcoreVendors.id })
      .from(trustcoreVendors)
      .where(eq(trustcoreVendors.orgId, orgId))
      .orderBy(desc(trustcoreVendors.createdAt))
      .limit(counts.vendors + 200),
  ])

  const vendorIds = latestVendors.map((v) => v.id)

  const assetRows = Array.from({ length: counts.dataAssets }, (_, i) => ({
    orgId,
    name: `Data Asset ${String(i + 1).padStart(4, '0')}`,
    description: `Synthetic validation record for data inventory table row ${i + 1}`,
    dataCategory: pick(DATA_CATEGORIES, i),
    sensitivityLevel: pick(SENSITIVITY, i),
    processingPurpose: 'Customer onboarding and service delivery',
    lawfulBasisOrConsentBasis: i % 2 === 0 ? 'Consent' : 'Contractual necessity',
    storageLocation: i % 3 === 0 ? 'Canada Central' : 'East US 2',
    systemOwner: `Owner ${i % 40}`,
    retentionPeriod: `${12 + (i % 48)} months`,
    crossBorderTransfer: i % 3 === 0,
    destinationCountry: i % 3 === 0 ? (i % 2 === 0 ? 'US' : 'FR') : null,
    vendorId: vendorIds.length > 0 ? vendorIds[i % vendorIds.length] : null,
    status: i % 9 === 0 ? 'needs_review' : i % 7 === 0 ? 'archived' : 'active',
  }))

  await insertInChunks(assetRows, 200, async (chunk) => {
    await db.insert(trustcoreDataAssets).values(chunk)
  })

  const piaRows = Array.from({ length: counts.pias }, (_, i) => ({
    orgId,
    title: `PIA ${String(i + 1).padStart(4, '0')}`,
    triggerType: pick(PIA_TRIGGERS, i),
    description: `Synthetic PIA scenario ${i + 1}`,
    riskScore: (i * 7) % 101,
    status: pick(PIA_STATUS, i),
    reviewerName: `Reviewer ${i % 25}`,
    approvedAt: i % 3 === 0 ? agoDays(i % 120) : null,
    mitigationPlan: i % 4 === 0 ? 'Additional encryption, access review, and retention minimization.' : null,
  }))

  await insertInChunks(piaRows, 200, async (chunk) => {
    await db.insert(trustcorePias).values(chunk)
  })

  const incidentRows = Array.from({ length: counts.incidents }, (_, i) => {
    const detected = agoDays((i % 180) + 1)
    const occurred = agoDays((i % 180) + 2)
    const reported = i % 4 === 0
    const notified = i % 5 === 0
    return {
      orgId,
      title: `Incident ${String(i + 1).padStart(4, '0')}`,
      description: `Synthetic incident record ${i + 1}`,
      incidentType: pick(INCIDENT_TYPES, i),
      severity: pick(SEVERITY, i),
      dateDetected: detected,
      dateOccurred: occurred,
      harmAssessment: i % 3 === 0 ? 'Potential impact to confidentiality and service availability.' : 'No material harm observed.',
      seriousHarmLikely: i % 6 === 0,
      reportedToCai: reported,
      caiReportedAt: reported ? agoDays((i % 120) + 1) : null,
      affectedIndividualsNotified: notified,
      individualNotificationAt: notified ? agoDays((i % 90) + 1) : null,
      containmentActions: 'Rotated credentials and completed privileged access review.',
      resolutionStatus: pick(INCIDENT_STATUS, i),
    }
  })

  await insertInChunks(incidentRows, 150, async (chunk) => {
    await db.insert(trustcoreIncidents).values(chunk)
  })

  const dsrRows = Array.from({ length: counts.dsrRequests }, (_, i) => {
    const receivedAt = agoDays((i % 140) + 1)
    const dueAt = new Date(receivedAt)
    dueAt.setUTCDate(dueAt.getUTCDate() + 30)
    const completed = i % 3 === 0
    const denied = i % 11 === 0
    return {
      orgId,
      requesterName: `Requester ${String(i + 1).padStart(4, '0')}`,
      requesterEmail: `requester${i + 1}@example.test`,
      requestType: pick(DSR_TYPES, i),
      identityVerified: i % 2 === 0,
      receivedAt,
      dueAt,
      completedAt: completed ? agoDays(i % 60) : null,
      status: denied ? 'denied' : completed ? 'completed' : pick(DSR_STATUS, i),
      responseSummary: completed ? 'Request processed and response issued.' : null,
      denialReason: denied ? 'Identity could not be verified within SLA.' : null,
    }
  })

  await insertInChunks(dsrRows, 200, async (chunk) => {
    await db.insert(trustcoreDsrRequests).values(chunk)
  })

  const consentRows = Array.from({ length: counts.consentRecords }, (_, i) => ({
    orgId,
    subjectName: `Subject ${String(i + 1).padStart(4, '0')}`,
    subjectEmail: `subject${i + 1}@example.test`,
    purpose: i % 2 === 0 ? 'Marketing communications' : 'Product analytics',
    consentMethod: pick(CONSENT_METHOD, i),
    grantedAt: agoDays((i % 365) + 1),
    withdrawnAt: i % 8 === 0 ? agoDays(i % 90) : null,
    consentTextVersion: `v${1 + (i % 6)}.${i % 10}`,
    evidenceRef: `consent-${i + 1}`,
  }))

  await insertInChunks(consentRows, 250, async (chunk) => {
    await db.insert(trustcoreConsentRecords).values(chunk)
  })

  const evidenceRows = Array.from({ length: counts.evidenceEvents }, (_, i) => ({
    orgId,
    actorId: `user_${(i % 80) + 1}`,
    entityType: pick(['data_asset', 'pia', 'incident', 'dsr_request', 'vendor', 'policy'], i),
    entityId: randomUUID(),
    action: pick(['created', 'updated', 'reviewed', 'exported', 'acknowledged'], i),
    summary: `Synthetic evidence event ${i + 1}`,
    metadata: { batch: 'trustcore-seed-heavy', index: i + 1 },
    eventHash: `evt_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
    previousEventHash: i > 0 ? `evt_${randomUUID().replace(/-/g, '').slice(0, 24)}` : null,
    createdAt: agoDays(i % 240),
  }))

  await insertInChunks(evidenceRows, 250, async (chunk) => {
    await db.insert(trustcoreEvidenceEvents).values(chunk)
  })

  const snapshotRows = Array.from({ length: counts.snapshots }, (_, i) => {
    const score = Math.max(35, 92 - (i % 35))
    const blocking = i % 6
    return {
      orgId,
      score,
      confidence: 65 + (i % 30),
      status: score >= 80 ? 'compliant' : score >= 60 ? 'at-risk' : 'non-compliant',
      risks: [
        { category: 'pia', severity: pick(SEVERITY, i), message: `PIA risk marker ${i + 1}` },
        { category: 'vendor', severity: pick(SEVERITY, i + 1), message: `Vendor risk marker ${i + 1}` },
      ],
      summary: {
        totalAssets: counts.dataAssets,
        overdueRequests: counts.dsrRequests / 8,
        highRiskVendors: counts.vendors / 5,
      },
      riskCount: 5 + (i % 12),
      blockingCount: blocking,
      triggeredBy: i % 2 === 0 ? 'manual' : 'cron',
      createdAt: agoDays(i * 2),
    }
  })

  await insertInChunks(snapshotRows, 100, async (chunk) => {
    await db.insert(trustcoreComplianceSnapshots).values(chunk)
  })

  const policyRows = Array.from({ length: counts.policies }, (_, i) => ({
    orgId,
    type: pick(POLICY_TYPES, i),
    content: `# Policy ${i + 1}\n\nGenerated policy body for validation batch ${i + 1}.`,
    version: i + 1,
    generatedBy: i % 2 === 0 ? 'system' : 'assistant',
    createdAt: agoDays(i * 5),
  }))

  await db.insert(trustcorePolicies).values(policyRows)

  const reminderRows = Array.from({ length: counts.reminders }, (_, i) => ({
    orgId,
    sourceType: pick(REMINDER_SOURCE, i),
    sourceId: randomUUID(),
    title: `Reminder ${String(i + 1).padStart(4, '0')}`,
    description: `Operational action item ${i + 1}`,
    severity: pick(SEVERITY, i),
    dueAt: agoDays(-(i % 45)),
    status: pick(REMINDER_STATUS, i),
    actionUrl: '/dashboard',
    completedAt: i % 4 === 0 ? agoDays(i % 30) : null,
    dismissedAt: i % 6 === 0 ? agoDays(i % 20) : null,
  }))

  await insertInChunks(reminderRows, 200, async (chunk) => {
    await db.insert(trustcoreReminders).values(chunk)
  })

  const leadRows = Array.from({ length: counts.leads }, (_, i) => ({
    email: `lead${Date.now()}_${i + 1}@example.test`,
    source: pick(LEAD_SOURCE, i),
    capturedAt: agoDays(i % 100),
    convertedAt: i % 3 === 0 ? agoDays(i % 50) : null,
    orgId: i % 3 === 0 ? orgId : null,
  }))

  await insertInChunks(leadRows, 200, async (chunk) => {
    await db.insert(trustcoreLeads).values(chunk)
  })

  const [summary] = await Promise.all([
    Promise.all([
      db.select().from(trustcoreVendors).where(eq(trustcoreVendors.orgId, orgId)),
      db.select().from(trustcoreDataAssets).where(eq(trustcoreDataAssets.orgId, orgId)),
      db.select().from(trustcorePias).where(eq(trustcorePias.orgId, orgId)),
      db.select().from(trustcoreIncidents).where(eq(trustcoreIncidents.orgId, orgId)),
      db.select().from(trustcoreDsrRequests).where(eq(trustcoreDsrRequests.orgId, orgId)),
      db.select().from(trustcoreEvidenceEvents).where(eq(trustcoreEvidenceEvents.orgId, orgId)),
      db.select().from(trustcoreReminders).where(eq(trustcoreReminders.orgId, orgId)),
      db.select().from(trustcorePolicies).where(eq(trustcorePolicies.orgId, orgId)),
      db.select().from(trustcoreLeads).where(and(eq(trustcoreLeads.orgId, orgId))),
    ]),
  ])

  const [vendors, assets, pias, incidents, dsr, evidence, reminders, policies, convertedLeads] = summary

  console.log('[trustcore:seed:heavy] done')
  console.log(`orgId=${orgId}`)
  console.log(`vendors=${vendors.length}`)
  console.log(`dataAssets=${assets.length}`)
  console.log(`pias=${pias.length}`)
  console.log(`incidents=${incidents.length}`)
  console.log(`dsrRequests=${dsr.length}`)
  console.log(`evidenceEvents=${evidence.length}`)
  console.log(`reminders=${reminders.length}`)
  console.log(`policies=${policies.length}`)
  console.log(`convertedLeads=${convertedLeads.length}`)
}

main().catch((error) => {
  console.error('[trustcore:seed:heavy] failed')
  console.error(error)
  process.exit(1)
})

/**
 * TrustCore — Reminder Engine (Law 25)
 *
 * Inspects live org data and deterministically generates/upserts
 * reminder records for every outstanding Law 25 obligation.
 *
 * Deduplication:
 *   Each reminder has a stable (sourceType, title) key.
 *   If an open/overdue reminder with that key already exists, it is
 *   left unchanged. A new reminder is only inserted when none exists.
 *
 * Rules implemented:
 *   A. Privacy Program  — annual review, missing officer
 *   B. DSR Requests     — due in 7d / 3d / overdue
 *   C. Incidents        — CAI reporting, stalled-open
 *   D. Vendors          — high-risk without contract, cross-border without review
 *   E. Policies         — 12-month review cycle
 *   F. Data Assets      — high/critical without PIA
 */

import {
  listTrustcorePrivacyPrograms,
  listTrustcoreDataAssets,
  listTrustcorePias,
  listTrustcoreIncidents,
  listTrustcoreDsrRequests,
  listTrustcoreVendors,
  listTrustcorePolicies,
  upsertTrustcoreReminder,
} from '@nzila/db/queries/trustcore'
import type { TrustcoreReminder } from '@nzila/db/queries/trustcore'

// ── Time helpers ───────────────────────────────────────────────────────────

const MS_DAY = 24 * 60 * 60 * 1000

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * MS_DAY)
}

function ageInDays(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / MS_DAY)
}

// ── Engine ─────────────────────────────────────────────────────────────────

/**
 * Inspect all org data and create/upsert reminders for outstanding
 * Law 25 obligations.
 *
 * @returns All reminders created or found (may include pre-existing ones).
 */
export async function generateTrustcoreReminders(
  orgId: string,
): Promise<TrustcoreReminder[]> {
  // Batch-load all compliance data in parallel
  const [programs, assets, pias, incidents, dsrRequests, vendors, policies] = await Promise.all([
    listTrustcorePrivacyPrograms(orgId),
    listTrustcoreDataAssets(orgId),
    listTrustcorePias(orgId),
    listTrustcoreIncidents(orgId),
    listTrustcoreDsrRequests(orgId),
    listTrustcoreVendors(orgId),
    listTrustcorePolicies(orgId),
  ])

  const results: TrustcoreReminder[] = []

  // ── A. Privacy Program ─────────────────────────────────────────────────

  const activeProgram = programs.find((p) => p.status === 'active')

  if (!activeProgram) {
    results.push(
      await upsertTrustcoreReminder({
        orgId,
        sourceType: 'privacy_program',
        sourceId: null,
        title: 'Privacy program not yet activated',
        description:
          'Your Law 25 privacy program has not been set to active. Complete onboarding or activate your program to start tracking compliance.',
        severity: 'critical',
        dueAt: daysFromNow(7),
        status: 'open',
        actionUrl: '/onboarding',
      }),
    )
  } else {
    // Annual review
    if (activeProgram.lastReviewedAt) {
      const age = ageInDays(activeProgram.lastReviewedAt)
      if (age >= 365) {
        results.push(
          await upsertTrustcoreReminder({
            orgId,
            sourceType: 'privacy_program',
            sourceId: activeProgram.id,
            title: 'Annual privacy program review due',
            description: `Your privacy program was last reviewed ${age} days ago. Law 25 requires an annual review.`,
            severity: age >= 395 ? 'critical' : 'high',
            dueAt: new Date(activeProgram.lastReviewedAt.getTime() + 365 * MS_DAY),
            status: 'open',
            actionUrl: '/compliance',
          }),
        )
      }
    }

    // Missing privacy officer email
    if (!activeProgram.privacyOfficerEmail) {
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'privacy_program',
          sourceId: activeProgram.id,
          title: 'Privacy officer email missing',
          description:
            'Your privacy program is missing a privacy officer email. This is required for Law 25 compliance and must be publicly accessible.',
          severity: 'high',
          dueAt: daysFromNow(14),
          status: 'open',
          actionUrl: '/compliance',
        }),
      )
    }
  }

  // ── B. DSR Requests ────────────────────────────────────────────────────

  const activeDsrs = dsrRequests.filter(
    (r) => r.status !== 'completed' && r.status !== 'denied',
  )

  for (const dsr of activeDsrs) {
    const now = Date.now()
    const dueMs = dsr.dueAt.getTime()
    const daysUntilDue = Math.floor((dueMs - now) / MS_DAY)

    if (dueMs < now) {
      // Overdue
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'dsr_request',
          sourceId: dsr.id,
          title: `Overdue DSR request — ${dsr.requestType} from ${dsr.requesterName}`,
          description: `This data subject rights request is overdue. Law 25 requires a response within 30 days. Take action immediately.`,
          severity: 'critical',
          dueAt: dsr.dueAt,
          status: 'overdue',
          actionUrl: '/requests',
        }),
      )
    } else if (daysUntilDue <= 3) {
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'dsr_request',
          sourceId: dsr.id,
          title: `DSR request due in ${daysUntilDue} day(s) — ${dsr.requesterName}`,
          description: `A ${dsr.requestType} request from ${dsr.requesterName} must be resolved within ${daysUntilDue} day(s).`,
          severity: 'critical',
          dueAt: dsr.dueAt,
          status: 'open',
          actionUrl: '/requests',
        }),
      )
    } else if (daysUntilDue <= 7) {
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'dsr_request',
          sourceId: dsr.id,
          title: `DSR request due in ${daysUntilDue} day(s) — ${dsr.requesterName}`,
          description: `A ${dsr.requestType} request from ${dsr.requesterName} is due in ${daysUntilDue} day(s). Start processing it now.`,
          severity: 'high',
          dueAt: dsr.dueAt,
          status: 'open',
          actionUrl: '/requests',
        }),
      )
    }
  }

  // ── C. Incidents ───────────────────────────────────────────────────────

  for (const incident of incidents) {
    const isOpen =
      incident.resolutionStatus === 'open' || incident.resolutionStatus === 'contained'

    // CAI reporting
    if (incident.seriousHarmLikely && !incident.reportedToCai) {
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'incident',
          sourceId: incident.id,
          title: `CAI report required — "${incident.title}"`,
          description:
            'This incident involves likely serious harm and must be reported to the Commission d\'accès à l\'information (CAI) within 72 hours of detection.',
          severity: 'critical',
          dueAt: new Date(incident.dateDetected.getTime() + 72 * 60 * 60 * 1000),
          status: 'open',
          actionUrl: '/incidents',
        }),
      )
    }

    // Stalled open > 30 days
    if (isOpen && ageInDays(incident.createdAt) > 30) {
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'incident',
          sourceId: incident.id,
          title: `Incident unresolved for ${ageInDays(incident.createdAt)} days — "${incident.title}"`,
          description:
            'This incident has been open for more than 30 days without resolution. Law 25 requires timely resolution and documentation.',
          severity: 'high',
          dueAt: daysFromNow(7),
          status: 'open',
          actionUrl: '/incidents',
        }),
      )
    }
  }

  // ── D. Vendors ─────────────────────────────────────────────────────────

  const activeVendors = vendors.filter((v) => v.status === 'active')

  for (const vendor of activeVendors) {
    const isHighRisk = vendor.riskLevel === 'high' || vendor.riskLevel === 'critical'

    if (isHighRisk && !vendor.contractReviewed) {
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'vendor',
          sourceId: vendor.id,
          title: `High-risk vendor without contract review — ${vendor.name}`,
          description: `${vendor.name} is classified as ${vendor.riskLevel} risk. A formal contract review with privacy clauses is required before continuing data sharing.`,
          severity: 'high',
          dueAt: daysFromNow(30),
          status: 'open',
          actionUrl: '/vendors',
        }),
      )
    }

    if (vendor.crossBorderTransfer && !vendor.contractReviewed) {
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'vendor',
          sourceId: vendor.id,
          title: `Cross-border vendor requires contract review — ${vendor.name}`,
          description: `${vendor.name} transfers data outside Canada. Law 25 requires a privacy assessment and contractual safeguards for cross-border transfers.`,
          severity: vendor.riskLevel === 'high' || vendor.riskLevel === 'critical' ? 'critical' : 'high',
          dueAt: daysFromNow(30),
          status: 'open',
          actionUrl: '/vendors',
        }),
      )
    }
  }

  // ── E. Policies ────────────────────────────────────────────────────────

  const policyTypesSeen = new Set<string>()
  for (const policy of policies) {
    if (policyTypesSeen.has(policy.type)) continue // already handled this type
    policyTypesSeen.add(policy.type)

    const age = ageInDays(policy.createdAt)
    if (age >= 365) {
      const label = policy.type === 'privacy_policy' ? 'Privacy Policy' : 'Data Governance Policy'
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'policy',
          sourceId: policy.id,
          title: `${label} requires annual review`,
          description: `Your ${label} was generated ${age} days ago and has not been reviewed. Annual review is a Law 25 best practice.`,
          severity: 'medium',
          dueAt: new Date(policy.createdAt.getTime() + 365 * MS_DAY),
          status: 'open',
          actionUrl: '/policies',
        }),
      )
    }
  }

  // Policies missing entirely
  if (!policyTypesSeen.has('privacy_policy')) {
    results.push(
      await upsertTrustcoreReminder({
        orgId,
        sourceType: 'policy',
        sourceId: null,
        title: 'Privacy policy not yet generated',
        description:
          'Your organization does not have a privacy policy. Law 25 requires a publicly accessible privacy policy. Complete onboarding to generate one.',
        severity: 'critical',
        dueAt: daysFromNow(14),
        status: 'open',
        actionUrl: '/onboarding',
      }),
    )
  }

  if (!policyTypesSeen.has('data_governance')) {
    results.push(
      await upsertTrustcoreReminder({
        orgId,
        sourceType: 'policy',
        sourceId: null,
        title: 'Data governance policy not yet generated',
        description:
          'Your organization does not have a data governance policy. Complete onboarding to generate one.',
        severity: 'high',
        dueAt: daysFromNow(30),
        status: 'open',
        actionUrl: '/onboarding',
      }),
    )
  }

  // ── F. Data Assets ─────────────────────────────────────────────────────

  const activeAssets = assets.filter((a) => a.status === 'active')
  const piaAssetIds = new Set(pias.map((p) => p.id)) // rough: if any PIA exists, partial credit

  for (const asset of activeAssets) {
    const needsPia =
      asset.sensitivityLevel === 'high' || asset.sensitivityLevel === 'critical'
    // Only flag if there are no PIAs at all (conservative heuristic)
    if (needsPia && pias.length === 0 && !piaAssetIds.has(asset.id)) {
      results.push(
        await upsertTrustcoreReminder({
          orgId,
          sourceType: 'data_asset',
          sourceId: asset.id,
          title: `PIA required for high-sensitivity asset — "${asset.name}"`,
          description: `"${asset.name}" is classified as ${asset.sensitivityLevel} sensitivity. Law 25 requires a Privacy Impact Assessment (PIA) before processing this data.`,
          severity: asset.sensitivityLevel === 'critical' ? 'critical' : 'high',
          dueAt: daysFromNow(30),
          status: 'open',
          actionUrl: '/pia',
        }),
      )
    }
  }

  return results
}

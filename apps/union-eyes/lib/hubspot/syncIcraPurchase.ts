/**
 * ICRA → HubSpot purchase sync.
 *
 * Called when a paid ICRA report tier has been fulfilled (i.e. the Stripe
 * webhook has already upgraded the assessment in our DB). Responsibility:
 *
 * 1. Load the assessment + maturity profile from the DB.
 * 2. Upsert a HubSpot contact carrying the organizational posture (deterministic
 *    custom properties — no behavioural enrichment).
 * 3. Create a deal in the OCI continuity pipeline at the appropriate stage
 *    so account stewards can engage with context, not cold outreach.
 *
 * Non-blocking & non-surveillance contract:
 *   • Returns `{ skipped: 'no_email' }` when no voluntarily-provided email is
 *     attached to the assessment. NEVER scrapes, infers, or auto-resolves an
 *     identity.
 *   • Returns `{ skipped: 'crm_disabled' }` when HUBSPOT_API_KEY is unset.
 *   • All exceptions are caught and logged; the function never throws upstream.
 *     Stripe fulfilment, PDF delivery, and assessment flow are sacred — they
 *     must not be affected by CRM availability.
 *   • Request/response bodies are never logged. Only opaque identifiers.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { icraAssessments, icraMaturityProfiles } from '@/db/schema/icra-schema';
import type {
  ExecutivePersonaId,
  OrganizationalContinuityProfile,
  ReportTierId,
} from '@/lib/icra/types';
import { logger } from '@/lib/logger';
import { upsertContact, createDeal } from '@/lib/services/crm-service';
import {
  ICRA_DEAL_STAGES,
  ICRA_DEAL_STAGE_LABELS,
  REPORT_TIER_LABELS,
  buildContactProperties,
  buildCompanyProperties,
  type IcraContactAttribution,
  type IcraDealStageKey,
} from './icraPropertyMapper';
import { deriveOcraAdaptivePropertiesFromPersisted } from './icraAdaptiveProperties';
import { resolveAdaptiveContext } from '@/lib/icra/adaptation';
import { ALL_QUESTIONS, QUESTION_BANK_VERSION } from '@/lib/icra/questions';
import type { RoutableQuestion } from '@/lib/icra/adaptation';

export type SyncSkipReason =
  | 'no_email'
  | 'crm_disabled'
  | 'assessment_missing'
  | 'profile_missing';

export interface SyncIcraPurchaseInput {
  assessmentId: string;
  tierId: ReportTierId;
  /** Stripe payment intent id (or session id) — recorded as deal external ref. */
  paymentReference?: string;
  /** Amount in major units (e.g. CAD). Optional — recorded on the deal if present. */
  amount?: number;
  /** Voluntarily provided contact email. Required for any sync. */
  email?: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  persona?: ExecutivePersonaId;
  attribution?: IcraContactAttribution;
}

export type SyncIcraPurchaseResult =
  | { ok: true; contactId: string | null; dealId: string | null; stage: IcraDealStageKey }
  | { ok: false; skipped: SyncSkipReason };

function tierToStage(tier: ReportTierId): IcraDealStageKey {
  switch (tier) {
    case 'institutional_continuity_diagnostic':
      return 'diagnostic_interest';
    case 'executive_continuity_brief':
      return 'brief_purchased';
    case 'continuity_reflection':
    default:
      return 'reflection_completed';
  }
}

/**
 * Sync an ICRA report purchase into HubSpot.
 *
 * Safe to call as fire-and-forget; never throws. The caller — typically the
 * Stripe webhook — should ignore the return value and continue execution.
 */
export async function syncIcraPurchase(
  input: SyncIcraPurchaseInput,
): Promise<SyncIcraPurchaseResult> {
  try {
    if (!input.email) {
      return { ok: false, skipped: 'no_email' };
    }
    if (!process.env.HUBSPOT_API_KEY) {
      return { ok: false, skipped: 'crm_disabled' };
    }

    // Load assessment + profile (read-only)
    const [assessment] = await db
      .select({
        id: icraAssessments.id,
        reportTierId: icraAssessments.reportTierId,
        organizationContext: icraAssessments.organizationContext,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, input.assessmentId))
      .limit(1);

    if (!assessment) {
      logger.warn('[hubspot-icra] assessment missing for purchase sync', {
        assessmentId: input.assessmentId,
      });
      return { ok: false, skipped: 'assessment_missing' };
    }

    const [profileRow] = await db
      .select({ profilePayload: icraMaturityProfiles.profilePayload })
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, input.assessmentId))
      .limit(1);

    if (!profileRow?.profilePayload) {
      logger.warn('[hubspot-icra] profile missing for purchase sync', {
        assessmentId: input.assessmentId,
      });
      return { ok: false, skipped: 'profile_missing' };
    }

    const profile = profileRow.profilePayload as OrganizationalContinuityProfile;

    // Resolve adaptive context — persisted blob, or reconstructed deterministically
    // from declared org form. Failure is non-fatal: HubSpot sync proceeds with
    // legacy properties only.
    let adaptiveProperties: Record<string, string> = {};
    try {
      const resolution = resolveAdaptiveContext({
        organizationContext: assessment.organizationContext,
        questionBank: ALL_QUESTIONS as unknown as RoutableQuestion[],
        currentQuestionBankVersion: QUESTION_BANK_VERSION,
      });
      const raw = deriveOcraAdaptivePropertiesFromPersisted(
        resolution.adaptiveContext,
      ) as Record<string, string | number | boolean>;
      adaptiveProperties = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, String(v)]),
      );
    } catch (adaptiveErr) {
      logger.warn('[hubspot-icra] adaptive property derivation skipped', {
        assessmentId: input.assessmentId,
        message:
          adaptiveErr instanceof Error ? adaptiveErr.message : String(adaptiveErr),
      });
    }

    const contactProperties = {
      ...buildContactProperties(profile, {
        persona: input.persona,
        attribution: input.attribution,
      }),
      // Company-grade properties also useful on the contact when no company exists
      ...buildCompanyProperties(profile),
      // OCRA adaptive bands + counts (low-cardinality, audit-safe)
      ...adaptiveProperties,
    };

    const contactId = await upsertContact({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.organizationName,
      properties: contactProperties,
    });

    const stage = tierToStage(input.tierId);
    const dealName = input.organizationName
      ? `${input.organizationName} — ${REPORT_TIER_LABELS[input.tierId]}`
      : `${REPORT_TIER_LABELS[input.tierId]} — ${input.email}`;

    const dealProperties: Record<string, string> = {
      oci_assessment_id: input.assessmentId,
      oci_report_tier: REPORT_TIER_LABELS[input.tierId],
      oci_pipeline_stage_label: ICRA_DEAL_STAGE_LABELS[stage],
    };
    if (input.paymentReference) {
      dealProperties.oci_payment_reference = input.paymentReference;
    }

    const dealId = await createDeal({
      name: dealName,
      stage: ICRA_DEAL_STAGES[stage],
      amount: input.amount,
      contactId: contactId ?? undefined,
      properties: dealProperties,
    });

    logger.info('[hubspot-icra] purchase sync completed', {
      assessmentId: input.assessmentId,
      tierId: input.tierId,
      stage,
      contactId,
      dealId,
    });

    return { ok: true, contactId, dealId, stage };
  } catch (err) {
    // Non-blocking contract: never throw upstream. Stripe fulfilment is sacred.
    logger.error('[hubspot-icra] purchase sync failed', {
      assessmentId: input.assessmentId,
      tierId: input.tierId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, skipped: 'crm_disabled' };
  }
}

/**
 * Workbook \u2192 HubSpot purchase sync.
 *
 * Called from the Stripe webhook after a Self-Guided Workbook has been
 * provisioned. Mirrors syncIcraPurchase: non-blocking, never throws,
 * respects the anti-surveillance contract documented in
 * workbookPropertyMapper.ts.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workbookMemoryHolders, workbooks } from '@/db/schema/workbook-schema';
import { runStewardshipCartography } from '@/lib/workbook/engines/stewardshipCartography';
import { logger } from '@/lib/logger';
import { createDeal, upsertContact } from '@/lib/services/crm-service';
import {
  WORKBOOK_DEAL_STAGE_LABELS,
  WORKBOOK_DEAL_STAGES,
  WORKBOOK_TIER_LABELS,
  buildWorkbookCompanyProperties,
  buildWorkbookContactProperties,
  workbookTierToStage,
  type WorkbookAttribution,
  type WorkbookDealStageKey,
  type WorkbookTierKey,
} from './workbookPropertyMapper';

export type WorkbookSyncSkipReason = 'no_email' | 'crm_disabled' | 'workbook_missing';

export interface SyncWorkbookPurchaseInput {
  workbookId: string;
  tier: WorkbookTierKey;
  paymentReference?: string;
  amount?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  attribution?: WorkbookAttribution;
}

export type SyncWorkbookPurchaseResult =
  | { ok: true; contactId: string | null; dealId: string | null; stage: WorkbookDealStageKey }
  | { ok: false; skipped: WorkbookSyncSkipReason };

export async function syncWorkbookPurchase(
  input: SyncWorkbookPurchaseInput,
): Promise<SyncWorkbookPurchaseResult> {
  try {
    if (!input.email) {
      return { ok: false, skipped: 'no_email' };
    }
    if (!process.env.HUBSPOT_API_KEY) {
      return { ok: false, skipped: 'crm_disabled' };
    }

    const [wb] = await db
      .select({ id: workbooks.id })
      .from(workbooks)
      .where(eq(workbooks.id, input.workbookId))
      .limit(1);

    if (!wb) {
      logger.warn('[hubspot-workbook] workbook missing for purchase sync', {
        workbookId: input.workbookId,
      });
      return { ok: false, skipped: 'workbook_missing' };
    }

    // Aggregate cartography \u2014 deterministic, no PII.
    const holders = await db
      .select({
        id: workbookMemoryHolders.id,
        role: workbookMemoryHolders.role,
        tenureBand: workbookMemoryHolders.tenureBand,
        criticality: workbookMemoryHolders.criticality,
        successorIdentified: workbookMemoryHolders.successorIdentified,
      })
      .from(workbookMemoryHolders)
      .where(eq(workbookMemoryHolders.workbookId, input.workbookId));

    const cartography = runStewardshipCartography(
      holders.map((h) => ({
        id: h.id,
        role: h.role,
        criticality: h.criticality as
          | 'routine'
          | 'important'
          | 'load_bearing'
          | 'institution_critical'
          | null,
        tenureBand: h.tenureBand as '0_3y' | '3_7y' | '7_15y' | '15y_plus' | null,
        successorIdentified: h.successorIdentified,
      })),
    );

    const contactProperties = {
      ...buildWorkbookContactProperties({
        tier: input.tier,
        attribution: input.attribution,
      }),
      ...buildWorkbookCompanyProperties({
        cartography,
        modulesComplete: 0,
        totalModules: 6,
        lastActivityAt: new Date(),
      }),
    };

    const contactId = await upsertContact({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.organizationName,
      properties: contactProperties,
    });

    const stage = workbookTierToStage(input.tier);
    const dealName = input.organizationName
      ? `${input.organizationName} \u2014 ${WORKBOOK_TIER_LABELS[input.tier]}`
      : `${WORKBOOK_TIER_LABELS[input.tier]} \u2014 ${input.email}`;

    const dealProperties: Record<string, string> = {
      oci_workbook_id: input.workbookId,
      oci_workbook_tier: WORKBOOK_TIER_LABELS[input.tier],
      oci_pipeline_stage_label: WORKBOOK_DEAL_STAGE_LABELS[stage],
    };
    if (input.paymentReference) {
      dealProperties.oci_payment_reference = input.paymentReference;
    }

    const dealId = await createDeal({
      name: dealName,
      stage: WORKBOOK_DEAL_STAGES[stage],
      amount: input.amount,
      contactId: contactId ?? undefined,
      properties: dealProperties,
    });

    logger.info('[hubspot-workbook] purchase sync completed', {
      workbookId: input.workbookId,
      tier: input.tier,
      stage,
      contactId,
      dealId,
    });

    return { ok: true, contactId, dealId, stage };
  } catch (err) {
    // Non-blocking contract: never throw upstream.
    logger.error('[hubspot-workbook] purchase sync failed', {
      workbookId: input.workbookId,
      tier: input.tier,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, skipped: 'crm_disabled' };
  }
}

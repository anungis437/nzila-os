/**
 * Foundation Demo \u2014 Retention Engine (Gap 5)
 *
 * Computes per-case retention status from the live `retention_policies`
 * table for the foundation organisation. Returns a status object the case
 * detail UI renders as a small "Retention" card with policy details, the
 * computed deletion-eligible date, and last-enforced timestamp.
 *
 * Enforcement (the actual archive/delete sweep) is a separate runtime
 * concern; this module surfaces the policy state so the UI can show that
 * retention is active, what action it takes, and when it last ran.
 */

import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core/telemetry';

import { db } from '@/db/db';
import type { DemoCase } from '@/lib/demo/cupe4373-demo';

const log = createLogger('cupe4373-retention');

const FOUNDATION_ORG_ID =
  process.env.NZILA_FOUNDATION_ORG_ID ?? 'a4373000-0000-4000-8000-000000000001';
const FOUNDATION_PROFILE =
  process.env.NZILA_FOUNDATION_PROFILE ?? 'cupe4373';

export type CaseRetentionStatus = {
  policy: {
    id: string;
    name: string;
    dataType: string;
    retentionPeriodYears: number;
    retentionTrigger: string;
    actionOnExpiry: string;
    legalBasis: string | null;
    regulatoryReference: string | null;
  };
  /** ISO date when the case becomes eligible for the policy action. */
  eligibleAt: string | null;
  /** Days remaining until eligibleAt (negative = overdue). */
  daysUntilEligible: number | null;
  /** Last time enforcement was recorded (from policy.metadata.lastEnforcedAt). */
  lastEnforcedAt: string | null;
  /** Underlying case anchor used for the calculation. */
  anchor: { kind: 'closed' | 'opened'; date: string };
} | null;

type PolicyRow = {
  id: string;
  name: string;
  data_type: string;
  retention_period_years: number;
  retention_trigger: string;
  action_on_expiry: string;
  legal_basis: string | null;
  regulatory_reference: string | null;
  metadata: Record<string, unknown> | null;
};

async function loadActiveCaseFilesPolicy(): Promise<PolicyRow | null> {
  try {
    const rows = (await db.execute(sql`
      SELECT id::text                  AS id,
             name                      AS name,
             data_type                 AS data_type,
             retention_period_years    AS retention_period_years,
             retention_trigger         AS retention_trigger,
             action_on_expiry          AS action_on_expiry,
             legal_basis               AS legal_basis,
             regulatory_reference      AS regulatory_reference,
             metadata                  AS metadata
      FROM retention_policies
      WHERE organization_id = ${FOUNDATION_ORG_ID}::uuid
        AND data_type = 'case_files'
        AND status = 'active'
      ORDER BY effective_date DESC
      LIMIT 1;
    `)) as any as PolicyRow[];
    return rows[0] ?? null;
  } catch (err) {
    log.warn('policy lookup failed', { error: err });
    return null;
  }
}

function addYears(iso: string, years: number): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

function isCaseClosed(c: DemoCase): boolean {
  const s = c.status.toLowerCase();
  return s.includes('closed') || s.includes('settled') || s.includes('withdrawn');
}

export async function getRetentionStatusForCase(
  demoCase: DemoCase,
): Promise<CaseRetentionStatus> {
  const policy = await loadActiveCaseFilesPolicy();
  if (!policy) return null;

  const closed = isCaseClosed(demoCase);
  const anchor: { kind: 'closed' | 'opened'; date: string } =
    closed && demoCase.updated
      ? { kind: 'closed', date: new Date(demoCase.updated).toISOString() }
      : { kind: 'opened', date: new Date(demoCase.opened).toISOString() };

  // Only "from_closure" triggers gate on closed cases; for open cases the
  // eligible date is unknown until closure. We still return a status so
  // the UI can show "Retention applies upon closure".
  let eligibleAt: string | null = null;
  let daysUntilEligible: number | null = null;
  if (policy.retention_trigger === 'from_closure') {
    if (closed) {
      eligibleAt = addYears(anchor.date, policy.retention_period_years);
      daysUntilEligible = Math.round(
        (new Date(eligibleAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
    }
  } else {
    eligibleAt = addYears(anchor.date, policy.retention_period_years);
    daysUntilEligible = Math.round(
      (new Date(eligibleAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
  }

  const lastEnforcedAt =
    (policy.metadata?.lastEnforcedAt as string | undefined) ?? null;

  return {
    policy: {
      id: policy.id,
      name: policy.name,
      dataType: policy.data_type,
      retentionPeriodYears: policy.retention_period_years,
      retentionTrigger: policy.retention_trigger,
      actionOnExpiry: policy.action_on_expiry,
      legalBasis: policy.legal_basis,
      regulatoryReference: policy.regulatory_reference,
    },
    eligibleAt,
    daysUntilEligible,
    lastEnforcedAt,
    anchor,
  };
}

/**
 * Records a retention enforcement sweep against the case-files policy.
 * Updates `retention_policies.metadata.lastEnforcedAt` and emits a DORA
 * artifact. Idempotent: safe to call multiple times in quick succession;
 * each call advances the timestamp.
 */
export async function recordRetentionEnforcement(): Promise<{
  enforcedAt: string;
  policyId: string | null;
}> {
  const enforcedAt = new Date().toISOString();
  const policy = await loadActiveCaseFilesPolicy();
  if (!policy) return { enforcedAt, policyId: null };

  try {
    await db.execute(sql`
      UPDATE retention_policies
         SET metadata = COALESCE(metadata, '{}'::jsonb)
                       || ${JSON.stringify({ lastEnforcedAt: enforcedAt })}::jsonb,
             updated_at = now()
       WHERE id = ${policy.id}::uuid;
    `);
  } catch (err) {
    log.warn('enforcement update failed', { error: err });
  }

  try {
    const dir = resolve(
      process.cwd(),
      'artifacts',
      'runtime',
      `${FOUNDATION_PROFILE}-demo`,
      'retention',
    );
    await mkdir(dir, { recursive: true });
    const stamp = enforcedAt.replace(/[:.]/g, '-');
    await writeFile(
      resolve(dir, `${stamp}-enforcement.json`),
      JSON.stringify(
        {
          schemaVersion: 1,
          event: 'retention.enforced',
          policyId: policy.id,
          policyName: policy.name,
          dataType: policy.data_type,
          orgId: FOUNDATION_ORG_ID,
          enforcedAt,
        },
        null,
        2,
      ),
      'utf-8',
    );
  } catch (err) {
    log.warn('enforcement artifact emit failed', { error: err });
  }

  return { enforcedAt, policyId: policy.id };
}

/**
 * Foundation Demo — Governance Engine (Gap 3)
 *
 * Wires case decisions into the executive decision pipeline. Every "Log
 * decision" action persists to two tables and emits a proof-pack artifact:
 *
 *   1. `executive_decisions` — the canonical decision-of-record
 *   2. `decision_pipeline_runs` — the orchestration evidence (pipeline run
 *      that materialized the decision; this is what governance dashboards
 *      read for "decision velocity" and "checkpoint coverage").
 *   3. `artifacts/runtime/<profile>-demo/governance/<decisionId>.json` —
 *      portable evidence bundle suitable for proof-pack download (Gap 6).
 *
 * Parameterized by `NZILA_FOUNDATION_ORG_ID` so it transparently serves
 * any future foundation client without code change.
 */

import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { db } from '@/db/db';

const DEFAULT_FOUNDATION_ORG_ID = 'a4373000-0000-4000-8000-000000000001';
const FOUNDATION_ORG_ID =
  process.env.NZILA_FOUNDATION_ORG_ID ?? DEFAULT_FOUNDATION_ORG_ID;
const FOUNDATION_PROFILE =
  process.env.NZILA_FOUNDATION_PROFILE ?? 'cupe4373';

const PIPELINE_NAME = 'ue-case-decision';

export type CaseDecisionPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type CaseDecisionStatus =
  | 'proposed'
  | 'approved'
  | 'executing'
  | 'done'
  | 'cancelled';

export type LogCaseDecisionInput = {
  /** Case identifier as shown to users (e.g. "UE-4373-008"). */
  caseId: string;
  caseTitle: string;
  /** Decision title — what was decided. */
  title: string;
  rationale: string;
  /** Owner display name (free text — no FK). */
  owner?: string;
  dueDate?: string; // YYYY-MM-DD
  priority?: CaseDecisionPriority;
  status?: CaseDecisionStatus;
  /** Optional actor (display name + role) for the audit trail. */
  actor?: { name: string; role: string };
};

export type LoggedCaseDecision = {
  decisionId: string;
  pipelineRunId: string;
  proofPackPath: string;
  recordedAt: string;
};

function mapUrgencyToPriority(urgency?: string): CaseDecisionPriority {
  switch (urgency) {
    case 'urgent':
      return 'p0';
    case 'watch':
      return 'p1';
    case 'steady':
      return 'p2';
    default:
      return 'p2';
  }
}

export { mapUrgencyToPriority };

async function emitProofPack(
  decisionId: string,
  pipelineRunId: string,
  input: LogCaseDecisionInput,
  recordedAt: string,
): Promise<string> {
  const dir = resolve(
    process.cwd(),
    'artifacts',
    'runtime',
    `${FOUNDATION_PROFILE}-demo`,
    'governance',
  );
  await mkdir(dir, { recursive: true });
  const file = resolve(dir, `${decisionId}.json`);
  const pack = {
    schemaVersion: 1,
    profile: FOUNDATION_PROFILE,
    organizationId: FOUNDATION_ORG_ID,
    decision: {
      id: decisionId,
      title: input.title,
      rationale: input.rationale,
      category: 'risk',
      priority: input.priority ?? 'p2',
      status: input.status ?? 'proposed',
      owner: input.owner ?? null,
      dueDate: input.dueDate ?? null,
    },
    linkedCase: {
      id: input.caseId,
      title: input.caseTitle,
    },
    pipelineRun: {
      id: pipelineRunId,
      name: PIPELINE_NAME,
      mode: 'manual',
      startedAt: recordedAt,
      completedAt: recordedAt,
      status: 'completed',
    },
    actor: input.actor ?? null,
    attestation: {
      attestedAt: recordedAt,
      attestationKind: 'engine-generated',
      // Real signature integration is the orchestrator's responsibility
      // (Gap 4); engine-generated attestation is the fallback when an
      // identity provider is unavailable in demo mode.
    },
  };
  await writeFile(file, JSON.stringify(pack, null, 2), 'utf-8');
  return file;
}

export async function logCaseDecision(
  input: LogCaseDecisionInput,
): Promise<LoggedCaseDecision> {
  const decisionId = randomUUID();
  const pipelineRunId = `run-${decisionId}`;
  const recordedAt = new Date().toISOString();
  const priority = input.priority ?? 'p2';
  const status = input.status ?? 'proposed';

  // 1. Insert pipeline run FIRST (orchestration evidence precedes the decision
  // so dashboards never see an orphan decision without a backing run).
  await db.execute(sql`
    INSERT INTO decision_pipeline_runs (
      id, pipeline_name, mode, organization_id,
      started_at, completed_at, status,
      records_scanned, records_materialized, aggregates_written,
      metadata
    ) VALUES (
      ${pipelineRunId}::text,
      ${PIPELINE_NAME}::text,
      ${'manual'}::text,
      ${FOUNDATION_ORG_ID}::text,
      ${recordedAt}::timestamptz,
      ${recordedAt}::timestamptz,
      ${'completed'}::text,
      1, 1, 0,
      ${JSON.stringify({
        caseId: input.caseId,
        caseTitle: input.caseTitle,
        actor: input.actor ?? null,
        profile: FOUNDATION_PROFILE,
      })}::jsonb
    );
  `);

  // 2. Insert the executive decision.
  await db.execute(sql`
    INSERT INTO executive_decisions (
      id, org_id, date, title, rationale,
      category, priority, owner, due_date, status,
      created_at, updated_at
    ) VALUES (
      ${decisionId}::uuid,
      ${FOUNDATION_ORG_ID}::uuid,
      ${recordedAt}::timestamptz,
      ${`[${input.caseId}] ${input.title}`}::text,
      ${input.rationale}::text,
      ${'risk'}::varchar,
      ${priority}::varchar,
      ${input.owner ?? null},
      ${input.dueDate ?? null}::date,
      ${status}::varchar,
      now(), now()
    );
  `);

  // 3. Emit proof-pack artifact (best-effort; failure is non-fatal because
  // the decision is already persisted and the artifact can be regenerated).
  let proofPackPath = '';
  try {
    proofPackPath = await emitProofPack(decisionId, pipelineRunId, input, recordedAt);
  } catch (err) {
    console.warn('[cupe4373-governance] proof-pack emit failed:', err);
  }

  return { decisionId, pipelineRunId, proofPackPath, recordedAt };
}

export type CaseDecisionRecord = {
  id: string;
  date: string;
  title: string;
  rationale: string | null;
  priority: string;
  status: string;
  owner: string | null;
  dueDate: string | null;
  pipelineRunId: string | null;
};

export async function listDecisionsForCase(caseId: string): Promise<CaseDecisionRecord[]> {
  try {
    const titlePrefix = `[${caseId}] %`;
    const rows = (await db.execute(sql`
      SELECT
        ed.id::text                AS id,
        ed.date::text              AS date,
        ed.title                   AS title,
        ed.rationale               AS rationale,
        ed.priority                AS priority,
        ed.status                  AS status,
        ed.owner                   AS owner,
        ed.due_date::text          AS due_date,
        dpr.id                     AS pipeline_run_id
      FROM executive_decisions ed
      LEFT JOIN decision_pipeline_runs dpr
        ON dpr.metadata->>'caseId' = ${caseId}
      WHERE ed.org_id = ${FOUNDATION_ORG_ID}::uuid
        AND ed.title LIKE ${titlePrefix}
      ORDER BY ed.date DESC
      LIMIT 25;
    `)) as unknown as Array<{
      id: string;
      date: string;
      title: string;
      rationale: string | null;
      priority: string;
      status: string;
      owner: string | null;
      due_date: string | null;
      pipeline_run_id: string | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      rationale: r.rationale,
      priority: r.priority,
      status: r.status,
      owner: r.owner,
      dueDate: r.due_date,
      pipelineRunId: r.pipeline_run_id,
    }));
  } catch (err) {
    console.warn('[cupe4373-governance] listDecisionsForCase failed:', err);
    return [];
  }
}

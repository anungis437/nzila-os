/**
 * POST /api/cases/[caseId]/decision
 *
 * Persist a case-level decision through the executive decision pipeline
 * (executive_decisions + decision_pipeline_runs) and emit a proof-pack
 * artifact.
 *
 * Authorization: requires steward role or higher (the role resolution chain
 * is the canonical one used by the dashboard layout — see
 * `lib/api-auth-guard.ts:hasMinRole`).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { hasMinRole } from '@/lib/api-auth-guard';
import { auth } from '@nzila/platform-auth/entra/server';
import { createLogger } from '@nzila/os-core/telemetry';
import {
  logCaseDecision,
  mapUrgencyToPriority,
  type CaseDecisionPriority,
  type CaseDecisionStatus,
} from '@/lib/demo/server/cupe4373-governance';

const log = createLogger('api-cases-decision');
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PriorityEnum = z.enum(['p0', 'p1', 'p2', 'p3']);
const StatusEnum = z.enum(['proposed', 'approved', 'executing', 'done', 'cancelled']);

const BodySchema = z.object({
  caseTitle: z.string().min(1).max(280),
  title: z.string().min(1).max(280),
  rationale: z.string().min(1).max(8000),
  owner: z.string().max(128).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .optional(),
  priority: PriorityEnum.optional(),
  status: StatusEnum.optional(),
  urgency: z.string().optional(),
  actor: z
    .object({
      name: z.string().min(1).max(128),
      role: z.string().min(1).max(64),
    })
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'UNAUTHENTICATED', message: 'Sign-in required.' },
      { status: 401 },
    );
  }
  const allowed = await hasMinRole('steward');
  if (!allowed) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Steward role or higher required to record decisions.' },
      { status: 403 },
    );
  }

  const { caseId } = await params;
  let raw: any;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_BODY', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const priority: CaseDecisionPriority =
    body.priority ?? mapUrgencyToPriority(body.urgency);
  const status: CaseDecisionStatus = body.status ?? 'approved';

  try {
    const result = await logCaseDecision({
      caseId,
      caseTitle: body.caseTitle,
      title: body.title,
      rationale: body.rationale,
      owner: body.owner,
      dueDate: body.dueDate,
      priority,
      status,
      actor: body.actor,
    });
    return NextResponse.json(
      {
        ok: true,
        decisionId: result.decisionId,
        pipelineRunId: result.pipelineRunId,
        recordedAt: result.recordedAt,
        proofPackPath: result.proofPackPath || null,
        idempotencyKey: result.idempotencyKey,
        replayed: result.replayed,
      },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (err) {
    const cause = (err as { cause?: { code?: string; message?: string } } | undefined)?.cause;
    log.error('insert failed', {
      caseId,
      message: (err as Error)?.message,
      causeCode: cause?.code,
      causeMessage: cause?.message,
    });
    return NextResponse.json(
      {
        error: 'PERSIST_FAILED',
        message: cause?.message ?? (err as Error).message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}

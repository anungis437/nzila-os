/**
 * POST /api/cases/[caseId]/decision
 *
 * Persist a case-level decision through the executive decision pipeline
 * (executive_decisions + decision_pipeline_runs) and emit a proof-pack
 * artifact. This is the Gap 3 governance wire-up for the foundation demo.
 *
 * In demo runtime the endpoint accepts unauthenticated POSTs (the demo
 * surface itself is gated). In non-demo runtimes it requires an
 * authenticated user with `record_decision` capability — that wiring lives
 * with Gap 7 (real auth) and is intentionally deferred here.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience';
import {
  logCaseDecision,
  mapUrgencyToPriority,
  type CaseDecisionPriority,
  type CaseDecisionStatus,
} from '@/lib/demo/server/cupe4373-governance';

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
  if (!isCupe4373DemoRuntime()) {
    return NextResponse.json(
      {
        error: 'DEMO_ONLY',
        message:
          'Decision logging via this endpoint is currently demo-only; real-runtime wiring is tracked under Gap 7.',
      },
      { status: 403 },
    );
  }

  const { caseId } = await params;
  let raw: unknown;
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
    console.error('[api/cases/decision] insert failed', {
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

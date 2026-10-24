/**
 * Triage designations: the explicit, expiring, revocable authority to see and work the unassigned conversation
 * queue. An organization administrator grants and revokes; the grant is never implied by rank and never exposes
 * message content. Every decision is audited in the same transaction.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { caseAssigneeEligible, getCaseActor } from '@/lib/cases/case-authorization';
import {
  grantTriageDesignation,
  listTriageDesignations,
  revokeTriageDesignation,
} from '@/lib/messaging/thread-assignment';

export const dynamic = 'force-dynamic';

const grantSchema = z.object({
  userId: z.string().trim().min(1).max(255),
  expiresAt: z.string().datetime(),
});
const revokeSchema = z.object({ designationId: z.string().uuid() });

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' }, openapi: { tags: ['Messages'], summary: 'List triage designations' } },
  async () => {
    const actor = await getCaseActor();
    const designations = await withRLSContext(async (tx) => listTriageDesignations(tx, actor));
    return { designations };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' }, body: grantSchema, openapi: { tags: ['Messages'], summary: 'Grant a triage designation' } },
  async ({ body }) => {
    const actor = await getCaseActor();
    const result = await withRLSContext(async (tx) =>
      grantTriageDesignation(
        tx,
        actor,
        { userId: body.userId, expiresAt: new Date(body.expiresAt) },
        { assigneeEligible: (userId) => caseAssigneeEligible(tx, actor, userId) },
      ),
    );
    switch (result.kind) {
      case 'ok':
        return NextResponse.json({ data: result.designation }, { status: 201 });
      case 'invalid_expiry':
        throw ApiError.badRequest('expiresAt must be in the future and no more than 90 days away.');
      case 'self_grant':
        throw ApiError.forbidden('A designation cannot be granted to yourself.');
      case 'ineligible':
        return NextResponse.json({ error: { code: 'DESIGNEE_NOT_ELIGIBLE', message: 'The designee is not an eligible staff member.' } }, { status: 422 });
      case 'conflict':
        return NextResponse.json({ error: { code: 'DESIGNATION_ALREADY_LIVE', message: 'A live designation already exists.' } }, { status: 409 });
    }
  },
);

export const DELETE = withApi(
  { auth: { required: true, minRole: 'admin' }, body: revokeSchema, openapi: { tags: ['Messages'], summary: 'Revoke a triage designation' } },
  async ({ body }) => {
    const actor = await getCaseActor();
    const result = await withRLSContext(async (tx) => revokeTriageDesignation(tx, actor, body.designationId));
    if (result.kind === 'not_found') throw ApiError.notFound('Designation');
    return { revoked: true };
  },
);

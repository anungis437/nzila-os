/**
 * The organization's adopted retention policy for closed conversations. Organization administrators only.
 *
 * There is no default period: until one is recorded here, every conversation reports `policy_not_adopted` and nothing
 * is eligible for disposition. Recording a policy changes no conversation and deletes nothing; the application has no
 * deletion of conversation content. The record names the authority that adopted the period; the system stores the
 * reference and who recorded it but cannot verify the institutional decision itself.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { adoptRetentionPolicy, liveRetentionPolicy, MAX_POLICY_REFERENCE, MAX_RETENTION_DAYS } from '@/lib/messaging/thread-lifecycle';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  retentionDays: z.number().int().min(1).max(MAX_RETENTION_DAYS),
  policyReference: z.string().trim().min(1).max(MAX_POLICY_REFERENCE),
  authorityReference: z.string().trim().min(1).max(MAX_POLICY_REFERENCE),
});

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' }, openapi: { tags: ['Messages'], summary: 'Adopted message retention policy' } },
  async () => {
    const actor = await getCaseActor();
    if (actor.role !== 'admin') throw ApiError.forbidden();
    const policy = await withRLSContext(async (tx) => liveRetentionPolicy(tx, actor.organizationId));
    return { adopted: policy !== null, policy };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' }, body: bodySchema, openapi: { tags: ['Messages'], summary: 'Record the adopted message retention policy' } },
  async ({ body }) => {
    const actor = await getCaseActor();
    const result = await withRLSContext(async (tx) => adoptRetentionPolicy(tx, actor, body));
    if (result.kind === 'forbidden') throw ApiError.forbidden('Only an organization administrator can record a retention policy.');
    if (result.kind === 'invalid') throw ApiError.badRequest('The retention policy is not valid.');
    return NextResponse.json({ data: { policy: result.policy } }, { status: 201 });
  },
);

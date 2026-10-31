// cognition-governance-ci: allow-route-bypass — Per-interview document CRUD.
/**
 * POST   /api/exit-interviews/[id]/documents  — attach a document record
 * GET    /api/exit-interviews/[id]/documents  — list attached documents
 * DELETE /api/exit-interviews/[id]/documents/[docId] handled separately
 *
 * File upload is handled client-side to Azure Blob Storage (presigned URL flow).
 * This endpoint receives the already-uploaded file metadata and stores the
 * record in exit_interview_documents.
 *
 * Access: steward+ or interview owner
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { exitInterviews, exitInterviewDocuments } from '@/db/schema';
import { ROLE_HIERARCHY, normalizeRole, hasMinRole } from '@/lib/api-auth-guard';
import { canReadInterview, resolveInterviewReader } from '@/lib/knowledge-transfer/governance/interview-access';

export const dynamic = 'force-dynamic';

function hasStewardPrivileges(role: string | null): boolean {
  const normalized = normalizeRole((role ?? 'member') as never);
  return (ROLE_HIERARCHY[normalized] ?? 0) >= ROLE_HIERARCHY.steward;
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
]);

const attachDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  fileUrl: z.string().url('fileUrl must be a valid URL'),
  mimeType: z.string().refine((m) => ALLOWED_MIME_TYPES.has(m), {
    message: 'Unsupported file type. Allowed: PDF, Word, TXT, PNG, JPEG',
  }),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024, 'File must be ≤ 50 MB').optional(),
  transcriptText: z.string().max(100_000).optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
    body: attachDocumentSchema,
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Attach document to exit interview',
      description: 'Registers an already-uploaded document artifact against an exit interview.',
    },
  },
  async ({ params, body, organizationId, userId, user }) => {
    const [interview] = await db
      .select({ id: exitInterviews.id, createdBy: exitInterviews.createdBy, status: exitInterviews.status })
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!interview) throw ApiError.notFound('Exit interview');

    const stewardPlus = hasStewardPrivileges(user?.role ?? null);
    const isOwner = interview.createdBy === userId;
    if (!stewardPlus && !isOwner) {
      throw ApiError.forbidden('Only the interview owner or steward-level users can attach documents');
    }

    // A reviewed, published or archived interview is no longer being prepared: what the reviewer approved is what is published.
    if (interview.status === 'reviewed' || interview.status === 'published' || interview.status === 'archived') {
      throw ApiError.conflict('Cannot attach documents to a reviewed, published or archived interview');
    }

    // Validate fileUrl is within allowed domains (no SSRF)
    const parsedUrl = new URL(body!.fileUrl);
    const allowedHosts = [
      'nzilacanadastore.blob.core.windows.net',
      'localhost',
      '127.0.0.1',
    ];
    if (!allowedHosts.some((h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`))) {
      throw ApiError.badRequest('fileUrl must point to an authorized storage host');
    }

    const doc = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const [row] = await tx
        .insert(exitInterviewDocuments)
        .values({
          interviewId: params.id,
          organizationId: organizationId!,
          title: body!.title,
          fileUrl: body!.fileUrl,
          mimeType: body!.mimeType,
          sizeBytes: body!.sizeBytes,
          transcriptText: body!.transcriptText,
          createdBy: userId!,
        })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'exit_interview.document_attach',
        resourceType: 'exit_interview_documents',
        resourceId: row.id,
        details: { interviewId: params.id, mimeType: body!.mimeType },
      });
      return row;
    });

    return { data: doc };
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'List interview documents',
      description: 'Returns all document artifacts attached to an exit interview.',
    },
  },
  async ({ params, organizationId, userId, user }) => {
    // Ensure interview is in this org
    const [interview] = await db
      .select({ id: exitInterviews.id, status: exitInterviews.status, createdBy: exitInterviews.createdBy, sensitivityLevel: exitInterviews.sensitivityLevel, consentGranted: exitInterviews.consentGranted })
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!interview) throw ApiError.notFound('Exit interview');

    // The attachments (including transcripts) of a draft are as private as the draft: the interview route shows an
    // unpublished interview only to its owner and to steward-level users, and so does this one.
    // The attachments (transcripts, file locations) follow the interview's sensitivity floor and consent as well.
    const reader = await resolveInterviewReader(userId ?? null, hasStewardPrivileges(user?.role ?? null), hasMinRole);
    if (!canReadInterview(interview, reader)) {
      throw ApiError.notFound('Exit interview');
    }

    const docs = await db
      .select()
      .from(exitInterviewDocuments)
      .where(and(
        eq(exitInterviewDocuments.interviewId, params.id),
        eq(exitInterviewDocuments.organizationId, organizationId!),
      ));

    return { data: docs };
  },
);

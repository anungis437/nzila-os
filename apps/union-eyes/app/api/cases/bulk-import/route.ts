/**
 * Bulk Case Import API — POST /api/cases/bulk-import
 *
 * Accepts an array of case records, processes each with per-record error tracking,
 * uses idempotency hashing to prevent duplicates on retry.
 *
 * PR-020: Pre-deployment hardening — critical blocker resolution
 */

import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { z } from 'zod';
import { db } from '@/db/db';
import { claims } from '@/db/schema/claims-schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { createClaim } from '@/db/queries/claims-queries';
import { auditDataMutation } from '@/lib/audit-logger';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { hasMinRole } from '@/lib/api-auth-guard';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const bulkCaseSchema = z.object({
  memberId: z.string().min(1),
  caseType: z.string().min(1),
  title: z.string().min(3).max(500),
  description: z.string().min(5),
  incidentDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  location: z.string().optional(),
  desiredOutcome: z.string().optional(),
  externalSourceId: z.string().optional(),
});

const bulkImportSchema = z.object({
  cases: z.array(bulkCaseSchema).min(1).max(100),
});

type ImportResult = {
  index: number;
  status: 'created' | 'duplicate' | 'error';
  claimId?: string;
  claimNumber?: string;
  error?: string;
};

const CLAIM_TYPE_MAP: Record<string, string> = {
  discipline: 'grievance_discipline',
  harassment: 'harassment_workplace',
  discrimination: 'discrimination_other',
  wage_dispute: 'wage_dispute',
  benefits_denial: 'grievance_pay',
  recall_rehire: 'wrongful_termination',
  safety: 'workplace_safety',
  contracting: 'contract_dispute',
  dues: 'grievance_pay',
  other: 'other',
};

export async function POST(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }

    await requireEntitlement(orgId, 'grievance_case_suite');

    const isAdmin = await hasMinRole('admin');
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Bulk import requires admin role or above.' },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON.' },
        { status: 400 },
      );
    }

    const validation = bulkImportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Input validation failed.', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { cases: caseRecords } = validation.data;
    const results: ImportResult[] = [];

    for (let i = 0; i < caseRecords.length; i++) {
      const record = caseRecords[i];
      try {
        // Idempotency hash
        const hashInput = record.externalSourceId
          ? `ext:${record.externalSourceId}`
          : `${record.memberId}|${record.caseType}|${record.incidentDate}|${record.title}`;
        const idempotencyHash = createHash('sha256').update(hashInput).digest('hex');

        // Check for existing
        const [existing] = await db
          .select({ claimId: claims.claimId, claimNumber: claims.claimNumber })
          .from(claims)
          .where(eq(claims.idempotencyHash, idempotencyHash))
          .limit(1);

        if (existing) {
          results.push({
            index: i,
            status: 'duplicate',
            claimId: existing.claimId,
            claimNumber: existing.claimNumber ?? undefined,
          });
          continue;
        }

        const claimType = (CLAIM_TYPE_MAP[record.caseType] ?? record.caseType) as Parameters<typeof createClaim>[0]['claimType'];

        const claim = await withRLSContext(async (tx) => {
          return createClaim(
            {
              organizationId: orgId,
              memberId: record.memberId,
              claimType,
              priority: record.priority as 'low' | 'medium' | 'high' | 'critical',
              description: record.description,
              incidentDate: new Date(record.incidentDate),
              location: record.location ?? null,
              desiredOutcome: record.desiredOutcome ?? '',
              isAnonymous: false,
              witnessDetails: null,
              witnessesPresent: false,
              status: 'submitted',
              idempotencyHash,
              metadata: {
                title: record.title,
                bulk_import: true,
                external_source_id: record.externalSourceId,
                imported_at: new Date().toISOString(),
              },
            },
            tx,
          );
        });

        results.push({
          index: i,
          status: 'created',
          claimId: claim.claimId,
          claimNumber: claim.claimNumber ?? undefined,
        });
      } catch (err) {
        logger.error('Bulk import: record failed', err as Error, { index: i, record });
        results.push({
          index: i,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const duplicates = results.filter(r => r.status === 'duplicate').length;
    const errors = results.filter(r => r.status === 'error').length;

    await auditDataMutation({
      userId,
      organizationId: orgId,
      resource: 'claims',
      action: 'create',
      details: {
        event: 'BULK_IMPORT',
        totalRecords: caseRecords.length,
        created,
        duplicates,
        errors,
      },
    });

    logger.info('Bulk import completed', { total: caseRecords.length, created, duplicates, errors });

    return NextResponse.json(
      {
        success: true,
        summary: { total: caseRecords.length, created, duplicates, errors },
        results,
      },
      { status: errors > 0 && created === 0 ? 207 : 201 },
    );
  } catch (error) {
    logger.error('Bulk import failed', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

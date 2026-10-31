import { withApi, ApiError } from '@/lib/api/framework';
import { listPage } from '@/lib/api/list-page';
import { NextResponse } from 'next/server';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { pensionT4aRecords } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { isPensionAdministrator, ownPensionIdentities, PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';

/**
 * DEF-0B10-PEN-T4A-POST-STORES-AN-ADMINISTRATOR-TYPED-INCOME-AS-A-GENERATED-TAX-RECORD
 * No authoritative pension payment reconciliation, slip number, document, issuance
 * or filing service exists here. Do not accept administrator-typed income as a
 * generated tax slip. Existing records remain readable under existing own-record
 * or pension-financial-administrator access; their provenance needs separate review.
 */
export const dynamic = 'force-dynamic';

// A list answers at most this many rows per page; offset pages through the rest.
const LIST_LIMIT = 200;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List T4A records', description: 'T4A records: your own, or the organization\'s for a pension administrator' },
  },
  async ({ request, organizationId, userId, user }) => {
    const page = listPage(request, LIST_LIMIT);
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');

    return withRLSContext({ organizationId }, async (tx) => {
      const conditions = [eq(pensionT4aRecords.organizationId, organizationId)];
      if (isPensionAdministrator(user?.role)) {
        if (memberId) conditions.push(eq(pensionT4aRecords.memberId, memberId));
      } else {
        const own = await ownPensionIdentities(tx, organizationId, userId);
        if (own.length === 0 || (memberId && !own.includes(memberId))) return [];
        conditions.push(inArray(pensionT4aRecords.memberId, memberId ? [memberId] : own));
      }
      return tx.select().from(pensionT4aRecords).where(and(...conditions)).orderBy(desc(pensionT4aRecords.createdAt)).limit(page.limit).offset(page.offset);
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: { tags: ['Pension'], summary: 'T4A generation unavailable pending source verification', description: 'Does not create or file tax slips without reconciled income, unique slip identifiers, and institutional authorization' },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Pension organization context required');
    return NextResponse.json(
      {
        error: 'PENSION_T4A_GENERATION_NOT_IMPLEMENTED',
        capability: 'pension.t4a.generate',
        capabilityState: 'NOT_IMPLEMENTED',
        message: 'Tax slip generation requires reconciled payment data, a unique slip identifier, an approved document and filing workflow.',
      },
      { status: 501, headers: { 'Cache-Control': 'private, no-store' } },
    );
  },
);

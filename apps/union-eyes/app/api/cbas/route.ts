/**
 * GET POST /api/cbas
 * Drizzle ORM — direct database access (migrated from Django proxy)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listCBAs, type CBAFilters } from '@/lib/services/cba-service';
import { createCbaAudited } from '@/lib/services/cba-audited-service';
import { withRoleAuth, type BaseAuthContext } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

const JURISDICTIONS = [
  'federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba',
  'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei',
  'newfoundland', 'northwest_territories', 'yukon', 'nunavut',
] as const;

// The organization, creator, visibility and counters are never accepted from the body.
const createCBASchema = z.object({
  organizationId: z.string().uuid().optional(),
  cbaNumber: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  jurisdiction: z.enum(JURISDICTIONS),
  language: z.enum(['en', 'fr', 'bilingual']).optional(),
  employerName: z.string().min(1).max(300),
  employerId: z.string().max(100).optional(),
  unionName: z.string().min(1).max(300),
  unionLocal: z.string().max(100).optional(),
  unionId: z.string().max(100).optional(),
  effectiveDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  signedDate: z.coerce.date().optional(),
  ratificationDate: z.coerce.date().optional(),
  industrySector: z.string().min(1).max(200),
  sector: z.string().max(200).optional(),
  employeeCoverage: z.number().int().optional(),
  bargainingUnitDescription: z.string().optional(),
  documentUrl: z.string().url().optional(),
  status: z.enum(['active', 'expired', 'under_negotiation', 'ratified_pending', 'archived']).optional(),
});

export const GET = withRoleAuth('member', async (req: NextRequest, context: BaseAuthContext) => {
  const organizationId = context.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'No active organization' }, { status: 400 });
  }

  const url = new URL(req.url);
  const requestedOrg = url.searchParams.get('organizationId');
  if (requestedOrg && requestedOrg !== organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const filters: CBAFilters = { organizationId };

  const status = url.searchParams.getAll('status');
  if (status.length) filters.status = status;

  const jurisdiction = url.searchParams.getAll('jurisdiction');
  if (jurisdiction.length) filters.jurisdiction = jurisdiction;

  const search = url.searchParams.get('search');
  if (search) filters.searchQuery = search;

  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  try {
    const result = await withRLSContext({ organizationId }, async () => listCBAs(filters, { page, limit }));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to list CBAs' }, { status: 500 });
  }
});

export const POST = withRoleAuth('steward', async (req: NextRequest, context: BaseAuthContext) => {
  const { organizationId, userId } = context;
  if (!organizationId || !userId) {
    return NextResponse.json({ error: 'No active organization' }, { status: 400 });
  }

  const body = await req.json();
  const validation = createCBASchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { organizationId: requestedOrg, ...data } = validation.data;
  if (requestedOrg && requestedOrg !== organizationId) {
    return NextResponse.json({ error: 'Forbidden: not the active organization' }, { status: 403 });
  }

  try {
    const cba = await createCbaAudited({ organizationId, userId }, data);
    return NextResponse.json(cba, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'CBA number already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create CBA' }, { status: 500 });
  }
});

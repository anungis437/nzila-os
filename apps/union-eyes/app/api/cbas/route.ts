/**
 * GET POST /api/cbas
 * Drizzle ORM — direct database access (migrated from Django proxy)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listCBAs, createCBA, type CBAFilters } from '@/lib/services/cba-service';
import { getCurrentUser } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

const JURISDICTIONS = [
  'federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba',
  'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei',
  'newfoundland', 'northwest_territories', 'yukon', 'nunavut',
] as const;

const createCBASchema = z.object({
  organizationId: z.string().uuid(),
  cbaNumber: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  jurisdiction: z.enum(JURISDICTIONS),
  employerName: z.string().min(1).max(300),
  unionName: z.string().min(1).max(300),
  effectiveDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  industrySector: z.string().min(1).max(200),
}).passthrough();

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const filters: CBAFilters = {};

  const orgId = url.searchParams.get('organizationId');
  if (orgId) filters.organizationId = orgId;

  const status = url.searchParams.getAll('status');
  if (status.length) filters.status = status;

  const jurisdiction = url.searchParams.getAll('jurisdiction');
  if (jurisdiction.length) filters.jurisdiction = jurisdiction;

  const search = url.searchParams.get('search');
  if (search) filters.searchQuery = search;

  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  try {
    const result = await listCBAs(filters, { page, limit });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to list CBAs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validation = createCBASchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: validation.error.errors },
      { status: 400 }
    );
  }

  try {
    const cba = await createCBA(validation.data);
    return NextResponse.json(cba, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create CBA' }, { status: 500 });
  }
}


/**
 * CRUD collection route for deadlines
 * Falls back to empty results when DB schema is incomplete.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { deadlines } from '@/db/schema';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const crud = crudRoutes({
  table: deadlines,
  pk: 'id',
  tags: ["Claims"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});

export async function GET(req: NextRequest) {
  const response = await crud.GET(req);
  if (!response.ok) {
    return NextResponse.json({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
  }
  return response;
}

export const POST = crud.POST;

/**
 * GET PATCH DELETE /api/events/[id]
 * -> Django unions: /api/unions/calendar-events/
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/unions/calendar-events/' + id + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/unions/calendar-events/' + id + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return djangoProxy(req, '/api/unions/calendar-events/' + id + '/', { method: 'DELETE' });
}


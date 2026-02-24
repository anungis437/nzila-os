/**
 * GET PATCH DELETE /api/communications/polls/[pollId]/vote
 * -> Django notifications: /api/notifications/campaigns/
 * NOTE: auto-resolved from communications/polls/[pollId]/vote
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ pollId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { pollId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + pollId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { pollId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + pollId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { pollId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + pollId + '/', { method: 'DELETE' });
}


/**
 * GET PATCH DELETE /api/communications/sms/conversations/[conversationId]/read
 * -> Django notifications: /api/notifications/campaigns/
 * NOTE: auto-resolved from communications/sms/conversations/[conversationId]/read
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { conversationId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + conversationId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { conversationId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + conversationId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { conversationId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + conversationId + '/', { method: 'DELETE' });
}


/**
 * GET PATCH DELETE /api/communications/track/open/[campaignId]/[recipientId]
 * -> Django notifications: /api/notifications/campaigns/
 * NOTE: auto-resolved from communications/track/open/[campaignId]/[recipientId]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ recipientId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { recipientId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + recipientId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { recipientId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + recipientId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { recipientId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + recipientId + '/', { method: 'DELETE' });
}


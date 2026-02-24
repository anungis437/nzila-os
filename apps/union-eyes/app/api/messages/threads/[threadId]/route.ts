/**
 * GET PATCH DELETE /api/messages/threads/[threadId]
 * -> Django notifications: /api/notifications/messages/
 * NOTE: auto-resolved from messages/threads/[threadId]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ threadId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { threadId } = await params;
  return djangoProxy(req, '/api/notifications/messages/' + threadId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { threadId } = await params;
  return djangoProxy(req, '/api/notifications/messages/' + threadId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { threadId } = await params;
  return djangoProxy(req, '/api/notifications/messages/' + threadId + '/', { method: 'DELETE' });
}


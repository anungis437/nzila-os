/**
 * GET PATCH DELETE /api/communications/surveys/[surveyId]
 * -> Django notifications: /api/notifications/campaigns/
 * NOTE: auto-resolved from communications/surveys/[surveyId]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ surveyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { surveyId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + surveyId + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { surveyId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + surveyId + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { surveyId } = await params;
  return djangoProxy(req, '/api/notifications/campaigns/' + surveyId + '/', { method: 'DELETE' });
}


/**
 * GET /api/communications/surveys/[surveyId]/results
 * -> Django notifications: /api/notifications/campaigns/
 * NOTE: auto-resolved from communications/surveys/[surveyId]/results
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


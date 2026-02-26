/**
 * GET POST /api/analytics/cross-org
 * -> Django analytics: /api/analytics/analytics-metrics/
 * NOTE: auto-resolved from analytics/cross-org
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return djangoProxy(req, '/api/analytics/analytics-metrics/');
}

export function POST(req: NextRequest) {
  return djangoProxy(req, '/api/analytics/analytics-metrics/', { method: 'POST' });
}


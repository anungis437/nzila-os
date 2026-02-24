/**
 * GET PATCH DELETE /api/case-studies/[slug]
 * -> Django grievances: /api/grievances/slug/
 * NOTE: auto-resolved from case-studies/[slug]
 * Auto-migrated by scripts/migrate_routes.py
 */
import { NextRequest } from 'next/server';
import { djangoProxy } from '@/lib/django-proxy';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  return djangoProxy(req, '/api/grievances/slug/' + slug + '/');
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  return djangoProxy(req, '/api/grievances/slug/' + slug + '/', { method: 'PATCH' });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  return djangoProxy(req, '/api/grievances/slug/' + slug + '/', { method: 'DELETE' });
}


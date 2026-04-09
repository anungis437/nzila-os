/**
 * @deprecated Budget routes removed — budgets table never created.
 * Use /api/billing/reports for financial reporting.
 *
 * Phase 9 — Deprecation System
 */
import { NextRequest } from 'next/server';
import { logDeprecatedAccess, deprecatedResponse } from '@/lib/api/deprecation';

export const dynamic = 'force-dynamic';

const CANONICAL = '/api/billing/reports';

async function handler(request: NextRequest) {
  logDeprecatedAccess('/api/financial/budgets', request.method, CANONICAL);
  return deprecatedResponse('/api/financial/budgets', CANONICAL);
}

export const GET = handler;
export const POST = handler;

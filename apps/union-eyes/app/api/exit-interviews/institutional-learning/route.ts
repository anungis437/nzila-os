/**
 * Legacy slug redirect — moved to /api/exit-interviews/organizational-learning.
 * Kept for backward compatibility with external integrations.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = '/api/exit-interviews/organizational-learning';
  return NextResponse.redirect(url, 308);
}

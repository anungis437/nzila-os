/**
 * System Status API Endpoint
 * 
 * GET /api/status - Returns comprehensive system status
 */

import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/monitoring/status-page';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get system status
 */
export async function GET() {
  try {
    const status = await getSystemStatus();
    
    // Return 503 if system is down
    const statusCode = status.status === 'down' ? 503 : 200;
    
    return NextResponse.json(status, { status: statusCode });
  } catch (_error) {
    return standardErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, 'Service unavailable');
  }
}


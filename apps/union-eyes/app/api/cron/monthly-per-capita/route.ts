/**
 * Monthly Per-Capita Cron Job
 * Purpose: Automatically calculate per-capita remittances on 1st of each month
 * Schedule: Runs at midnight UTC on the 1st day of every month
 * Vercel Cron: 0 0 1 * *
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processMonthlyPerCapita } from '@/services/clc/per-capita-calculator';
import { markOverdueRemittances } from '@/services/clc/per-capita-calculator';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
// =====================================================================================
// GET - Monthly per-capita calculation
// =====================================================================================

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request (timing-safe comparison)
    const authHeader = request.headers.get('authorization');
    const secret = authHeader?.replace('Bearer ', '') ?? '';
    const expected = process.env.CRON_SECRET ?? '';
    const secretBuf = Buffer.from(secret);
    const expectedBuf = Buffer.from(expected);
    if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }
// Run monthly calculation
    const result = await processMonthlyPerCapita();

    // Mark overdue remittances
    const overdueCount = await markOverdueRemittances();
return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      calculation: result,
      overdueMarked: overdueCount,
    });
  } catch (error) {
return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}


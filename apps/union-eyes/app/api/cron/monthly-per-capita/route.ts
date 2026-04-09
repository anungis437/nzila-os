/**
 * Monthly Per-Capita Cron Job
 * Protected by withApi cron auth (Phase 7 — Workflow Realignment).
 * Purpose: Automatically calculate per-capita remittances on 1st of each month
 * Schedule: Runs at midnight UTC on the 1st day of every month
 */

import { processMonthlyPerCapita } from '@/services/clc/per-capita-calculator';
import { markOverdueRemittances } from '@/services/clc/per-capita-calculator';
import { withApi } from '@/lib/api/framework';

// =====================================================================================
// GET - Monthly per-capita calculation
// =====================================================================================

const handler = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'Calculate monthly per-capita remittances' },
  },
  async () => {
    const result = await processMonthlyPerCapita();
    const overdueCount = await markOverdueRemittances();

    return {
      success: true,
      timestamp: new Date().toISOString(),
      calculation: result,
      overdueMarked: overdueCount,
    };
  },
);

export const GET = handler;
// POST for manual triggering
export const POST = handler;


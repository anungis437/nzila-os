/**
 * Monthly Per-Capita Cron Job
 * Protected by withApi cron auth (Phase 7 — Workflow Realignment).
 * Purpose: Automatically calculate per-capita remittances on 1st of each month
 * Schedule: lib/operations/scheduled-jobs.json (POST, 07:00 UTC on the 1st)
 *
 * Answers 500 when any organization's calculation or save failed (with the counts and the failing organization ids), so the
 * scheduler shows a failed run; the organizations that did succeed keep their remittances. It used to answer success true
 * whatever the counts, and ran the overdue sweep a second time on top of the one processMonthlyPerCapita already performs.
 */

import { processMonthlyPerCapita } from '@/services/clc/per-capita-calculator';
import { withApi } from '@/lib/api/framework';
import { jobResponse } from '@/lib/operations/job-result';

const handler = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'Calculate monthly per-capita remittances' },
  },
  async () => {
    const result = await processMonthlyPerCapita();
    return jobResponse({
      job: 'monthly-per-capita',
      // Every organization was either calculated (and then saved or not) or failed to calculate.
      attempted: result.calculated + result.calculationFailed,
      succeeded: result.saved,
      failures: result.failedOrganizationIds.map((scope) => ({ scope, reason: 'calculation or save failed' })),
      details: { calculation: { calculated: result.calculated, saved: result.saved, errors: result.errors }, overdueMarked: result.overdueMarked },
    });
  },
);

// POST only: a scheduler (lib/operations/scheduled-jobs.json) or an operator posts here; a GET can never run the job.
export const POST = handler;
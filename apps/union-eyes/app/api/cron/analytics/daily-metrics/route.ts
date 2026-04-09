/**
 * Daily Analytics Metrics Cron Job
 * Protected by withApi cron auth (Phase 7 — Workflow Realignment).
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron'],
      summary: 'Daily analytics metrics collection',
    },
  },
  async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  },
);

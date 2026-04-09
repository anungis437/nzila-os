/**
 * Process Notifications Cron Job (stub — not yet implemented)
 * Protected by withApi cron auth (Phase 7 — Workflow Realignment).
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'Process notifications (stub)' },
  },
  async () => {
    return { status: 'not_implemented', message: 'Process notifications cron not yet implemented', timestamp: new Date().toISOString() };
  },
);

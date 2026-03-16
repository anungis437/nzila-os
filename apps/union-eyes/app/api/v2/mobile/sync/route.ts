/**
 * Stub endpoint — returns empty data
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["System"],
      summary: 'List records',
      description: 'Returns data (stub).',
    },
  },
  async () => {
    return { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ["System"],
      summary: 'Create record',
      description: 'Creates a record (stub).',
    },
  },
  async () => {
    return { data: { id: crypto.randomUUID(), createdAt: new Date().toISOString() } };
  },
);

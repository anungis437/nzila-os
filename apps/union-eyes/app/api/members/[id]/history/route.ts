/**
 * Item stub endpoint
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Members"],
      summary: 'Get by ID (stub)',
      description: 'Returns a single record (stub).',
    },
  },
  async ({ params }) => {
    return { data: { id: params.id } };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ["Members"],
      summary: 'Update record (stub)',
      description: 'Updates a record (stub).',
    },
  },
  async ({ params }) => {
    return { data: { id: params.id, updatedAt: new Date().toISOString() } };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ["Members"],
      summary: 'Delete record (stub)',
      description: 'Deletes a record (stub).',
    },
  },
  async ({ params }) => {
    return { data: { id: params.id, deleted: true } };
  },
);

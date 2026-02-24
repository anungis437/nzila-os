/**
 * GET POST /api/ai/ingest
 * Migrated to withApi() framework
 */

import { withApi, z } from '@/lib/api/framework';

const _ingestSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  jurisdiction: z.string().optional(),
  tags: z.array(z.string()).optional(),
  extractEntities: z.boolean().default(true),
  addToRAG: z.boolean().default(true),
});

 
 
import { GET as v1GET, POST as v1POST } from '@/app/api/ai/ingest/route';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Ai'],
      summary: 'GET ingest',
    },
  },
  async ({ request, params: _params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1GET(request);
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Ai'],
      summary: 'POST ingest',
    },
  },
  async ({ request, params: _params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request);
    return response;
  },
);

/**
 * GET POST /api/ai/mamba
 * Migrated to withApi() framework
 */

import { withApi, z } from '@/lib/api/framework';

const _mambaRequestSchema = z.object({
  input: z.string().min(1).max(100000),
  options: z.object({
    maxTokens: z.number().min(1).max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
    systemPrompt: z.string().optional(),
    longDocument: z.boolean().default(false),
  }).optional(),
});

const _longDocumentSchema = z.object({
  document: z.string().min(1),
  chunkSize: z.number().min(512).max(8192).default(4096),
  overlap: z.number().min(0).max(1024).default(256),
});

 
 
import { GET as v1GET, POST as v1POST } from '@/app/api/ai/mamba/route';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Ai'],
      summary: 'GET mamba',
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
      summary: 'POST mamba',
    },
  },
  async ({ request, params: _params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request);
    return response;
  },
);

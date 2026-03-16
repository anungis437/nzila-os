/**
 * Health check endpoint
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ["System"],
      summary: 'Health check',
      description: 'Returns service health status.',
    },
  },
  async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  },
);

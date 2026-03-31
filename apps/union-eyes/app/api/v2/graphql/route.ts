/**
 * GET POST /api/v2/graphql
 * GraphQL endpoint — not yet available, use REST API endpoints.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Graphql'],
      summary: 'GET graphql',
    },
  },
  async () => {
    throw ApiError.notImplemented('GraphQL endpoint is not yet available. Use REST API endpoints instead.');
  },
);

export const POST = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Graphql'],
      summary: 'POST graphql',
    },
    successStatus: 201,
  },
  async () => {
    throw ApiError.notImplemented('GraphQL endpoint is not yet available. Use REST API endpoints instead.');
  },
);

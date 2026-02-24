/**
 * GET POST /api/graphql
 * Migrated to withApi() framework
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createYoga } from 'graphql-yoga';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { schema } from '@/lib/graphql/schema';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { resolvers } from '@/lib/graphql/resolvers';
 
 
 
 
 
 
 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Graphql'],
      summary: 'GET graphql',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {
    // TODO: migrate handler body
    throw ApiError.internal('Route not yet migrated');
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
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {
    // TODO: migrate handler body
    throw ApiError.internal('Route not yet migrated');
  },
);

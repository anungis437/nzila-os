import { NextResponse } from 'next/server';
/**
 * GET /api/docs/openapi
 * Migrated to withApi() framework
 */
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

 
 
 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Docs'],
      summary: 'GET openapi',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {

        const openApiPath = path.join(process.cwd(), 'docs', 'api', 'openapi-complete.yaml');

        if (!fs.existsSync(openApiPath)) {
          throw ApiError.notFound('OpenAPI specification not found. Run: pnpm run openapi:generate:enhanced');
        }

        const yamlContent = fs.readFileSync(openApiPath, 'utf-8');
        const spec = yaml.load(yamlContent) as Record<string, unknown>;

        return NextResponse.json(spec, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          },
        });

  },
);

/**
 * OpenAPI Spec Endpoint
 * Serves the complete OpenAPI 3.0 specification.
 *
 * The complete specification inventories every operation of the platform, so it is served only to an authenticated
 * administrator and is never cached by a shared cache. /api/docs/openapi.json is the public documentation.
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import * as yaml from 'js-yaml';
import { logger } from '@/lib/logger';
import { withRoleAuth } from '@/lib/api-auth-guard';

export const GET = withRoleAuth('admin', async () => {
  try {
    const openApiPath = path.join(process.cwd(), 'docs', 'api', 'openapi-complete.yaml');
    
    if (!fs.existsSync(openApiPath)) {
      return NextResponse.json(
        { error: 'OpenAPI specification not found. Run: pnpm run openapi:generate:enhanced' },
        { status: 404 }
      );
    }
    
    const yamlContent = fs.readFileSync(openApiPath, 'utf-8');
    const spec = yaml.load(yamlContent) as Record<string, unknown>;
    
    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    logger.error('Error loading OpenAPI spec:', error);
    return NextResponse.json(
      { error: 'Failed to load API specification' },
      { status: 500 }
    );
  }
});

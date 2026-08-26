/**
 * OpenAPI Spec Endpoint
 * Serves the complete OpenAPI 3.0 specification
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import * as yaml from 'js-yaml';
import { logger } from '@/lib/logger';

export async function GET() {
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
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    logger.error('Error loading OpenAPI spec:', error);
    return NextResponse.json(
      { error: 'Failed to load API specification' },
      { status: 500 }
    );
  }
}

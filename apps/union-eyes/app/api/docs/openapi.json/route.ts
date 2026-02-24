/**
 * OpenAPI JSON Endpoint
 * 
 * GET /api/docs/openapi.json - Returns OpenAPI specification
 */

import { NextResponse } from 'next/server';
import { openApiConfig } from '@/lib/api-docs/openapi-config';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(openApiConfig);
}


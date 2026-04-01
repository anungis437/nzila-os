import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';
import { withApiAuth } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('vocabulary:roles');

/**
 * GET /api/vocabulary/roles
 * 
 * Returns all role definitions with permissions.
 * 
 * Response: Role[]
 */
export const GET = withApiAuth(async (_request: NextRequest) => {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.roles, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    logger.error('[/api/vocabulary/roles] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve roles' },
      { status: 500 }
    );
  }
});

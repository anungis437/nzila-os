import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';
import { withApiAuth } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('vocabulary:statuses');

/**
 * GET /api/vocabulary/statuses
 * 
 * Returns all case statuses with allowed transitions and role permissions.
 * 
 * Response: Status[]
 */
export const GET = withApiAuth(async (_request: NextRequest) => {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.statuses, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    logger.error('[/api/vocabulary/statuses] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve statuses' },
      { status: 500 }
    );
  }
});

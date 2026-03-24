import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';
import { withApiAuth } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('vocabulary:severities');

/**
 * GET /api/vocabulary/severities
 * 
 * Returns all severity levels for case classification.
 * 
 * Response: Severity[]
 */
export const GET = withApiAuth(async (request: NextRequest) => {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.severities, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    logger.error('[/api/vocabulary/severities] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve severities' },
      { status: 500 }
    );
  }
});

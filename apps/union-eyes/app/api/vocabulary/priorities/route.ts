import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';
import { withApiAuth } from '@/lib/api-auth-guard';
import { toPublicVocabulary } from '@/lib/vocabulary/public-vocabulary';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('vocabulary:priorities');

/**
 * GET /api/vocabulary/priorities
 * 
 * Returns the priority levels (identifier and label). Service-level hours are not served: they are package defaults, not institutional data.
 * 
 * Response: Priority[]
 */
export const GET = withApiAuth(async (_request: NextRequest) => {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(toPublicVocabulary(vocabulary).priorities, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    logger.error('[/api/vocabulary/priorities] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve priorities' },
      { status: 500 }
    );
  }
});

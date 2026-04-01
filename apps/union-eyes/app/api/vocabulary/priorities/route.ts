import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';
import { withApiAuth } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('vocabulary:priorities');

/**
 * GET /api/vocabulary/priorities
 * 
 * Returns all priority levels with SLA hours and escalation requirements.
 * 
 * Response: Priority[]
 */
export const GET = withApiAuth(async (_request: NextRequest) => {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.priorities, {
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

import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';
import { withApiAuth } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('vocabulary:case-types');

/**
 * GET /api/vocabulary/case-types
 * 
 * Returns all available case types for the CUPE grievance system.
 * 
 * Response: CaseType[]
 */
export const GET = withApiAuth(async (request: NextRequest) => {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.caseTypes, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    logger.error('[/api/vocabulary/case-types] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve case types' },
      { status: 500 }
    );
  }
});

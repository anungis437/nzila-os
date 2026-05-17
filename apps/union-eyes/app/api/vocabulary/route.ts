import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';
import { withApiAuth } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('vocabulary');

/**
 * GET /api/vocabulary
 * 
 * Returns the complete CUPE vocabulary (case types, priorities, severities, roles, statuses).
 * Org-scoped: Only returns vocabulary; no org-specific customization in v0.1.
 * 
 * Authentication: Required (via platform auth middleware)
 * RLS: Not applicable (vocabulary is system-wide, not org-scoped)
 * 
 * Response: CUPEVocabulary
 */
export const GET = withApiAuth(async (_request: NextRequest) => {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache vocab for 1 hour
      },
    });
  } catch (error) {
    logger.error('[/api/vocabulary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve vocabulary' },
      { status: 500 }
    );
  }
});


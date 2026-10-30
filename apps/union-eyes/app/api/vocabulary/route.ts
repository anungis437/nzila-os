import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';
import { withApiAuth } from '@/lib/api-auth-guard';
import { toPublicVocabulary } from '@/lib/vocabulary/public-vocabulary';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('vocabulary');

/**
 * GET /api/vocabulary
 * 
 * Returns the CUPE vocabulary labels (case types, priorities, severities, roles, statuses) without SLA hours, role flags or transitions.
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
    
    return NextResponse.json(toPublicVocabulary(vocabulary), {
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


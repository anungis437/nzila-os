import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';

/**
 * GET /api/vocabulary
 * 
 * Returns the complete CUPE vocabulary (case types, priorities, severities, roles, statuses).
 * Org-scoped: Only returns vocabulary; no org-specific customization in v0.1.
 * 
 * Authentication: Required (via Clerk auth middleware)
 * RLS: Not applicable (vocabulary is system-wide, not org-scoped)
 * 
 * Response: CUPEVocabulary
 */
export async function GET(request: NextRequest) {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache vocab for 1 hour
      },
    });
  } catch (error) {
    console.error('[/api/vocabulary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve vocabulary' },
      { status: 500 }
    );
  }
}

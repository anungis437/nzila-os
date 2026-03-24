import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';

/**
 * GET /api/vocabulary/severities
 * 
 * Returns all severity levels for case classification.
 * 
 * Response: Severity[]
 */
export async function GET(request: NextRequest) {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.severities, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[/api/vocabulary/severities] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve severities' },
      { status: 500 }
    );
  }
}

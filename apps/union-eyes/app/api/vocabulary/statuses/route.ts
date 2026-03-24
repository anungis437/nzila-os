import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';

/**
 * GET /api/vocabulary/statuses
 * 
 * Returns all case statuses with allowed transitions and role permissions.
 * 
 * Response: Status[]
 */
export async function GET(request: NextRequest) {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.statuses, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[/api/vocabulary/statuses] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve statuses' },
      { status: 500 }
    );
  }
}

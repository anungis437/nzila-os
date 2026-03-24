import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';

/**
 * GET /api/vocabulary/roles
 * 
 * Returns all role definitions with permissions.
 * 
 * Response: Role[]
 */
export async function GET(request: NextRequest) {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.roles, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[/api/vocabulary/roles] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve roles' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';

/**
 * GET /api/vocabulary/case-types
 * 
 * Returns all available case types for the CUPE grievance system.
 * 
 * Response: CaseType[]
 */
export async function GET(request: NextRequest) {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.caseTypes, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[/api/vocabulary/case-types] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve case types' },
      { status: 500 }
    );
  }
}

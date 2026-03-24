import { NextRequest, NextResponse } from 'next/server';
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary';

/**
 * GET /api/vocabulary/priorities
 * 
 * Returns all priority levels with SLA hours and escalation requirements.
 * 
 * Response: Priority[]
 */
export async function GET(request: NextRequest) {
  try {
    const vocabulary = getCUPEVocabulary();
    
    return NextResponse.json(vocabulary.priorities, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[/api/vocabulary/priorities] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve priorities' },
      { status: 500 }
    );
  }
}

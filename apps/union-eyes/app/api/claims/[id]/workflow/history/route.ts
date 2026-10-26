/**
 * GET /api/claims/[id]/workflow/history
 * Case status history, scoped by the canonical case read authority and transition visibility.
 * grievance_transitions has no RLS policy yet, so this route is the access control.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor, caseAuthorizationResponse } from '@/lib/cases/case-authorization';
import { readTransitionHistory } from '@/lib/cases/transition-history';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const actor = await getCaseActor();
    const { id } = await params;
    const history = await withRLSContext((tx) => readTransitionHistory(tx, actor, id));
    return NextResponse.json({ history });
  } catch (error) {
    const response = caseAuthorizationResponse(error);
    if (response) return response;
    throw error;
  }
}
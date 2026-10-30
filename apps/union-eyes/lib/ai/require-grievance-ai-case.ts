/**
 * Gate 0: AI processing of a grievance is a case-level access decision,
 * never an implication of the steward title or tenant membership.
 * Fail before reading any grievance data or invoking an external provider.
 */
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';

export class GrievanceAiCaseAccessDenied extends Error {
  readonly code = 'GRIEVANCE_AI_CASE_ACCESS_DENIED';
  constructor() {
    super('Case access required');
    this.name = 'GrievanceAiCaseAccessDenied';
  }
}

export async function requireGrievanceAiCaseAccess(input: {
  userId: string;
  organizationId: string;
  grievanceId: string;
}): Promise<void> {
  if (!input.userId || !input.organizationId || !input.grievanceId)
    throw new GrievanceAiCaseAccessDenied();

  // The authority kernel verifies an unrevoked, unexpired case relationship.
  // Its own DB errors fail closed to canViewCase=false.
  const decision = await getEffectiveCaseAccess(input);
  if (!decision.canViewCase) throw new GrievanceAiCaseAccessDenied();
}

/**
 * What GET /api/cases lists. The route builds the rows with SQL, so these types are what its select names; the screens that read the list take theirs from here.
 *
 * A case the caller may read in full is a CaseListRow. A case the caller can only see in the triage queue (nobody holds an owner or assignee relationship to it) is a CaseQueueRow: the queue
 * is metadata only, never the member, the description, the analysis, the evidence or an amount (see caseTriageQueueScope in case-authorization.ts).
 */
export interface CaseListRow {
  claimId: string;
  claimNumber: string | null;
  organizationId: string;
  memberId: string | null;
  isAnonymous: boolean | null;
  claimType: string | null;
  status: string;
  priority: string;
  incidentDate: Date | null;
  location: string | null;
  description: string | null;
  desiredOutcome: string | null;
  filedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignedTo: string | null;
  assignedAt: Date | null;
  aiScore: number | string | null;
  meritConfidence: number | string | null;
  complexityScore: number | string | null;
  claimAmount: number | string | null;
  resolutionOutcome: string | null;
  resolvedAt: Date | null;
  progress: number | null;
  memberName: string | null;
  memberEmail: string | null;
  /** The name the organization's member record gives the assignee; null when the case is unassigned or the assignee is no longer a member. */
  assignedToName: string | null;
}

export interface CaseQueueRow {
  claimId: string;
  claimNumber: string | null;
  claimType: string | null;
  status: string;
  priority: string;
  createdAt: Date;
  filedDate: Date | null;
  triageOnly: true;
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus =
  | 'new'
  | 'triage'
  | 'assigned'
  | 'investigating'
  | 'action_planning'
  | 'monitoring'
  | 'resolved'
  | 'closed'
  | 'archived';

export type IncidentCategory =
  | 'hiring'
  | 'promotion'
  | 'discipline'
  | 'service_delivery'
  | 'policy';

export type IntakeChannel = 'web' | 'email' | 'phone' | 'manager_escalation';

export type IncidentEventType =
  | 'created'
  | 'assignment_changed'
  | 'status_changed'
  | 'note_added'
  | 'evidence_added'
  | 'remediation_created'
  | 'due_date_changed'
  | 'closed'
  | 'courtlens_event';

export type RemediationType =
  | 'policy_review'
  | 'training_assignment'
  | 'leadership_meeting'
  | 'process_correction'
  | 'communication_plan'
  | 'disciplinary_review'
  | 'external_advisor_consult';

export type RemediationStatus = 'open' | 'in_progress' | 'blocked' | 'completed';

export type NoteVisibilityScope =
  | 'private'
  | 'investigator_only'
  | 'legal_only'
  | 'executive_safe';

export interface IncidentRecord {
  id: string;
  orgId: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  intakeChannel: IntakeChannel;
  createdBy: string;
  assignedTo: string | null;
  openedAt: string;
  dueAt: string | null;
  closedAt: string | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentCreateInput {
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  intakeChannel: IntakeChannel;
  summary: string;
  dueAt?: string | null;
}

export interface IncidentUpdateInput {
  title?: string;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  dueAt?: string | null;
  summary?: string;
}

export interface IncidentAssignInput {
  assignedTo: string;
  reason: string;
  dueAt?: string | null;
}

export interface IncidentTransitionInput {
  to: IncidentStatus;
  reason: string;
}

export interface IncidentEventRecord {
  id: string;
  incidentId: string;
  actorId: string;
  type: IncidentEventType;
  payloadJson: Record<string, unknown>;
  createdAt: string;
}

export interface RemediationActionRecord {
  id: string;
  incidentId: string;
  ownerId: string;
  description: string;
  remediationType: RemediationType;
  dueDate: string;
  status: RemediationStatus;
  completionEvidence: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemediationActionCreateInput {
  ownerId: string;
  description: string;
  remediationType: RemediationType;
  dueDate: string;
}

export interface IncidentNoteRecord {
  id: string;
  incidentId: string;
  authorId: string;
  visibilityScope: NoteVisibilityScope;
  content: string;
  createdAt: string;
}

export interface IncidentTimelineItem {
  id: string;
  incidentId: string;
  happenedAt: string;
  actorId: string;
  type: IncidentEventType | 'remediation_status_changed';
  description: string;
  data?: Record<string, unknown>;
}

export interface IncidentDetail {
  incident: IncidentRecord;
  events: IncidentEventRecord[];
  actions: RemediationActionRecord[];
  notes: IncidentNoteRecord[];
  timeline: IncidentTimelineItem[];
}

export interface IncidentDetailOptions {
  role?: string;
  includeSensitiveNotes?: boolean;
}

export interface AbrDashboardSummary {
  orgId: string;
  generatedAt: string;
  openIncidents: number;
  overdueInvestigations: number;
  overdueActions: number;
  avgDaysOpen: number;
  incidentsByCategory: Record<IncidentCategory, number>;
  trainingCompletionPct: number;
  unresolvedHotspots: number;
  ownerWorkload: Array<{ ownerId: string; openCount: number }>;
  trend90d: Array<{ date: string; opened: number; closed: number }>;
}

export interface AbrUserRecord {
  id: string;
  orgId: string;
  role: string;
  email: string;
  name: string;
  active: boolean;
}

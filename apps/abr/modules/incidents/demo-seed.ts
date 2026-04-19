import type {
  AbrUserRecord,
  IncidentRecord,
  IncidentEventRecord,
  RemediationActionRecord,
  IncidentNoteRecord,
} from './types';

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

export const DEMO_ORGS = [
  { id: 'metro-university', name: 'Metro University', sector: 'Education', region: 'CA-ON' },
  { id: 'northcare-hospital', name: 'NorthCare Hospital', sector: 'Healthcare', region: 'CA-ON' },
  { id: 'city-of-lakeside', name: 'City of Lakeside', sector: 'Municipal', region: 'CA-BC' },
  { id: 'national-union-local', name: 'National Union Local', sector: 'Union', region: 'CA-QC' },
] as const;

export const DEMO_USERS: AbrUserRecord[] = [
  {
    id: 'usr_metro_hr_01',
    orgId: 'metro-university',
    role: 'hr_lead',
    email: 'hr.lead@metro-university.ca',
    name: 'Amina Clarke',
    active: true,
  },
  {
    id: 'usr_metro_inv_01',
    orgId: 'metro-university',
    role: 'investigator',
    email: 'investigator@metro-university.ca',
    name: 'Jordan Mensah',
    active: true,
  },
  {
    id: 'usr_metro_exec_01',
    orgId: 'metro-university',
    role: 'executive_viewer',
    email: 'vp.people@metro-university.ca',
    name: 'Kia Thompson',
    active: true,
  },
];

export const DEMO_INCIDENTS: IncidentRecord[] = [
  {
    id: 'inc_metro_001',
    orgId: 'metro-university',
    title: 'Interview panel bias escalation',
    category: 'hiring',
    severity: 'high',
    status: 'investigating',
    intakeChannel: 'manager_escalation',
    createdBy: 'usr_metro_hr_01',
    assignedTo: 'usr_metro_inv_01',
    openedAt: iso(16),
    dueAt: iso(-4),
    closedAt: null,
    summary: 'Panel scoring criteria diverged across candidates and disadvantaged Black applicants.',
    createdAt: iso(16),
    updatedAt: iso(2),
  },
  {
    id: 'inc_metro_002',
    orgId: 'metro-university',
    title: 'Residence conduct sanctions disproportionality review',
    category: 'discipline',
    severity: 'medium',
    status: 'action_planning',
    intakeChannel: 'web',
    createdBy: 'usr_metro_hr_01',
    assignedTo: 'usr_metro_inv_01',
    openedAt: iso(24),
    dueAt: iso(-7),
    closedAt: null,
    summary: 'Escalated concerns about sanction patterns affecting Black students at higher rates.',
    createdAt: iso(24),
    updatedAt: iso(3),
  },
];

export const DEMO_EVENTS: IncidentEventRecord[] = [
  {
    id: 'evt_metro_001',
    incidentId: 'inc_metro_001',
    actorId: 'usr_metro_hr_01',
    type: 'created',
    payloadJson: { status: 'new' },
    createdAt: iso(16),
  },
  {
    id: 'evt_metro_002',
    incidentId: 'inc_metro_001',
    actorId: 'usr_metro_hr_01',
    type: 'assignment_changed',
    payloadJson: { assignedTo: 'usr_metro_inv_01', reason: 'formal escalation' },
    createdAt: iso(15),
  },
  {
    id: 'evt_metro_003',
    incidentId: 'inc_metro_001',
    actorId: 'usr_metro_inv_01',
    type: 'status_changed',
    payloadJson: { from: 'assigned', to: 'investigating' },
    createdAt: iso(14),
  },
];

export const DEMO_ACTIONS: RemediationActionRecord[] = [
  {
    id: 'act_metro_001',
    incidentId: 'inc_metro_001',
    ownerId: 'usr_metro_hr_01',
    description: 'Review interview scorecard guidance with hiring committee chairs.',
    remediationType: 'policy_review',
    dueDate: iso(-2),
    status: 'in_progress',
    completionEvidence: null,
    completedAt: null,
    createdAt: iso(10),
    updatedAt: iso(1),
  },
  {
    id: 'act_metro_002',
    incidentId: 'inc_metro_002',
    ownerId: 'usr_metro_inv_01',
    description: 'Deliver corrective coaching to residence conduct officers.',
    remediationType: 'training_assignment',
    dueDate: iso(-1),
    status: 'open',
    completionEvidence: null,
    completedAt: null,
    createdAt: iso(6),
    updatedAt: iso(2),
  },
];

export const DEMO_NOTES: IncidentNoteRecord[] = [
  {
    id: 'note_metro_001',
    incidentId: 'inc_metro_001',
    authorId: 'usr_metro_inv_01',
    visibilityScope: 'investigator_only',
    content: 'Initial witness interviews complete; drafting recommendation pack.',
    createdAt: iso(4),
  },
  {
    id: 'note_metro_002',
    incidentId: 'inc_metro_001',
    authorId: 'usr_metro_exec_01',
    visibilityScope: 'executive_safe',
    content: 'Executive brief requested before next governance committee meeting.',
    createdAt: iso(2),
  },
];

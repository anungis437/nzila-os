import type { AbrRole } from './rbac';
import type {
  IncidentDetail,
  IncidentEventRecord,
  IncidentNoteRecord,
  NoteVisibilityScope,
} from '@/modules/incidents/types';

export interface IncidentVisibilityPolicy {
  canSeeAggregateOnly: boolean;
  allowedNoteScopes: NoteVisibilityScope[];
  canSeeSensitiveTimeline: boolean;
  canSeeEvidence: boolean;
}

export function getIncidentVisibilityPolicy(role: AbrRole): IncidentVisibilityPolicy {
  switch (role) {
    case 'executive_viewer':
      return {
        canSeeAggregateOnly: true,
        allowedNoteScopes: ['executive_safe'],
        canSeeSensitiveTimeline: false,
        canSeeEvidence: false,
      };
    case 'auditor':
      return {
        canSeeAggregateOnly: false,
        allowedNoteScopes: ['executive_safe'],
        canSeeSensitiveTimeline: true,
        canSeeEvidence: false,
      };
    case 'legal_counsel':
      return {
        canSeeAggregateOnly: false,
        allowedNoteScopes: ['executive_safe', 'legal_only'],
        canSeeSensitiveTimeline: true,
        canSeeEvidence: true,
      };
    case 'investigator':
    case 'organization_admin':
    case 'super_admin':
      return {
        canSeeAggregateOnly: false,
        allowedNoteScopes: ['private', 'investigator_only', 'legal_only', 'executive_safe'],
        canSeeSensitiveTimeline: true,
        canSeeEvidence: true,
      };
    case 'hr_lead':
    case 'dei_lead':
      return {
        canSeeAggregateOnly: false,
        allowedNoteScopes: ['investigator_only', 'executive_safe'],
        canSeeSensitiveTimeline: true,
        canSeeEvidence: false,
      };
    default:
      return {
        canSeeAggregateOnly: true,
        allowedNoteScopes: ['executive_safe'],
        canSeeSensitiveTimeline: false,
        canSeeEvidence: false,
      };
  }
}

function redactEvent(event: IncidentEventRecord): IncidentEventRecord {
  return {
    ...event,
    payloadJson: {},
  };
}

function redactNote(note: IncidentNoteRecord): IncidentNoteRecord {
  return {
    ...note,
    content: '[redacted]',
  };
}

export function applyIncidentRedaction(detail: IncidentDetail, role: AbrRole): IncidentDetail {
  const policy = getIncidentVisibilityPolicy(role);
  const notes = detail.notes
    .filter((note) => policy.allowedNoteScopes.includes(note.visibilityScope))
    .map((note) => (policy.canSeeAggregateOnly ? redactNote(note) : note));

  const events = policy.canSeeSensitiveTimeline
    ? detail.events
    : detail.events.map(redactEvent);

  const actions = policy.canSeeAggregateOnly
    ? detail.actions.map((action) => ({
        ...action,
        description: 'Executive-safe remediation record',
        completionEvidence: null,
      }))
    : detail.actions;

  const incident = policy.canSeeAggregateOnly
    ? {
        ...detail.incident,
        summary: 'Redacted for executive-safe access. Review governance summary for aggregate trends.',
      }
    : detail.incident;

  const timeline = policy.canSeeSensitiveTimeline
    ? detail.timeline
    : detail.timeline.map((item) => ({
        ...item,
        description: 'Redacted timeline event',
        data: {},
      }));

  return {
    incident,
    events,
    actions,
    notes,
    timeline,
  };
}
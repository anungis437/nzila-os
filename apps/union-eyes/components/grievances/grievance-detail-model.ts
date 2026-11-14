/**
 * What the grievance detail screen reads, and the few rules it applies before it asks the server for anything.
 *
 * GET /api/grievances/:id answers { success, data } where data is the grievance row with its events, its governed documents, its
 * collaborators and the caller's effective access. A body that lacks a part the screen reads is an error to show, never a grievance
 * with an empty timeline or an empty document list.
 *
 * The status the screen offers next is what the server's own lifecycle rules allow: PATCH /api/grievances/:id/status accepts the
 * grievance_status members, translates both statuses through the state bridge and asks validateTransition (lib/workflow/case-lifecycle)
 * with the actor's role and the assigned representative. The same functions answer here, so a button is offered only for a change the
 * server can accept. The caller's role is not known to the screen: it asks as a steward, the lowest role that can change a status, so
 * a transition only a higher role may make is not offered here (the server stays the authority either way). Who is assigned is read from
 * the case-access kernel (primaryLroId): the representative column on the grievance row is mutable and not an authority source.
 */
import type { GrievanceStatus } from '@/db/schema/domains/claims/grievances';
import { canTransitionGrievance } from '@/lib/cases/grievance-transition-authority';
import { ApiShapeError, envelopeData, isRecord } from '@/lib/client/api-envelope';
import { validateTransition } from '@/lib/workflow/case-lifecycle';
import { toLifecycleState } from '@/lib/workflow/state-bridge';

export interface GrievanceEvent {
  id: string;
  eventType: string;
  notes: string | null;
  createdAt: string;
}

export interface GovernedDocument {
  id: string;
  title: string | null;
  filename: string | null;
  fileUrl: string;
  documentType: string;
  privacyLabel: string;
  createdAt: string;
}

export interface CollaboratorAccess {
  id: string;
  userId: string;
  accessRole: string;
  status: string;
  expiresAt: string | null;
}

export interface EffectiveAccess {
  canViewInternal: boolean;
  isPrimaryOwner: boolean;
  isSecondaryCollaborator: boolean;
  accessRole: string | null;
  canManageAssignments: boolean;
  canUploadDocuments: boolean;
}

export interface GrievanceDetail {
  id: string;
  grievanceNumber: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  filedDate: string | null;
  /** The representative with primary ownership, from the case-access kernel; null while nobody is assigned. */
  primaryLroId: string | null;
  employerName: string | null;
  cbaArticle: string | null;
  events: GrievanceEvent[];
  governedDocuments: GovernedDocument[];
  collaborators: CollaboratorAccess[];
  effectiveAccess: EffectiveAccess;
}

// Keyed by the database enum, so a status added there cannot be left without a color (or a label in the catalog test) at compile time.
export const STATUS_COLORS: Record<GrievanceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  new: 'bg-blue-100 text-blue-800',
  filed: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  investigating: 'bg-orange-100 text-orange-800',
  response_due: 'bg-purple-100 text-purple-800',
  response_received: 'bg-purple-100 text-purple-800',
  escalated: 'bg-red-100 text-red-800',
  mediation: 'bg-purple-100 text-purple-800',
  arbitration: 'bg-red-100 text-red-800',
  settled: 'bg-green-100 text-green-800',
  withdrawn: 'bg-gray-100 text-gray-800',
  denied: 'bg-gray-100 text-gray-800',
  closed: 'bg-gray-100 text-gray-800',
  converted: 'bg-green-100 text-green-800',
  closed_no_case: 'bg-gray-100 text-gray-800',
};

export const GRIEVANCE_STATUSES = Object.keys(STATUS_COLORS) as GrievanceStatus[];

export const isKnownStatus = (status: string): status is GrievanceStatus => Object.prototype.hasOwnProperty.call(STATUS_COLORS, status);

export const PRIVACY_LABELS = ['public_internal', 'team_confidential', 'lro_confidential', 'privileged', 'case_restricted', 'highly_sensitive'] as const;

/** The document types the form offers, which are members of the types POST /api/grievances/:id/documents accepts. */
export const DOCUMENT_TYPES = ['evidence', 'witness_statement', 'correspondence', 'other'] as const;

export const ACCESS_ROLES = ['secondary_lro', 'reviewer', 'read_only'] as const;

const lifecycleOf = (status: string) => toLifecycleState('grievance', status) ?? toLifecycleState('cupe', status);

/** The statuses the server's lifecycle rules allow from `current`, for a steward and the assigned representative. */
export function nextStatuses(current: string, assignedTo: string | null): GrievanceStatus[] {
  const from = lifecycleOf(current);
  if (!from) return [];
  return GRIEVANCE_STATUSES.filter((target) => {
    if (target === current) return false;
    const to = lifecycleOf(target);
    return to !== null && validateTransition({ actorRole: 'steward', caseId: 'client', currentState: from, targetState: to, assignedTo }).allowed;
  });
}

/** Whether the caller has authority over this matter to change its status: the rule the status route applies. */
export const maySetStatus = (grievance: Pick<GrievanceDetail, 'status' | 'primaryLroId' | 'effectiveAccess'>): boolean =>
  canTransitionGrievance({
    isPrimaryOwner: grievance.effectiveAccess.isPrimaryOwner,
    accessRole: grievance.effectiveAccess.isSecondaryCollaborator ? grievance.effectiveAccess.accessRole : null,
    grievanceStatus: grievance.status,
    primaryRepresentativeId: grievance.primaryLroId,
  });

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  heic: 'image/heic',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  eml: 'message/rfc822',
  msg: 'application/vnd.ms-outlook',
};

/** The media type a file name implies; a name with no known extension is application/octet-stream, which says only that the type is not known. */
export function mimeTypeOf(filename: string): string {
  const extension = filename.trim().split('.').pop()?.toLowerCase() ?? '';
  return filename.includes('.') && Object.prototype.hasOwnProperty.call(MIME_TYPES, extension) ? MIME_TYPES[extension] : 'application/octet-stream';
}

/** A web address: the only kind of address a document is registered under, or opened from. A javascript: or data: address would run in the page that follows it. */
export function webUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const mustBeText = (value: unknown, what: string): string => {
  const found = text(value);
  if (found === null) throw new ApiShapeError(`a grievance without ${what}`);
  return found;
};

function records(value: unknown, what: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new ApiShapeError(`a grievance without ${what}`);
  return value.map((item) => {
    if (!isRecord(item)) throw new ApiShapeError(`a ${what} entry that is not a record`);
    return item;
  });
}

export function readGrievanceDetail(body: unknown): GrievanceDetail {
  const data = envelopeData(body);
  const access = data.effectiveAccess;
  if (
    !isRecord(access) ||
    typeof access.isPrimaryOwner !== 'boolean' ||
    typeof access.canManageAssignments !== 'boolean' ||
    typeof access.canUploadDocuments !== 'boolean'
  ) {
    throw new ApiShapeError('a grievance without the caller’s access');
  }
  return {
    id: mustBeText(data.id, 'an id'),
    grievanceNumber: mustBeText(data.grievanceNumber, 'a number'),
    type: text(data.type) ?? '',
    status: mustBeText(data.status, 'a status'),
    priority: text(data.priority) ?? '',
    title: text(data.title) ?? '',
    description: text(data.description),
    filedDate: text(data.filedDate),
    primaryLroId: text(data.primaryLroId),
    employerName: text(data.employerName),
    cbaArticle: text(data.cbaArticle),
    events: records(data.events, 'events').map((event) => ({
      id: mustBeText(event.id, 'an event id'),
      eventType: text(event.eventType) ?? '',
      notes: text(event.notes),
      createdAt: mustBeText(event.createdAt, 'an event date'),
    })),
    governedDocuments: records(data.governedDocuments, 'governed documents').map((document) => ({
      id: mustBeText(document.id, 'a document id'),
      title: text(document.title),
      filename: text(document.filename),
      fileUrl: mustBeText(document.fileUrl, 'a document address'),
      documentType: text(document.documentType) ?? '',
      privacyLabel: text(document.privacyLabel) ?? '',
      createdAt: mustBeText(document.createdAt, 'a document date'),
    })),
    collaborators: records(data.collaborators, 'collaborators').map((assignment) => ({
      id: mustBeText(assignment.id, 'an access id'),
      userId: mustBeText(assignment.userId, 'an access user'),
      accessRole: text(assignment.accessRole) ?? '',
      status: text(assignment.status) ?? '',
      expiresAt: text(assignment.expiresAt),
    })),
    effectiveAccess: {
      // Missing authority never enables internal tools.
      canViewInternal: access.canViewInternal === true,
      isPrimaryOwner: access.isPrimaryOwner,
      isSecondaryCollaborator: access.isSecondaryCollaborator === true,
      accessRole: text(access.accessRole),
      canManageAssignments: access.canManageAssignments,
      canUploadDocuments: access.canUploadDocuments,
    },
  };
}

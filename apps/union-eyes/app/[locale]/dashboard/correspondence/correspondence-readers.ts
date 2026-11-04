/**
 * Reads what the correspondence routes answer, for the correspondence dashboard.
 *
 * GET /api/correspondence returns { data: [letter, ...], count } and GET /api/correspondence/{id} returns { data: letter } (each wrapped once more
 * by withApi), so both read through the list and record helpers. A body that is not that shape is an error for the screen to report, never an
 * empty queue or a blank letter. The history of a letter carries the event, the actor and the time only: the route does not serve the network
 * address, user agent or hash of an entry, and nothing here asks for them.
 */
import { ApiShapeError, envelopeRow, envelopeRows } from '@/lib/client/api-envelope';
import { asRecord, optionalDate, optionalString, requiredDate, requiredString } from '@/lib/client/row-fields';

export const CORRESPONDENCE_STATUSES = ['draft', 'pending_review', 'approved', 'signed', 'dispatched', 'delivered', 'returned', 'cancelled'] as const;
export type CorrespondenceStatus = (typeof CORRESPONDENCE_STATUSES)[number];

export const DISPATCH_METHODS = ['email', 'mail', 'fax', 'hand_delivered', 'courier'] as const;
export type DispatchMethod = (typeof DISPATCH_METHODS)[number];

export interface CorrespondenceListItem {
  id: string;
  referenceNumber: string | null;
  subject: string;
  status: CorrespondenceStatus;
  type: string;
  priority: string;
  draftedBy: string;
  assignedSignerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorrespondenceRecipient {
  id: string;
  kind: string;
  name: string;
  email: string | null;
  mailingAddress: string | null;
  organization: string | null;
  title: string | null;
}

export interface CorrespondenceHistoryEntry {
  id: string;
  event: string;
  description: string | null;
  actorName: string | null;
  actorRole: string | null;
  at: Date;
}

export interface CorrespondenceDetail extends CorrespondenceListItem {
  body: string;
  internalNotes: string | null;
  approvedAt: Date | null;
  signedAt: Date | null;
  dispatchedAt: Date | null;
  dispatchMethod: string | null;
  recipients: CorrespondenceRecipient[];
  history: CorrespondenceHistoryEntry[];
}

function readStatus(row: Record<string, unknown>): CorrespondenceStatus {
  const status = requiredString(row, 'status');
  if (!(CORRESPONDENCE_STATUSES as readonly string[]).includes(status)) throw new ApiShapeError(`status "${status}" is not a correspondence status`);
  return status as CorrespondenceStatus;
}

function readListItem(row: Record<string, unknown>): CorrespondenceListItem {
  return {
    id: requiredString(row, 'id'),
    referenceNumber: optionalString(row, 'referenceNumber'),
    subject: requiredString(row, 'subject'),
    status: readStatus(row),
    type: requiredString(row, 'type'),
    priority: requiredString(row, 'priority'),
    draftedBy: requiredString(row, 'draftedBy'),
    assignedSignerId: optionalString(row, 'assignedSignerId'),
    createdAt: requiredDate(row, 'createdAt'),
    updatedAt: requiredDate(row, 'updatedAt'),
  };
}

export function readCorrespondenceList(body: unknown): CorrespondenceListItem[] {
  return envelopeRows(body).map((item, index) => readListItem(asRecord(item, `letter ${index + 1}`)));
}

function rowsOf(row: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = row[key];
  if (!Array.isArray(value)) throw new ApiShapeError(`${key} is not a list`);
  return value.map((item, index) => asRecord(item, `${key} ${index + 1}`));
}

export function readCorrespondenceDetail(body: unknown): CorrespondenceDetail {
  const row = envelopeRow(body);
  return {
    ...readListItem(row),
    body: requiredString(row, 'body'),
    internalNotes: optionalString(row, 'internalNotes'),
    approvedAt: optionalDate(row, 'approvedAt'),
    signedAt: optionalDate(row, 'signedAt'),
    dispatchedAt: optionalDate(row, 'dispatchedAt'),
    dispatchMethod: optionalString(row, 'dispatchMethod'),
    recipients: rowsOf(row, 'recipients').map((recipient) => ({
      id: requiredString(recipient, 'id'),
      kind: requiredString(recipient, 'recipientType'),
      name: requiredString(recipient, 'name'),
      email: optionalString(recipient, 'email'),
      mailingAddress: optionalString(recipient, 'mailingAddress'),
      organization: optionalString(recipient, 'organization'),
      title: optionalString(recipient, 'title'),
    })),
    history: rowsOf(row, 'auditTrail').map((entry) => ({
      id: requiredString(entry, 'id'),
      event: requiredString(entry, 'eventType'),
      description: optionalString(entry, 'eventDescription'),
      actorName: optionalString(entry, 'actorName'),
      actorRole: optionalString(entry, 'actorRole'),
      at: requiredDate(entry, 'timestamp'),
    })),
  };
}

export interface SavedSignature {
  id: string;
  displayName: string;
  displayTitle: string | null;
  isDefault: boolean;
}

/** GET /api/correspondence/signatures returns { data: [signature, ...] }: the signer's saved signatures, newest first. */
export function readSignatures(body: unknown): SavedSignature[] {
  return envelopeRows(body).map((item, index) => {
    const row = asRecord(item, `signature ${index + 1}`);
    return {
      id: requiredString(row, 'id'),
      displayName: requiredString(row, 'displayName'),
      displayTitle: optionalString(row, 'displayTitle'),
      isDefault: row.isDefault === true,
    };
  });
}

/** What the person may do with a letter now. It mirrors the routes' own rules; the server still decides, and its refusal is shown as it states it. */
export interface LetterActions {
  edit: boolean;
  submit: boolean;
  claimSigner: boolean;
  approve: boolean;
  requestRevision: boolean;
  sign: boolean;
  dispatch: boolean;
  cancel: boolean;
  reopen: boolean;
}

export interface Viewer {
  userId: string;
  /** At least an officer: the level the approve, revise, sign and signature routes require. */
  canSign: boolean;
}

export function actionsFor(letter: Pick<CorrespondenceDetail, 'status' | 'draftedBy' | 'assignedSignerId'>, viewer: Viewer): LetterActions {
  const { status } = letter;
  const isSigner = letter.assignedSignerId !== null && letter.assignedSignerId === viewer.userId;
  return {
    edit: status === 'draft',
    submit: status === 'draft' && letter.assignedSignerId !== null,
    claimSigner: status === 'draft' && viewer.canSign && !isSigner,
    // Approval is an independent review: the drafter does not approve their own letter.
    approve: status === 'pending_review' && viewer.canSign && letter.draftedBy !== viewer.userId,
    requestRevision: (status === 'pending_review' || status === 'approved') && viewer.canSign,
    sign: status === 'approved' && viewer.canSign && isSigner,
    dispatch: status === 'signed',
    cancel: status === 'draft' || status === 'pending_review' || status === 'approved' || status === 'signed',
    reopen: (status === 'cancelled' || status === 'returned') && viewer.canSign,
  };
}

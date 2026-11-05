/**
 * What the chatbot routes answer, read for browser code.
 *
 * GET /api/chatbot/sessions, POST /api/chatbot/sessions and GET /api/chatbot/sessions/[id]/messages answer { success, data: { data } } (withApi's envelope
 * around the handler's { data }); POST /api/chatbot/messages answers the same envelope with the assistant's message row. A body that is not that
 * shape is an error for the screen to report, never an empty list of chats, an empty transcript or an answer with nothing in it.
 */
import { ApiShapeError, envelopeRow, envelopeRows } from '@/lib/client/api-envelope';
import { asRecord, optionalString, requiredCount, requiredString } from '@/lib/client/row-fields';

export interface ChatSessionRecord {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string | null;
}

/** A document the answer was drawn from. */
export interface Citation {
  documentId: string;
  title: string;
  relevanceScore: number;
}

export type ChatRole = 'user' | 'assistant' | 'system' | 'function';

export interface ChatMessageRecord {
  id: string;
  role: ChatRole;
  content: string;
  citations: Citation[];
  responseTimeMs: number | null;
}

const ROLES: readonly string[] = ['user', 'assistant', 'system', 'function'];
const isRole = (value: unknown): value is ChatRole => typeof value === 'string' && ROLES.includes(value);

// title and content are NOT NULL text; an empty one is still a stored value, not a missing one.
function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new ApiShapeError(`${key} is missing`);
  return value;
}

function citationFrom(value: unknown): Citation {
  const row = asRecord(value, 'citation');
  const score = row.relevanceScore;
  if (typeof score !== 'number' || !Number.isFinite(score)) throw new ApiShapeError('relevanceScore is not a number');
  return { documentId: requiredString(row, 'documentId'), title: text(row, 'title'), relevanceScore: score };
}

function citationsFrom(value: unknown): Citation[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new ApiShapeError('retrievedDocuments is not a list');
  return value.map(citationFrom);
}

function millisFrom(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ApiShapeError('responseTimeMs is not a number');
  return value;
}

export function sessionFrom(value: unknown): ChatSessionRecord {
  const row = asRecord(value, 'chat session');
  const messageCount = requiredCount(row, 'messageCount');
  if (!Number.isInteger(messageCount) || messageCount < 0) throw new ApiShapeError('messageCount is not a count');
  return { id: requiredString(row, 'id'), title: text(row, 'title'), messageCount, lastMessageAt: optionalString(row, 'lastMessageAt') };
}

export function messageFrom(value: unknown): ChatMessageRecord {
  const row = asRecord(value, 'chat message');
  const { role } = row;
  if (!isRole(role)) throw new ApiShapeError('role is not a chat role');
  return {
    id: requiredString(row, 'id'),
    role,
    content: text(row, 'content'),
    citations: citationsFrom(row.retrievedDocuments),
    responseTimeMs: millisFrom(row.responseTimeMs),
  };
}

export const sessionsFrom = (body: unknown): ChatSessionRecord[] => envelopeRows(body).map(sessionFrom);
export const createdSessionFrom = (body: unknown): ChatSessionRecord => sessionFrom(envelopeRow(body));
export const messagesFrom = (body: unknown): ChatMessageRecord[] => envelopeRows(body).map(messageFrom);
export const answerFrom = (body: unknown): ChatMessageRecord => messageFrom(envelopeRow(body));

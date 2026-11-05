import { describe, expect, it } from 'vitest';
import { ApiShapeError } from '@/lib/client/api-envelope';
import { answerFrom, createdSessionFrom, messageFrom, messagesFrom, sessionFrom, sessionsFrom } from '../chatbot-api';

// Rows of chat_sessions and chat_messages as the routes return them.
const session = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  userId: 'user_2abc',
  organizationId: '0b6f1d7a-3a62-4c6e-8d0b-5a7c9e2f4d11',
  title: 'Grievance help',
  status: 'active',
  messageCount: 2,
  lastMessageAt: '2026-10-20T12:00:00.000Z',
  ...over,
});
const message = (over: Record<string, unknown> = {}) => ({
  id: 'm2',
  sessionId: '11111111-1111-4111-8111-111111111111',
  role: 'assistant',
  content: 'Start with your steward.',
  modelUsed: 'gpt-4',
  tokensUsed: 120,
  responseTimeMs: 1500,
  retrievedDocuments: [{ documentId: 'd1', title: 'Collective agreement', relevanceScore: 0.87, excerpt: 'Article 12' }],
  helpful: null,
  createdAt: '2026-10-20T12:00:00.000Z',
  ...over,
});
const rows = (data: unknown) => ({ success: true, data: { data }, timestamp: 'now' });

describe('sessionsFrom and sessionFrom', () => {
  it('read the sessions the route lists and the one it creates', () => {
    expect(sessionsFrom(rows([session()]))).toEqual([{ id: '11111111-1111-4111-8111-111111111111', title: 'Grievance help', messageCount: 2, lastMessageAt: '2026-10-20T12:00:00.000Z' }]);
    expect(createdSessionFrom(rows(session({ messageCount: 0, lastMessageAt: null })))).toMatchObject({ messageCount: 0, lastMessageAt: null });
    expect(sessionsFrom(rows([]))).toEqual([]);
  });

  it.each([
    ['a body with no data', { success: true }],
    ['a bare list', { success: true, data: [session()] }],
    ['a list that is not a list', rows(session())],
    ['a session with no id', rows([session({ id: undefined })])],
    ['a session with no title', rows([session({ title: undefined })])],
    ['a message count that is not a number', rows([session({ messageCount: '2' })])],
    ['a negative message count', rows([session({ messageCount: -1 })])],
    ['a fractional message count', rows([session({ messageCount: 1.5 })])],
  ])('refuse %s', (_what, body) => {
    expect(() => sessionsFrom(body)).toThrow(ApiShapeError);
  });

  it('accepts a title that is stored empty, as stored', () => {
    expect(sessionFrom(session({ title: '' })).title).toBe('');
  });

  it('refuses a created answer that is not a session row', () => {
    expect(() => createdSessionFrom(rows([session()]))).toThrow(ApiShapeError);
    expect(() => createdSessionFrom({ success: true, data: {} })).toThrow(ApiShapeError);
  });
});

describe('messagesFrom, messageFrom and answerFrom', () => {
  it('read the transcript, with the citations and the time of an answer and none of either for a question', () => {
    const [question, reply] = messagesFrom(rows([message({ id: 'm1', role: 'user', content: 'How?', responseTimeMs: null, retrievedDocuments: null }), message()]));

    expect(question).toEqual({ id: 'm1', role: 'user', content: 'How?', citations: [], responseTimeMs: null });
    expect(reply).toEqual({
      id: 'm2',
      role: 'assistant',
      content: 'Start with your steward.',
      citations: [{ documentId: 'd1', title: 'Collective agreement', relevanceScore: 0.87 }],
      responseTimeMs: 1500,
    });
  });

  it('read the answer the route returns for a question', () => {
    expect(answerFrom(rows(message())).content).toBe('Start with your steward.');
  });

  it('keep the rows of every role the table allows, for the screen to choose from', () => {
    for (const role of ['user', 'assistant', 'system', 'function']) expect(messageFrom(message({ role })).role).toBe(role);
  });

  it.each([
    ['no role', message({ role: undefined })],
    ['a role the table does not have', message({ role: 'moderator' })],
    ['no id', message({ id: undefined })],
    ['no content', message({ content: undefined })],
    ['content that is not text', message({ content: 5 })],
    ['citations that are not a list', message({ retrievedDocuments: { title: 'x' } })],
    ['a citation with no score', message({ retrievedDocuments: [{ documentId: 'd1', title: 'x' }] })],
    ['a citation with a score that is not a number', message({ retrievedDocuments: [{ documentId: 'd1', title: 'x', relevanceScore: 'high' }] })],
    ['a citation with no document id', message({ retrievedDocuments: [{ title: 'x', relevanceScore: 0.5 }] })],
    ['a time that is not a number', message({ responseTimeMs: '1.5s' })],
  ])('refuse a message with %s', (_what, row) => {
    expect(() => messageFrom(row)).toThrow(ApiShapeError);
  });

  it.each([
    ['a bare list', { success: true, data: [message()] }],
    ['no data', { success: true }],
  ])('refuse a transcript that is %s', (_what, body) => {
    expect(() => messagesFrom(body)).toThrow(ApiShapeError);
  });
});

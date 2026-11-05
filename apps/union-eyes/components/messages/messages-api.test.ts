import { describe, expect, it } from 'vitest';
import { ApiShapeError } from '@/lib/client/api-envelope';
import { createdThreadId, messagesFrom, queueFrom, threadDetailFrom, threadsFrom } from './messages-api';

// The shapes the routes build (lib/messaging/thread-access ThreadView and MessageView, thread-read-state ThreadDetail, thread-assignment QueueItem).
const thread = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  subject: 'Overtime dispute',
  status: 'open',
  isArchived: false,
  lastMessageAt: '2026-10-20T12:00:00.000Z',
  createdAt: '2026-10-19T12:00:00.000Z',
  representativeAssigned: true,
  viewerRole: 'member',
  ...over,
});
const message = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  fromMe: true,
  senderKind: 'member',
  content: 'Please check my hours',
  createdAt: '2026-10-19T12:00:00.000Z',
  readByCounterpart: false,
  ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  subject: 'Overtime dispute',
  status: 'open',
  isArchived: false,
  representativeAssigned: true,
  viewerRole: 'member',
  canReply: true,
  canClose: true,
  canArchive: false,
  retention: { audience: 'member', state: 'not_closed' },
  ...over,
});
const queueItem = (over: Record<string, unknown> = {}) => ({
  id: '33333333-3333-4333-8333-333333333333',
  subject: 'Dues deduction error',
  category: 'dues',
  priority: 'high',
  createdAt: '2026-10-20T10:00:00.000Z',
  ...over,
});
// withApi's envelope, and the bare { data } that the handlers which build their own response send.
const wrapped = (data: unknown) => ({ success: true, data, timestamp: 'now' });
const bare = (data: unknown) => ({ data });

describe('threadsFrom', () => {
  it('reads the conversations from either envelope', () => {
    for (const body of [wrapped({ threads: [thread()] }), bare({ threads: [thread()] })]) {
      expect(threadsFrom(body)).toEqual([thread()]);
    }
  });

  it('reads a conversation that has no message yet, and an empty list as empty', () => {
    expect(threadsFrom(wrapped({ threads: [thread({ lastMessageAt: null })] }))[0].lastMessageAt).toBeNull();
    expect(threadsFrom(wrapped({ threads: [] }))).toEqual([]);
  });

  it.each([
    ['a body with no data', { success: true }],
    ['no list of conversations', wrapped({})],
    ['a list that is not a list', wrapped({ threads: thread() })],
    ['a bare list', { threads: [thread()] }],
    ['a conversation with no subject', wrapped({ threads: [thread({ subject: undefined })] })],
    ['a conversation with no archived flag', wrapped({ threads: [thread({ isArchived: undefined })] })],
    ['a conversation whose viewer is neither the member nor the assignee', wrapped({ threads: [thread({ viewerRole: 'admin' })] })],
    ['a creation time that is not a date', wrapped({ threads: [thread({ createdAt: 'yesterday' })] })],
    ['a last message time that is not a date', wrapped({ threads: [thread({ lastMessageAt: 'soon' })] })],
    ['an entry that is not a record', wrapped({ threads: ['x'] })],
  ])('refuses %s, which an empty list would hide', (_what, body) => {
    expect(() => threadsFrom(body)).toThrow(ApiShapeError);
  });
});

describe('queueFrom', () => {
  it('reads the queue, with a category or priority the conversation lacks as none', () => {
    expect(queueFrom(wrapped({ queue: [queueItem(), queueItem({ id: 'q2', category: null, priority: null })] }))).toEqual([
      queueItem(),
      queueItem({ id: 'q2', category: null, priority: null }),
    ]);
  });

  it.each([
    ['no queue', wrapped({})],
    ['a queue that is not a list', wrapped({ queue: queueItem() })],
    ['an entry with no subject', wrapped({ queue: [queueItem({ subject: undefined })] })],
    ['an entry with a time that is not a date', wrapped({ queue: [queueItem({ createdAt: 'x' })] })],
  ])('refuses %s', (_what, body) => {
    expect(() => queueFrom(body)).toThrow(ApiShapeError);
  });
});

describe('messagesFrom', () => {
  it('reads the messages, with a message that has no text as null', () => {
    expect(messagesFrom(wrapped({ messages: [message(), message({ id: 'm2', content: null, senderKind: 'system' })] }))).toEqual([
      message(),
      message({ id: 'm2', content: null, senderKind: 'system' }),
    ]);
  });

  it.each([
    ['no messages', wrapped({})],
    ['messages that are not a list', wrapped({ messages: message() })],
    ['a message from nobody the screen knows', wrapped({ messages: [message({ senderKind: 'bot' })] })],
    ['a message whose text is not text', wrapped({ messages: [message({ content: 5 })] })],
    ['a message with no read flag', wrapped({ messages: [message({ readByCounterpart: undefined })] })],
    ['a message with no sender flag', wrapped({ messages: [message({ fromMe: 'yes' })] })],
    ['a message time that is not a date', wrapped({ messages: [message({ createdAt: 'x' })] })],
  ])('refuses %s, which a conversation with no messages would hide', (_what, body) => {
    expect(() => messagesFrom(body)).toThrow(ApiShapeError);
  });
});

describe('threadDetailFrom', () => {
  it('reads what the viewer may do, as the server decided it', () => {
    expect(threadDetailFrom(wrapped({ thread: detail({ canReply: false, canClose: false, canArchive: true }) }))).toMatchObject({
      canReply: false,
      canClose: false,
      canArchive: true,
      viewerRole: 'member',
    });
  });

  it('reads the member and the staff views of the retention position', () => {
    expect(threadDetailFrom(wrapped({ thread: detail() })).retention).toEqual({ audience: 'member', state: 'not_closed' });
    expect(
      threadDetailFrom(wrapped({ thread: detail({ viewerRole: 'assignee', retention: { audience: 'staff', state: 'retained', retainedUntil: '2033-01-01T00:00:00.000Z' } }) })).retention,
    ).toEqual({ audience: 'staff', state: 'retained', retainedUntil: '2033-01-01T00:00:00.000Z' });
    expect(threadDetailFrom(wrapped({ thread: detail({ retention: { audience: 'staff', state: 'legal_hold' } }) })).retention).toEqual({ audience: 'staff', state: 'legal_hold' });
    expect(threadDetailFrom(wrapped({ thread: detail({ retention: undefined }) })).retention).toBeUndefined();
  });

  it.each([
    ['no conversation', wrapped({})],
    ['a conversation that is not a record', wrapped({ thread: 'x' })],
    ['no permission to reply', wrapped({ thread: detail({ canReply: undefined }) })],
    ['a permission that is not a yes or no', wrapped({ thread: detail({ canClose: 'yes' }) })],
    ['a retention position the screen has no words for', wrapped({ thread: detail({ retention: { audience: 'member', state: 'legal_hold' } }) })],
    ['a retention for nobody', wrapped({ thread: detail({ retention: { audience: 'other', state: 'retained' } }) })],
    ['a retention date that is not a date', wrapped({ thread: detail({ retention: { audience: 'staff', state: 'retained', retainedUntil: 'x' } }) })],
  ])('refuses %s', (_what, body) => {
    expect(() => threadDetailFrom(body)).toThrow(ApiShapeError);
  });
});

describe('createdThreadId', () => {
  it('reads the id of the conversation the route created', () => {
    expect(createdThreadId(bare({ id: '11111111-1111-4111-8111-111111111111' }))).toBe('11111111-1111-4111-8111-111111111111');
  });

  it.each([
    ['no id', bare({})],
    ['an id that is not text', bare({ id: 7 })],
    ['no data', {}],
  ])('refuses a created answer with %s, which would open nothing', (_what, body) => {
    expect(() => createdThreadId(body)).toThrow(ApiShapeError);
  });
});

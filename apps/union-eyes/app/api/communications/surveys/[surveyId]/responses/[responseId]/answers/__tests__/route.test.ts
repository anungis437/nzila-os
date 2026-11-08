import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  persistAtomicAudit: vi.fn(),
  selectQueue: [] as unknown[][],
  insertValues: null as Record<string, unknown> | null,
  onConflictSet: null as Record<string, unknown> | null,
  returningRow: [{ id: 'answer-1', questionId: 'q-1', answeredAt: new Date('2026-01-01') }] as Array<Record<string, unknown>>,
}));

function selectChain() {
  const c: Record<string, unknown> = {};
  for (const fn of ['from', 'where']) c[fn] = () => c;
  c.limit = async () => (m.selectQueue.shift() ?? []);
  return c;
}

const tx = {
  select: vi.fn(() => selectChain()),
  insert: vi.fn(() => ({
    values: (v: Record<string, unknown>) => {
      m.insertValues = v;
      return {
        onConflictDoUpdate: (opts: { set: Record<string, unknown> }) => {
          m.onConflictSet = opts.set;
          return { returning: async () => m.returningRow };
        },
      };
    },
  })),
};

vi.mock('@/lib/api/framework', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/framework')>('@/lib/api/framework');
  return { ...actual, withApi: m.withApi };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/schema', () => ({
  surveyResponses: { id: 'id', surveyId: 'surveyId', organizationId: 'organizationId', status: 'status', userId: 'userId' },
  surveyQuestions: { id: 'id', surveyId: 'surveyId', organizationId: 'organizationId', required: 'required' },
  surveyAnswers: {
    id: 'id', responseId: 'responseId', questionId: 'questionId', organizationId: 'organizationId',
    answerText: 'answerText', answerNumber: 'answerNumber', answerChoices: 'answerChoices', answerOther: 'answerOther', answeredAt: 'answeredAt',
  },
}));

async function loadRoute() {
  return import('../route');
}

const SURVEY_ID = '11111111-1111-4111-8111-111111111111';
const RESPONSE_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';

describe('survey response answers route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.insertValues = null;
    m.onConflictSet = null;
    m.returningRow = [{ id: 'answer-1', questionId: QUESTION_ID, answeredAt: new Date('2026-01-01') }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx));
  });

  const ctx = (body: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
    params: { surveyId: SURVEY_ID, responseId: RESPONSE_ID },
    organizationId: 'org_1',
    userId: 'user_1',
    body,
    ...overrides,
  });

  it('records the answer, upserts on a second call, and audits the submission', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]); // response lookup
    m.selectQueue.push([{ id: QUESTION_ID }]); // question lookup
    const { POST } = await loadRoute();
    const result = await POST(ctx({ questionId: QUESTION_ID, answerText: 'My answer' }));
    expect(result).toMatchObject({ id: 'answer-1', questionId: QUESTION_ID });
    expect(m.insertValues).toMatchObject({ responseId: RESPONSE_ID, questionId: QUESTION_ID, answerText: 'My answer' });
    expect(m.onConflictSet).toMatchObject({ answerText: 'My answer' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'user_1',
        action: 'survey.answer.submitted',
        resourceType: 'survey_answers',
        resourceId: 'answer-1',
      }),
    );
  });

  it('refuses when the response has already been completed, and does not audit', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'completed', userId: 'user_1' }]);
    const { POST } = await loadRoute();
    await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'x' }))).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(tx.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('refuses when the response belongs to a different respondent', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'someone_else' }]);
    const { POST } = await loadRoute();
    await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'x' }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows an anonymous response (userId null) to be answered by any caller', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: null }]);
    m.selectQueue.push([{ id: QUESTION_ID }]);
    const { POST } = await loadRoute();
    await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'x' }))).resolves.toMatchObject({ id: 'answer-1' });
  });

  it('404s when the response does not exist', async () => {
    m.selectQueue.push([]);
    const { POST } = await loadRoute();
    await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'x' }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('404s when the question does not belong to this survey', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
    m.selectQueue.push([]); // question lookup misses
    const { POST } = await loadRoute();
    await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'x' }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a body with more than one answer shape, before any lookup', async () => {
    const { POST } = await loadRoute();
    await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'x', answerNumber: 1 }))).rejects.toThrow();
    expect(tx.select).not.toHaveBeenCalled();
  });

  it('rejects a body with no answer shape at all', async () => {
    const { POST } = await loadRoute();
    await expect(POST(ctx({ questionId: QUESTION_ID }))).rejects.toThrow();
    expect(tx.select).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  persistAtomicAudit: vi.fn(),
  selectQueue: [] as unknown[][],
  updateSet: null as Record<string, unknown> | null,
  updateRow: [{ id: 'resp-1', status: 'completed', completedAt: new Date('2026-01-01') }] as Array<Record<string, unknown>>,
}));

function selectChain() {
  const c: Record<string, unknown> = {};
  for (const fn of ['from', 'where']) c[fn] = () => c;
  c.limit = async () => (m.selectQueue.shift() ?? []);
  // Plain select (no .limit()) used for the required-questions and answered-ids lookups resolves via await directly.
  (c as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(m.selectQueue.shift() ?? []).then(res);
  return c;
}

const tx = {
  select: vi.fn(() => selectChain()),
  update: vi.fn(() => {
    const c: Record<string, unknown> = {};
    c.set = (v: Record<string, unknown>) => {
      m.updateSet = v;
      return c;
    };
    c.where = () => c;
    c.returning = async () => m.updateRow;
    return c;
  }),
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
  surveyAnswers: { questionId: 'questionId', responseId: 'responseId', organizationId: 'organizationId' },
}));

async function loadRoute() {
  return import('../route');
}

const SURVEY_ID = '11111111-1111-4111-8111-111111111111';
const RESPONSE_ID = '22222222-2222-4222-8222-222222222222';

describe('survey response completion route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateSet = null;
    m.updateRow = [{ id: RESPONSE_ID, status: 'completed', completedAt: new Date('2026-01-01') }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx));
  });

  const ctx = (body: Record<string, unknown> = {}) => ({
    params: { surveyId: SURVEY_ID, responseId: RESPONSE_ID },
    organizationId: 'org_1',
    userId: 'user_1',
    body,
  });

  it('completes a response with no required questions', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]); // response
    m.selectQueue.push([]); // required questions: none
    const { PATCH } = await loadRoute();
    const result = await PATCH(ctx({ timeSpentSeconds: 120 }));
    expect(result).toMatchObject({ id: RESPONSE_ID, status: 'completed' });
    expect(m.updateSet).toMatchObject({ status: 'completed', timeSpentSeconds: 120 });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'user_1', action: 'survey.response.completed', resourceId: RESPONSE_ID }),
    );
  });

  it('completes a response once every required question has an answer', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]); // response
    m.selectQueue.push([{ id: 'q1' }, { id: 'q2' }]); // required questions
    m.selectQueue.push([{ questionId: 'q1' }, { questionId: 'q2' }]); // answered
    const { PATCH } = await loadRoute();
    await expect(PATCH(ctx())).resolves.toMatchObject({ status: 'completed' });
  });

  it('refuses with the missing question ids when a required question has no answer', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
    m.selectQueue.push([{ id: 'q1' }, { id: 'q2' }]);
    m.selectQueue.push([{ questionId: 'q1' }]); // q2 unanswered
    const { PATCH } = await loadRoute();
    await expect(PATCH(ctx())).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { missingQuestionIds: ['q2'] } });
    expect(tx.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('refuses when the response has already been completed', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'completed', userId: 'user_1' }]);
    const { PATCH } = await loadRoute();
    await expect(PATCH(ctx())).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuses when the response belongs to a different respondent', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'someone_else' }]);
    const { PATCH } = await loadRoute();
    await expect(PATCH(ctx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('404s when the response does not exist', async () => {
    m.selectQueue.push([]);
    const { PATCH } = await loadRoute();
    await expect(PATCH(ctx())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses with a conflict when two concurrent completions race (the update predicate matches nothing)', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
    m.selectQueue.push([]); // no required questions
    m.updateRow = [];
    const { PATCH } = await loadRoute();
    await expect(PATCH(ctx())).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

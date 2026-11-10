import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashResponseCapability, RESPONSE_CAPABILITY_HEADER } from '@/lib/communications/survey-response-capability';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  persistAtomicAudit: vi.fn(),
  selectQueue: [] as unknown[][],
  updateSet: null as Record<string, unknown> | null,
  updateRow: [{ id: 'resp-1', status: 'completed', completedAt: new Date('2026-01-01') }] as Array<Record<string, unknown>>,
}));

function selectChain() {
  const c: Record<string, unknown> = {};
  let table: { __name?: string } | undefined;
  c.from = (value: { __name?: string }) => { table = value; return c; };
  c.where = () => c;
  c.limit = async () => {
    const rows = (m.selectQueue.shift() ?? []) as Array<Record<string, unknown>>;
    if (table?.__name === 'questionnaireVersions') return [{ questions: rows.map((row) => ({ required: true, ...row })) }];
    return rows.map((row) => ({ questionnaireVersionId: 'version-1', ...row }));
  };
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
  surveyResponses: { id: 'id', surveyId: 'surveyId', organizationId: 'organizationId', status: 'status', userId: 'userId', responseTokenHash: 'responseTokenHash' },
  surveyQuestionnaireVersions: { __name: 'questionnaireVersions', id: 'versionId', surveyId: 'versionSurveyId', organizationId: 'versionOrganizationId', questions: 'questions' },
  surveyAnswers: { questionId: 'questionId', responseId: 'responseId', organizationId: 'organizationId' },
}));

async function loadRoute() {
  return import('../route');
}

const SURVEY_ID = '11111111-1111-4111-8111-111111111111';
const RESPONSE_ID = '22222222-2222-4222-8222-222222222222';

function request(headers: Record<string, string> = {}) {
  return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } } as unknown as Request;
}

describe('survey response completion route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateSet = null;
    m.updateRow = [{ id: RESPONSE_ID, status: 'completed', completedAt: new Date('2026-01-01') }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx));
  });

  const ctx = (body: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) => ({
    request: request(),
    params: { surveyId: SURVEY_ID, responseId: RESPONSE_ID },
    organizationId: 'org_1',
    userId: 'user_1',
    body,
    ...overrides,
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

  describe('DEF-0B5-SURVEY-RESPONSES-IDENTIFIED-OR-ANONYMOUS-RESPONSE-MUTATION-AUTHORITY', () => {
    it('refuses to complete an anonymous response when no capability token is presented', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: null, responseTokenHash: hashResponseCapability('right-token') }]);
      const { PATCH } = await loadRoute();
      await expect(PATCH(ctx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('refuses to complete an anonymous response when the wrong capability token is presented', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: null, responseTokenHash: hashResponseCapability('right-token') }]);
      const { PATCH } = await loadRoute();
      await expect(PATCH(ctx({}, { request: request({ [RESPONSE_CAPABILITY_HEADER]: 'wrong-token' }) }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('refuses to complete a legacy anonymous response with no stored capability hash at all', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: null, responseTokenHash: null }]);
      const { PATCH } = await loadRoute();
      await expect(PATCH(ctx({}, { request: request({ [RESPONSE_CAPABILITY_HEADER]: 'anything' }) }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('completes an anonymous response when the correct capability token is presented', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: null, responseTokenHash: hashResponseCapability('right-token') }]);
      m.selectQueue.push([]); // no required questions
      const { PATCH } = await loadRoute();
      await expect(
        PATCH(ctx({}, { request: request({ [RESPONSE_CAPABILITY_HEADER]: 'right-token' }) })),
      ).resolves.toMatchObject({ status: 'completed' });
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  persistAtomicAudit: vi.fn(),
  selectQueue: [] as unknown[][],
  insertValues: null as Record<string, unknown> | null,
  returningRow: [{ id: 'resp-1', surveyId: 'survey-1', status: 'in_progress', startedAt: new Date('2026-01-01') }] as Array<Record<string, unknown>>,
  dbSelectQueue: [] as unknown[][],
}));

function selectChain(queue: unknown[][]) {
  const c: Record<string, unknown> = {};
  let table: { __name?: string } | undefined;
  c.from = (value: { __name?: string }) => { table = value; return c; };
  c.where = () => c;
  c.orderBy = async () => table?.__name === 'questions'
    ? [{ id: 'question-1', questionText: 'Question', questionType: 'text', orderIndex: 1, required: false }]
    : [];
  c.limit = async () => {
    if (table?.__name === 'questionnaireVersions') return [{ id: 'version-1', version: 1 }];
    return queue.shift() ?? [];
  };
  return c;
}

const tx = {
  select: vi.fn(() => selectChain(m.selectQueue)),
  execute: vi.fn(async () => undefined),
  insert: vi.fn(() => ({
    values: (v: Record<string, unknown>) => {
      m.insertValues = v;
      return { returning: async () => m.returningRow };
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
vi.mock('@/db/db', () => ({
  db: { select: vi.fn(() => selectChain(m.dbSelectQueue)) },
}));
vi.mock('@/db/schema', () => ({
  surveys: { __name: 'surveys', id: 'id', organizationId: 'organizationId', allowAnonymous: 'allowAnonymous', allowMultipleResponses: 'allowMultipleResponses', status: 'status', publishedAt: 'publishedAt', closesAt: 'closesAt' },
  surveyResponses: { id: 'id', surveyId: 'surveyId', organizationId: 'organizationId', status: 'status', responseTokenHash: 'responseTokenHash' },
  surveyQuestions: {
    __name: 'questions', id: 'questionId', surveyId: 'questionSurveyId', organizationId: 'questionOrganizationId',
    questionText: 'questionText', questionType: 'questionType', description: 'description', orderIndex: 'orderIndex', section: 'section', required: 'required',
    choices: 'choices', allowOther: 'allowOther', minChoices: 'minChoices', maxChoices: 'maxChoices', ratingMin: 'ratingMin', ratingMax: 'ratingMax',
    minLength: 'minLength', maxLength: 'maxLength', placeholder: 'placeholder', showIf: 'showIf',
  },
  surveyQuestionnaireVersions: { __name: 'questionnaireVersions', id: 'versionId', surveyId: 'versionSurveyId', version: 'version', contentDigest: 'contentDigest' },
  surveyAnonymousParticipations: { id: 'participationId' },
}));

async function loadRoute() {
  return import('../route');
}

const SURVEY_ID = '11111111-1111-4111-8111-111111111111';
const OPEN_SURVEY = { id: SURVEY_ID, status: 'published', publishedAt: new Date('2020-01-01'), closesAt: null, allowMultipleResponses: true };

describe('survey response creation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.dbSelectQueue = [];
    m.insertValues = null;
    m.returningRow = [{ id: 'resp-1', surveyId: SURVEY_ID, status: 'in_progress', startedAt: new Date('2026-01-01') }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx));
  });

  const ctx = (overrides: Record<string, unknown> = {}) => ({
    params: { surveyId: SURVEY_ID },
    organizationId: 'org_1',
    userId: 'user_1',
    ...overrides,
  });

  it('creates an identified response (userId set) with no capability token, for a non-anonymous survey', async () => {
    m.selectQueue.push([{ ...OPEN_SURVEY, allowAnonymous: false }]);
    const { POST } = await loadRoute();
    const result = await POST(ctx());
    expect(result).toMatchObject({ id: 'resp-1', status: 'in_progress' });
    expect(result).not.toHaveProperty('responseToken');
    expect(m.insertValues).toMatchObject({ organizationId: 'org_1', surveyId: SURVEY_ID, userId: 'user_1', responseTokenHash: null });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'user_1', action: 'survey.response.created', resourceId: 'resp-1' }),
    );
  });

  it('creates an anonymous response (userId null) and returns a one-time capability token, storing only its hash', async () => {
    m.selectQueue.push([{ ...OPEN_SURVEY, allowAnonymous: true }]);
    const { POST } = await loadRoute();
    const result = await POST(ctx());
    expect(result).toMatchObject({ id: 'resp-1', status: 'in_progress' });
    expect(typeof (result as { responseToken?: unknown }).responseToken).toBe('string');
    expect((result as { responseToken: string }).responseToken.length).toBeGreaterThan(20);
    expect(m.insertValues).toMatchObject({ userId: null });
    expect(m.insertValues?.responseTokenHash).toEqual(expect.any(String));
    // The hash is never the raw token itself.
    expect(m.insertValues?.responseTokenHash).not.toEqual((result as { responseToken: string }).responseToken);
  });

  it('issues a different token on every anonymous response created', async () => {
    m.selectQueue.push([{ ...OPEN_SURVEY, allowAnonymous: true }]);
    m.selectQueue.push([{ ...OPEN_SURVEY, allowAnonymous: true }]);
    const { POST } = await loadRoute();
    const first = (await POST(ctx())) as { responseToken: string };
    const second = (await POST(ctx())) as { responseToken: string };
    expect(first.responseToken).not.toEqual(second.responseToken);
  });

  it('404s when the survey does not exist in this organization', async () => {
    m.selectQueue.push([]);
    const { POST } = await loadRoute();
    await expect(POST(ctx())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('refuses when the survey is not published/active', async () => {
    m.selectQueue.push([{ ...OPEN_SURVEY, status: 'draft' }]);
    const { POST } = await loadRoute();
    await expect(POST(ctx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses when the survey has not been published yet', async () => {
    m.selectQueue.push([{ ...OPEN_SURVEY, publishedAt: new Date(Date.now() + 86_400_000) }]);
    const { POST } = await loadRoute();
    await expect(POST(ctx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses when the survey has already closed', async () => {
    m.selectQueue.push([{ ...OPEN_SURVEY, closesAt: new Date(Date.now() - 1000) }]);
    const { POST } = await loadRoute();
    await expect(POST(ctx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

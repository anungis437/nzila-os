import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashResponseCapability, RESPONSE_CAPABILITY_HEADER } from '@/lib/communications/survey-response-capability';

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
  surveyResponses: { id: 'id', surveyId: 'surveyId', organizationId: 'organizationId', status: 'status', userId: 'userId', responseTokenHash: 'responseTokenHash' },
  surveyQuestions: {
    id: 'id', surveyId: 'surveyId', organizationId: 'organizationId', required: 'required',
    choices: 'choices', allowOther: 'allowOther', minChoices: 'minChoices', maxChoices: 'maxChoices',
    ratingMin: 'ratingMin', ratingMax: 'ratingMax', minLength: 'minLength', maxLength: 'maxLength',
  },
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

// A question with no choices/rating/length constraints at all: a plain free-text question.
const PLAIN_TEXT_QUESTION = { id: QUESTION_ID, choices: null, allowOther: false, minChoices: null, maxChoices: null, ratingMin: null, ratingMax: null, minLength: null, maxLength: null };

function request(headers: Record<string, string> = {}) {
  return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } } as unknown as Request;
}

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
    request: request(),
    params: { surveyId: SURVEY_ID, responseId: RESPONSE_ID },
    organizationId: 'org_1',
    userId: 'user_1',
    body,
    ...overrides,
  });

  it('records the answer, upserts on a second call, and audits the submission', async () => {
    m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]); // response lookup
    m.selectQueue.push([PLAIN_TEXT_QUESTION]); // question lookup
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

  describe('DEF-0B5-SURVEY-RESPONSES-IDENTIFIED-OR-ANONYMOUS-RESPONSE-MUTATION-AUTHORITY', () => {
    it('refuses an anonymous response when no capability token is presented', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: null, responseTokenHash: hashResponseCapability('right-token') }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'x' }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('refuses an anonymous response when the wrong capability token is presented', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: null, responseTokenHash: hashResponseCapability('right-token') }]);
      const { POST } = await loadRoute();
      await expect(
        POST(ctx({ questionId: QUESTION_ID, answerText: 'x' }, { request: request({ [RESPONSE_CAPABILITY_HEADER]: 'wrong-token' }) })),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('refuses a legacy anonymous response with no stored capability hash at all, no matter what is presented', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: null, responseTokenHash: null }]);
      const { POST } = await loadRoute();
      await expect(
        POST(ctx({ questionId: QUESTION_ID, answerText: 'x' }, { request: request({ [RESPONSE_CAPABILITY_HEADER]: 'anything' }) })),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('allows an anonymous response to be answered when the correct capability token is presented', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: null, responseTokenHash: hashResponseCapability('right-token') }]);
      m.selectQueue.push([PLAIN_TEXT_QUESTION]);
      const { POST } = await loadRoute();
      await expect(
        POST(ctx({ questionId: QUESTION_ID, answerText: 'x' }, { request: request({ [RESPONSE_CAPABILITY_HEADER]: 'right-token' }) })),
      ).resolves.toMatchObject({ id: 'answer-1' });
    });
  });

  describe('question-type-aware answer validation', () => {
    it('accepts answerChoices that are all members of the question choice list, within minChoices/maxChoices', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, choices: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], minChoices: 1, maxChoices: 2 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerChoices: ['a', 'b'] }))).resolves.toMatchObject({ id: 'answer-1' });
    });

    it('rejects an answerChoices entry that is not a member of the question choice list', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, choices: [{ id: 'a' }, { id: 'b' }] }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerChoices: ['a', 'not-a-real-choice'] }))).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { invalidChoiceIds: ['not-a-real-choice'] },
      });
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('rejects fewer selected choices than minChoices', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, choices: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], minChoices: 2, maxChoices: 3 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerChoices: ['a'] }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects more selected choices than maxChoices', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, choices: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], minChoices: 1, maxChoices: 1 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerChoices: ['a', 'b'] }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects a non-choice answer shape for a choice question', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, choices: [{ id: 'a' }, { id: 'b' }] }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'a' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('accepts answerNumber within the question rating bounds', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, ratingMin: 1, ratingMax: 5 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerNumber: 3 }))).resolves.toMatchObject({ id: 'answer-1' });
    });

    it('rejects answerNumber above the question rating max', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, ratingMin: 1, ratingMax: 5 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerNumber: 9 }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects answerNumber below the question rating min', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, ratingMin: 1, ratingMax: 5 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerNumber: 0 }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects a non-numeric answer shape for a rating question', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, ratingMin: 1, ratingMax: 5 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'five' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('accepts answerText within minLength/maxLength for a plain text question', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, minLength: 2, maxLength: 20 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'hello' }))).resolves.toMatchObject({ id: 'answer-1' });
    });

    it('rejects answerText shorter than minLength', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, minLength: 10 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'short' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects answerText longer than maxLength', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, maxLength: 3 }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'way too long' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects answerOther when the question does not allow it', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, allowOther: false }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'x', answerOther: 'extra' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('accepts answerOther when the question allows it', async () => {
      m.selectQueue.push([{ id: RESPONSE_ID, status: 'in_progress', userId: 'user_1' }]);
      m.selectQueue.push([{ ...PLAIN_TEXT_QUESTION, allowOther: true }]);
      const { POST } = await loadRoute();
      await expect(POST(ctx({ questionId: QUESTION_ID, answerText: 'x', answerOther: 'extra' }))).resolves.toMatchObject({ id: 'answer-1' });
    });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

// DEF-0B7-COGA-DERIVED-AGGREGATES-IGNORE-INTERVIEW-SENSITIVITY, DEF-0B7-COGB-DERIVED-GRAPHS-IGNORE-INTERVIEW-SENSITIVITY,
// DEF-0B7-COGB-SUCCESSION-SENDS-EVERY-PUBLISHED-INTERVIEW-TO-MODEL-IGNORING-SENSITIVITY and
// DEF-0B7-COGA-FORECAST-PROJECTIONS-ARE-FIXED-RATES-AND-ALWAYS-IMPROVE: the real engines and routes against real SQL with an
// interview at every sensitivity level, with and without consent.

const state = vi.hoisted(() => ({ db: null as unknown, generate: null as unknown, audit: [] as Array<Record<string, unknown>> }));

vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...a: unknown[]) => (a[a.length - 1] as (tx: unknown) => Promise<unknown>)(state.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: async (_tx: unknown, e: Record<string, unknown>) => void state.audit.push(e) }));
vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
}));
vi.mock('@/lib/ai/ai-client', () => ({
  buildOrgAiTrace: () => ({}),
  UE_APP_KEY: 'ue',
  UE_PROFILES: { CONTINUITY_RISK: 'p' },
  UE_SYSTEM_ORG_ID: 'sys',
  getAiClient: () => ({ generate: (input: unknown) => (state.generate as (i: unknown) => unknown)(input) }),
}));

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
let pg: PGlite;
let n = 0;

async function interview(title: string, level: string | null, over: { consent?: boolean; status?: string; org?: string } = {}) {
  n += 1;
  await pg.query(
    `INSERT INTO exit_interviews (id, organization_id, retiring_employee_name, role_in_union, years_of_service, title, key_lessons, status,
       sensitivity_level, consent_granted, created_by, topics, expertise_tags, continuity_risk_score, published_at)
     VALUES (gen_random_uuid(), $1::uuid, 'Jane Retiree', 'steward', 20, $2, 'lessons', $3, $4, $5, 'author', $6::jsonb, $7::jsonb, 80, now())`,
    [over.org ?? ORG, title, over.status ?? 'published', level, over.consent ?? true, JSON.stringify([`topic-${title}`]), JSON.stringify([`tag-${title}`])],
  );
}

beforeAll(async () => {
  const { exitInterviews, exitInterviewEvents } = await import('@/db/schema');
  const { createTableDatabase } = await import('./support/pglite-tables');
  const created = await createTableDatabase([exitInterviews, exitInterviewEvents]);
  pg = created.pg;
  state.db = created.db;
});
afterAll(async () => { await pg.close(); });

beforeEach(async () => {
  state.audit.length = 0;
  await pg.exec('TRUNCATE exit_interviews, exit_interview_events CASCADE');
  await interview('open', 'public_internal');
  await interview('restricted', 'restricted');
  await interview('privileged', 'privileged');
  await interview('legal', 'legal_sensitive');
  await interview('executive', 'executive_confidential');
  await interview('unrecorded', null);
  await interview('noconsent', 'public_internal', { consent: false });
  await interview('draft', 'public_internal', { status: 'draft' });
  await interview('foreign', 'public_internal', { org: OTHER });
});

describe('derived analytics eligibility', () => {
  it('the expertise map aggregates only published, consented interviews of the organization at the allowed levels', async () => {
    const { GET } = await import('../exit-interviews/expertise-map/route');
    const result = (await (GET as any)({ organizationId: ORG })) as { data: unknown };
    const text = JSON.stringify(result);
    expect(text).toContain('tag-open');
    expect(text).toContain('tag-restricted');
    for (const hidden of ['privileged', 'legal', 'executive', 'noconsent', 'draft', 'foreign']) {
      expect(text, hidden).not.toContain(`tag-${hidden}`);
    }
  });

  it('the topic graph and the propagation map carry no topic or tag of an ineligible interview', async () => {
    const { buildTopicGraph } = await import('@/lib/knowledge-transfer/topic-graph/topic-graph-builder');
    const { buildDependencyPropagationMap } = await import('@/lib/knowledge-transfer/propagation/dependency-propagator');
    const text = JSON.stringify(await buildTopicGraph(ORG)) + JSON.stringify(await buildDependencyPropagationMap(ORG));
    for (const hidden of ['privileged', 'legal', 'executive', 'noconsent', 'draft', 'foreign']) {
      expect(text.toLowerCase(), hidden).not.toContain(hidden);
    }
    expect(text.toLowerCase()).toContain('open');
  });

  it('the governance timeline leaves out administrator-only levels but keeps privileged for an officer', async () => {
    const { GET } = await import('../exit-interviews/governance-timeline/route');
    const { data } = (await (GET as any)({ organizationId: ORG })) as { data: { sensitivityDistribution: Record<string, number>; totalInterviewsInWindow: number } };
    expect(data.sensitivityDistribution).not.toHaveProperty('legal_sensitive');
    expect(data.sensitivityDistribution).not.toHaveProperty('executive_confidential');
    expect(data.sensitivityDistribution.privileged).toBe(1);
    expect(data.totalInterviewsInWindow).toBe(6);
  });
});

describe('succession analysis', () => {
  const reply = JSON.stringify({
    criticalOperationalGaps: ['gap'], documentationPriorities: ['doc'], continuityRecommendations: ['rec'], governanceMitigations: ['mit'], executiveSummary: 'summary',
  });

  it('sends only eligible interviews to the model, audits the call, and marks the result as model-generated', async () => {
    const sent: string[] = [];
    state.generate = async (input: { input: Array<{ content: string }> }) => {
      sent.push(input.input[1].content);
      return { content: reply };
    };
    const { analyzeSuccessionFragility } = await import('@/lib/knowledge-transfer/succession/succession-analyzer');
    const report = await analyzeSuccessionFragility(ORG, 'officer-1');
    expect(report.modelGenerated).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('open');
    expect(sent[0]).toContain('restricted');
    for (const hidden of ['privileged', 'legal', 'executive', 'noconsent', 'draft', 'foreign']) {
      expect(sent[0], hidden).not.toContain(`] ${hidden}`);
    }
    expect(state.audit.map((e) => e.action)).toEqual(['exit_interview.succession_analysis.requested', 'exit_interview.succession_analysis.completed']);
  });

  it('answers an unusable model reply as a failure with an audit entry, not a canned summary', async () => {
    state.generate = async () => ({ content: 'not json' });
    const { analyzeSuccessionFragility } = await import('@/lib/knowledge-transfer/succession/succession-analyzer');
    await expect(analyzeSuccessionFragility(ORG, 'officer-1')).rejects.toBeTruthy();
    state.generate = async () => ({ content: JSON.stringify({ executiveSummary: 'only this' }) });
    await expect(analyzeSuccessionFragility(ORG, 'officer-1')).rejects.toBeTruthy();
    expect(state.audit.filter((e) => e.action === 'exit_interview.succession_analysis.failed')).toHaveLength(2);
  });

  it('makes no model call when nothing is eligible', async () => {
    const generate = vi.fn();
    state.generate = generate;
    const { analyzeSuccessionFragility } = await import('@/lib/knowledge-transfer/succession/succession-analyzer');
    const report = await analyzeSuccessionFragility('33333333-3333-4333-8333-333333333333', 'officer-1');
    expect(generate).not.toHaveBeenCalled();
    expect(report.modelGenerated).toBe(false);
  });
});

describe('continuity forecast', () => {
  it('reports no trend and no projection, never an improving curve, and bases its metrics on eligible interviews', async () => {
    const { forecastContinuityTrends } = await import('@/lib/knowledge-transfer/forecasting/continuity-forecaster');
    const forecast = await forecastContinuityTrends(ORG);
    expect(forecast.trendDirection).toBe('insufficient_data');
    expect(forecast.projections).toEqual([]);
    expect(forecast.historicalData).toEqual([]);
    expect(forecast.confidence).toBe(0);
    // An interview with no recorded level is read as restricted, which derived analytics admit: open, restricted and unrecorded.
    expect(forecast.dataPoints).toBe(3);
  });
});

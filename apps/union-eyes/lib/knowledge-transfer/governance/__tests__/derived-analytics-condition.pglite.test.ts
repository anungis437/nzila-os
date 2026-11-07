/**
 * derivedAnalyticsCondition on real SQL (DEF-0B7-EXC-CONSENT-WITHDRAWAL-AND-RECLASSIFICATION-WITHDRAW-NOTHING-DERIVED).
 *
 * The register recorded "neither the keyword search nor the semantic search carries a consent condition" as
 * remaining work. Reading the current source shows both already do (hybrid-search.ts's keywordSearch and
 * semanticSearch each require consentGranted = true, proven on real SQL in
 * db/__tests__/semantic-search.postgres.test.ts and lib/knowledge-transfer/search/__tests__/hybrid-search.test.ts),
 * and so does every one of the seven derived-analytics engines (topic graph, propagation, resilience, forecast,
 * simulation, continuity risk, succession) through the single shared derivedAnalyticsCondition they all import
 * from interview-access.ts — but every one of those seven engines' own unit tests mocks
 * derivedAnalyticsCondition away (`() => 'derived-analytics-condition'`), so nothing yet proves the shared
 * condition itself is correct against real SQL the way interviewListCondition already is (see
 * interview-access.test.ts's own comment, and app/api/__tests__/exit-interviews-read-gates.pglite.test.ts).
 *
 * This proves derivedAnalyticsCondition directly, against the real Drizzle table on PGlite: since all seven
 * engines share the one function unchanged, proving it once covers all seven by construction.
 *
 * Erasing a withdrawn-consent interview's knowledge-base content and embedding (rather than the deactivation and
 * consent-gated filtering already in place) is the exit-interviews governance route's own documented, deliberate
 * deferral ("retention and legal hold are decided elsewhere") — an institutional decision, not an engineering gap
 * this file closes or should.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exitInterviews } from '@/db/schema';
import { derivedAnalyticsCondition } from '../interview-access';
import { createTableDatabase, type TableDatabase } from '@/app/api/__tests__/support/pglite-tables';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;

let database: TableDatabase;

async function interview(n: number, organizationId: string, over: { status?: string; level?: string; consent?: boolean } = {}) {
  await database.db.insert(exitInterviews).values({
    id: id(n),
    organizationId,
    status: (over.status ?? 'published') as never,
    retiringEmployeeName: 'Jane Retiree',
    roleInUnion: 'steward' as never,
    title: `Interview ${n}`,
    keyLessons: 'Lessons learned here',
    sensitivityLevel: (over.level ?? 'public_internal') as never,
    consentGranted: over.consent ?? true,
    createdBy: 'author-1',
  });
}

beforeAll(async () => {
  database = await createTableDatabase([exitInterviews], [
    `CREATE TABLE organizations (id uuid primary key)`,
  ]);
  await database.pg.query(`INSERT INTO organizations (id) VALUES ($1::uuid), ($2::uuid)`, [ORG, OTHER_ORG]);

  await interview(1, ORG, { level: 'public_internal', consent: true });
  await interview(2, ORG, { level: 'restricted', consent: true });
  // Withdrawn consent: this is the exact DEF-0B7 case. Excluded even though its level would otherwise qualify.
  await interview(3, ORG, { level: 'public_internal', consent: false });
  // Privileged and above are not derived-analytics levels at all, consent notwithstanding.
  await interview(4, ORG, { level: 'privileged', consent: true });
  // A draft is not finished: never fed to derived analytics.
  await interview(5, ORG, { level: 'public_internal', consent: true, status: 'draft' });
  // Another organization's row, otherwise identical to #1: never crosses the tenant boundary.
  await interview(6, OTHER_ORG, { level: 'public_internal', consent: true });
});

afterAll(async () => { await database.pg.close(); });

describe('derivedAnalyticsCondition', () => {
  it('admits only published, consented interviews at a derived-analytics level, of the caller\'s organization', async () => {
    const rows = await database.db.select({ id: exitInterviews.id }).from(exitInterviews).where(derivedAnalyticsCondition(ORG));
    expect(rows.map((r) => r.id).sort()).toEqual([id(1), id(2)].sort());
  });
});

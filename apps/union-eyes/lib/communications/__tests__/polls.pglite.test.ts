// DEF-0B5-POLLS-NO-CREATE-OR-VOTE-PATH: a steward creates a poll and each member votes on it exactly once. The one-vote rule is the database's
// unique key on poll_votes (poll_id, user_id) (platform migration 0064), exercised here against real PostgreSQL semantics (PGlite).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { polls, pollVotes } from '@/db/schema';
import { createTableDatabase } from '@/app/api/__tests__/support/pglite-tables';
import type { RLSTx } from '@/lib/db/with-rls-context';

const audit = vi.hoisted(() => ({ entries: [] as Array<Record<string, unknown>>, fail: false }));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (_tx: unknown, entry: Record<string, unknown>) => {
    if (audit.fail) throw new Error('audit down');
    audit.entries.push(entry);
  },
}));

const { buildPollValues, castPollVote, createPoll, createPollSchema, readOwnPollVote } = await import('../polls');

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-11-05T12:00:00.000Z');
let pg: PGlite;
let db: RLSTx;
const inTx = <T>(work: (tx: RLSTx) => Promise<T>) => (db as unknown as { transaction: (f: (tx: RLSTx) => Promise<T>) => Promise<T> }).transaction(work);
const input = (over: Record<string, unknown> = {}) => createPollSchema.parse({ question: 'Strike vote date?', options: ['Monday', 'Friday'], ...over });

beforeAll(async () => {
  const created = await createTableDatabase([polls, pollVotes], [
    'CREATE TABLE organizations (id uuid primary key, name text)',
    'ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_poll_id_user_id_key UNIQUE (poll_id, user_id)',
  ]);
  pg = created.pg;
  db = created.db as unknown as RLSTx;
});
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  await pg.exec('TRUNCATE poll_votes, polls, organizations');
  audit.entries = [];
  audit.fail = false;
});

describe('poll creation', () => {
  it('creates an open single-choice poll with server-minted option ids and audits it', async () => {
    const poll = await inTx((tx) => createPoll(tx, { organizationId: ORG, userId: 'steward-1', input: input(), now: NOW }));
    expect(poll).toMatchObject({ organizationId: ORG, status: 'active', allowMultipleVotes: false, totalVotes: 0, createdBy: 'steward-1' });
    expect(poll.options).toEqual([{ id: 'opt-1', text: 'Monday' }, { id: 'opt-2', text: 'Friday' }]);
    expect(audit.entries).toEqual([expect.objectContaining({ action: 'communications.poll.create', resourceId: poll.id, organizationId: ORG })]);
  });

  it('refuses settings that do not operate, client-written lifecycle fields, and malformed options', () => {
    for (const bad of [
      { allowMultipleVotes: true },
      { requireAuthentication: false },
      { status: 'closed' },
      { totalVotes: 99 },
      { publishedAt: '2020-01-01T00:00:00Z' },
      { options: ['Only one'] },
      { options: Array.from({ length: 21 }, (_, i) => `o${i}`) },
      { options: ['', 'x'] },
      { question: '' },
    ]) {
      expect(createPollSchema.safeParse({ question: 'Q', options: ['a', 'b'], ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
    expect(() => buildPollValues(input({ options: ['Yes', 'yes'] }), NOW)).toThrow('distinct');
    expect(() => buildPollValues(input({ closesAt: '2026-11-05T11:00:00Z' }), NOW)).toThrow('future');
  });

  it('writes nothing when the audit cannot be written', async () => {
    audit.fail = true;
    await expect(inTx((tx) => createPoll(tx, { organizationId: ORG, userId: 'steward-1', input: input(), now: NOW }))).rejects.toThrow('audit down');
    expect((await pg.query('SELECT id FROM polls')).rows).toHaveLength(0);
  });
});

describe('poll voting', () => {
  const newPoll = async (over: Record<string, unknown> = {}, organizationId = ORG) =>
    inTx((tx) => createPoll(tx, { organizationId, userId: 'steward-1', input: input(over), now: NOW }));

  it('records one vote per member, counts it, audits it without the choice, and refuses a second vote', async () => {
    const poll = await newPoll();
    const vote = await inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: poll.id, optionId: 'opt-2', now: NOW }));
    expect(vote.optionId).toBe('opt-2');
    await expect(inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: poll.id, optionId: 'opt-1', now: NOW })))
      .rejects.toMatchObject({ code: 'CONFLICT' });
    await inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-2', pollId: poll.id, optionId: 'opt-1', now: NOW }));
    expect((await pg.query('SELECT user_id, option_id FROM poll_votes ORDER BY user_id')).rows).toEqual([
      { user_id: 'member-1', option_id: 'opt-2' }, { user_id: 'member-2', option_id: 'opt-1' },
    ]);
    expect((await pg.query('SELECT total_votes, unique_voters FROM polls')).rows).toEqual([{ total_votes: 2, unique_voters: 2 }]);
    const voteAudits = audit.entries.filter((entry) => entry.action === 'communications.poll.vote');
    expect(voteAudits).toHaveLength(2);
    expect(JSON.stringify(voteAudits)).not.toContain('opt-');
    expect(await inTx((tx) => readOwnPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: poll.id }))).toMatchObject({ voted: true, optionId: 'opt-2' });
    expect(await inTx((tx) => readOwnPollVote(tx, { organizationId: ORG, userId: 'member-3', pollId: poll.id }))).toMatchObject({ voted: false, optionId: null });
  });

  it('keeps one vote when the same member votes twice concurrently', async () => {
    const poll = await newPoll();
    const results = await Promise.allSettled([
      inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: poll.id, optionId: 'opt-1', now: NOW })),
      inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: poll.id, optionId: 'opt-2', now: NOW })),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await pg.query('SELECT id FROM poll_votes')).rows).toHaveLength(1);
    expect((await pg.query('SELECT total_votes FROM polls')).rows).toEqual([{ total_votes: 1 }]);
  });

  it('the database itself refuses a second row for the same member and poll', async () => {
    const poll = await newPoll();
    await pg.query(`INSERT INTO poll_votes (organization_id, poll_id, user_id, option_id) VALUES ($1, $2, 'member-1', 'opt-1')`, [ORG, poll.id]);
    await expect(pg.query(`INSERT INTO poll_votes (organization_id, poll_id, user_id, option_id) VALUES ($1, $2, 'member-1', 'opt-2')`, [ORG, poll.id])).rejects.toThrow();
  });

  it('does not find a poll of another organization, and writes nothing there', async () => {
    const foreign = await newPoll({}, OTHER);
    await expect(inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: foreign.id, optionId: 'opt-1', now: NOW })))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(inTx((tx) => readOwnPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: foreign.id }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await pg.query('SELECT id FROM poll_votes')).rows).toHaveLength(0);
  });

  it('refuses an unknown option, a closed poll and a poll past its closing time, writing nothing', async () => {
    const poll = await newPoll({ closesAt: '2026-11-06T12:00:00Z' });
    await expect(inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: poll.id, optionId: 'opt-9', now: NOW }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: poll.id, optionId: 'opt-1', now: new Date('2026-11-07T00:00:00Z') }))).rejects.toMatchObject({ code: 'CONFLICT' });
    await pg.query(`UPDATE polls SET status = 'closed'`);
    await expect(inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: poll.id, optionId: 'opt-1', now: NOW }))).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await pg.query('SELECT id FROM poll_votes')).rows).toHaveLength(0);
  });

  it('rolls the vote back when its audit cannot be written', async () => {
    const poll = await newPoll();
    audit.fail = true;
    await expect(inTx((tx) => castPollVote(tx, { organizationId: ORG, userId: 'member-1', pollId: poll.id, optionId: 'opt-1', now: NOW }))).rejects.toThrow('audit down');
    expect((await pg.query('SELECT id FROM poll_votes')).rows).toHaveLength(0);
    expect((await pg.query('SELECT total_votes FROM polls')).rows).toEqual([{ total_votes: 0 }]);
  });
});

import { describe, expect, it } from 'vitest';
import { ELECTION_VOTING_CAPABILITY, electionCopy, type ElectionCopy } from '../election-copy';
import { electionPaths, formatElectionDate, hasRecordedResults, isCertified, readEntry } from '../election-records';

const blank = { verifiedBy: null, verificationDate: null, winners: [] as unknown[], totalVotes: 0, participationRate: null };

describe('isCertified', () => {
  it('follows the server rule: an auditor name or a verification date certifies the record', () => {
    expect(isCertified(blank)).toBe(false);
    expect(isCertified({ ...blank, verifiedBy: 'Independent Auditor' })).toBe(true);
    expect(isCertified({ ...blank, verificationDate: '2026-10-02' })).toBe(true);
    expect(isCertified({ verifiedBy: '', verificationDate: undefined })).toBe(false);
  });
});

describe('hasRecordedResults', () => {
  it('treats a fresh record (no winners, zero votes) as having nothing recorded, not as zero votes', () => {
    expect(hasRecordedResults(blank)).toBe(false);
  });

  it('treats a blank participation rate written as 0 as not recorded', () => {
    expect(hasRecordedResults({ ...blank, participationRate: 0 })).toBe(false);
    expect(hasRecordedResults({ ...blank, participationRate: undefined })).toBe(false);
  });

  it.each([
    ['a winner', { winners: [{ name: 'A' }] }],
    ['a vote total', { totalVotes: 12 }],
    ['a participation rate', { participationRate: 40 }],
    ['a certification', { verifiedBy: 'Independent Auditor' }],
  ])('treats %s as recorded results', (_label, change) => {
    expect(hasRecordedResults({ ...blank, ...change })).toBe(true);
  });
});

describe('electionPaths', () => {
  it('keeps the locale prefix and the dashboard segment that the pages live under', () => {
    const paths = electionPaths('fr-CA');
    expect(paths.list).toBe('/fr-CA/dashboard/elections');
    expect(paths.create).toBe('/fr-CA/dashboard/elections/new');
    expect(paths.detail('abc 1')).toBe('/fr-CA/dashboard/elections/abc%201');
  });
});

describe('formatElectionDate', () => {
  it('shows a stored calendar date as that same day, in the reader language', () => {
    expect(formatElectionDate('2026-10-01', 'en-CA')).toContain('2026');
    expect(formatElectionDate('2026-10-01', 'en-CA')).toMatch(/\b1\b/);
    expect(formatElectionDate('2026-10-01', 'fr-CA')).toMatch(/octobre/);
  });

  it('returns a value it cannot read unchanged instead of printing "Invalid Date"', () => {
    expect(formatElectionDate('next spring', 'en-CA')).toBe('next spring');
  });
});

describe('readEntry', () => {
  it('reads the documented candidate and winner shapes', () => {
    expect(readEntry({ name: 'A', union: 'Local 1', platform: 'Fair pay', votes: 12 })).toEqual({
      name: 'A',
      union: 'Local 1',
      platform: 'Fair pay',
      votes: 12,
      termStart: undefined,
      termEnd: undefined,
    });
    expect(readEntry({ name: 'B', term_start: '2027-01-01', term_end: '2028-12-31' })).toMatchObject({
      name: 'B',
      termStart: '2027-01-01',
      termEnd: '2028-12-31',
    });
  });

  it('accepts a bare name', () => {
    expect(readEntry('C. Candidate')).toEqual({ name: 'C. Candidate' });
  });

  it('shows an entry with no readable name as the JSON it is, rather than hiding it', () => {
    expect(readEntry({ votes: 3 })).toEqual({ name: '{"votes":3}' });
    expect(readEntry(null)).toEqual({ name: 'null' });
    expect(readEntry([1, 2])).toEqual({ name: '[1,2]' });
  });

  it('ignores a vote count that is not a number', () => {
    expect(readEntry({ name: 'D', votes: '12' }).votes).toBeUndefined();
  });
});

describe('electionCopy', () => {
  const keysOf = (value: unknown): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child).map((inner) => `${key}.${inner}`)])
      : [];

  it('speaks French for any French locale and English otherwise', () => {
    expect(electionCopy('fr-CA').list.title).toBe('Élections du conseil');
    expect(electionCopy('FR').list.title).toBe('Élections du conseil');
    expect(electionCopy('en-CA').list.title).toBe('Council elections');
    expect(electionCopy('it').list.title).toBe('Council elections');
  });

  it('has the same entries in both languages', () => {
    expect(keysOf(electionCopy('fr-CA'))).toEqual(keysOf(electionCopy('en-CA')));
  });

  it('never tells the reader a vote can be cast, counted or exported', () => {
    const offered = (copy: ElectionCopy) => JSON.stringify([copy.list, copy.detail, copy.form, copy.shared]);
    expect(offered(electionCopy('en-CA'))).not.toMatch(/submit ballot|cast your vote|export results|already (cast|voted)/i);
    expect(offered(electionCopy('fr-CA'))).not.toMatch(/soumettre le bulletin|exporter les résultats|déjà voté/i);
  });

  it('names the capability it cannot offer', () => {
    expect(ELECTION_VOTING_CAPABILITY).toBe('UE-GOV-ELECTION-VOTING-RESULTS');
  });
});

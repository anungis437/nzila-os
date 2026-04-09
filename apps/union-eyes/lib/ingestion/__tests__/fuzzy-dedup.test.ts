/**
 * Tests: Fuzzy Deduplication Engine (§5-§7)
 *
 * Tests string similarity, timestamp proximity, party matching,
 * and composite case similarity scoring.
 */

import { describe, it, expect } from 'vitest';
import {
  jaccardSimilarity,
  timestampProximity,
  partyNameMatch,
  computeCaseSimilarity,
  computeDocumentHash,
  type CaseRecord,
} from '../fuzzy-dedup';

// ─── jaccardSimilarity ──────────────────────────────────────────────────────

describe('jaccardSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    const score = jaccardSimilarity('abc def', 'xyz uvw');
    expect(score).toBe(0);
  });

  it('returns high score for similar phrases', () => {
    const score = jaccardSimilarity(
      'Workplace harassment complaint filed',
      'Workplace harassment complaint submitted',
    );
    expect(score).toBeGreaterThan(0.5);
  });

  it('is case-insensitive', () => {
    expect(jaccardSimilarity('Hello World', 'hello world')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(0);
    expect(jaccardSimilarity('hello', '')).toBe(0);
    expect(jaccardSimilarity('', 'world')).toBe(0);
  });

  it('ignores punctuation', () => {
    const score = jaccardSimilarity(
      'contract violation, section 12',
      'contract violation section 12',
    );
    expect(score).toBeGreaterThan(0.9);
  });
});

// ─── timestampProximity ─────────────────────────────────────────────────────

describe('timestampProximity', () => {
  it('returns 1 for identical timestamps', () => {
    expect(timestampProximity('2026-01-15T10:00:00Z', '2026-01-15T10:00:00Z')).toBe(1);
  });

  it('returns >0 for timestamps within 24h', () => {
    const score = timestampProximity('2026-01-15T10:00:00Z', '2026-01-15T22:00:00Z');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 0 for timestamps >24h apart', () => {
    expect(timestampProximity('2026-01-15T10:00:00Z', '2026-01-17T10:00:00Z')).toBe(0);
  });

  it('returns 0 for null timestamps', () => {
    expect(timestampProximity(null, '2026-01-15T10:00:00Z')).toBe(0);
    expect(timestampProximity('2026-01-15T10:00:00Z', null)).toBe(0);
    expect(timestampProximity(null, null)).toBe(0);
  });

  it('returns 0 for invalid timestamps', () => {
    expect(timestampProximity('not-a-date', '2026-01-15T10:00:00Z')).toBe(0);
  });
});

// ─── partyNameMatch ─────────────────────────────────────────────────────────

describe('partyNameMatch', () => {
  it('returns 1 for exact match', () => {
    expect(partyNameMatch('John Smith', 'John Smith')).toBe(1);
  });

  it('matches case-insensitively', () => {
    expect(partyNameMatch('JOHN SMITH', 'john smith')).toBe(1);
  });

  it('returns 0 for null names', () => {
    expect(partyNameMatch(null, 'John')).toBe(0);
    expect(partyNameMatch('John', null)).toBe(0);
  });

  it('returns high score for similar names', () => {
    const score = partyNameMatch('John Smith Jr', 'John Smith');
    expect(score).toBeGreaterThanOrEqual(0.6);
  });
});

// ─── computeCaseSimilarity ──────────────────────────────────────────────────

describe('computeCaseSimilarity', () => {
  const baseCase: CaseRecord = {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Workplace harassment complaint by employee',
    incidentDate: '2026-03-15T10:00:00Z',
    grievantName: 'Jane Doe',
    organizationId: 'org-1',
  };

  it('detects highly similar cases', () => {
    const similar: CaseRecord = {
      id: '22222222-2222-2222-2222-222222222222',
      title: 'Workplace harassment complaint by worker',
      incidentDate: '2026-03-15T14:00:00Z',
      grievantName: 'Jane Doe',
      organizationId: 'org-1',
    };

    const match = computeCaseSimilarity(baseCase, similar);
    expect(match).not.toBeNull();
    expect(match!.score).toBeGreaterThan(0.7);
    expect(match!.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null for different orgs', () => {
    const diffOrg: CaseRecord = {
      ...baseCase,
      id: '33333333-3333-3333-3333-333333333333',
      organizationId: 'org-2',
    };
    expect(computeCaseSimilarity(baseCase, diffOrg)).toBeNull();
  });

  it('returns null for unrelated cases', () => {
    const unrelated: CaseRecord = {
      id: '44444444-4444-4444-4444-444444444444',
      title: 'Payroll discrepancy audit report',
      incidentDate: '2025-01-01T00:00:00Z',
      grievantName: 'Bob Jones',
      organizationId: 'org-1',
    };
    expect(computeCaseSimilarity(baseCase, unrelated)).toBeNull();
  });

  it('requires at least 2 matching signals', () => {
    // Same title but different date and party — only 1 signal
    const onlyTitle: CaseRecord = {
      id: '55555555-5555-5555-5555-555555555555',
      title: 'Workplace harassment complaint by employee',
      incidentDate: '2025-01-01T00:00:00Z',
      grievantName: 'Completely Different Person',
      organizationId: 'org-1',
    };
    // May match if title alone gives 2 signals (bigram overlap)
    // Actually title_similarity is one signal, so with no timestamp and no party match, it's null
    const result = computeCaseSimilarity(baseCase, onlyTitle);
    // Only title matches — 1 signal — should be null
    expect(result).toBeNull();
  });
});

// ─── computeDocumentHash ────────────────────────────────────────────────────

describe('computeDocumentHash', () => {
  it('produces consistent hashes', () => {
    const h1 = computeDocumentHash('report.pdf', 'pdf', 'https://store/report.pdf');
    const h2 = computeDocumentHash('report.pdf', 'pdf', 'https://store/report.pdf');
    expect(h1).toBe(h2);
  });

  it('is case-insensitive', () => {
    const h1 = computeDocumentHash('Report.PDF', 'PDF', 'HTTPS://store/report.pdf');
    const h2 = computeDocumentHash('report.pdf', 'pdf', 'https://store/report.pdf');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different files', () => {
    const h1 = computeDocumentHash('report.pdf', 'pdf');
    const h2 = computeDocumentHash('invoice.pdf', 'pdf');
    expect(h1).not.toBe(h2);
  });
});

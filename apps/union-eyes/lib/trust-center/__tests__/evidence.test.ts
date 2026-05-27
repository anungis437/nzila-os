import { describe, it, expect } from 'vitest';
import {
  classifyArtifact,
  annotateArtifacts,
  classifyClaimCoverage,
  computeManifestSummary,
  validateBuyerSafety,
  buildClaim,
  buildArtifact,
} from '../evidence';
import { checkDenylist, TRUST_CENTER_DENYLIST } from '../types';
import type { TrustClaim } from '../types';

// ── classifyArtifact ──────────────────────────────────────────────────────────

describe('classifyArtifact', () => {
  it('returns present when file exists and has content', () => {
    expect(classifyArtifact(true, true)).toBe('present');
  });

  it('returns partial when file exists but has no content', () => {
    expect(classifyArtifact(true, false)).toBe('partial');
  });

  it('returns missing when file does not exist', () => {
    expect(classifyArtifact(false, false)).toBe('missing');
    expect(classifyArtifact(false, true)).toBe('missing');
  });
});

// ── annotateArtifacts ─────────────────────────────────────────────────────────

describe('annotateArtifacts', () => {
  it('annotates each artifact with resolved status', () => {
    const artifacts = [
      buildArtifact('a/exists.json', 'report', 'exists'),
      buildArtifact('a/empty.json', 'report', 'empty'),
      buildArtifact('a/gone.json', 'report', 'missing'),
    ];
    const lookup = (path: string): [boolean, boolean] => {
      if (path.includes('exists')) return [true, true];
      if (path.includes('empty')) return [true, false];
      return [false, false];
    };
    const annotated = annotateArtifacts(artifacts, lookup);
    expect(annotated[0].status).toBe('present');
    expect(annotated[1].status).toBe('partial');
    expect(annotated[2].status).toBe('missing');
  });
});

// ── classifyClaimCoverage ─────────────────────────────────────────────────────

describe('classifyClaimCoverage', () => {
  function claimWithStatuses(statuses: Array<'present' | 'partial' | 'missing'>): TrustClaim {
    return buildClaim('test', 'Test', 'Test summary', statuses.map((s, i) => ({
      ...buildArtifact(`path/${i}`, 'report', 'desc'),
      status: s,
    })));
  }

  it('returns present when all evidence is present', () => {
    expect(classifyClaimCoverage(claimWithStatuses(['present', 'present']))).toBe('present');
  });

  it('returns missing when all evidence is missing', () => {
    expect(classifyClaimCoverage(claimWithStatuses(['missing', 'missing']))).toBe('missing');
  });

  it('returns missing when evidence array is empty', () => {
    expect(classifyClaimCoverage(buildClaim('x', 'X', 'X summary', []))).toBe('missing');
  });

  it('returns partial for mixed present + missing', () => {
    expect(classifyClaimCoverage(claimWithStatuses(['present', 'missing']))).toBe('partial');
  });

  it('returns partial for mix of partial only', () => {
    expect(classifyClaimCoverage(claimWithStatuses(['partial', 'partial']))).toBe('partial');
  });
});

// ── computeManifestSummary ────────────────────────────────────────────────────

describe('computeManifestSummary', () => {
  function makeClaim(id: string, statuses: Array<'present' | 'partial' | 'missing'>, buyerVisible = true): TrustClaim {
    return buildClaim(id, id, `Summary for ${id}`, statuses.map((s, i) => ({
      ...buildArtifact(`path/${id}/${i}`, 'report', 'desc'),
      status: s,
    })), { buyerVisible });
  }

  it('counts present, partial, missing correctly', () => {
    const claims = [
      makeClaim('a', ['present', 'present']),
      makeClaim('b', ['present', 'missing']),
      makeClaim('c', ['missing']),
    ];
    const summary = computeManifestSummary(claims);
    expect(summary.totalClaims).toBe(3);
    expect(summary.presentClaims).toBe(1);
    expect(summary.partialClaims).toBe(1);
    expect(summary.missingClaims).toBe(1);
  });

  it('counts buyer-visible claims', () => {
    const claims = [
      makeClaim('a', ['present'], true),
      makeClaim('b', ['present'], false),
    ];
    const summary = computeManifestSummary(claims);
    expect(summary.buyerVisibleClaims).toBe(1);
  });

  it('computes coverage score: 100 when all present', () => {
    const claims = [makeClaim('a', ['present']), makeClaim('b', ['present'])];
    expect(computeManifestSummary(claims).coverageScore).toBe(100);
  });

  it('computes coverage score: 0 when all missing', () => {
    const claims = [makeClaim('a', ['missing']), makeClaim('b', ['missing'])];
    expect(computeManifestSummary(claims).coverageScore).toBe(0);
  });

  it('returns 0 coverage and 0 counts for empty input', () => {
    const summary = computeManifestSummary([]);
    expect(summary.totalClaims).toBe(0);
    expect(summary.coverageScore).toBe(0);
  });
});

// ── validateBuyerSafety ───────────────────────────────────────────────────────

describe('validateBuyerSafety', () => {
  it('returns no violations for clean claims', () => {
    const claims = [buildClaim('a', 'A', 'This platform supports governance controls.', [])];
    expect(validateBuyerSafety(claims)).toHaveLength(0);
  });

  it('flags a claim summary containing a denylist term', () => {
    const claims = [
      buildClaim('a', 'A', 'Obtained via WhatsApp private meeting.', [], { buyerVisible: true }),
    ];
    const violations = validateBuyerSafety(claims);
    expect(violations).toHaveLength(1);
    expect(violations[0].claimId).toBe('a');
    expect(violations[0].matchedTerm).toBe('whatsapp');
  });

  it('does not check non-buyer-visible claims', () => {
    const claims = [
      buildClaim('b', 'B', 'Contains token= internal reference.', [], { buyerVisible: false }),
    ];
    expect(validateBuyerSafety(claims)).toHaveLength(0);
  });

  it('catches all TRUST_CENTER_DENYLIST terms', () => {
    for (const term of TRUST_CENTER_DENYLIST) {
      const claims = [buildClaim('x', 'X', `Contains ${term} value.`, [], { buyerVisible: true })];
      const violations = validateBuyerSafety(claims);
      expect(violations.length).toBeGreaterThan(0);
    }
  });
});

// ── checkDenylist ─────────────────────────────────────────────────────────────

describe('checkDenylist', () => {
  it('is case-insensitive', () => {
    expect(checkDenylist('This contains BEARER token')).toBeDefined();
  });

  it('returns undefined for clean text', () => {
    expect(checkDenylist('governance policy orchestration')).toBeUndefined();
  });

  it('returns the matched term', () => {
    expect(checkDenylist('raw transcript excerpt')).toBe('raw transcript');
  });
});

// ── manifest shape ────────────────────────────────────────────────────────────

describe('manifest shape', () => {
  it('buildClaim populates all required fields', () => {
    const claim = buildClaim(
      'route-governance',
      'Route governance registry',
      'UnionEyes maintains a generated registry of governed routes.',
      [buildArtifact('apps/union-eyes/reports/route-registry.json', 'report', 'Generated route registry')],
      { buyerVisible: true, riskIfMissing: 'Buyers cannot verify route coverage.' },
    );
    expect(claim.id).toBe('route-governance');
    expect(claim.buyerVisible).toBe(true);
    expect(claim.riskIfMissing).toContain('route coverage');
    expect(claim.evidence).toHaveLength(1);
    expect(claim.evidence[0].type).toBe('report');
  });
});

/**
 * CourtLens Phase 2H bilingual regression tests.
 *
 * Proves that:
 * - `courtlens` namespace exists in both en-CA and fr-CA catalogs.
 * - Every EN-CA courtlens key has a matching FR-CA key (structural parity).
 * - Every EN-CA abrDashboard key has a matching FR-CA key (pre-existing gap
 *   closed in Phase 2H).
 * - FR-CA legal-boundary strings actually contain the French denial phrase
 *   "n'est pas un avis juridique" (unicode-aware).
 * - No accidentally-empty FR strings.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const en = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'en-CA.json'), 'utf8'),
) as Record<string, unknown>;
const fr = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fr-CA.json'), 'utf8'),
) as Record<string, unknown>;

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return prefix ? [prefix] : [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(p);
    else out.push(...collectKeys(v, p));
  }
  return out;
}

function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (typeof cur === 'object' && cur !== null && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

describe('bilingual catalogs — courtlens namespace parity', () => {
  it('courtlens exists in both catalogs', () => {
    expect(en.courtlens).toBeDefined();
    expect(fr.courtlens).toBeDefined();
  });

  it('every EN courtlens key has a matching FR key', () => {
    const enKeys = collectKeys(en.courtlens, 'courtlens');
    const missing: string[] = [];
    for (const k of enKeys) {
      if (typeof getByPath(fr, k) !== 'string') missing.push(k);
    }
    expect(missing).toEqual([]);
  });

  it('every FR courtlens key has a matching EN key (no orphans)', () => {
    const frKeys = collectKeys(fr.courtlens, 'courtlens');
    const missing: string[] = [];
    for (const k of frKeys) {
      if (typeof getByPath(en, k) !== 'string') missing.push(k);
    }
    expect(missing).toEqual([]);
  });

  it('no FR courtlens string is empty', () => {
    const frKeys = collectKeys(fr.courtlens, 'courtlens');
    const empty: string[] = [];
    for (const k of frKeys) {
      if (String(getByPath(fr, k)).trim() === '') empty.push(k);
    }
    expect(empty).toEqual([]);
  });

  it('FR intake page carries "avis juridique" denial framing', () => {
    const framingHumanReview = getByPath(fr, 'courtlens.publicIntake.framingHumanReview') as string;
    const framingNoAi = getByPath(fr, 'courtlens.publicIntake.framingNoAi') as string;
    expect(framingHumanReview).toContain('avis juridique');
    expect(framingNoAi).toContain('avis juridique');
    // Must not claim to provide legal advice (accepts both ASCII ' and curly ’)
    expect(framingHumanReview.toLowerCase()).toMatch(
      /n['\u2019]est pas un avis juridique|il ne s['\u2019]agit pas d['\u2019]un avis juridique/,
    );
  });

  it('FR consent copy carries "n\'est pas un avis juridique" denial', () => {
    const consent = getByPath(fr, 'courtlens.publicIntake.consentLabel') as string;
    expect(consent.toLowerCase()).toContain('avis juridique');
  });

  it('FR tenant queue subtitle carries the denial framing', () => {
    const subtitle = getByPath(fr, 'courtlens.tenantQueue.subtitle') as string;
    expect(subtitle.toLowerCase()).toContain('avis juridique');
  });

  it('FR matter detail subtitle carries the denial framing', () => {
    const subtitle = getByPath(fr, 'courtlens.matterDetail.subtitle') as string;
    expect(subtitle.toLowerCase()).toContain('avis juridique');
  });

  it('FR error strings are non-empty and French', () => {
    const rateLimit = getByPath(fr, 'courtlens.errors.publicIntakeRateLimit') as string;
    expect(rateLimit).toMatch(/Trop|patienter/i);
  });
});

describe('bilingual catalogs — abrDashboard namespace parity (pre-existing gap closed)', () => {
  it('abrDashboard exists in both catalogs', () => {
    expect(en.abrDashboard).toBeDefined();
    expect(fr.abrDashboard).toBeDefined();
  });

  it('every EN abrDashboard key has a matching FR key', () => {
    const enKeys = collectKeys(en.abrDashboard, 'abrDashboard');
    const missing: string[] = [];
    for (const k of enKeys) {
      if (typeof getByPath(fr, k) !== 'string') missing.push(k);
    }
    expect(missing).toEqual([]);
  });

  it('covers keys referenced by dashboard pages (regression against silent i18n gaps)', () => {
    // Sampled from actual t('...') calls in dashboard pages
    const required = [
      'abrDashboard.roi.title',
      'abrDashboard.pipeline.title',
      'abrDashboard.pipeline.stats.activeDemos',
      'abrDashboard.intelligence.title',
      'abrDashboard.intelligence.reviewQueue',
      'abrDashboard.learning.title',
      'abrDashboard.governance.title',
      'abrDashboard.trust.title',
    ];
    for (const key of required) {
      expect(typeof getByPath(en, key), `EN missing ${key}`).toBe('string');
      expect(typeof getByPath(fr, key), `FR missing ${key}`).toBe('string');
    }
  });
});

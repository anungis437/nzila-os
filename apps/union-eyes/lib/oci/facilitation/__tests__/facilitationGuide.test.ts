/**
 * OCI facilitation guide invariants.
 *
 * The catalogue is editorial content with organizational consequence.
 * These tests guard the doctrinal invariants that the guide must
 * uphold so that drift in the data file is caught at CI time.
 */

import { describe, expect, it } from 'vitest';

import {
  FACILITATION_GUIDE,
  FACILITATION_GUIDE_BY_SESSION,
} from '../facilitationGuide';
import type {
  FacilitationGuideEntry,
  FacilitationSessionType,
  LocalizedString,
  LocalizedStringList,
} from '../types';

const REQUIRED_SESSIONS: readonly FacilitationSessionType[] = [
  'executive-interpretation',
  'workbook-orientation',
  'stewardship-density-review',
  'continuity-breakpoint-working-session',
  'governance-continuity-plan-ratification',
];

// Subset of forbidden marketing vocabulary the guide must never adopt.
// Kept inline so that doctrine cannot drift via a single source removal.
const FORBIDDEN_TERMS: readonly string[] = [
  'transformation',
  'transform',
  'optimize',
  'optimization',
  'optimise',
  'optimisation',
  'productivity',
  'autonomous',
  'disrupt',
  'automation',
  'automate',
  'ai-led',
  'ai-driven',
  'ai-powered',
  'demo',
  'modules available',
  'all-in-one',
  'frictionless',
  'seamless',
  'behavioural analytics',
  'behavioral analytics',
  'scoring',
  'surveillance',
  'rip and replace',
];

function collectStrings(entry: FacilitationGuideEntry): string[] {
  // Scan only participant-facing editorial fields. Fields that name
  // forbidden frames in order to forbid them (failureSignals,
  // whatToAvoid) are intentionally excluded — they must be able to
  // quote the frame they reject.
  const out: string[] = [];
  const pushLocalized = (s: LocalizedString) => out.push(s['en-CA']);
  const pushLocalizedList = (s: LocalizedStringList) =>
    out.push(...s['en-CA']);

  pushLocalized(entry.title);
  pushLocalized(entry.purpose);
  pushLocalized(entry.audience);
  pushLocalized(entry.openingPosture);
  pushLocalized(entry.mappingArc);
  pushLocalized(entry.closingPosture);
  pushLocalizedList(entry.successSignals);
  return out;
}

describe('FACILITATION_GUIDE', () => {
  it('covers every required session type exactly once', () => {
    const seen = FACILITATION_GUIDE.map((e) => e.sessionType).sort();
    const expected = [...REQUIRED_SESSIONS].sort();
    expect(seen).toEqual(expected);
  });

  it('exposes a lookup keyed by sessionType for every entry', () => {
    for (const entry of FACILITATION_GUIDE) {
      expect(FACILITATION_GUIDE_BY_SESSION[entry.sessionType]).toBe(entry);
    }
  });

  it('declares non-empty editorial fields for every entry', () => {
    for (const entry of FACILITATION_GUIDE) {
      expect(entry.title['en-CA'].length).toBeGreaterThan(0);
      expect(entry.purpose['en-CA'].length).toBeGreaterThan(0);
      expect(entry.successSignals['en-CA'].length).toBeGreaterThan(0);
      expect(entry.failureSignals['en-CA'].length).toBeGreaterThan(0);
      expect(entry.whatToAvoid['en-CA'].length).toBeGreaterThan(0);
      expect(entry.durationMinutes).toBeGreaterThan(0);
    }
  });

  it('uses no forbidden marketing vocabulary in any editorial field', () => {
    for (const entry of FACILITATION_GUIDE) {
      // Strip doctrine document references that legitimately contain
      // the token 'surveillance' (e.g. "OCI Anti-Surveillance Position")
      // before scanning for the surveillance marketing token.
      const blob = collectStrings(entry)
        .join('\n')
        .toLowerCase()
        .replace(/anti-surveillance/g, '');
      for (const term of FORBIDDEN_TERMS) {
        expect(
          blob.includes(term),
          `Entry ${entry.sessionType} contains forbidden term "${term}"`,
        ).toBe(false);
      }
    }
  });
});

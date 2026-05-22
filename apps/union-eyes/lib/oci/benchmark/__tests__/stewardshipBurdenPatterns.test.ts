/**
 * OCI stewardship-burden pattern invariants.
 */

import { describe, expect, it } from 'vitest';

import {
  STEWARDSHIP_BURDEN_PATTERNS,
  STEWARDSHIP_BURDEN_PATTERNS_BY_CATEGORY,
  STEWARDSHIP_BURDEN_PATTERNS_BY_ID,
} from '../stewardshipBurdenPatterns';
import type { StewardshipBurdenCategory } from '../types';

const REQUIRED_CATEGORIES: readonly StewardshipBurdenCategory[] = [
  'governance-density',
  'interpretive-density',
  'operational-process-density',
  'onboarding-mentorship-density',
  'external-counterpart-memory-density',
  'modernization-stewardship-overload',
  'continuity-fairness-imbalance',
  'silent-stewardship',
];

const FORBIDDEN_TERMS: readonly string[] = [
  'transformation',
  'transform',
  'optimize',
  'optimise',
  'optimization',
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

describe('STEWARDSHIP_BURDEN_PATTERNS', () => {
  it('has at least three patterns per required category', () => {
    for (const category of REQUIRED_CATEGORIES) {
      const bucket = STEWARDSHIP_BURDEN_PATTERNS_BY_CATEGORY[category] ?? [];
      expect(
        bucket.length,
        `Category ${category} must contain at least 3 patterns`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('assigns unique pattern ids and an entry in the id lookup', () => {
    const ids = STEWARDSHIP_BURDEN_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of STEWARDSHIP_BURDEN_PATTERNS) {
      expect(STEWARDSHIP_BURDEN_PATTERNS_BY_ID[p.id]).toBe(p);
    }
  });

  it('uses no forbidden vocabulary in participant-facing fields', () => {
    for (const p of STEWARDSHIP_BURDEN_PATTERNS) {
      const blob = [
        p.name['en-CA'],
        p.description['en-CA'],
        ...(p.institutionalIndicators['en-CA'] ?? []),
        ...(p.mappingPrompts['en-CA'] ?? []),
        ...(p.stabilizationOptions['en-CA'] ?? []),
      ]
        .join('\n')
        .toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(
          blob.includes(term),
          `Pattern ${p.id} contains forbidden term "${term}"`,
        ).toBe(false);
      }
    }
  });

  it('keeps mapping prompts free of blame framing', () => {
    const blame = /why do you (not|fail to|never)/i;
    for (const p of STEWARDSHIP_BURDEN_PATTERNS) {
      for (const prompt of p.mappingPrompts['en-CA'] ?? []) {
        expect(
          blame.test(prompt),
          `Pattern ${p.id} mapping prompt uses blame framing: "${prompt}"`,
        ).toBe(false);
      }
    }
  });

  it('declares red lines for every pattern', () => {
    for (const p of STEWARDSHIP_BURDEN_PATTERNS) {
      const lines = p.redLines['en-CA'] ?? [];
      expect(
        lines.length,
        `Pattern ${p.id} must declare at least one red line`,
      ).toBeGreaterThan(0);
    }
  });
});

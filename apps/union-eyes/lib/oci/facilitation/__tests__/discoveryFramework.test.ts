/**
 * OCI institutional discovery framework invariants.
 */

import { describe, expect, it } from 'vitest';

import {
  INSTITUTIONAL_DISCOVERY_BY_SECTION,
  INSTITUTIONAL_DISCOVERY_FRAMEWORK,
} from '../institutionalDiscoveryFramework';
import type { DiscoverySectionId } from '../types';

const REQUIRED_SECTIONS: readonly DiscoverySectionId[] = [
  'governance-landscape',
  'stewardship-hotspots',
  'continuity-fragility',
  'modernization-pressure',
  'political-sensitivities',
];

const FORBIDDEN_TERMS: readonly string[] = [
  'transformation',
  'optimize',
  'optimise',
  'productivity',
  'autonomous',
  'disrupt',
  'automation',
  'automate',
  'ai-led',
  'ai-driven',
  'ai-powered',
  'demo',
  'all-in-one',
  'frictionless',
  'seamless',
  'behavioural analytics',
  'behavioral analytics',
  'scoring',
  'surveillance',
];

describe('INSTITUTIONAL_DISCOVERY_FRAMEWORK', () => {
  it('covers every required section exactly once', () => {
    const seen = INSTITUTIONAL_DISCOVERY_FRAMEWORK.map((s) => s.sectionId).sort();
    expect(seen).toEqual([...REQUIRED_SECTIONS].sort());
  });

  it('exposes a lookup keyed by sectionId', () => {
    for (const section of INSTITUTIONAL_DISCOVERY_FRAMEWORK) {
      expect(INSTITUTIONAL_DISCOVERY_BY_SECTION[section.sectionId]).toBe(section);
    }
  });

  it('declares at least three prompts and a non-empty synthesisStarter for every section', () => {
    for (const section of INSTITUTIONAL_DISCOVERY_FRAMEWORK) {
      expect(section.prompts.length).toBeGreaterThanOrEqual(3);
      expect(section.synthesisStarter['en-CA'].length).toBeGreaterThan(0);
      for (const prompt of section.prompts) {
        expect(prompt.prompt['en-CA'].length).toBeGreaterThan(0);
        expect(prompt.rationale['en-CA'].length).toBeGreaterThan(0);
      }
    }
  });

  it('uses no forbidden marketing vocabulary in any prompt or rationale', () => {
    for (const section of INSTITUTIONAL_DISCOVERY_FRAMEWORK) {
      const parts: string[] = [
        section.title['en-CA'],
        section.purpose['en-CA'],
        section.synthesisStarter['en-CA'],
      ];
      for (const p of section.prompts) {
        parts.push(p.prompt['en-CA'], p.rationale['en-CA']);
      }
      const blob = parts.join('\n').toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(
          blob.includes(term),
          `Section ${section.sectionId} contains forbidden term "${term}"`,
        ).toBe(false);
      }
    }
  });
});

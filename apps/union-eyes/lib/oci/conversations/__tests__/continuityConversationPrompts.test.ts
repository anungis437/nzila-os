/**
 * OCI continuity conversation prompts invariants.
 *
 * The catalogue must cover every continuity category, avoid blame
 * patterns in any question, and never adopt forbidden marketing
 * vocabulary.
 */

import { describe, expect, it } from 'vitest';

import {
  CONTINUITY_CONVERSATION_PROMPTS,
  CONTINUITY_CONVERSATION_PROMPTS_BY_CATEGORY,
} from '../continuityConversationPrompts';
import type { ConversationCategory } from '../../facilitation/types';

const REQUIRED_CATEGORIES: readonly ConversationCategory[] = [
  'governance-survivability',
  'stewardship-burden',
  'operational-reconstruction',
  'institutional-memory',
  'onboarding-fragility',
  'continuity-fairness',
  'modernization-risk',
  'governance-interpretation-drift',
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

// Patterns that signal blame-voice rather than recognition-voice.
const BLAME_PATTERNS: readonly RegExp[] = [
  /why do you (not|fail to|never)/i,
  /why did you (not|fail to|never)/i,
  /why have you (not|failed to|never)/i,
  /why don't you/i,
];

describe('CONTINUITY_CONVERSATION_PROMPTS', () => {
  it('includes every required continuity category with at least three prompts', () => {
    for (const category of REQUIRED_CATEGORIES) {
      const prompts = CONTINUITY_CONVERSATION_PROMPTS_BY_CATEGORY[category] ?? [];
      expect(
        prompts.length,
        `Category ${category} must have at least 3 prompts`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('exposes only known categories', () => {
    for (const prompt of CONTINUITY_CONVERSATION_PROMPTS) {
      expect(REQUIRED_CATEGORIES).toContain(prompt.category);
    }
  });

  it('declares unique stable ids for every prompt', () => {
    const ids = CONTINUITY_CONVERSATION_PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares non-empty editorial fields for every prompt', () => {
    for (const prompt of CONTINUITY_CONVERSATION_PROMPTS) {
      expect(prompt.question['en-CA'].length).toBeGreaterThan(0);
      expect(prompt.whyItMatters['en-CA'].length).toBeGreaterThan(0);
      expect(prompt.whatToListenFor['en-CA'].length).toBeGreaterThan(0);
      expect(prompt.avoidIfShared['en-CA'].length).toBeGreaterThan(0);
    }
  });

  it('never adopts blame-voice in any question', () => {
    for (const prompt of CONTINUITY_CONVERSATION_PROMPTS) {
      const question = prompt.question['en-CA'];
      for (const pattern of BLAME_PATTERNS) {
        expect(
          pattern.test(question),
          `Prompt ${prompt.id} contains blame pattern ${pattern}`,
        ).toBe(false);
      }
    }
  });

  it('never adopts forbidden marketing vocabulary in any field', () => {
    for (const prompt of CONTINUITY_CONVERSATION_PROMPTS) {
      const blob = [
        prompt.question['en-CA'],
        prompt.whyItMatters['en-CA'],
        ...prompt.whatToListenFor['en-CA'],
        ...prompt.avoidIfShared['en-CA'],
      ]
        .join('\n')
        .toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(
          blob.includes(term),
          `Prompt ${prompt.id} contains forbidden term "${term}"`,
        ).toBe(false);
      }
    }
  });
});

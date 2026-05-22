/**
 * Assessment Modality Invariant — verifies the bank distribution and
 * modality role discipline mandated by docs/oci/assessment/OCI_MODALITY_DOCTRINE.md.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS, QUESTION_BANK_VERSION } from '../questions';
import type { Question } from '../types';

function countByType(qs: ReadonlyArray<Question>) {
  return qs.reduce<Record<Question['type'], number>>(
    (acc, q) => {
      acc[q.type] = (acc[q.type] ?? 0) + 1;
      return acc;
    },
    { likert_5: 0, multiple_choice: 0, maturity_select: 0 },
  );
}

describe('OCI assessment modality invariant', () => {
  const counts = countByType(ALL_QUESTIONS);
  const total = ALL_QUESTIONS.length;

  it('bank version is at least 3 (modality expansion sprint)', () => {
    expect(QUESTION_BANK_VERSION).toBeGreaterThanOrEqual(3);
  });

  it('likert_5 question count is within doctrine bounds (6..8)', () => {
    expect(counts.likert_5).toBeGreaterThanOrEqual(6);
    expect(counts.likert_5).toBeLessThanOrEqual(8);
  });

  it('multiple_choice question count is within doctrine bounds (4..6)', () => {
    expect(counts.multiple_choice).toBeGreaterThanOrEqual(4);
    expect(counts.multiple_choice).toBeLessThanOrEqual(6);
  });

  it('maturity_select remains the dominant modality (>= 60% of surface)', () => {
    expect(counts.maturity_select / total).toBeGreaterThanOrEqual(0.6);
  });

  it('all three modalities are represented', () => {
    expect(counts.likert_5).toBeGreaterThan(0);
    expect(counts.multiple_choice).toBeGreaterThan(0);
    expect(counts.maturity_select).toBeGreaterThan(0);
  });

  it('every question has a unique id', () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every likert_5 question carries a 1..5 scale', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'likert_5') continue;
      expect(q.scale.min).toBe(1);
      expect(q.scale.max).toBe(5);
      expect(q.scale.minLabel.length).toBeGreaterThan(0);
      expect(q.scale.maxLabel.length).toBeGreaterThan(0);
    }
  });

  it('every multiple_choice question has at least 3 options', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'multiple_choice') continue;
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
  });
});

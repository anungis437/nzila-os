/**
 * Question Metadata Integrity — verifies intelligence metadata completeness
 * and modality-role consistency per docs/oci/assessment/OCI_QUESTION_ARCHITECTURE.md.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../questions';
import { validateQuestionMetadata } from '../questionIntelligenceMetadata';

describe('Question intelligence metadata integrity', () => {
  it('every likert_5 question declares intelligence metadata', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'likert_5') continue;
      expect(q.intelligence, `likert ${q.id} missing intelligence`).toBeDefined();
    }
  });

  it('every multiple_choice question declares intelligence metadata', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'multiple_choice') continue;
      expect(q.intelligence, `mc ${q.id} missing intelligence`).toBeDefined();
    }
  });

  it('every question with declared metadata passes validation', () => {
    for (const q of ALL_QUESTIONS) {
      if (!q.intelligence) continue;
      const issues = validateQuestionMetadata(q);
      expect(issues, `${q.id}: ${issues.join(', ')}`).toEqual([]);
    }
  });

  it('modality role is consistent with question type', () => {
    for (const q of ALL_QUESTIONS) {
      const m = q.intelligence;
      if (!m) continue;
      if (q.type === 'maturity_select') expect(m.modalityRole).toBe('maturity_ladder');
      if (q.type === 'likert_5')
        expect(['confidence_sensing', 'ambiguity_sensing']).toContain(m.modalityRole);
      if (q.type === 'multiple_choice')
        expect(['structural_pattern', 'inheritance_pattern', 'topology_pattern']).toContain(
          m.modalityRole,
        );
    }
  });

  it('intelligence contribution is declared with at most two entries', () => {
    for (const q of ALL_QUESTIONS) {
      const m = q.intelligence;
      if (!m) continue;
      expect(m.intelligenceContribution.length).toBeGreaterThanOrEqual(1);
      expect(m.intelligenceContribution.length).toBeLessThanOrEqual(2);
    }
  });

  it('likert_5 confidence questions are longitudinally high-value', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'likert_5') continue;
      expect(q.intelligence?.longitudinalValue).toBe('high');
      expect(q.intelligence?.confidenceSensitivity).toBe(true);
    }
  });

  it('multiple_choice questions declare at least one archetype contribution', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'multiple_choice') continue;
      const archetypes = q.intelligence?.archetypeContribution ?? [];
      expect(archetypes.length).toBeGreaterThan(0);
    }
  });
});

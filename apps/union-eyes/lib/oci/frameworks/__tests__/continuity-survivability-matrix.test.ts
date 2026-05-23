import { describe, expect, it } from 'vitest';
import {
  classifySurvivability,
  SURVIVABILITY_MATRIX,
  type DependencyConcentration,
  type SuccessorReadiness,
} from '../continuity-survivability-matrix';

describe('Continuity Survivability Matrix', () => {
  const dependencies: DependencyConcentration[] = ['distributed', 'concentrated', 'singular'];
  const successors: SuccessorReadiness[] = ['identified', 'in_progress', 'absent'];

  it('publishes a 3x3 matrix (9 unique cells)', () => {
    expect(SURVIVABILITY_MATRIX).toHaveLength(9);
    const ids = SURVIVABILITY_MATRIX.map((c) => c.id);
    expect(new Set(ids).size).toBe(9);
  });

  it('covers every (dependency, successor) permutation', () => {
    for (const d of dependencies) {
      for (const s of successors) {
        const cell = SURVIVABILITY_MATRIX.find((c) => c.dependency === d && c.successor === s);
        expect(cell, `missing cell for ${d}_${s}`).toBeDefined();
        expect(cell?.id).toBe(`${d}_${s}`);
      }
    }
  });

  it('every cell has a non-empty label and posture', () => {
    for (const cell of SURVIVABILITY_MATRIX) {
      expect(cell.label.length).toBeGreaterThan(0);
      expect(cell.posture.length).toBeGreaterThan(0);
    }
  });

  it('classifies the worst-case (singular + absent) as imminent break', () => {
    const result = classifySurvivability('singular', 'absent');
    expect(result.id).toBe('singular_absent');
    expect(result.label).toMatch(/imminent/i);
  });

  it('classifies the best-case (distributed + identified) as covered', () => {
    const result = classifySurvivability('distributed', 'identified');
    expect(result.id).toBe('distributed_identified');
    expect(result.posture).toMatch(/periodic review/i);
  });

  it('classifySurvivability returns the correct cell for every combination', () => {
    for (const d of dependencies) {
      for (const s of successors) {
        const cell = classifySurvivability(d, s);
        expect(cell.dependency).toBe(d);
        expect(cell.successor).toBe(s);
      }
    }
  });

  it('falls back to last cell for unknown combination (defensive default)', () => {
    // Cast: this is the defensive default branch — exercised when an upstream
    // caller produces a permutation the matrix does not enumerate.
    const result = classifySurvivability(
      'unknown' as DependencyConcentration,
      'unknown' as SuccessorReadiness,
    );
    expect(result).toBe(SURVIVABILITY_MATRIX[SURVIVABILITY_MATRIX.length - 1]);
  });
});

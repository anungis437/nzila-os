import { describe, expect, it } from 'vitest';
import { classifyDecay, applyDecay, DECAY_THRESHOLDS_DAYS } from './confidence-decay';

describe('Confidence decay', () => {
  it('returns NONE for null/undefined/negative ages', () => {
    expect(classifyDecay(null).band).toBe('NONE');
    expect(classifyDecay(undefined).band).toBe('NONE');
    expect(classifyDecay(-1).band).toBe('NONE');
  });

  it('honours boundary days (89/90/179/180/364/365)', () => {
    expect(classifyDecay(89).band).toBe('NONE');
    expect(classifyDecay(90).band).toBe('MILD');
    expect(classifyDecay(179).band).toBe('MILD');
    expect(classifyDecay(180).band).toBe('MODERATE');
    expect(classifyDecay(364).band).toBe('MODERATE');
    expect(classifyDecay(365).band).toBe('SEVERE');
  });

  it('emits OUTDATED_ASSESSMENT caution at MODERATE+', () => {
    expect(classifyDecay(180).caution).toBe('OUTDATED_ASSESSMENT');
    expect(classifyDecay(400).caution).toBe('OUTDATED_ASSESSMENT');
    expect(classifyDecay(89).caution).toBe(null);
  });

  it('thresholds frozen', () => {
    expect(Object.isFrozen(DECAY_THRESHOLDS_DAYS)).toBe(true);
  });

  it('applyDecay never raises confidence', () => {
    expect(applyDecay('HIGH', 'MILD')).toBe('MODERATE');
    expect(applyDecay('MODERATE', 'MILD')).toBe('MODERATE');
    expect(applyDecay('HIGH', 'MODERATE')).toBe('MODERATE');
    expect(applyDecay('MODERATE', 'MODERATE')).toBe('LOW');
    expect(applyDecay('HIGH', 'SEVERE')).toBe('INSUFFICIENT');
    expect(applyDecay('INSUFFICIENT', 'NONE')).toBe('INSUFFICIENT');
  });

  it('is deterministic across repeated calls', () => {
    for (let i = 0; i < 100; i++) {
      expect(classifyDecay(200).band).toBe('MODERATE');
    }
  });
});

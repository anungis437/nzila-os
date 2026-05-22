import { describe, expect, it } from 'vitest';
import {
  runContinuityMapping,
  ENGINE_VERSION,
  type ContinuityLandscapeInput,
} from '@/lib/workbook/engines/continuityMappingEngine';

const FORBIDDEN =
  /\b(transformation|transform|optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const empty = (): ContinuityLandscapeInput => ({
  workbookId: 'wb-empty',
  holders: [],
});

const concentrated = (): ContinuityLandscapeInput => ({
  workbookId: 'wb-c',
  holders: [
    { id: 'h1', role: 'r1', criticality: 'institution_critical', tenureBand: '15y_plus', successorIdentified: false },
    { id: 'h2', role: 'r2', criticality: 'load_bearing', tenureBand: '7_15y', successorIdentified: false },
  ],
  operationalSurface: {
    documentedProcessCount: 1,
    undocumentedProcessCount: 4,
    singleCarrierProcessCount: 4,
    totalProcessCount: 5,
  },
});

describe('continuityMappingEngine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('returns no warning or critical signals on empty workbook', () => {
    const out = runContinuityMapping(empty());
    const elevated = out.signals.filter((s) => s.severity === 'warning' || s.severity === 'critical');
    expect(elevated).toEqual([]);
  });

  it('is deterministic', () => {
    expect(runContinuityMapping(concentrated())).toEqual(runContinuityMapping(concentrated()));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runContinuityMapping(concentrated());
    const text = [out.preview, ...out.signals.map((s) => s.statement)].join(' ').replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});

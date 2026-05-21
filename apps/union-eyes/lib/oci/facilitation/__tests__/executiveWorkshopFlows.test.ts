/**
 * OCI executive workshop flow invariants.
 *
 * Workshop flows must open with reflection rather than diagnosis,
 * cover the standard arc, and never adopt forbidden marketing
 * vocabulary inside their prompts or facilitator notes.
 */

import { describe, expect, it } from 'vitest';

import {
  EXECUTIVE_WORKSHOP_FLOWS,
  EXECUTIVE_WORKSHOP_FLOWS_BY_SESSION,
} from '../executiveWorkshopFlows';
import type { FacilitationSessionType, WorkshopFlow } from '../types';

const REQUIRED_SESSIONS: readonly FacilitationSessionType[] = [
  'executive-interpretation',
  'workbook-orientation',
  'stewardship-density-review',
  'continuity-breakpoint-working-session',
  'governance-continuity-plan-ratification',
];

const STANDARD_STEP_IDS: readonly string[] = [
  'opening-reflection',
  'operational-mapping',
  'stewardship-recognition',
  'governance-realization',
  'stabilization-pathway',
];

const FORBIDDEN_TERMS: readonly string[] = [
  'transformation',
  'transform',
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

function flatten(flow: WorkshopFlow): string {
  // Scan only participant-facing editorial fields. `redLines`
  // intentionally quote forbidden frames in order to forbid them
  // and are therefore excluded from the vocabulary scan.
  const parts: string[] = [flow.title['en-CA'], flow.summary['en-CA']];
  for (const step of flow.steps) {
    parts.push(step.prompt['en-CA']);
    parts.push(step.expectedSurface['en-CA']);
    parts.push(step.facilitatorNotes['en-CA']);
    parts.push(step.tonePosture['en-CA']);
  }
  return parts.join('\n').toLowerCase();
}

describe('EXECUTIVE_WORKSHOP_FLOWS', () => {
  it('covers every required session type exactly once', () => {
    const seen = EXECUTIVE_WORKSHOP_FLOWS.map((f) => f.sessionType).sort();
    expect(seen).toEqual([...REQUIRED_SESSIONS].sort());
  });

  it('exposes a lookup keyed by sessionType', () => {
    for (const flow of EXECUTIVE_WORKSHOP_FLOWS) {
      expect(EXECUTIVE_WORKSHOP_FLOWS_BY_SESSION[flow.sessionType]).toBe(flow);
    }
  });

  it('includes the full standard arc in every flow, in order', () => {
    for (const flow of EXECUTIVE_WORKSHOP_FLOWS) {
      const stepIds = flow.steps.map((s) => s.stepId);
      expect(stepIds).toEqual(STANDARD_STEP_IDS);
    }
  });

  it('opens every flow with reflection rather than diagnosis', () => {
    for (const flow of EXECUTIVE_WORKSHOP_FLOWS) {
      expect(flow.steps[0]?.stepId).toBe('opening-reflection');
    }
  });

  it('never adopts forbidden marketing vocabulary in any flow', () => {
    for (const flow of EXECUTIVE_WORKSHOP_FLOWS) {
      // Strip doctrine document references that legitimately contain
      // the token 'surveillance' before scanning.
      const blob = flatten(flow).replace(/anti-surveillance/g, '');
      for (const term of FORBIDDEN_TERMS) {
        expect(
          blob.includes(term),
          `Flow ${flow.sessionType} contains forbidden term "${term}"`,
        ).toBe(false);
      }
    }
  });
});

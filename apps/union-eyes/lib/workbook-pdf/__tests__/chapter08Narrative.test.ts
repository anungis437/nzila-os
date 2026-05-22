import { describe, expect, it } from 'vitest';
import {
  buildStewardshipRedistributionNarrative,
  buildGovernanceRecoveryNarrative,
} from '@/lib/workbook-pdf/workbookNarrativeEngine';
import { runStewardshipRedistribution } from '@/lib/workbook/engines/stewardshipRedistributionEngine';
import { runGovernanceRecovery } from '@/lib/workbook/engines/governanceRecoveryEngine';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

describe('Chapter 08 narrative builders', () => {
  it('produces a deterministic stewardship redistribution narrative', () => {
    const result = runStewardshipRedistribution({
      status: 'facilitated',
      redistribution: {
        carriers: [
          { id: 'c1', label: 'Bargaining lead', exposure: 0.95 },
        ],
        processes: [
          { id: 'p1', label: 'Member intake', singleCarrier: true, undocumented: true },
        ],
        lineageGaps: [],
      },
      reciprocityTermsRatified: false,
    });

    const a = buildStewardshipRedistributionNarrative(result);
    const b = buildStewardshipRedistributionNarrative(result);
    expect(a).toEqual(b);
    expect(a.signalsHeading).toBe('Redistribution signals');
    expect(a.opening).toBeTruthy();
    expect(a.body).toMatch(/redistribution target/);
  });

  it('produces a deterministic governance recovery narrative', () => {
    const result = runGovernanceRecovery({
      status: 'facilitated',
      lineage: {
        workbookId: 'wb',
        precedents: [
          {
            id: 'p1',
            subject: 'Mandate scope precedent',
            era: 'founding',
            reaffirmationCount: 0,
            referencedInPractice: false,
            successorBriefed: false,
          },
        ],
        governanceDomains: [],
      },
      governanceRatificationCommitted: false,
    });

    const a = buildGovernanceRecoveryNarrative(result);
    const b = buildGovernanceRecoveryNarrative(result);
    expect(a).toEqual(b);
    expect(a.signalsHeading).toBe('Recovery signals');
    expect(a.body).toMatch(/precedent/);
  });

  it('uses tone free of forbidden vocabulary and blame framing across both builders', () => {
    const stewardship = buildStewardshipRedistributionNarrative(
      runStewardshipRedistribution({
        status: 'facilitated',
        redistribution: {
          carriers: [{ id: 'c1', label: 'Bargaining lead', exposure: 0.95 }],
          processes: [
            { id: 'p1', label: 'Member intake', singleCarrier: true, undocumented: true },
          ],
          lineageGaps: [],
        },
        reciprocityTermsRatified: true,
      }),
    );

    const governance = buildGovernanceRecoveryNarrative(
      runGovernanceRecovery({
        status: 'facilitated',
        lineage: {
          workbookId: 'wb',
          precedents: [
            {
              id: 'p1',
              subject: 'Mandate scope precedent',
              era: 'founding',
              reaffirmationCount: 0,
              referencedInPractice: false,
              successorBriefed: false,
            },
          ],
          governanceDomains: [],
        },
        governanceRatificationCommitted: true,
      }),
    );

    const text = [
      stewardship.opening,
      stewardship.body,
      stewardship.signalsHeading,
      governance.opening,
      governance.body,
      governance.signalsHeading,
    ]
      .join(' ')
      .replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});

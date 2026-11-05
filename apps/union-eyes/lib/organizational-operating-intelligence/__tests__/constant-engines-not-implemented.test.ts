import { describe, expect, it } from 'vitest';
import {
  crossDomainCorrelationEngine,
  institutionalPrecedentEngine,
  proceduralContinuityEngine,
} from '../kernel-bridge';

// DEF-0B7-COGA-CROSS-DOMAIN-CORRELATIONS-ARE-FIXED-LITERALS and
// DEF-0B7-COGB-PRECEDENT-AND-PROCEDURAL-ENGINES-RETURN-CONSTANT-CONTENT-AS-ORGANIZATION-ANALYSIS:
// these engines returned the same literal profile for every organization inside an explainability envelope.

describe.each([
  ['cross-domain correlation', crossDomainCorrelationEngine],
  ['institutional precedent', institutionalPrecedentEngine],
  ['procedural continuity', proceduralContinuityEngine],
])('%s engine', (_label, engine) => {
  it('refuses with NOT_IMPLEMENTED and returns no profile, for any organization', async () => {
    for (const organization of ['org-a', 'org-b', 'an-empty-organization']) {
      await expect(engine(organization)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    }
  });

  it('never states a constant as an analysis of the organization', async () => {
    const outcome = await engine('org-a').then((value) => JSON.stringify(value), (error: Error) => error.message);
    for (const literal of ['0.75', '0.65', 'Governance protocols', 'Continuity procedures', 'moderate']) {
      expect(outcome).not.toContain(literal);
    }
    expect(outcome).toContain('not implemented');
  });
});

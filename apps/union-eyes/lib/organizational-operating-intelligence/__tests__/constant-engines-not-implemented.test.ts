import { describe, expect, it } from 'vitest';
import {
  crossDomainCorrelationEngine,
  institutionalPrecedentEngine,
  proceduralContinuityEngine,
  systemsDynamicsEngine,
  governanceCoherenceEngine,
  operationalCoordinationEngine,
  operatingRhythmsEngine,
  multiDomainCognitionEngine,
  operationalTrustEngine,
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

// DEF-0B7-COGB-DYNAMICS-ENGINES-EMBED-LITERAL-NUMBERS-AND-CLAIMS-AS-MEASUREMENTS: the systems-dynamics,
// governance-coherence, operational-coordination, operating-rhythms, multi-domain-cognition and operational-trust
// engines wrote literal values into their profiles that depended on no stored record (consistency 50 and 60,
// stabilization signal confidence 75 and 70, coordination frequency 70 and 50, response times of 5, 7 and 3 days,
// adherence 75, variance 30, stabilization 14 days, integration scores 50 to 70, reasoning-chain confidence 70 and
// 65, fixed trust indicators such as "Reliable mitigation execution") so a reader could not tell a measured field
// from a constant. They now refuse the same way as the correlation/precedent/procedural engines above.
describe.each([
  ['systems dynamics', systemsDynamicsEngine],
  ['governance coherence', governanceCoherenceEngine],
  ['operational coordination', operationalCoordinationEngine],
  ['operating rhythms', operatingRhythmsEngine],
  ['multi-domain cognition', multiDomainCognitionEngine],
  ['operational trust', operationalTrustEngine],
])('%s engine', (_label, engine) => {
  it('refuses with NOT_IMPLEMENTED and returns no profile, for any organization', async () => {
    for (const organization of ['org-a', 'org-b', 'an-empty-organization']) {
      await expect(engine(organization)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    }
  });

  it('never states a fixed frequency, response time, integration score or trust indicator as an analysis', async () => {
    const outcome = await engine('org-a').then((value) => JSON.stringify(value), (error: Error) => error.message);
    for (const literal of ['Reliable mitigation execution', 'stabilization signal', '14 days']) {
      expect(outcome).not.toContain(literal);
    }
    expect(outcome).toContain('not implemented');
  });
});

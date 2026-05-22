/**
 * ARTIFACT TYPE: Vitest Persistence Suite
 * MODULE: OCI Operational Truth Hardening — Part 2
 * DOCTRINE_VERSION: 1.0.0
 */

import { describe, expect, it } from 'vitest';

import { makeRuntimeEvent } from './__fixtures__/ociFixtures';
import { validateContinuityEventEnvelope } from '../runtime/contracts/runtimeEnvelopeValidators';

describe('Event envelope serialization integrity', () => {
  it('a composed envelope is structurally valid', () => {
    const event = makeRuntimeEvent('serial-1', 'GovernanceInterpretationChanged');
    const result = validateContinuityEventEnvelope(event);
    expect(result.valid).toBe(true);
  });

  it('a JSON round-tripped envelope remains valid', () => {
    const event = makeRuntimeEvent('serial-2', 'OnboardingSurvivabilityImproved');
    const replayed = JSON.parse(JSON.stringify(event));
    const result = validateContinuityEventEnvelope(replayed);
    expect(result.valid).toBe(true);
  });

  it('an envelope with missing institutionScope is rejected', () => {
    const event = makeRuntimeEvent('serial-3', 'GovernanceInterpretationChanged');
    const corrupted = { ...event, institutionScope: '' };
    const result = validateContinuityEventEnvelope(corrupted);
    expect(result.valid).toBe(false);
  });

  it('an envelope with a non-ISO observedAt is rejected', () => {
    const event = makeRuntimeEvent('serial-4', 'GovernanceInterpretationChanged');
    const corrupted = { ...event, observedAt: 'yesterday' };
    const result = validateContinuityEventEnvelope(corrupted);
    expect(result.valid).toBe(false);
  });
});

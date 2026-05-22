import { describe, expect, it } from 'vitest';
import { FORBIDDEN_CONTEXT_KEYS, type NarrativeContext } from '../narrativePromptContracts';
import { findProhibitedPatterns } from '../prohibitedAiPatterns';

describe('Anti-surveillance invariants', () => {
  it('NarrativeContext type carries no telemetry/behavioural fields', () => {
    // Type-level guarantee: enumerate the runtime-visible keys allowed on a
    // NarrativeContext via a sample instance and assert no forbidden key
    // appears.
    const sample: NarrativeContext = {
      artifactKind: 'ExecutiveSummary',
      locale: 'en-CA',
      synthesisEngineVersion: '1.0.0',
      promptRegistryVersion: '1.0.0',
      maturityBands: [],
      adaptiveContext: {
        institutionalScale: 'mid',
        continuityComplexity: 'moderate',
        governanceComplexity: 'moderate',
        continuityExposure: 'stable',
        respondentLens: 'executive',
      },
      archetypes: [],
      breakpoints: [],
      confidence: { confidenceBand: 'high', stabilityBand: 'stable' },
      structuralSignals: [],
      onboardingFindings: [],
      governanceObservations: [],
    };
    for (const k of Object.keys(sample)) {
      expect(FORBIDDEN_CONTEXT_KEYS).not.toContain(k);
    }
  });

  it('FORBIDDEN_CONTEXT_KEYS includes core telemetry/behavioural keys', () => {
    const required = [
      'rawAnswers',
      'freeText',
      'transcript',
      'telemetry',
      'typingCadence',
      'sessionTiming',
      'behaviouralMetadata',
      'emotionalInference',
      'ipAddress',
    ];
    for (const k of required) {
      expect(FORBIDDEN_CONTEXT_KEYS).toContain(k);
    }
  });

  it('anti_surveillance prohibited patterns reject telemetry-style phrasing', () => {
    const samples = [
      'typing cadence flagged a respondent.',
      'session timing exceeded threshold.',
      'behavioural metadata indicated stress.',
      'behavioral signal escalated.',
    ];
    for (const s of samples) {
      const matches = findProhibitedPatterns(s);
      expect(matches.some((m) => m.category === 'anti_surveillance')).toBe(true);
    }
  });
});

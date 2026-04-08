/**
 * NIL Briefing Contracts — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  DECISION_PROMPT_CONTRACTS,
  getDecisionPromptContract,
  listDecisionPromptUseCases,
} from '../briefings/index.js';

describe('briefings / NIL prompt contracts', () => {
  it('defines 6 decision prompt contracts', () => {
    expect(DECISION_PROMPT_CONTRACTS.length).toBe(6);
  });

  it('all contracts have required fields', () => {
    for (const contract of DECISION_PROMPT_CONTRACTS) {
      expect(contract.useCase).toBeTruthy();
      expect(contract.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(contract.app).toBe('union-eyes');
      expect(contract.systemPrompt).toBeTruthy();
      expect(contract.systemPrompt.length).toBeGreaterThan(50);
      expect(contract.requiredOutputFields.length).toBeGreaterThan(0);
      expect(contract.anonymizationRules.length).toBeGreaterThan(0);
      expect(typeof contract.buildInput).toBe('function');
    }
  });

  it('all contracts include standard anonymization rules', () => {
    for (const contract of DECISION_PROMPT_CONTRACTS) {
      expect(contract.anonymizationRules).toContain('Never name individual affiliates by name');
      expect(contract.anonymizationRules).toContain('Use sector-level aggregates only');
    }
  });

  describe('getDecisionPromptContract', () => {
    it('returns contract by use case', () => {
      const contract = getDecisionPromptContract('summarize_movement_risk_posture');
      expect(contract).toBeDefined();
      expect(contract!.useCase).toBe('summarize_movement_risk_posture');
    });

    it('returns undefined for unknown use case', () => {
      expect(getDecisionPromptContract('nonexistent')).toBeUndefined();
    });

    it('finds all 6 expected use cases', () => {
      const expectedUseCases = [
        'summarize_movement_risk_posture',
        'detect_cross_affiliate_issue_cluster',
        'recommend_clc_action_from_signals',
        'generate_bargaining_watch_brief',
        'explain_sector_divergence',
        'generate_executive_briefing_note',
      ];
      for (const uc of expectedUseCases) {
        expect(getDecisionPromptContract(uc)).toBeDefined();
      }
    });
  });

  describe('listDecisionPromptUseCases', () => {
    it('returns 6 use cases', () => {
      const useCases = listDecisionPromptUseCases();
      expect(useCases.length).toBe(6);
    });

    it('matches contract definitions', () => {
      const useCases = listDecisionPromptUseCases();
      for (const uc of useCases) {
        expect(DECISION_PROMPT_CONTRACTS.some((c) => c.useCase === uc)).toBe(true);
      }
    });
  });

  describe('buildInput functions', () => {
    it('risk posture contract builds sanitized input', () => {
      const contract = getDecisionPromptContract('summarize_movement_risk_posture')!;
      const input = contract.buildInput({
        riskPosture: {
          posture: 'vigilant',
          watchAreas: ['Wages cluster'],
          risingSectors: ['Mining'],
          issueClusters: ['Wages across sectors'],
          summary: 'Movement vigilant',
          confidence: 0.7,
        },
      }) as { riskPosture: { posture: string } };
      expect(input.riskPosture).toBeDefined();
      expect(input.riskPosture.posture).toBe('vigilant');
    });

    it('issue cluster contract filters by pattern type', () => {
      const contract = getDecisionPromptContract('detect_cross_affiliate_issue_cluster')!;
      const input = contract.buildInput({
        patterns: [
          { id: 'P1', patternType: 'cross_affiliate_issue_cluster', title: 'T', summary: 'S', affectedSectors: [], affectedAffiliateTypes: [], confidence: 0.7, watchLevel: 'elevated', evidenceRefs: [] },
          { id: 'P2', patternType: 'bargaining_pressure_signal', title: 'T2', summary: 'S2', affectedSectors: [], affectedAffiliateTypes: [], confidence: 0.6, watchLevel: 'monitor', evidenceRefs: [] },
        ],
      }) as { patterns: { id: string }[] };
      expect(input.patterns.length).toBe(1);
      expect(input.patterns[0]!.id).toBe('P1');
    });

    it('executive briefing contract limits to 10 cards', () => {
      const contract = getDecisionPromptContract('generate_executive_briefing_note')!;
      const cards = Array.from({ length: 15 }, (_, i) => ({
        id: `BRIEF-${i}`,
        category: 'risk' as const,
        headline: `Card ${i}`,
        significance: `Sig ${i}`,
        confidence: 0.7,
        confidenceBand: 'high' as const,
        recommendedAction: 'monitor' as const,
        timeframe: 'this_quarter' as const,
        watchLevel: 'elevated' as const,
        evidenceRefs: [],
      }));
      const input = contract.buildInput({ cards }) as { briefingCards: unknown[] };
      expect(input.briefingCards.length).toBe(10);
    });
  });
});

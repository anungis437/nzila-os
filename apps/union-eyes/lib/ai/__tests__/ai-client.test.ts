import { describe, it, expect, vi } from 'vitest';

const { mockCreateAiClient } = vi.hoisted(() => ({
  mockCreateAiClient: vi.fn(() => ({
    generate: vi.fn(),
    embed: vi.fn(),
  })),
}));

vi.mock('@nzila/ai-sdk', () => ({
  createAiClient: mockCreateAiClient,
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => ({ getToken: vi.fn(async () => 'test-token') })),
}));

import { UE_APP_KEY, UE_SYSTEM_ORG_ID, UE_PROFILES } from '../ai-client';

describe('AI Client', () => {
  describe('UE_APP_KEY', () => {
    it('is "union-eyes"', () => {
      expect(UE_APP_KEY).toBe('union-eyes');
    });
  });

  describe('UE_SYSTEM_ORG_ID', () => {
    it('is a zero UUID', () => {
      expect(UE_SYSTEM_ORG_ID).toBe('00000000-0000-0000-0000-000000000000');
    });
  });

  describe('UE_PROFILES', () => {
    it('has CHATBOT profile', () => {
      expect(UE_PROFILES.CHATBOT).toBe('ue-chatbot');
    });

    it('has EMBEDDINGS profile', () => {
      expect(UE_PROFILES.EMBEDDINGS).toBe('ue-embeddings');
    });

    it('has GRIEVANCE_TRIAGE profile', () => {
      expect(UE_PROFILES.GRIEVANCE_TRIAGE).toBe('ue-grievance-triage');
    });

    it('has CLAUSE_REASONING profile', () => {
      expect(UE_PROFILES.CLAUSE_REASONING).toBe('ue-clause-reasoning');
    });

    it('has EMPLOYER_RISK profile', () => {
      expect(UE_PROFILES.EMPLOYER_RISK).toBe('ue-employer-risk');
    });

    it('has STEWARD_COPILOT profile', () => {
      expect(UE_PROFILES.STEWARD_COPILOT).toBe('ue-steward-copilot');
    });

    it('has EXECUTIVE_INSIGHTS profile', () => {
      expect(UE_PROFILES.EXECUTIVE_INSIGHTS).toBe('ue-executive-insights');
    });

    it('has all required profile keys', () => {
      const keys = Object.keys(UE_PROFILES);
      expect(keys.length).toBeGreaterThanOrEqual(12);
    });
  });
});

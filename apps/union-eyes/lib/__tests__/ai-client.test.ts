import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: vi.fn(),
  UE_APP_KEY: 'union-eyes',
  UE_SYSTEM_ORG_ID: 'system-org',
}));

import * as aiClient from '../ai-client';

describe('lib/ai-client', () => {
  it('re-exports the canonical AI client surface', () => {
    expect(typeof aiClient.getAiClient).toBe('function');
    expect(aiClient.UE_APP_KEY).toBe('union-eyes');
    expect(aiClient.UE_SYSTEM_ORG_ID).toBe('system-org');
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'chatbot-service.ts'), 'utf8');

describe('Gate 0 chatbot moderation must fail closed', () => {
  // Replaced in F06 batch 5 (A5): the two pins on the direct provider call (an absent OPENAI_API_KEY, a non-ok fetch response) described a
  // moderation path that bypassed the AI control plane. Moderation now goes through the control plane; the fail-closed guarantee is the same
  // and is pinned against that path.
  it('does not call a provider directly or read a provider key: moderation goes through the AI control plane', () => {
    expect(source).not.toContain('api.openai.com');
    expect(source).not.toContain('OPENAI_API_KEY');
    expect(source).not.toMatch(/fetch\(/);
    expect(source).toContain('profileKey: UE_PROFILES.CHATBOT_MODERATION');
  });

  it('refuses a refused call or a malformed answer before treating text as safe', () => {
    expect(source).toContain("throw new Error('Invalid moderation provider response')");
    expect(source).toContain("return { flagged: true, reason: 'Safety system unavailable' }");
    expect(source).toMatch(/typeof \(parsed as \{ flagged\?: unknown \}\)\.flagged !== 'boolean'/);
  });

  it('does not continue to retrieval or model generation after moderation refuses', () => {
    const begin = source.indexOf('if (safetyCheck.flagged)');
    const history = source.indexOf('// Conversation history:', begin);
    expect(begin).toBeGreaterThan(0);
    expect(history).toBeGreaterThan(begin);
    const guard = source.slice(begin, history);
    expect(guard).toContain("throw new Error('Content safety system unavailable')");
    expect(guard).toContain("throw new Error('Message flagged by content safety filter')");
    expect(guard).not.toContain('proceeding with message');
  });
});

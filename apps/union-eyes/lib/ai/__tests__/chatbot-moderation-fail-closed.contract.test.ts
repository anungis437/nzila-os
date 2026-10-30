import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'chatbot-service.ts'), 'utf8');

describe('Gate 0 chatbot moderation must fail closed', () => {
  it('refuses absent provider credentials rather than silently skipping moderation', () => {
    expect(source).toMatch(/if \(!apiKey\) \{\s*return \{ flagged: true, reason: 'Safety system unavailable' \}/);
    expect(source).not.toContain('return { flagged: false }; // Skip if not configured');
  });

  it('refuses unavailable or malformed provider responses before treating text as safe', () => {
    expect(source).toContain("if (!response.ok) throw new Error('Moderation provider unavailable')");
    expect(source).toContain("throw new Error('Invalid moderation provider response')");
    expect(source).toContain("return { flagged: true, reason: 'Safety system unavailable' }");
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

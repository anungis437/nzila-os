import { describe, expect, it } from 'vitest';
import { decideMlQueryDisclosure } from '../ml-query-disclosure';

describe('ML query disclosure decision', () => {
  it('fails closed without approved policy/provider and rejects direct identifiers', () => {
    expect(decideMlQueryDisclosure({ question: 'counts', serviceUrl: 'https://ai.example' }).allowed).toBe(false);
    expect(decideMlQueryDisclosure({ question: 'alice@example.com', serviceUrl: 'https://ai.example', policyRef: 'board-2026-1' }).allowed).toBe(false);
    expect(decideMlQueryDisclosure({ question: 'counts', serviceUrl: 'http://ai.example', policyRef: 'board-2026-1' }).allowed).toBe(false);
  });
  it('allows only minimized approved context keys', () => {
    expect(decideMlQueryDisclosure({ question: 'claim counts', context: { status: 'open' }, serviceUrl: 'https://ai.example', policyRef: 'board-2026-1' }).allowed).toBe(true);
    expect(decideMlQueryDisclosure({ question: 'claim counts', context: { memberName: 'Alice' }, serviceUrl: 'https://ai.example', policyRef: 'board-2026-1' }).allowed).toBe(false);
  });
});

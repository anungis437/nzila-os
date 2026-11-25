import { describe, expect, it } from 'vitest';
import { readChallengeAnswer, readSignInAnswer } from '../sign-in-answer';

describe('sign-in answers', () => {
  it('recognizes a session, a second-factor challenge, and nothing else', () => {
    expect(readSignInAnswer({ user: { id: 'u1' } })).toEqual({ kind: 'signed-in' });
    expect(readSignInAnswer({ user: { id: 'u1' }, requiresMfa: true, challengeToken: 'c' })).toEqual({ kind: 'second-factor', challengeToken: 'c' });
    for (const answer of [null, undefined, 'ok', [], {}, { user: {} }, { user: { id: '' } }, { user: { id: 1 } }, { requiresMfa: true }, { requiresMfa: true, challengeToken: '' }, { user: { id: 'u1' }, requiresMfa: true, challengeToken: 5 }]) {
      expect(readSignInAnswer(answer)).toEqual({ kind: 'unconfirmed' });
    }
  });
  it('treats only an explicit ok as a completed challenge', () => {
    expect(readChallengeAnswer({ ok: true })).toBe(true);
    for (const answer of [null, {}, { ok: 'true' }, { ok: false }, 'ok']) expect(readChallengeAnswer(answer)).toBe(false);
  });
});

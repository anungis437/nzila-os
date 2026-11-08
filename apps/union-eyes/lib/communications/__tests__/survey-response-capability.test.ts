import { describe, expect, it } from 'vitest';
import {
  hashResponseCapability,
  issueResponseCapability,
  verifyResponseCapability,
  RESPONSE_CAPABILITY_HEADER,
} from '../survey-response-capability';

describe('survey response capability tokens', () => {
  it('issues a high-entropy token distinct from its own stored hash', () => {
    const { token, tokenHash } = issueResponseCapability();
    expect(token.length).toBeGreaterThan(20);
    expect(tokenHash).not.toEqual(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex digest
  });

  it('issues a different token every call', () => {
    const a = issueResponseCapability();
    const b = issueResponseCapability();
    expect(a.token).not.toEqual(b.token);
    expect(a.tokenHash).not.toEqual(b.tokenHash);
  });

  it('verifies a token against its own issued hash', () => {
    const { token, tokenHash } = issueResponseCapability();
    expect(verifyResponseCapability(token, tokenHash)).toBe(true);
  });

  it('refuses a wrong token against a real hash', () => {
    const { tokenHash } = issueResponseCapability();
    expect(verifyResponseCapability('not-the-right-token', tokenHash)).toBe(false);
  });

  it('refuses when no token is presented', () => {
    const { tokenHash } = issueResponseCapability();
    expect(verifyResponseCapability(null, tokenHash)).toBe(false);
    expect(verifyResponseCapability(undefined, tokenHash)).toBe(false);
    expect(verifyResponseCapability('', tokenHash)).toBe(false);
  });

  it('refuses when there is no stored hash at all (identified response, or a legacy response with none issued)', () => {
    expect(verifyResponseCapability('any-token', null)).toBe(false);
    expect(verifyResponseCapability('any-token', undefined)).toBe(false);
    expect(verifyResponseCapability('any-token', '')).toBe(false);
  });

  it('refuses a malformed (non-hex) stored hash rather than throwing', () => {
    expect(verifyResponseCapability('any-token', 'not-valid-hex!!')).toBe(false);
  });

  it('hashResponseCapability is deterministic for the same token', () => {
    const { token } = issueResponseCapability();
    expect(hashResponseCapability(token)).toEqual(hashResponseCapability(token));
  });

  it('exposes a stable header name for callers to present the token through', () => {
    expect(RESPONSE_CAPABILITY_HEADER).toBe('x-survey-response-token');
  });
});

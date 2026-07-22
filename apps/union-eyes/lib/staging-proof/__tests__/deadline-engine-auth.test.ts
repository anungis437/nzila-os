import { describe, expect, it } from 'vitest';
import {
  createProofSignature,
  verifyProofAuthorization,
} from '../deadline-engine-auth';

const NOW = new Date('2026-07-21T12:00:00.000Z');
const TIMESTAMP = NOW.toISOString();
const NONCE = 'proof_nonce_abcdefghijklmnopqrstuvwxyz';
const ENV = {
  TARGET_ENVIRONMENT: 'staging',
  STAGING_PROOFS_ENABLED: 'true',
  UNION_EYES_RUNTIME_ID: 'union-eyes-staging',
  STAGING_PROOF_SECRET: 'test-proof-secret',
};

function request(overrides: Partial<{ timestamp: string; nonce: string; signature: string; scenario: string; env: typeof ENV }> = {}) {
  const scenario = overrides.scenario ?? 'schedule-basic';
  const timestamp = overrides.timestamp ?? TIMESTAMP;
  const nonce = overrides.nonce ?? NONCE;
  return verifyProofAuthorization({
    env: overrides.env ?? ENV,
    scenario,
    headers: {
      timestamp,
      nonce,
      signature: overrides.signature ?? createProofSignature(ENV.STAGING_PROOF_SECRET, timestamp, nonce, 'schedule-basic'),
    },
    now: NOW,
  });
}

describe('deadline-engine staging proof authorization', () => {
  it.each(['production', 'pilot', 'demo', '', 'unknown'])('rejects %s environment identity', (environment) => {
    expect(request({ env: { ...ENV, TARGET_ENVIRONMENT: environment } }).authorized).toBe(false);
  });

  it('rejects a disabled proof route and a wrong application identity', () => {
    expect(request({ env: { ...ENV, STAGING_PROOFS_ENABLED: 'false' } }).authorized).toBe(false);
    expect(request({ env: { ...ENV, UNION_EYES_RUNTIME_ID: 'union-eyes-pilot' } }).authorized).toBe(false);
  });

  it('rejects invalid, expired, and malformed signed requests', () => {
    expect(request({ signature: '0'.repeat(64) }).authorized).toBe(false);
    expect(request({ timestamp: '2026-07-21T11:54:59.999Z' }).authorized).toBe(false);
    expect(request({ nonce: 'short' }).authorized).toBe(false);
  });

  it('rejects an unsupported scenario', () => {
    expect(request({ scenario: 'arbitrary-sql' }).authorized).toBe(false);
  });

  it('accepts a current request signed with the dedicated proof secret', () => {
    expect(request()).toEqual({ authorized: true, timestamp: NOW, nonce: NONCE });
  });
});
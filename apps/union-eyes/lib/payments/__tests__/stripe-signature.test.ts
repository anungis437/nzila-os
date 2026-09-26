import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyStripeSignature,
  STRIPE_WEBHOOK_TOLERANCE_SECONDS,
} from '../stripe-signature';

const SECRET = 'whsec_test';
const NOW_MS = 1_700_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);
const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });

function sign(tSeconds: number | string, body = payload, secret = SECRET): string {
  const hash = createHmac('sha256', secret).update(`${tSeconds}.${body}`).digest('hex');
  return `t=${tSeconds},v1=${hash}`;
}

describe('verifyStripeSignature — MAC + freshness', () => {
  it('accepts a fresh timestamp with a correct signature', () => {
    expect(verifyStripeSignature(payload, sign(NOW_S), SECRET, { now: NOW_MS })).toBe(true);
  });

  it('rejects a stale timestamp even with a correct signature', () => {
    const stale = NOW_S - STRIPE_WEBHOOK_TOLERANCE_SECONDS - 1;
    expect(verifyStripeSignature(payload, sign(stale), SECRET, { now: NOW_MS })).toBe(false);
  });

  it('rejects a materially future-dated timestamp', () => {
    const future = NOW_S + STRIPE_WEBHOOK_TOLERANCE_SECONDS + 1;
    expect(verifyStripeSignature(payload, sign(future), SECRET, { now: NOW_MS })).toBe(false);
  });

  it('accepts a timestamp exactly at the tolerance boundary (past and future)', () => {
    const past = NOW_S - STRIPE_WEBHOOK_TOLERANCE_SECONDS;
    const future = NOW_S + STRIPE_WEBHOOK_TOLERANCE_SECONDS;
    expect(verifyStripeSignature(payload, sign(past), SECRET, { now: NOW_MS })).toBe(true);
    expect(verifyStripeSignature(payload, sign(future), SECRET, { now: NOW_MS })).toBe(true);
  });

  it('rejects a malformed (non-integer) timestamp', () => {
    expect(verifyStripeSignature(payload, sign('abc'), SECRET, { now: NOW_MS })).toBe(false);
  });

  it('rejects a missing timestamp', () => {
    const hash = createHmac('sha256', SECRET).update(`.${payload}`).digest('hex');
    expect(verifyStripeSignature(payload, `v1=${hash}`, SECRET, { now: NOW_MS })).toBe(false);
  });

  it('rejects a fresh timestamp with a bad MAC', () => {
    expect(
      verifyStripeSignature(payload, `t=${NOW_S},v1=${'0'.repeat(64)}`, SECRET, { now: NOW_MS }),
    ).toBe(false);
  });

  it('accepts when one of multiple v1 signatures is valid and fresh', () => {
    const good = createHmac('sha256', SECRET).update(`${NOW_S}.${payload}`).digest('hex');
    const header = `t=${NOW_S},v1=${'0'.repeat(64)},v1=${good}`;
    expect(verifyStripeSignature(payload, header, SECRET, { now: NOW_MS })).toBe(true);
  });

  it('rejects when the secret is empty', () => {
    expect(verifyStripeSignature(payload, sign(NOW_S), '', { now: NOW_MS })).toBe(false);
  });

  it('defaults the tolerance to 300 seconds', () => {
    expect(STRIPE_WEBHOOK_TOLERANCE_SECONDS).toBe(300);
  });
});

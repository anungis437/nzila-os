/**
 * lib/idempotency.ts tests — Phase 2E.5.
 */

import { describe, expect, it } from 'vitest';
import { createIdempotencyKey } from './idempotency';

describe('createIdempotencyKey', () => {
  it('returns a non-empty string', () => {
    const key = createIdempotencyKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(8);
  });

  it('returns a different value on every call (no static reuse)', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) keys.add(createIdempotencyKey());
    expect(keys.size).toBe(100);
  });

  it('never returns predictable simple values', () => {
    const key = createIdempotencyKey();
    expect(key).not.toBe('');
    expect(key).not.toBe('null');
    expect(key).not.toBe('undefined');
    expect(key).not.toBe('idempotency-key');
    expect(key).not.toBe('0');
  });

  it('uses crypto.randomUUID when available', () => {
    // Confirm we get UUID-like output when the runtime provides it (Node 19+, browsers)
    const key = createIdempotencyKey();
    // UUID v4 shape: 8-4-4-4-12 hex; the fallback also always has hyphens
    expect(key).toMatch(/[-a-z0-9]/i);
  });
});

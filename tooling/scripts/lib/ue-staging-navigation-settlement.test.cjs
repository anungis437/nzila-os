'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizedPath,
  settleRoleLanding,
  settleRestrictedDestination,
} = require('./ue-staging-navigation-settlement.cjs');

function page(initial, redirects = []) {
  let location = initial;
  let waits = 0;
  return {
    url() { return location; },
    waitCount() { return waits; },
    async waitForURL(predicate, options) {
      waits += 1;
      assert.equal(options.timeout, 20_000);
      for (const next of redirects) {
        location = next;
        if (predicate(new URL(location))) return;
      }
      throw new Error('Timeout waiting for navigation');
    },
  };
}

test('normalizes real browser paths without query strings and trailing slashes', () => {
  assert.equal(normalizedPath('https://staging.example/en-CA/dashboard/executive/?x=1'), '/en-CA/dashboard/executive');
  assert.equal(normalizedPath('/en-CA/dashboard/'), '/en-CA/dashboard');
});

test('accepts a completed officer landing immediately', async () => {
  const p = page('https://staging.example/en-CA/dashboard/executive');
  const receipt = await settleRoleLanding(p, '/en-CA/dashboard/executive');
  assert.equal(receipt.finalPath, '/en-CA/dashboard/executive');
  assert.equal(receipt.redirectedAfterDOMContentLoaded, false);
  assert.equal(p.waitCount(), 0);
});

test('waits through Next.js streamed redirect from dashboard root before determining role', async () => {
  const p = page('https://staging.example/en-CA/dashboard', [
    'https://staging.example/en-CA/dashboard/executive',
  ]);
  const receipt = await settleRoleLanding(p, '/en-CA/dashboard/executive');
  assert.equal(receipt.initialPath, '/en-CA/dashboard');
  assert.equal(receipt.finalPath, '/en-CA/dashboard/executive');
  assert.equal(receipt.redirectedAfterDOMContentLoaded, true);
  assert.equal(p.waitCount(), 1);
});

test('refuses a genuinely missing role redirect (never substitutes member landing)', async () => {
  const p = page('https://staging.example/en-CA/dashboard');
  await assert.rejects(
    settleRoleLanding(p, '/en-CA/dashboard/executive'),
    /Required role-landing redirect did not settle/,
  );
});

test('accepts an explicit server-side restricted-route refusal', async () => {
  const p = page('https://staging.example/en-CA/dashboard/finance');
  const result = await settleRestrictedDestination(p, '/en-CA/dashboard/finance', 403);
  assert.equal(result.denialMode, 'HTTP_403');
  assert.equal(p.waitCount(), 0);
});

test('accepts a streamed restricted-route redirect after DOMContentLoaded', async () => {
  const p = page('https://staging.example/en-CA/dashboard/finance', [
    'https://staging.example/en-CA/dashboard',
  ]);
  const result = await settleRestrictedDestination(p, '/en-CA/dashboard/finance', 200);
  assert.equal(result.denialMode, 'BROWSER_REDIRECT');
  assert.equal(result.finalPath, '/en-CA/dashboard');
  assert.equal(p.waitCount(), 1);
});

test('refuses a finance page that stays accessible as HTTP 200', async () => {
  const p = page('https://staging.example/en-CA/dashboard/finance');
  await assert.rejects(
    settleRestrictedDestination(p, '/en-CA/dashboard/finance', 200),
    /Restricted destination still accessible/,
  );
});

test('refuses an HTTP 500 before treating browser navigation as authorization', async () => {
  const p = page('https://staging.example/en-CA/dashboard/executive');
  await assert.rejects(
    settleRestrictedDestination(p, '/en-CA/dashboard/finance', 500),
    /unexpected HTTP status/,
  );
});

test('refuses invalid wait limits', async () => {
  const p = page('https://staging.example/en-CA/dashboard');
  await assert.rejects(
    settleRoleLanding(p, '/en-CA/dashboard/executive', { timeoutMs: 0 }),
    /Invalid bounded/,
  );
});

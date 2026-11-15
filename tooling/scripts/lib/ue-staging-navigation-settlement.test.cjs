'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizedPath,
  settleRoleLanding,
  settleRestrictedDestination,
  openVisibleDestination,
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

function visibleContext(plans) {
  const pages = [];
  return {
    pages,
    async newPage() {
      const plan = plans[pages.length];
      const events = [];
      let location = 'about:blank';
      const p = {
        events,
        url() { return location; },
        async setViewportSize(viewport) { events.push(['viewport', viewport]); },
        async goto(url, options) {
          events.push(['goto', url, options]);
          location = url;
          return { status: () => plan.status ?? 200 };
        },
        async waitForURL(predicate) {
          events.push(['redirect']);
          if (plan.redirect) location = plan.redirect;
          if (!predicate(new URL(location))) throw Error('Expected redirect never occurred');
        },
        async waitForLoadState(state) {
          events.push(['loaded', state]);
          if (plan.afterLoad) location = plan.afterLoad;
        },
        async reload() { throw Error('Reload must not interrupt the prior navigation'); },
        async close() { events.push(['closed']); },
      };
      pages.push(p);
      return p;
    },
  };
}

test('opens mobile at its viewport and waits for the exact streamed personal-settings destination', async () => {
  const context = visibleContext([{ redirect: 'https://staging.example/en-CA/dashboard/profile' }]);
  const result = await openVisibleDestination(context, 'https://staging.example',
    '/en-CA/dashboard/settings', '/en-CA/dashboard/profile', { viewport: { width: 390, height: 844 } });
  assert.equal(result.responseStatus, 200);
  assert.equal(result.initialPath, '/en-CA/dashboard/settings');
  assert.equal(result.finalPath, '/en-CA/dashboard/profile');
  assert.equal(result.redirectedAfterDOMContentLoaded, true);
  assert.deepEqual(result.page.events.map(([name]) => name), ['viewport', 'goto', 'redirect', 'loaded']);
});

test('uses separate desktop and mobile visits instead of reloading a frame with a pending redirect', async () => {
  const context = visibleContext([
    { redirect: 'https://staging.example/fr-CA/dashboard/profile' },
    { redirect: 'https://staging.example/fr-CA/dashboard/profile' },
  ]);
  const desktop = await openVisibleDestination(context, 'https://staging.example',
    '/fr-CA/dashboard/settings', '/fr-CA/dashboard/profile');
  await desktop.page.close();
  const mobile = await openVisibleDestination(context, 'https://staging.example',
    '/fr-CA/dashboard/settings', '/fr-CA/dashboard/profile', { viewport: { width: 390, height: 844 } });
  assert.notEqual(mobile.page, desktop.page);
  assert.equal(context.pages.length, 2);
  assert.equal(desktop.page.events[0][0], 'goto');
  assert.equal(mobile.page.events[0][0], 'viewport');
  assert.equal(mobile.finalPath, desktop.finalPath);
  await mobile.page.close();
});

test('does not pass a personal settings visit from its initial HTTP 200 without the required redirect', async () => {
  const context = visibleContext([{}]);
  await assert.rejects(openVisibleDestination(context, 'https://staging.example',
    '/en-CA/dashboard/settings', '/en-CA/dashboard/profile'), /Required role-landing redirect did not settle/);
  assert.equal(context.pages[0].events.at(-1)[0], 'closed');
});

test('keeps organization settings as the exact administrator destination', async () => {
  const context = visibleContext([{}]);
  const result = await openVisibleDestination(context, 'https://staging.example',
    '/en-CA/dashboard/settings', '/en-CA/dashboard/settings');
  assert.equal(result.finalPath, '/en-CA/dashboard/settings');
  assert.equal(result.redirectedAfterDOMContentLoaded, false);
});

test('refuses a late administrator redirect away from the required organization settings page', async () => {
  const context = visibleContext([{ afterLoad: 'https://staging.example/en-CA/dashboard/profile' }]);
  await assert.rejects(openVisibleDestination(context, 'https://staging.example',
    '/en-CA/dashboard/settings', '/en-CA/dashboard/settings'), /changed after settlement/);
});

test('refuses a foreign-origin destination even when the path matches', async () => {
  const context = visibleContext([{ redirect: 'https://elsewhere.example/en-CA/dashboard/profile' }]);
  await assert.rejects(openVisibleDestination(context, 'https://staging.example',
    '/en-CA/dashboard/settings', '/en-CA/dashboard/profile'), /changed after settlement/);
});

test('refuses visible-page HTTP errors without retrying or interpreting them as an authorized landing', async () => {
  const context = visibleContext([{ status: 503 }]);
  await assert.rejects(openVisibleDestination(context, 'https://staging.example',
    '/en-CA/dashboard/settings', '/en-CA/dashboard/settings'), /unexpected HTTP status: 503/);
  assert.deepEqual(context.pages[0].events.map(([name]) => name), ['goto', 'closed']);
});

test('never navigates a source-visible route to a foreign origin', async () => {
  const context = visibleContext([]);
  await assert.rejects(openVisibleDestination(context, 'https://staging.example',
    '//elsewhere.example/en-CA/dashboard/settings', '/en-CA/dashboard/settings'), /staging origin/);
  assert.equal(context.pages.length, 0);
});

test('records the source settings policy for every actual persona and pins both policy and route', () => {
  const inventory = require('./ue-v2-navigation-inventory.json');
  for (const role of ['member', 'steward', 'chief_steward', 'officer', 'secretary_treasurer']) {
    assert.deepEqual(inventory.profiles[role].accountSettings,
      { path: '/dashboard/settings', destination: '/dashboard/profile' }, role);
  }
  for (const role of ['admin', 'app_owner']) {
    assert.deepEqual(inventory.profiles[role].accountSettings,
      { path: '/dashboard/settings', destination: '/dashboard/settings' }, role);
  }
  assert(inventory.sourceDigests['apps/union-eyes/lib/auth/org-settings-access.ts']);
  assert(inventory.sourceDigests['apps/union-eyes/app/[locale]/dashboard/settings/page.tsx']);
});

#!/usr/bin/env node
/**
 * CUPE4373 demo walkthrough smoke.
 *
 * Validates the full presenter flow end-to-end against a running Union Eyes
 * instance (defaults to https://demo.unioneyes.app, override with --base).
 *
 * Asserts:
 *   - Public marketing pages respond 200 without auth and never expose
 *     forbidden contamination terms.
 *   - Anonymous visitors are NOT force-redirected from / into /dashboard.
 *   - The persona login endpoint authenticates the steward demo persona.
 *   - All 13 authenticated CUPE4373 dashboard surfaces render (200).
 *   - No CUPE4373 demo surface leaks the forbidden contamination terms.
 *
 * Exit code: 0 on success, 1 on any failure.
 */

const argv = process.argv.slice(2);
const baseFlagIdx = argv.indexOf('--base');
const BASE = baseFlagIdx >= 0 ? argv[baseFlagIdx + 1] : 'https://demo.unioneyes.app';

const FORBIDDEN = ['Grand River', '7 West', 'CUPE Local 123', 'Brandon', 'Union365'];

const PUBLIC_ROUTES = [
  '/en-CA',
  '/en-CA/platform',
  '/en-CA/solutions',
  '/en-CA/trust',
  '/en-CA/pricing',
  '/en-CA/story',
  '/en-CA/whitepapers',
  '/en-CA/contact',
];

const AUTHED_ROUTES = [
  '/en-CA/dashboard',
  '/en-CA/dashboard/inbox',
  '/en-CA/dashboard/priorities',
  '/en-CA/dashboard/cases',
  '/en-CA/dashboard/grievances',
  '/en-CA/dashboard/documents',
  '/en-CA/dashboard/members',
  '/en-CA/dashboard/communications',
  '/en-CA/dashboard/governance',
  '/en-CA/dashboard/reports',
  '/en-CA/dashboard/agreements',
  '/en-CA/dashboard/calendar',
  '/en-CA/dashboard/work',
];

const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

const failures = [];
const record = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

async function probe(path, cookie) {
  const headers = { accept: 'text/html' };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', headers });
  const body = await res.text().catch(() => '');
  const text = strip(body);
  const found = FORBIDDEN.filter((t) => text.includes(t));
  return { status: res.status, location: res.headers.get('location') || '', text, forbidden: found };
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  return { ok: res.ok, cookie };
}

(async () => {
  console.log(`[walkthrough] base=${BASE}`);

  // 1. Root must not force anonymous visitors directly into /dashboard.
  const rootRes = await fetch(`${BASE}/`, { redirect: 'manual' });
  const rootLoc = rootRes.headers.get('location') || '';
  record(
    !/\/dashboard(\b|\/)/.test(rootLoc),
    `Anonymous / does not redirect into /dashboard (got ${rootRes.status} → ${rootLoc || '(none)'})`,
  );

  // 2. Public marketing routes render with no forbidden terms.
  for (const path of PUBLIC_ROUTES) {
    const r = await probe(path);
    record(r.status === 200, `PUBLIC ${path} → ${r.status}`);
    record(r.forbidden.length === 0, `PUBLIC ${path} clean of forbidden terms${r.forbidden.length ? ` (found: ${r.forbidden.join(', ')})` : ''}`);
  }

  // 3. Steward persona authenticates.
  const steward = await login('steward@cupe4373.demo', 'Demo!2026-Foundation');
  record(steward.ok && !!steward.cookie, 'Steward persona authenticates via /api/auth/login');
  if (!steward.cookie) {
    console.error('No session cookie returned; aborting authenticated walkthrough.');
    process.exit(1);
  }

  // 4. Every CUPE4373 authenticated surface renders.
  for (const path of AUTHED_ROUTES) {
    const r = await probe(path, steward.cookie);
    record(r.status === 200, `AUTH  ${path} → ${r.status}`);
    record(r.forbidden.length === 0, `AUTH  ${path} clean of forbidden terms${r.forbidden.length ? ` (found: ${r.forbidden.join(', ')})` : ''}`);
  }

  console.log('');
  if (failures.length) {
    console.error(`Walkthrough failed (${failures.length} issues):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log('Walkthrough OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

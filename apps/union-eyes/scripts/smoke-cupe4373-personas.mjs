#!/usr/bin/env node
/**
 * Persona E2E smoke for the Union Eyes demo instance.
 *
 * Validates the dual-persona authz contract end-to-end against a live URL:
 *   - member@cupe4373.demo  → can authenticate, cannot record decisions
 *   - steward@cupe4373.demo → can authenticate and record decisions
 *
 * This locks in Gap 7 closure (auth bypass removal) at the deployed boundary.
 * It is intentionally fast (≤ 30s) and dependency-free (Node 20+ fetch only).
 *
 * Usage:
 *   node apps/union-eyes/scripts/smoke-cupe4373-personas.mjs \
 *     --base https://nzila-os-union-eyes-demo.greenmoss-d27e0e19.canadacentral.azurecontainerapps.io
 *
 *   # Env overrides
 *   UE_SMOKE_BASE_URL=...        (alternative to --base)
 *   UE_SMOKE_MEMBER_EMAIL=...    (default member@cupe4373.demo)
 *   UE_SMOKE_STEWARD_EMAIL=...   (default steward@cupe4373.demo)
 *   UE_SMOKE_PASSWORD=...        (default Demo!2026-Foundation)
 *
 * Exit codes:
 *   0  all assertions passed
 *   1  any assertion failed (also prints failures)
 *   2  configuration / network error before assertions could run
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, tok, i, arr) => {
    if (tok.startsWith('--')) acc.push([tok.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const BASE = (args.base ?? process.env.UE_SMOKE_BASE_URL ?? '').replace(/\/$/, '');
if (!BASE) {
  console.error('error: --base or UE_SMOKE_BASE_URL is required');
  process.exit(2);
}

const MEMBER_EMAIL = process.env.UE_SMOKE_MEMBER_EMAIL ?? 'member@cupe4373.demo';
const STEWARD_EMAIL = process.env.UE_SMOKE_STEWARD_EMAIL ?? 'steward@cupe4373.demo';
const PASSWORD = process.env.UE_SMOKE_PASSWORD ?? 'Demo!2026-Foundation';
const TIMEOUT_MS = Number(process.env.UE_SMOKE_TIMEOUT_MS ?? 30_000);

const SESSION_COOKIE = 'nzila_session';
const results = [];
let failures = 0;

// Force IPv4 — on Windows, undici/Node fetch can hang on Azure Container Apps
// hostnames that publish AAAA records but have no working IPv6 path.
let dispatcher;
try {
  const undici = await import('undici');
  dispatcher = new undici.Agent({ connect: { family: 4, timeout: TIMEOUT_MS } });
} catch {
  // undici not bundled in this Node — fall back to default fetch
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
}

function parseSetCookie(headers) {
  // Node fetch's Headers#getSetCookie() returns an array; fall back to raw.
  const raw =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie')]
        : [];
  const jar = {};
  for (const entry of raw) {
    const [pair] = entry.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return jar;
}

async function request(path, { method = 'GET', body, cookies } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const headers = { accept: 'application/json' };
    if (body) headers['content-type'] = 'application/json';
    if (cookies) {
      headers.cookie = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
      signal: ctl.signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    let payload = null;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      payload = await res.json().catch(() => null);
    } else {
      payload = await res.text().catch(() => null);
    }
    return { status: res.status, headers: res.headers, body: payload };
  } finally {
    clearTimeout(timer);
  }
}

async function loginAs(email) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  if (res.status !== 200) {
    return { ok: false, status: res.status, body: res.body };
  }
  const jar = parseSetCookie(res.headers);
  if (!jar[SESSION_COOKIE]) {
    return { ok: false, status: res.status, error: 'no session cookie' };
  }
  return { ok: true, cookies: jar };
}

function buildDecisionBody() {
  return {
    caseTitle: 'Smoke: persona authz probe',
    title: 'Decline test decision (smoke)',
    rationale:
      'Smoke probe for persona authz contract — this is a synthetic test write that should be rejected for member personas and accepted for stewards.',
    priority: 'p3',
    status: 'proposed',
  };
}

// ── Probes ───────────────────────────────────────────────────────────────────

async function probeHealth() {
  const res = await request('/api/health');
  record(
    'GET /api/health → 200',
    res.status === 200,
    `status=${res.status}`,
  );
}

async function probeMember() {
  const auth = await loginAs(MEMBER_EMAIL);
  record(
    `login member (${MEMBER_EMAIL}) → 200 + session cookie`,
    auth.ok,
    auth.ok ? 'ok' : `status=${auth.status} body=${JSON.stringify(auth.body)?.slice(0, 200)}`,
  );
  if (!auth.ok) return;

  const decision = await request('/api/cases/smoke-case/decision', {
    method: 'POST',
    body: buildDecisionBody(),
    cookies: auth.cookies,
  });
  record(
    'POST /api/cases/:id/decision as member → 403 FORBIDDEN',
    decision.status === 403,
    `status=${decision.status} body=${JSON.stringify(decision.body)?.slice(0, 200)}`,
  );
}

async function probeSteward() {
  const auth = await loginAs(STEWARD_EMAIL);
  record(
    `login steward (${STEWARD_EMAIL}) → 200 + session cookie`,
    auth.ok,
    auth.ok ? 'ok' : `status=${auth.status} body=${JSON.stringify(auth.body)?.slice(0, 200)}`,
  );
  if (!auth.ok) return;

  const decision = await request('/api/cases/smoke-case/decision', {
    method: 'POST',
    body: buildDecisionBody(),
    cookies: auth.cookies,
  });
  // Acceptable: 200 (replayed) or 201 (newly recorded). Anything 4xx/5xx is a fail.
  const ok = decision.status === 200 || decision.status === 201;
  record(
    'POST /api/cases/:id/decision as steward → 200/201',
    ok,
    `status=${decision.status} body=${JSON.stringify(decision.body)?.slice(0, 300)}`,
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`▶ UE persona smoke against ${BASE}`);
  try {
    await probeHealth();
    await probeMember();
    await probeSteward();
  } catch (err) {
    console.error('fatal:', err?.message ?? err);
    process.exit(2);
  }

  for (const r of results) {
    const mark = r.ok ? '✓' : '✗';
    console.log(`  ${mark} ${r.name}  — ${r.detail}`);
  }
  console.log(
    failures === 0
      ? `\n✅ ${results.length}/${results.length} persona smoke assertions passed`
      : `\n❌ ${failures}/${results.length} persona smoke assertions FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();

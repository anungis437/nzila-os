// Protected remote CI only. Real Entra authorization-code sessions; no synthetic cookies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd() + '/apps/union-eyes'] }));
const BASE = 'https://nzila-ue-v2-staging-app.whitemoss-055b7430.canadacentral.azurecontainerapps.io';
const TENANT = 'cc15259a-d2bf-421f-8e44-dccf8dc6232a';
const PEOPLE = {
  // Steady-state officer; shares the same identity as qualify-ue-v2-real-navigation.cjs's PEOPLE.A.
  A: { oid: 'ecb4f1d7-b0ae-44f8-bf56-832bc173fc49', upn: 'ue-v2-staging-seniorrep-20261113@anungisayahoo.onmicrosoft.com', org: 'b96359c3-a8de-458c-8469-afc084b7fbc0' },
  // Distinct organization, for genuine cross-tenant isolation proof (own-visible / foreign-denied).
  B: { oid: '59d4c24e-acb6-4a0e-898a-ed20016c642c', upn: 'ue-v2-staging-isolation-b-20261113@anungisayahoo.onmicrosoft.com', org: 'f3a1c2d4-5e6b-4a7c-9d8e-1234567890ab' },
};
const OUT = 'artifacts/ue-v2-real-entra';
const report = { evidenceClass: 'REAL_REMOTE_ENTRA_SESSION_AND_API', sourceSha: process.env.SOURCE_SHA, workflowSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, observations: [], runtimeAcceptance: false };
let stage = 'guard', browser;
const contexts = new Map();
function record(value) { report.observations.push({ at: new Date().toISOString(), ...value }); }
function payload(body) { return body.data ?? body; }
// Some routes in this codebase (crud-factory item/list routes; see
// apps/union-eyes/lib/client/api-envelope.ts envelopeRows/envelopeRow) deliberately
// return `{ data: ... }` from the handler on TOP of withApi's own `{ success, data, timestamp }`
// wrap, so the real body is `{ data: { data: ... } }`. A single payload() unwrap is correct for
// hand-written routes (e.g. the single-case GET) but leaves an object (not an array) for those
// double-wrapped list routes. listPayload() unwraps one further level only when needed.
function listPayload(body) {
  const once = payload(body);
  if (Array.isArray(once)) return once;
  if (once && typeof once === 'object' && Array.isArray(once.data)) return once.data;
  return once;
}
function guid(value) { assert.match(value, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i); return value; }
async function request(key, path, method = 'GET', data, expected = [200]) {
  assert(path.startsWith('/api/') && !path.includes('://'));
  const traceId = crypto.randomBytes(16).toString('hex');
  const correlationId = crypto.randomUUID();
  const response = await contexts.get(key).request.fetch(BASE + path, { method, data, headers: { traceparent: '00-' + traceId + '-' + crypto.randomBytes(8).toString('hex') + '-01', 'x-correlation-id': correlationId, 'x-trace-id': traceId } });
  record({ kind: 'API', persona: key, method, path, status: response.status(), traceId, correlationId, responseTraceId: response.headers()['x-trace-id'] });
  assert(expected.includes(response.status()), 'Required API status mismatch');
  return response;
}
async function auth(key) {
  stage = 'real-entra-' + key;
  const context = await browser.newContext({ baseURL: BASE });
  contexts.set(key, context);
  const page = await context.newPage();
  const events = [];
  page.on('response', response => { const url = new URL(response.url()); if (url.origin === BASE && url.pathname.startsWith('/api/auth/')) events.push({ path: url.pathname, status: response.status() }); });
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  assert.equal(typeof csrf.csrfToken, 'string');
  const start = await context.request.post('/api/auth/signin/microsoft-entra-id', { form: { csrfToken: csrf.csrfToken, callbackUrl: BASE + '/en-CA/dashboard', json: 'true' }, headers: { 'X-Auth-Return-Redirect': '1' } });
  const redirect = await start.json();
  assert.equal(new URL(redirect.url).hostname, 'login.microsoftonline.com');
  await page.goto(redirect.url);
  await page.locator('input[type=email]').fill(PEOPLE[key].upn);
  await page.locator('input[type=submit]').click();
  const password = process.env['UE_V2_STAGING_PERSONA_' + key + '_PASSWORD'];
  assert(password && password.length > 10, 'Verified staging password required');
  await page.locator('input[type=password]').fill(password);
  await page.locator('input[type=submit]').click();
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline && new URL(page.url()).origin !== BASE) {
    const decline = page.locator('#idBtn_Back');
    if (await decline.isVisible().catch(() => false)) await decline.click();
    if (await page.getByText(/more information required|approve sign in request|enter code|verify your identity/i).first().isVisible().catch(() => false)) throw Error('Interactive verification required');
    await page.waitForTimeout(500);
  }
  assert.equal(new URL(page.url()).origin, BASE);
  const response = await context.request.get('/api/auth/session');
  assert.equal(response.status(), 200);
  const session = await response.json();
  assert.equal(session.entraObjectId, PEOPLE[key].oid);
  assert.equal(session.tenantId, TENANT);
  assert(session.user && session.expires);
  assert(Date.parse(session.expires) > Date.now() && Date.parse(session.expires) - Date.now() <= 901000);
  const cookies = await context.cookies(BASE);
  assert(cookies.some(cookie => cookie.name.includes('session-token') && cookie.secure && cookie.httpOnly));
  record({ kind: 'REAL_ENTRA_AUTHORIZATION_CODE_SESSION', persona: key, principal: PEOPLE[key].oid, tenant: TENANT, expires: session.expires, events, secureHttpOnlyCookie: true });
  await page.close();
}
async function main() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.match(report.sourceSha, /^[a-f0-9]{40}$/);
  fs.mkdirSync(OUT, { recursive: true });
  const publicIdentity = await fetch(BASE + '/api/version');
  assert.equal(publicIdentity.status, 200);
  const identity = await publicIdentity.json();
  assert.equal(identity.gitSha, report.sourceSha);
  record({ kind: 'LIVE_SOURCE_IDENTITY', gitSha: identity.gitSha, app: identity.app });
  browser = await chromium.launch({ headless: true });
  await auth('A'); await auth('B');
  const cases = {};
  for (const key of ['A', 'B']) {
    stage = 'create-own-case-' + key;
    const response = await request(key, '/api/cases', 'POST', { claimType: 'other', description: 'Synthetic V2 staging qualification case. No real member data.', priority: 'medium', isAnonymous: false }, [200, 201]);
    const created = payload(await response.json());
    cases[key] = guid(created.claimId);
    record({ kind: 'API_CREATED_CASE', persona: key, claimId: cases[key], organizationId: PEOPLE[key].org });
  }
  for (const key of ['A', 'B']) {
    stage = 'tenant-isolation-' + key;
    const other = key === 'A' ? 'B' : 'A';
    const own = payload(await (await request(key, '/api/cases/' + cases[key])).json());
    assert.equal(own.claimId, cases[key]);
    assert.equal(own.organizationId, PEOPLE[key].org);
    await request(key, '/api/cases/' + cases[other], 'GET', undefined, [403, 404]);
    const list = listPayload(await (await request(key, '/api/cases')).json());
    assert(Array.isArray(list), 'case list response was not an array even after the known envelope unwrap');
    assert(list.some(row => row.claimId === cases[key]), 'own just-created case missing from case list');
    assert(!list.some(row => row.claimId === cases[other]), 'foreign-tenant case leaked into case list');
    record({ kind: 'OWN_CASE_VISIBLE_FOREIGN_CASE_DENIED', persona: key, ownCase: cases[key], foreignCase: cases[other] });
  }
  // The verified officer's visible menu excludes Finance; this fixture has no financial mandate.
  stage = 'localized-executive-navigation';
  const pages = ['/dashboard/executive', '/dashboard/leadership', '/dashboard/governance', '/dashboard/bargaining', '/dashboard/correspondence', '/dashboard/continuity-intelligence', '/dashboard/settings'];
  for (const locale of ['en-CA', 'fr-CA']) {
    for (const path of pages) {
      const page = await contexts.get('A').newPage();
      const route = '/' + locale + path;
      const response = await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      assert(response);
      const finalPath = new URL(page.url()).pathname;
      record({ kind: 'LOCALIZED_EXECUTIVE_NAVIGATION', path: route, finalPath, status: response.status(), viewport: 'desktop', noInstitutionalAuthorityInferred: true });
      assert.equal(response.status(), 200);
      assert.equal(finalPath.replace(/\/$/, ''), route);
      assert.equal(await page.getByText('This page could not be found', { exact: true }).count(), 0);
      await page.close();
    }
  }
  stage = 'mobile-localized-dashboard';
  const mobile = await contexts.get('A').newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  for (const locale of ['en-CA', 'fr-CA']) {
    const path = '/' + locale + '/dashboard/executive';
    const response = await mobile.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    assert.equal(new URL(mobile.url()).pathname.replace(/\/$/, ''), path);
    record({ kind: 'MOBILE_LOCALIZED_PAGE', path, status: response.status(), width: 390, height: 844 });
  }
  await mobile.close();
  stage = 'canonical-document-intake';
  const content = Buffer.from('Synthetic Union Eyes V2 staging document. No real member information.');
  const checksum = crypto.createHash('sha256').update(content).digest('hex');
  const upload = await contexts.get('A').request.post(BASE + '/api/documents/upload', {
    multipart: { file: { name: 'ue-v2-synthetic-document.txt', mimeType: 'text/plain', buffer: content },
                 organizationId: PEOPLE.A.org, canonicalIntake: '1' },
  });
  record({ kind: 'CANONICAL_DOCUMENT_UPLOAD', persona: 'A', status: upload.status(), checksum, bytes: content.length });
  assert.equal(upload.status(), 201);
  const intake = payload(await upload.json());
  // The canonical intake route returns IntakeView, whose id field is named intakeId, not id.
  const intakeId = guid(intake.intakeId);
  await request('B', '/api/documents/intakes/' + intakeId, 'GET', undefined, [403, 404]);
  const documentPayload = { title: 'Synthetic V2 staging document', filename: 'ue-v2-synthetic-document.txt',
                            intakeId, contentHash: checksum, documentType: 'staging-qualification', privacyLabel: 'public_internal',
                            containsPii: false, containsMedicalSensitive: false, containsLegalPrivilege: false };
  const accepted = payload(await (await request('A', '/api/documents/repository', 'POST', documentPayload, [200, 201])).json());
  const documentId = guid(accepted.id);
  const replay = payload(await (await request('A', '/api/documents/repository', 'POST', documentPayload, [200, 201])).json());
  assert.equal(replay.id, documentId);
  await request('B', '/api/documents/' + documentId + '/download', 'GET', undefined, [403, 404]);
  const issued = payload(await (await request('A', '/api/documents/' + documentId + '/download')).json());
  const link = new URL(issued.downloadUrl);
  assert.equal(link.protocol, 'https:');
  assert.equal(link.hostname, 'nzilauev2stagingst.blob.core.windows.net');
  assert(link.pathname.startsWith('/ue-v2-documents/documents/' + PEOPLE.A.org + '/'));
  const expiresAt = link.searchParams.get('se');
  assert(expiresAt && Date.parse(expiresAt) > Date.now());
  let publicClientStatus;
  try { publicClientStatus = (await contexts.get('A').request.get(link.href, { timeout: 15000 })).status(); }
  catch { publicClientStatus = 'NETWORK_BLOCKED'; }
  assert.notEqual(publicClientStatus, 200);
  // Only the private staging operator can decrypt the signed lease for the
  // separate private-network byte and actual-expiry checks. No cookie is saved.
  const publicKey = crypto.createPublicKey(Buffer.from(process.env.EVIDENCE_PUBLIC_KEY_B64, 'base64'));
  assert.equal(publicKey.asymmetricKeyType, 'rsa');
  assert(publicKey.asymmetricKeyDetails.modulusLength >= 3072);
  const secretKey = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
  const aad = Buffer.from(report.sourceSha + ':' + documentId);
  cipher.setAAD(aad);
  const sealed = Buffer.concat([cipher.update(JSON.stringify({ url: link.href, organizationId: PEOPLE.A.org, expectedChecksum: checksum })), cipher.final()]);
  const envelope = { algorithm: 'RSA-OAEP-SHA256+A256GCM', aad: aad.toString('base64'), iv: iv.toString('base64'),
                     wrappedKey: crypto.publicEncrypt({ key: publicKey, oaepHash: 'sha256' }, secretKey).toString('base64'),
                     ciphertext: sealed.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  secretKey.fill(0);
  record({ kind: 'API_DOCUMENT_AND_ONE_USE_INTAKE', intakeId, documentId, checksum, replaySameDocument: true,
           foreignDownloadDenied: true, publicClientStatus, expiresAt,
           signedUrlSha256: crypto.createHash('sha256').update(link.href).digest('hex'), encryptedPrivateLease: envelope,
           privateBytesAndExpiryNotYetProven: true });
  report.claims = cases;
  if (process.env.VERIFY_MEMBERSHIP_REVOCATION === 'true') {
    stage = 'await-real-membership-revocation';
    report.status = 'CHECKPOINT_READY';
    fs.writeFileSync(OUT + '/checkpoint.json', JSON.stringify(report, null, 2) + '\n');
    // The protected checkpoint lets the private operator revoke only the owned
    // synthetic membership. Existing provider cookies stay exclusively in RAM.
    await new Promise(resolve => setTimeout(resolve, 360000));
    const activeSession = await contexts.get('A').request.get(BASE + '/api/auth/session');
    assert.equal(activeSession.status(), 200);
    const session = await activeSession.json();
    assert.equal(session.entraObjectId, PEOPLE.A.oid);
    assert(Date.parse(session.expires) > Date.now(), 'Session must remain unexpired');
    stage = 'existing-cookie-after-membership-revocation';
    await request('A', '/api/cases/' + cases.A, 'GET', undefined, [403, 404]);
    await request('A', '/api/documents/' + documentId + '/download', 'GET', undefined, [403, 404]);
    record({ kind: 'EXISTING_REAL_SESSION_DENIED_AFTER_MEMBERSHIP_REVOCATION',
      persona: 'A', claimId: cases.A, documentId, sessionStillUnexpired: true,
      previouslyIssuedLeaseRequiresSeparateActualExpiryProof: true });
  }
  report.status = 'PASS';
}
main().catch(error => { report.status = 'FAIL'; report.failure = { stage, error: error.name, message: error.message }; process.exitCode = 1; }).finally(async () => { if (browser) await browser.close().catch(() => {}); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + '/receipt.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, stage, observations: report.observations.length })); });

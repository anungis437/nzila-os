// Protected remote CI only. Real Entra authorization-code sessions; no synthetic cookies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd() + '/apps/union-eyes'] }));
const BASE = 'https://nzila-ue-v2-staging-app.whitemoss-055b7430.canadacentral.azurecontainerapps.io';
const TENANT = '5082b8be-b04d-4a13-b61c-b6397670177b';
const PEOPLE = {
  A: { oid: 'e07cbf07-fee5-45e3-934c-de5966dabae5', upn: 'ue-staging-recovery-a-20261022@onelabtech.onmicrosoft.com', org: 'b96359c3-a8de-458c-8469-afc084b7fbc0' },
  B: { oid: '3fca6b06-17aa-4dc7-85a1-f4fa5f8cc015', upn: 'ue-staging-recovery-b-20261022@onelabtech.onmicrosoft.com', org: '82e9921a-16ac-486a-b8f4-b28029cc2cbd' },
};
const OUT = 'artifacts/ue-v2-navigation';
const report = { evidenceClass: 'REAL_REMOTE_ENTRA_SESSION_AND_API', sourceSha: process.env.SOURCE_SHA, workflowSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, observations: [], runtimeAcceptance: false };
let stage = 'guard', browser;
const contexts = new Map();
function record(value) { report.observations.push({ at: new Date().toISOString(), ...value }); }
function payload(body) { return body.data ?? body; }
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
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REF,'refs/heads/main');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
  const change=JSON.parse(fs.readFileSync('ops/change-records/CHG-2026-0114.json','utf8'));
  assert.equal(change.founder_staging_authorization.candidate_sha,report.sourceSha);assert.equal(change.founder_staging_authorization.staging_only,true);assert.equal(change.founder_staging_authorization.production_authorized,false);
  require('node:child_process').execFileSync('git',['merge-base','--is-ancestor',report.sourceSha,process.env.GITHUB_SHA]);
  const inventory=JSON.parse(fs.readFileSync('tooling/scripts/lib/ue-v2-navigation-inventory.json','utf8'));
  assert.equal(inventory.applicationSourceSha,report.sourceSha);
  for(const [path,digest] of Object.entries(inventory.sourceDigests))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),digest,'Navigation source changed');
  const role=process.env.SYNTHETIC_MEMBERSHIP_ROLE;assert(['member','steward','officer','admin'].includes(role));
  const profile=inventory.profiles[role];report.requestedOwnedSyntheticRole=role;report.canonicalEntryCount=inventory.canonicalEntryCount;
  const identity=await fetch(BASE+'/api/version');assert.equal(identity.status,200);assert.equal((await identity.json()).gitSha,report.sourceSha);
  fs.mkdirSync(OUT,{recursive:true});browser=await chromium.launch({headless:true});await auth('A');
  stage='observed-canonical-role-landing';
  const home=await contexts.get('A').newPage();await home.goto(BASE+'/en-CA/dashboard',{waitUntil:'domcontentloaded'});
  assert.equal(new URL(home.url()).pathname.replace(/\/$/,''),'/en-CA'+profile.landing);
  record({kind:'OBSERVED_ROLE_EXECUTION_HOME',requestedOwnedSyntheticRole:role,path:new URL(home.url()).pathname});await home.close();
  for(const locale of ['en-CA','fr-CA'])for(const path of [...new Set([...profile.visible.map(x=>x.href),...profile.deepGovernance])]){
    stage='visible-navigation:'+role+':'+locale+':'+path;
    const page=await contexts.get('A').newPage();const route='/'+locale+path;
    const response=await page.goto(BASE+route,{waitUntil:'domcontentloaded'});assert(response);assert.equal(response.status(),200);
    assert.equal(new URL(page.url()).pathname.replace(/\/$/,''),route.split('?')[0]);
    assert.equal(await page.getByText('This page could not be found',{exact:true}).count(),0);
    assert.equal(await page.getByText('Application error: a server-side exception has occurred',{exact:false}).count(),0);
    record({kind:'REAL_VISIBLE_NAVIGATION',role,experience:profile.experience,path:route,status:response.status(),sourceVisible:profile.visible.some(x=>x.href===path)});
    await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
    assert.equal(overflow,false,'Required mobile route must not overflow');
    record({kind:'REAL_MOBILE_NAVIGATION',role,path:route,width:390,height:844,horizontalOverflow:overflow});await page.close();
  }
  stage='direct-scoped-administration-boundaries';
  // Financial and platform operations remain unavailable to these exact fixtures.
  for(const path of ['/dashboard/finance','/dashboard/operations','/dashboard/admin/members','/dashboard/security','/dashboard/integrations']){
    stage='direct-scoped-administration-boundaries:'+path;
    assert(!profile.visible.some(x=>x.href===path));const page=await contexts.get('A').newPage();
    const route='/en-CA'+path,response=await page.goto(BASE+route,{waitUntil:'domcontentloaded'});assert(response);assert(response.status()<500);
    assert(response.status()===403||new URL(page.url()).pathname.replace(/\/$/,'')!==route,'Restricted destination must remain denied: status='+response.status()+' finalPath='+new URL(page.url()).pathname);
    record({kind:'RESTRICTED_DESTINATION_DENIED_TO_ELIGIBLE_FIXTURE',role,path:route,status:response.status(),redirected:new URL(page.url()).pathname!==route});await page.close();
  }
  stage='filing-capacity-is-not-administrator-rank';
  if(['member','admin'].includes(role))await request('A','/api/cases','POST',{claimType:'other',description:'Synthetic denied filing capacity probe. No real facts.'},[403]);
  record({kind:'NO_INSTITUTIONAL_OR_FINANCIAL_AUTHORITY_INFERRED',role,platformAdministrator:false});
  report.status='PASS';
}
main().catch(error=>{report.status='FAIL';report.failure={stage,error:error.name,message:error.message};process.exitCode=1;}).finally(async()=>{if(browser)await browser.close().catch(()=>{});fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(OUT+'/receipt.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,stage,observations:report.observations.length}));});

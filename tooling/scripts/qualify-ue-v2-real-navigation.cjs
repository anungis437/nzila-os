// Protected remote CI only. Real Entra authorization-code sessions; no synthetic cookies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd() + '/apps/union-eyes'] }));
const { settleRoleLanding, settleRestrictedDestination } = require('./lib/ue-staging-navigation-settlement.cjs');
const OWNED_PERSONAS = require('./lib/ue-v2-owned-personas.cjs');
const BASE = 'https://nzila-ue-v2-staging-app.whitemoss-055b7430.canadacentral.azurecontainerapps.io';
const TENANT = 'cc15259a-d2bf-421f-8e44-dccf8dc6232a';
const PEOPLE = {};
const OUT = 'artifacts/ue-v2-navigation';
const report = { evidenceClass: 'REAL_REMOTE_ENTRA_SESSION_AND_API', sourceSha: process.env.SOURCE_SHA, workflowSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, observations: [], runtimeAcceptance: false };
let stage = 'guard', browser;
const contexts = new Map();
function record(value) { report.observations.push({ at: new Date().toISOString(), ...value }); }
function payload(body) { return body.data ?? body; }
function guid(value) { assert.match(value, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i); return value; }
// Documented Chromium/Playwright race (microsoft/playwright#34889 and related): a reload immediately
// following a goto can abort with ERR_ABORTED/"frame was detached" while the prior navigation's frame
// lifecycle is still settling. Retry once; any other error (a real app/test failure) still propagates.
async function reloadWithRetry(page, options) {
  try {
    return await page.reload(options);
  } catch (error) {
    if (!/ERR_ABORTED|frame was detached/.test(error.message)) throw error;
    return page.reload(options);
  }
}
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
  const password = process.env[PEOPLE[key].passwordEnv];
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
async function baseJourneys(role) {
  if(role==='member') {
    stage='member-intake-persistence';
    const intake={type:'other',title:'Synthetic staging intake '+report.runId,description:'Synthetic base-release intake. No real member facts.',createOfficialCase:false};
    const created=payload(await(await request('A','/api/grievances','POST',intake,[200,201])).json());
    guid(created.id);
    const own=payload(await(await request('A','/api/grievances/'+created.id)).json());
    assert.equal(own.grievance?.id??own.id,created.id,'Own intake must persist and remain readable');
    await request('A','/api/grievances','POST',{...intake,createOfficialCase:true},[403]);
    record({kind:'MEMBER_INTAKE_PERSISTED_OFFICIAL_CASE_REFUSED',intakeId:created.id});
    stage='member-message-persistence-and-idempotency';
    const message={subject:'Synthetic staging conversation '+report.runId,body:'Synthetic initial message. No real member information.',clientRequestId:crypto.randomUUID()};
    const thread=payload(await(await request('A','/api/messages/threads','POST',message,[201])).json());guid(thread.id);
    const replay=payload(await(await request('A','/api/messages/threads','POST',message,[201])).json());assert.equal(replay.id,thread.id);
    const reply={body:'Synthetic follow-up message for persisted bilingual casework qualification.',clientRequestId:crypto.randomUUID()};
    await request('A','/api/messages/threads/'+thread.id+'/messages','POST',reply,[201]);
    const repeat=payload(await(await request('A','/api/messages/threads/'+thread.id+'/messages','POST',reply)).json());assert.equal(repeat.duplicate,true);
    const saved=payload(await(await request('A','/api/messages/threads/'+thread.id+'/messages')).json());
    assert.equal(saved.messages.filter(row=>row.content===reply.body).length,1);
    record({kind:'MEMBER_CONVERSATION_AND_REPLY_PERSISTED_IDEMPOTENT',threadId:thread.id});
    stage='same-organization-unassigned-representative-privacy';
    PEOPLE.S=OWNED_PERSONAS.steward;await auth('S');
    const staffRole=await(await request('S','/api/profile/roles')).json();assert.equal(staffRole.role,'steward');
    await request('S','/api/messages/threads/'+thread.id+'/messages','GET',undefined,[404]);
    await request('S','/api/grievances/'+created.id,'GET',undefined,[403,404]);
    record({kind:'SAME_TENANT_UNASSIGNED_STEWARD_DENIED_PRIVATE_INTAKE_AND_MESSAGES',threadId:thread.id,intakeId:created.id});
  }
  if(['steward','chief_steward','officer'].includes(role)) {
    stage='representative-case-filing-and-member-visible-note';
    const filed=payload(await(await request('A','/api/cases','POST',{claimType:'other',description:'Synthetic representative case '+report.runId+'. No real member facts.'},[201])).json());guid(filed.claimId);
    const own=payload(await(await request('A','/api/cases/'+filed.claimId)).json());assert.equal(own.claimId,filed.claimId);
    for(const field of ['aiScore','aiAnalysis','meritConfidence','precedentMatch','complexityScore','legalCosts','courtCosts'])assert(!Object.hasOwn(own,field),'Filing a matter must not expose internal assessment');
    const note='Synthetic member-visible note '+crypto.randomUUID();
    await request('A','/api/cases/'+filed.claimId+'/notes','POST',{text:note,isInternal:false},[200,201]);
    const saved=await(await request('A','/api/cases/'+filed.claimId+'/notes')).json();assert(saved.notes.some(row=>row.message===note));
    // A filer is a party to their own matter. Neither rank nor filing confers assignment authority.
    await request('A','/api/cases/'+filed.claimId+'/assign','POST',{assigneeId:OWNED_PERSONAS.steward.oid,reason:'Synthetic unauthorized self-matter routing probe'},[403]);
    record({kind:'REPRESENTATIVE_FILING_NOTE_PERSISTENCE_AND_SELF_MATTER_ASSIGNMENT_DENIAL',claimId:filed.claimId,internalAssessmentRedacted:true});
    stage='member-directory-scope';
    await request('A','/api/members');
    await request('A','/api/members?organizationId=f3a1c2d4-5e6b-4a7c-9d8e-1234567890ab','GET',undefined,[403]);
    record({kind:'MEMBER_DIRECTORY_OWN_SCOPE_AND_FOREIGN_ORGANIZATION_DENIAL',role});
  }
}
async function main() {
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REF,'refs/heads/main');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
  const change=JSON.parse(fs.readFileSync('ops/change-records/CHG-2026-0114.json','utf8'));
  assert.equal(change.founder_staging_authorization.candidate_sha,report.sourceSha);assert.equal(change.founder_staging_authorization.staging_only,true);assert.equal(change.founder_staging_authorization.production_authorized,false);
  require('node:child_process').execFileSync('git',['merge-base','--is-ancestor',report.sourceSha,process.env.GITHUB_SHA]);
  const inventory=JSON.parse(fs.readFileSync('tooling/scripts/lib/ue-v2-navigation-inventory.json','utf8'));
  assert.equal(inventory.applicationSourceSha,report.sourceSha);
  for(const [path,digest] of Object.entries(inventory.sourceDigests))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),digest,'Navigation source changed');
  const role=process.env.SYNTHETIC_MEMBERSHIP_ROLE;assert(Object.hasOwn(OWNED_PERSONAS,role));
  PEOPLE.A=OWNED_PERSONAS[role];
  const profile=inventory.profiles[role];report.requestedOwnedSyntheticRole=role;report.canonicalEntryCount=inventory.canonicalEntryCount;
  const identity=await fetch(BASE+'/api/version');assert.equal(identity.status,200);assert.equal((await identity.json()).gitSha,report.sourceSha);
  record({kind:'LIVE_SOURCE_IDENTITY',gitSha:report.sourceSha,tenant:TENANT,principal:PEOPLE.A.oid});
  fs.mkdirSync(OUT,{recursive:true});browser=await chromium.launch({headless:true});await auth('A');
  // The dispatch input is a request, not proof of an actual membership role.
  // Use the signed-in person's own live membership API to refuse stale labels.
  stage='live-canonical-membership-role';
  const ownedRoleResponse=await request('A','/api/profile/roles');
  const ownedRole=await ownedRoleResponse.json();
  assert.equal(typeof ownedRole.role,'string','Live role endpoint must return a concrete canonical role');
  assert(Array.isArray(ownedRole.roles),'Live role endpoint must return its own role set');
  record({kind:'LIVE_CANONICAL_MEMBERSHIP_ROLE',requestedOwnedSyntheticRole:role,observedCanonicalRole:ownedRole.role});
  assert.equal(ownedRole.role,role,'Dispatch membership_role does not match the authenticated synthetic principal; select the actual role, not a fictional fixture');
  stage='observed-canonical-role-landing';
  const home=await contexts.get('A').newPage();
  const homeResponse=await home.goto(BASE+'/en-CA/dashboard',{waitUntil:'domcontentloaded'});assert(homeResponse);
  let landing;
  try {
    landing=await settleRoleLanding(home,'/en-CA'+profile.landing);
  } catch(error) {
    record({kind:'ROLE_LANDING_SETTLEMENT_FAILED',expectedPath:'/en-CA'+profile.landing,observedPath:new URL(home.url()).pathname,initialHttpStatus:homeResponse.status()});
    throw error;
  }
  record({kind:'OBSERVED_ROLE_EXECUTION_HOME',requestedOwnedSyntheticRole:role,initialPath:landing.initialPath,path:landing.finalPath,redirectedAfterDOMContentLoaded:landing.redirectedAfterDOMContentLoaded,initialHttpStatus:homeResponse.status()});await home.close();
  for(const locale of ['en-CA','fr-CA'])for(const path of [...new Set([...profile.visible.map(x=>x.href),...profile.deepGovernance])]){
    // Finance 2.1 and dues are outside the base release. The sensitive APIs below
    // must deny a fixture without a live financial mandate, even when its rank
    // permits a finance navigation shell. No positive finance feature claim.
    if(path==='/dashboard/finance') {
      record({kind:'OUT_OF_BASE_RELEASE_FINANCE_FEATURE',role,path,featureAcceptanceClaimed:false});
      continue;
    }
    stage='visible-navigation:'+role+':'+locale+':'+path;
    const page=await contexts.get('A').newPage();const route='/'+locale+path;
    const response=await page.goto(BASE+route,{waitUntil:'domcontentloaded'});assert(response);assert.equal(response.status(),200);
    await settleRoleLanding(page,route.split('?')[0]);
    assert.equal(await page.getByText('This page could not be found',{exact:true}).count(),0);
    assert.equal(await page.getByText('Application error: a server-side exception has occurred',{exact:false}).count(),0);
    record({kind:'REAL_VISIBLE_NAVIGATION',role,experience:profile.experience,path:route,status:response.status(),sourceVisible:profile.visible.some(x=>x.href===path)});
    await page.setViewportSize({width:390,height:844});await reloadWithRetry(page,{waitUntil:'domcontentloaded'});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
    assert.equal(overflow,false,'Required mobile route must not overflow');
    record({kind:'REAL_MOBILE_NAVIGATION',role,path:route,width:390,height:844,horizontalOverflow:overflow});await page.close();
  }
  stage='direct-scoped-administration-boundaries';
  // Financial and platform operations remain unavailable to these exact fixtures.
  for(const path of ['/dashboard/finance','/dashboard/operations','/dashboard/admin/members','/dashboard/security','/dashboard/integrations'].filter(path=>!profile.visible.some(x=>x.href===path))){
    stage='direct-scoped-administration-boundaries:'+path;
    assert(!profile.visible.some(x=>x.href===path));const page=await contexts.get('A').newPage();
    const route='/en-CA'+path,response=await page.goto(BASE+route,{waitUntil:'domcontentloaded'});assert(response);assert(response.status()<500);
    let denied;
    try {
      denied=await settleRestrictedDestination(page,route,response.status());
    } catch(error) {
      record({kind:'RESTRICTED_DESTINATION_SETTLEMENT_FAILED',role,path:route,status:response.status(),observedPath:new URL(page.url()).pathname});
      throw error;
    }
    record({kind:'RESTRICTED_DESTINATION_DENIED_TO_ELIGIBLE_FIXTURE',role,path:route,status:response.status(),denialMode:denied.denialMode,initialPath:denied.initialPath,finalPath:denied.finalPath});await page.close();
  }
  stage='sensitive-finance-api-boundaries';
  for(const path of ['/api/finance/summary','/api/finance/per-capita/inbound']) {
    await request('A',path,'GET',undefined,[403]);
    record({kind:'SENSITIVE_FINANCE_API_DENIED_WITHOUT_MANDATE',role,path});
  }
  stage='filing-capacity-is-not-administrator-rank';
  if(['member','admin'].includes(role))await request('A','/api/cases','POST',{claimType:'other',description:'Synthetic denied filing capacity probe. No real facts.'},[403]);
  await baseJourneys(role);
  const finalIdentity=await fetch(BASE+'/api/version');assert.equal(finalIdentity.status,200);assert.equal((await finalIdentity.json()).gitSha,report.sourceSha);
  record({kind:'NO_INSTITUTIONAL_OR_FINANCIAL_AUTHORITY_INFERRED',role,platformAdministrator:role==='app_owner',tenantContentBypassClaimed:false});
  report.status='PASS';
}
main().catch(error=>{report.status='FAIL';report.failure={stage,error:error.name,message:error.message};process.exitCode=1;}).finally(async()=>{if(browser)await browser.close().catch(()=>{});fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(OUT+'/receipt.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,stage,observations:report.observations.length}));});

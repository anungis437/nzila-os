import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(process.cwd(), 'app', 'api');
const read = (route: string) => readFileSync(join(API, ...route.split('/'), 'route.ts'), 'utf8');

describe('F07 read authority beyond a role floor', () => {
  // DEF-0B5-SMS-STEWARD-READS-ALL-MEMBER-MESSAGES / DEF-0B5-SMS-CAMPAIGN-READ-BY-ANY-MEMBER
  it.each([
    'communications/sms',
    'communications/sms/campaigns',
    'communications/sms/conversations',
  ])('%s is read and written at the officer floor', (route) => {
    const text = read(route);
    expect(text).toContain("readRole: 'officer'");
    expect(text).toContain("writeRole: 'officer'");
  });

  // DEF-0B5-SURVEY-DRAFTS-READABLE-BY-MEMBERS
  it.each(['communications/surveys', 'communications/surveys/[surveyId]'])('%s hides drafts from a member', (route) => {
    expect(read(route)).toContain("belowStaffReadCondition: ne(surveys.status, 'draft')");
  });

  // DEF-0B6-EDU-CONTENT-DRAFTS-AND-ARCHIVED-READABLE-BY-MEMBER
  it('the course catalogue shows a member only live courses', () => {
    expect(read('education/courses')).toContain('belowStaffReadCondition: eq(trainingCourses.isActive, true)');
  });

  // DEF-0B6-EDU-SESSION-READ-EXPOSES-ACCESS-CODE-AND-COSTS
  it('a session never returns its access code or costs', () => {
    const text = read('education/sessions');
    for (const column of ['virtualMeetingAccessCode', 'sessionBudget', 'actualCost']) expect(text).toContain(`'${column}'`);
  });

  // DEF-0B6-EDU-OWNER-SCOPED-READS-HIDE-MEMBER-RECORDS-FROM-STAFF
  it.each(['education/registrations', 'education/certifications'])('%s lets staff read every member record', (route) => {
    expect(read(route)).toContain('staffReadsAll: true');
  });

  // DEF-0B5-COMMITTEE-INTERNAL-NOTES-READ-BY-ANY-MEMBER / DEF-0B3-KPI-ALERT-RECIPIENTS-MEMBER-READ
  it('committees omit internal notes and KPI configurations omit alert recipients', () => {
    expect(read('committees')).toContain("omitFromResponse: ['notes', 'customFields']");
    expect(read('committees/[id]')).toContain("omitFromResponse: ['notes', 'customFields']");
    expect(read('analytics/kpis')).toContain("omitFromResponse: ['alertRecipients']");
  });

  // DEF-0B3-BARGAINING-NEGOTIATION-RECORDS-MEMBER-READ / DEF-0B4-OHS-COMMITTEE-ROSTER-MEMBER-READ / DEF-0B8-HS-PPE-ISSUEE-NAMES-READABLE-AT-MEMBER-FLOOR
  it('proposals, committee rosters and PPE issuance are not readable at the member floor', () => {
    expect(read('bargaining/proposals')).toContain("readRole: 'steward'");
    expect(read('cnesst/hs-committees')).toContain("readRole: 'steward'");
    expect(read('health-safety/ppe')).toContain("readRole: 'health_safety_rep'");
  });

  // DEF-0B11-RPT-DEFINITION-READS-RETURN-EVERY-REPORT-OF-THE-ORGANIZATION-TO-ANY-MEMBER / DEF-0B11-RPT-DATA-SOURCE-REGISTRY-IS-SERVED-TO-ANY-SIGNED-IN-USER
  it('report definitions need a steward and the data-source registry an officer', () => {
    expect(read('reports')).toContain("readRole: 'steward'");
    expect(read('reports/[id]')).toContain("readRole: 'steward'");
    expect(read('reports/datasources')).toContain("withRoleAuth('officer'");
  });

  // DEF-0B11-RPT-TEMPLATES-ROUTE-LISTS-EVERY-REPORT-DEFINITION-AND-STORES-A-NON-TEMPLATE-BY-DEFAULT
  it('the templates route lists and stores templates only', () => {
    const text = read('reports/templates');
    expect(text).toContain('eq(reports.isTemplate, true)');
    expect(text).toContain('isTemplate: true');
    expect(text).not.toContain('crudRoutes');
  });

  // DEF-0B3-ALERT-INBOX-MEMBER-FLOOR-NO-REDACTION
  it('the realtime alert inbox is an officer read', () => {
    expect(read('alerts/realtime')).toContain("auth: { minRole: 'officer' }");
  });

  // DEF-0B11-SOC-STEWARD-CONNECTS-THE-ORGANIZATION-PUBLISHING-IDENTITY-WITH-ADMIN-LEVEL-SCOPES-AND-PICKS-THE-FIRST-PAGE-AUTOMATICALLY
  it('connecting a publishing identity is an administrator act with no admin-level scope and no first-page pick', () => {
    const accounts = read('social-media/accounts');
    expect(accounts).toContain("export const POST = withRoleAuth('admin'");
    expect(accounts).toContain("export const DELETE = withRoleAuth('admin'");
    expect(accounts).not.toContain('business_management');
    expect(accounts).not.toContain('rw_organization_admin');
    const callback = read('social-media/accounts/callback');
    expect(callback).toContain("export const GET = withRoleAuth('admin'");
    expect(callback).toContain('pages.length > 1');
  });

  // DEF-0B8-HS-STATUS-AND-OUTCOME-FIELDS-WRITABLE-WITHOUT-WORKFLOW
  it.each(['health-safety/incidents/[id]', 'health-safety/hazards/[id]', 'health-safety/inspections/[id]'])('%s blocks a status or outcome PATCH', (route) => {
    expect(read(route)).toMatch(/blockedPatchFields: \[[^\]]*'status'/);
  });

  // DEF-0B6-CMP-COPE-FUNDRAISING-TOTALS-WRITABLE-BY-STEWARD
  it('a campaign body cannot set the amount raised or the provider identifiers', () => {
    const text = read('cope/campaigns');
    expect(text).toContain('writableFields:');
    expect(text).not.toMatch(/writableFields:[^\]]*currentAmount/);
    expect(text).not.toMatch(/writableFields:[^\]]*stripe/);
  });

  // DEF-0B7-PLT-SSO-LIST-DISCLOSES-PROVIDER-CONFIGURATION-AT-MEMBER-FLOOR
  it('bargaining notes and the agreement detail read through the confidentiality policy', () => {
    expect(read('bargaining-notes')).toContain("inArray(bargainingNotes.confidentialityLevel, ['public', 'internal'])");
    expect(read('bargaining-notes/[id]')).toContain("inArray(bargainingNotes.confidentialityLevel, ['public', 'internal'])");
  });

  // DEF-0B4-CARBON-VALIDATE-ATTESTS-CALLER-DATA / DEF-0B9-ML-SLA-LIST-GET-SKIPS-THE-FEATURE-GATE-AND-SAFETY-CHECK-THE-POST-APPLIES
  it('carbon claim validation answers 501 and the SLA-breach route has no ungated list read', () => {
    for (const route of ['carbon/validate', 'carbon/dashboard', 'carbon/infrastructure']) expect(read(route)).toContain('ApiError.notImplemented');
    expect(read('ml/predictions/sla-breach-risk')).toMatch(/export const GET = withApi\(\s*\{\s*\/\/[^\n]*\n\s*auth: \{ minRole: 'steward' \}/);
  });

  // DEF-0B10-OPL-09
  it('a legacy organization switch needs an active, non-removed membership of an active organization', () => {
    const text = read('organizations/switch');
    expect(text).toContain("eq(organizationMembers.status, 'active')");
    expect(text).toContain('isNull(organizationMembers.deletedAt)');
    expect(text).toContain("(org.status ?? 'active') !== 'active'");
  });

  // DEF-0B7-PLT-SSO-LIST-DISCLOSES-PROVIDER-CONFIGURATION-AT-MEMBER-FLOOR
  it('the SSO provider list is an administrator read', () => {
    expect(read('enterprise/sso/providers')).toMatch(/GET = withApi\(\s*\{\s*(\/\/[^\n]*\n\s*)?auth: \{ required: true, minRole: 'admin' \}/);
  });
});

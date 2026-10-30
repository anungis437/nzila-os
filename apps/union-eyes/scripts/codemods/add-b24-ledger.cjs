const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B24-F04-GENERIC-CRUD-FIELDS-AND-FACADES'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B24 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f04-factory-fields.contract.test.ts'
const FACADES = A + 'lib/api/__tests__/roster-facades.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F04: a generic CRUD route names the fields a body may write and the columns a response omits, and a path that the factory cannot serve answers 501 instead of refusing every request under another name',
  evidenceCommit: null,
  items: [
    item('DEF-0B12-CRUD-BARGAINING-UNIT-CERTIFICATION-AND-REPRESENTATION-FIELDS-WRITABLE-BY-ANY-STEWARD', [A + 'app/api/units/route.ts', A + 'app/api/units/[id]/route.ts', CONTRACT],
      'A create accepts an allow-list that excludes certification, representation, status and count fields, and a PATCH blocks them; they have no source yet.',
      { status: 'PARTIAL', remaining: 'No dedicated route records a certification or changes representation, so those fields are unwritable until one exists.' }),
    item('DEF-0B12-CRUD-BARGAINING-UNIT-ROWS-READABLE-BY-ANY-MEMBER-WITH-CERTIFICATION-NOTES-AND-CUSTOM-FIELDS', [A + 'app/api/units/route.ts', A + 'app/api/units/[id]/route.ts', CONTRACT],
      'Notes and custom fields are omitted from every unit response.'),
    item('DEF-0B12-CRUD-WORKSITE-ROWS-READABLE-BY-ANY-MEMBER-WITH-SITE-MANAGER-CONTACT-AND-NOTES', [A + 'app/api/worksites/route.ts', A + 'app/api/worksites/[id]/route.ts', CONTRACT],
      'The site manager\'s name, e-mail and telephone, the notes and the custom fields are omitted from every worksite response.'),
    item('DEF-0B12-CRUD-WCB-ASSESSMENT-PREMIUM-AND-PAYROLL-READABLE-BY-ANY-STEWARD', [A + 'app/api/wcb/assessments/route.ts', A + 'app/api/wcb/assessments/[id]/route.ts', CONTRACT],
      'The assessment (premium rate, assessable payroll, premium due) is read at the officer floor.'),
    item('DEF-0B12-CRUD-WCB-CLAIM-ROUTES-ARE-CONFIGURED-FOR-STEWARDS-AND-DENIED-FOR-EVERY-CALLER', [A + 'app/api/wcb/claims/route.ts', A + 'app/api/wcb/claims/[id]/route.ts', FACADES],
      'The WCB claim routes answer 501 explicitly instead of refusing every request through the governance denial; the table no longer has a generic route and its governance entry was removed.'),
    item('DEF-0B11-SOC-FEED-ROUTE-SERVES-THE-COMMUNICATIONS-CAMPAIGNS-TABLE-TO-ANY-MEMBER-AS-A-SOCIAL-FEED', [A + 'app/api/social-media/feed/route.ts', FACADES],
      'The feed answers 501; it was the generic factory over the communications campaigns table.'),
    item('DEF-0B7-EXP-EXTERNAL-DATA-ROUTES-REFUSE-EVERY-REQUEST-AND-MISNAMED', [A + 'app/api/external-data/route.ts', A + 'app/api/external-data/lrb/route.ts', FACADES],
      'Both routes answer 501 (they were the factory over external accounts under a labour-board name, refused for every caller).'),
    item('DEF-0B8-ICRA-API-KEYS-ROUTES-REFUSE-EVERY-REQUEST-WHILE-THE-AUTHORITY-REGISTER-CALLS-THEM-LIVE', [A + 'app/api/integrations/api-keys/route.ts', FACADES],
      'The API-key route answers 501 explicitly: no key is issued, listed or revoked through it.'),
    item('DEF-0B9-ASM-ONBOARDING-ROOT-IS-PENDING-PROFILES-REFUSED-BY-GOVERNANCE-WHILE-THE-ONBOARDING-FORM-POSTS-TO-IT', [A + 'app/api/onboarding/route.ts', FACADES],
      'The onboarding root answers 501 instead of refusing every form submission through the governance denial of the pending-profiles table.'),
    item('DEF-0B7-EXP-REPORT-WRITES-ANY-STEWARD-ANY-FIELD', [A + 'app/api/reports/route.ts', A + 'app/api/reports/[id]/route.ts', CONTRACT],
      'A report body writes only name, description, type, category, configuration and template reference; creator, counters, last run, organization and template flag are the server\'s.'),
    item('DEF-0B3-BULK-IMPORT-INERT', [A + 'app/api/members/bulk/route.ts', CONTRACT],
      'The bulk member route answers 501 for POST and GET rather than reporting an operation it never performed (upstream\'s change).'),
    item('DEF-0B2-UPDATE-ROLE-INERT', [A + 'app/api/admin/update-role/route.ts', FACADES, CONTRACT],
      'The update-role route answers 501 and returns no roster rows (batch B09).'),
    item('DEF-0B1-FIX-SUPER-ADMIN-INERT', [A + 'app/api/admin/fix-super-admin-roles/route.ts', A + 'app/api/__tests__/admin-role-repair-fail-closed.test.ts', CONTRACT],
      'The role-repair route answers 501 at the system-administrator floor and no roster is exposed (upstream\'s change, existing test).'),
    item('DEF-0B9-MOB-PUSH-DEVICE-REGISTRATION-REQUIRES-A-STEWARD-SO-A-MEMBER-DEVICE-IS-REFUSED', [A + 'app/api/mobile/devices/route.ts'],
      'The person who holds the phone registers it at the member floor, every row is the caller\'s own, and the token is never returned (batch B02).'),
    item('DEF-0B11-IDS-STORAGE-POST-INSERTS-A-CALLER-WRITTEN-MEDIA-ROW-WITH-ANY-FILE-URL-SIZE-AND-UPLOADER', [A + 'app/api/storage/usage/route.ts', FACADES],
      'The storage routes answer 501 (batch B15); no caller-written media row is inserted.'),
    item('DEF-0B12-CRUD-TAX-PATHS-SERVE-THE-PER-CAPITA-REMITTANCE-LEDGER-TO-ANY-MEMBER', [A + 'lib/api/crud-governance.ts', A + 'lib/api/__tests__/crud-governance.test.ts'],
      'The per-capita remittance ledger is DENIED for every generic read and write, and the tax paths no longer read it (upstream\'s change, existing test).'),
    item('DEF-0B12-CRUD-TAX-SLIP-RL1-T106-AND-COPE-RECEIPT-PATHS-ISSUE-NOTHING-AND-REFUSE-EVERY-WRITE', [A + 'app/api/tax/t106/route.ts', A + 'app/api/tax/slips/route.ts'],
      'The slip, RL-1, T106 and COPE receipt paths answer 501 (upstream\'s change); a slip is not issued by any route.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B24 added')

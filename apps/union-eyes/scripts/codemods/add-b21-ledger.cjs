const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B21-F07-OBJECT-AUTHORITY-AND-VERIFIED-CREDITS'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B21 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f07-read-authority.contract.test.ts'
const FACADES = A + 'lib/api/__tests__/roster-facades.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F07: authority is checked against the object, the organization and the capacity a record belongs to; defects already repaired in source are credited only where an existing test pins them',
  evidenceCommit: null,
  items: [
    item('DEF-0B9-ORG-CURRENT-ROW-READ-AT-ANY-MEMBER-FLOOR-RETURNS-SETTINGS-AND-BILLING-CONTACT', [A + 'app/api/organizations/current/route.ts', A + 'app/api/__tests__/organizations-current.route.test.ts', A + 'scripts/codemods/f07-org-current.cjs'],
      'The route needs an active membership (404 otherwise) and returns settings, billing contact, subscription tier and provenance only to the organization\'s administrators; every other member gets the public profile. The sibling /api/org/current already returns a four-field projection.'),
    item('DEF-0B10-OPL-09', [A + 'app/api/organizations/switch/route.ts', A + 'app/api/__tests__/organizations-switch.route.test.ts', CONTRACT],
      'The legacy switch requires an active, non-removed membership of an active organization, matching the resolver that later reads the selection; an archived organization is a 404. A platform administrator still switches without membership, as the platform mandate allows.',
      { status: 'PARTIAL', remaining: 'The legacy route still stores nothing server side: it validates and returns metadata, and the client writes the selection cookie.' }),
    item('DEF-0B3-TRIAL-EXPIRY-PLACEHOLDER-PAYMENT-CHECK', [A + 'app/api/billing/credits/check-expired/route.ts', A + 'app/api/__tests__/billing-credits-check-expired.route.test.ts'],
      'The route answers 501 and cancels nothing: it asked a placeholder that always answered "no payment method", so a page load by any steward cancelled a trial that had one. Test disclosure: the three tests that asserted the placeholder behaviour were replaced by one that asserts the 501 and that no trial is expired.'),
    item('DEF-0B12-PLT-TRIAGE-GRANT-APPLIES-THE-CASE-ELIGIBILITY-TEST-TO-A-MESSAGES-DESIGNATION', [A + 'lib/triage/designations.ts', A + 'app/api/triage-designations/route.ts', A + 'app/api/__tests__/triage-designations.route.test.ts'],
      'A messages designation is judged as a conversation assignee (live membership with a conversation-assignee role); only a cases designation uses the case-assignee test.'),
    item('DEF-0B9-ML-SLA-LIST-GET-SKIPS-THE-FEATURE-GATE-AND-SAFETY-CHECK-THE-POST-APPLIES', [A + 'app/api/ml/predictions/sla-breach-risk/route.ts', A + 'app/api/__tests__/ml-sla-breach-risk.route.test.ts', CONTRACT],
      'The list is read at the steward floor behind the same AI feature gate and safety check as the POST, and reads nothing when the gate refuses.'),
    item('DEF-0B7-PLT-EXT-GET-RETURNS-WHOLE-INTEGRATION-ROW-WITH-CREDENTIALS', [A + 'app/api/extensions/[id]/route.ts', A + 'app/api/__tests__/extensions-item.route.test.ts'],
      'The item read is an administrator\'s and, like the PATCH response, omits the credentials document and the SFTP host, port and path.'),
    item('DEF-0B3-BARGAINING-NOTES-SUMMARY-MODES-IGNORE-CONFIDENTIALITY', [A + 'app/api/bargaining-notes/route.ts', A + 'app/api/__tests__/cbas-bargaining-notes.route.test.ts', CONTRACT],
      'The special summary views use the same confidentiality policy as the list, which shows only public and internal notes (upstream\'s change); an existing test covers the list and a source contract pins the summary modes.'),
    item('DEF-0B3-BARGAINING-NOTE-ITEM-ROUTE-BYPASSES-CONFIDENTIALITY', [A + 'app/api/bargaining-notes/[id]/route.ts', CONTRACT],
      'The item read applies the same confidentiality filter (upstream\'s change). Only a source contract pins it; the item route has no behavioural test.'),
    item('DEF-0B4-CBAS-DETAIL-EMBEDS-INTERNAL-NOTES-FOR-MEMBERS', [A + 'app/api/cbas/[id]/route.ts', A + 'app/api/__tests__/cbas-bargaining-notes.route.test.ts'],
      'The agreement detail embeds only the notes the caller may see and keeps privileged notes from other members (upstream\'s change, existing test).'),
    item('DEF-0B4-CARBON-VALIDATE-ATTESTS-CALLER-DATA', [A + 'app/api/carbon/validate/route.ts', CONTRACT],
      'Claim validation answers 501: no claim is assessed and no certification outcome is given. The dashboard and infrastructure routes do the same.'),
    item('DEF-0B4-CLC-SYNC-LOG-MEMBER-READ-AND-FORGEABLE-VERIFICATION', [A + 'app/api/clc/sync/route.ts', FACADES],
      'The sync-log facade answers 501; its table is no longer reachable through a generic route (batches B09 and B15).'),
    item('DEF-0B10-PEN-RETIREMENT-ELIGIBILITY-LISTS-EVERY-PENSION-ENROLMENT-OF-THE-ORGANIZATION-TO-ANY-MEMBER', [A + 'app/api/pension/retirement-eligibility/route.ts', A + 'app/api/__tests__/pension-retirement-eligibility.pglite.test.ts'],
      'The list needs an officer, returns an allow-listed projection, is bound to the organization and records who read it, proven on real SQL (upstream\'s change).'),
    item('DEF-0B10-PEN-PORTAL-DOCUMENT-LIST-RETURNS-EVERY-PAGE-ROW-AND-IGNORES-ROLE-AND-AUTH-COLUMNS', [A + 'app/api/portal/documents/route.ts', FACADES],
      'The portal document list answers 501 (batch B15): it was the generic factory over every CMS page.'),
    item('DEF-0B10-PEN-PORTAL-POST-LETS-A-STEWARD-SET-STATUS-PUBLISHED-AND-ACCESS-COLUMNS-AROUND-THE-EDITORIAL-WORKFLOW', [A + 'app/api/portal/documents/upload/route.ts', FACADES],
      'The portal upload answers 501 (batch B15), so no steward can publish or set access columns through it.'),
    item('DEF-0B11-PRP-REWARDS-EXPORT-RETURNS-EVERY-MEMBER-LEDGER-AWARD-AND-BUDGET-ROW-TO-ANY-MEMBER', [A + 'app/api/rewards/export/route.ts', A + 'app/api/__tests__/rewards-export.route.test.ts'],
      'The export is an administrator\'s, refuses a member before any query, is audited with the file, bounded and formula-safe (upstream\'s change, existing test).'),
    item('DEF-0B11-SOC-ANY-AUTHENTICATED-USER-SENDS-AN-UPLOADED-FILE-TO-TYPED-ADDRESSES-THROUGH-THE-ORGANIZATION-SIGNATURE-PROVIDER-ACCOUNT', [A + 'app/api/signatures/documents/route.ts', A + 'app/api/__tests__/signatures-documents.route.test.ts'],
      'Sending needs a steward, bounds the upload and the signer list, and every platform signer must be an active member of the organization (upstream\'s change, existing tests).'),
    item('DEF-0B7-PLT-EVENT-ITEM-IGNORES-PRIVATE-VISIBILITY-AND-RETURNS-MEETING-PASSWORD', [A + 'app/api/events/[id]/route.ts', A + 'app/api/calendar/events/[id]/route.ts', A + 'app/api/__tests__/hs-calendar-tenant-privacy.contract.test.ts'],
      'The event item routes delegate to the canonical calendar item, which applies owner, visibility and tenant predicates and selects no meeting password (upstream\'s change, existing contract test).',
      { status: 'PARTIAL', remaining: 'The privacy test is a source contract; there is no real-SQL test of a private event read by a non-owner.' }),
    item('DEF-0B8-FED-LOCALS-READABLE-AT-MEMBER-FLOOR-WITH-NOTES-AND-OFFICER-IDS', [A + 'app/api/locals/route.ts', FACADES],
      'The locals facade answers 501 (batch B15).'),
    item('DEF-0B7-PLT-EQUITY-READS-RETURN-PRIVATE-SEGMENTS-TO-ANY-MEMBER', [A + 'app/api/equity/monitoring/route.ts', FACADES],
      'The equity routes answer 501 (batch B09), so no private segment is returned to anyone.'),
    item('DEF-0B12-CRUD-SUPPORT-TICKET-ITEM-ROUTES-LET-A-STEWARD-REWRITE-AND-AN-ADMIN-DELETE-ANY-USER-NOTIFICATION', [A + 'app/api/support/tickets/[id]/route.ts', FACADES],
      'The support-ticket item routes answer 501 (batch B09); they were the notification factory.'),
    item('DEF-0B10-ORG-CARD-COUNTS-ELECTION-RESULT-AND-CAMPAIGN-STATUS-ARE-CALLER-ASSERTED-WITH-NO-CARD-RECORDS', [A + 'app/api/organizing/card-check/route.ts', FACADES],
      'The card-check and support-percentage routes answer 501 (batch B09); nothing caller-asserted is stored as a result.'),
    item('DEF-0B10-ORG-ITEM-ROUTES-NAMED-FOR-NOTE-ENROLMENT-SEQUENCE-AND-ASSIGNMENT-REWRITE-OR-ARCHIVE-WHOLE-CAMPAIGN', [A + 'app/api/organizing/notes/[id]/route.ts', FACADES],
      'The note, sequence, enrolment and assignment item routes answer 501 (batch B09), so none can rewrite or archive a campaign.'),
    item('DEF-0B10-ORG-ASSIGNMENT-IS-LEAD-ORGANIZER-AND-TEAM-COLUMNS-WRITABLE-WITH-UNVERIFIED-USER-IDS', [A + 'app/api/organizing/assignments/route.ts', FACADES],
      'The assignment routes answer 501 (batch B09); no lead-organizer or team column is writable through them.'),
    item('DEF-0B9-ORG-ROSTER-POST-STEWARD-GRANTS-ANY-ORGANIZATION-ROLE-TO-ANY-USER-ID-WITHOUT-ACCEPTANCE', [A + 'app/api/organizations/[id]/members/route.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts'],
      'A steward may add a member only as a pending membership at the member role, proven on real SQL (upstream\'s change, existing test).'),
    item('DEF-0B9-ORG-ORGANIZATION-ROW-FACADES-RETURN-WHOLE-ORGANIZATION-ROW-AT-STEWARD-OR-ADMIN-FLOOR', [A + 'app/api/organizations/[id]/children/route.ts', A + 'app/api/__tests__/organization-directory-privacy.contract.test.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts'],
      'The organization facades return projected fields, require read authority and expose membership totals and contact details only to administrative readers (existing contract and real-SQL tests).'),
    item('DEF-0B9-ORG-ANALYTICS-ZERO-AND-HUNDRED-PERCENT-DEFAULTS-MEMBER-FLOOR-AND-NO-GROUP-SIZE-SUPPRESSION', [A + 'app/api/organizations/[id]/analytics/route.ts'],
      'Analytics are officer-level and an undefined rate is null rather than 0 or 100 (batch B11).',
      { status: 'PARTIAL', remaining: 'No small-group suppression threshold is applied to counts and rates.' }),
    item('DEF-0B10-PEN-BENEFIT-CLAIMS-CAN-BE-FILED-BUT-NO-ROUTE-CAN-DECIDE-OR-PAY-THEM', [A + 'app/api/pension/benefits/route.ts'],
      'A claim is always filed as pending and carries no decision, and a member reads only their own claims (upstream\'s change).',
      { status: 'PARTIAL', remaining: 'There is still no trustee decision or payment workflow: a filed claim cannot be approved, denied or paid.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B21 added')

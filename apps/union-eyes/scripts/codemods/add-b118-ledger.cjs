const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B118-F06-R7-WORKBOOK-CAPABILITY-AND-NATIVE-GRANTS',
  family: 'F06 R7: an unclaimed workbook is reached by a capability, not its identifier, and its path works under the real roles',
  test: A + 'db/__tests__/workbook-capability.postgres.test.ts',
  previousEvidence: { 'B117-F06-R6-EVIDENCE-AND-REGRESSION-INTEGRITY': '78ffd9204' },
  items: [
    {
      prefix: 'DEF-0B12-WBK-MEMORY-HOLDER-ROUTES-ACCEPT-READS-AND-WRITES-ON-THE-BEARER-ID',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [
        A + 'lib/workbook/workbook-capability.ts',
        A + 'lib/workbook/access-control.ts',
        A + 'db/migrations-platform/0056_workbook_capability.sql',
        A + 'db/migrations-platform/0056_workbook_capability.rollback.sql',
        A + 'db/schema/workbook-schema.ts',
        A + 'app/api/workbook/start/route.ts',
        A + 'app/api/workbook/[id]/claim/route.ts',
        A + 'app/api/workbook/[id]/memory-holders/route.ts',
        A + 'app/api/workbook/[id]/memory-holders/[holderId]/route.ts',
        A + 'app/[locale]/workbook/[id]/memory-holders/page.tsx',
        A + 'app/[locale]/workbook/start/page.tsx',
        A + 'app/[locale]/workbook/start/WorkbookStartClient.tsx',
        A + 'db/rls-storage-authority/reference-latent.ts',
        A + 'lib/operations/catalog-authority-contract.json',
        A + 'lib/workbook/__tests__/workbook-capability.test.ts',
        A + 'lib/workbook/__tests__/access-control.test.ts',
        A + 'app/api/__tests__/workbook-memory-holders.route.test.ts',
        A + 'lib/services/__tests__/s57-f06-r7-workbook-capability.test.ts',
      ],
      explanation: 'The last open part of the defect, the identifier as the credential, is closed. An unclaimed workbook now has a separate bearer capability (hash and expiry, migration 0056; the token is returned once at start with an HttpOnly cookie) and every memory-holder read, write, change and removal, and the server-rendered page, require it; a missing, wrong, expired or never-issued capability answers as a workbook that is not there. The claim removes it in the claim\'s own statement and clears the cookie. The memory-holder page, which read the people and their notes directly with no authority and no record, now runs through the same boundary and records the read first. The /workbook/start page inserted workbooks on a plain GET with no limit, challenge or capability; it now renders a control that calls the guarded start API. Natively the system role under which the unclaimed path runs held no INSERT on workbooks and no privilege on workbook_modules or workbook_memory_holders, so none of it could operate; the manifest now declares what the path needs and a native test on PG15 and PG16 proves start, read, add, change and remove under the system role, the consistent capability pair, the claim clearing it, and a tenant role seeing nothing. Replaced tests, disclosed: the access-control "allows an unclaimed workbook via the bearer id alone" test (now capability-gated, with refusal cases), the memory-holder route tests\' preclaim fixtures (the capability predicate is a seam there, proven for real in access-control and capability tests), and the two route tests that pinned the boundary arguments.',
      remaining: 'The display name (255) and notes (4000) bounds are unchanged: they are bounded, behind the capability, recorded, and subject to the unapproved notice policy. PUBLIC_INTAKE_AUDIT_KEY must be provisioned or the page and routes fail closed. Unclaimed workbooks created before migration 0056 have no capability and can no longer be reached by identifier; claiming them by claim token is unaffected. A capability is held by the browser that started the workbook, so it is not usable from another browser. Migrations 0054, 0056 and cache 0044 are unqualified in a deployment environment, and the manifest grants reach a database only through the bootstrap.',
    },
  ],
})

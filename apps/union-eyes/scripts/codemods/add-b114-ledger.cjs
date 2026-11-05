const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B114-F06-R3-PSEUDONYMOUS-WORKBOOK-AUDIT',
  family: 'F06 R3: durable audit evidence for pseudonymous workbook access and mutation',
  test: A + 'lib/public-intake/__tests__/intake-audit.test.ts',
  previousEvidence: { 'B113-F06-R2-REPORT-FIELD-AUTHORITY': '84fc8ef23' },
  items: [
    {
      prefix: 'DEF-0B12-WBK-MEMORY-HOLDER-ROUTES-ACCEPT-READS-AND-WRITES-ON-THE-BEARER-ID',
      status: 'PARTIAL',
      files: [
        A + 'db/migrations-platform/0054_public_intake_audit_events.sql',
        A + 'db/migrations-platform/0054_public_intake_audit_events.rollback.sql',
        A + 'db/migrations-cache/0044_public_intake_audit_events_rls_closure.sql',
        A + 'db/migrations-cache/0044_public_intake_audit_events_rls_closure.rollback.sql',
        A + 'db/schema/domains/infrastructure/public-intake-audit.ts',
        A + 'db/rls-storage-authority/reference-latent.ts',
        A + 'lib/public-intake/intake-audit.ts',
        A + 'lib/workbook/claimed-write-audit.ts',
        A + 'app/api/workbook/[id]/memory-holders/route.ts',
        A + 'app/api/__tests__/workbook-memory-holders.route.test.ts',
        A + 'app/api/workbook/[id]/memory-holders/__tests__/route.test.ts',
        A + 'db/__tests__/migration-0054-public-intake-audit-events.postgres.test.ts',
        A + 'db/__tests__/rls-storage-authority-registry-composition.test.ts',
      ],
      explanation: 'Pseudonymous audit authority: reads, creates, updates and deletes of the people an unclaimed workbook names are now recorded in a deliberately scoped, platform-level, append-only store (platform 0054, cache 0044, SYSTEM_ONLY, system role SELECT and INSERT only, UPDATE/DELETE/TRUNCATE refused by trigger). No organization, actor or consent is invented: the subject is a keyed HMAC of the bearer identifier (the identifier itself is never written; without PUBLIC_INTAKE_AUDIT_KEY nothing can be recorded and the surface fails closed), details are limited to field names and counts so a typed name, role or note is never evidence, and one subject\'s events form a hash chain whose fork is also refused by a unique index. A read is recorded before the data is read, in the same transaction, and a mutation commits with its record; if the record cannot be written the read or write does not happen. Claimed workbooks keep their ownership and role controls and now also record reads (previously only writes) under the claiming organization and the acting person. Native PostgreSQL 15 and 16 prove the migrations (twice, rollback and re-apply), the role boundary, concurrent writers on separate connections not forking a chain, and that the verifier catches a rewritten event and a removed middle event.',
      remaining: 'The workbook identifier is still the bearer credential and still travels in the start response and in page and checkout redirect URLs (there is no separate capability as ICRA has), and a display name and notes of up to 4,000 characters are still accepted. The verifier cannot see removal of the newest events without a head recorded outside the writer. PUBLIC_INTAKE_AUDIT_KEY must be provisioned before the surface can operate. Migrations 0054 and 0044 are unqualified in a deployment environment.',
    },
  ],
})

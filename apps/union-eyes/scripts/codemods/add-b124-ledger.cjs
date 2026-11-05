const fs = require('fs')
const path = require('path')
const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
const root = path.resolve(__dirname, '../../../../')

const clauseCore = [
  A + 'db/migrations-cache/0050_clause_library_sharing_functions_retired.sql',
  A + 'db/migrations-cache/0050_clause_library_sharing_functions_retired.rollback.sql',
  A + 'lib/clause-library/sharing-authority.ts',
  A + 'app/api/clause-library/route.ts',
  A + 'app/api/clause-library/search/route.ts',
  A + 'app/api/clause-library/compare/route.ts',
  A + 'app/api/clause-library/[id]/route.ts',
  A + 'db/rls-storage-authority/reference-latent.ts',
  A + 'db/rls-storage-authority/governance.ts',
  A + 'db/__tests__/clause-library-visibility.postgres.test.ts',
  A + 'lib/clause-library/__tests__/sharing-authority.test.ts',
  A + 'lib/clause-library/__tests__/source-projection.test.ts',
  A + 'app/api/__tests__/precedents-item-isolation.pglite.test.ts',
  A + 'app/api/__tests__/clause-library-compare.route.test.ts',
  A + 'app/api/__tests__/clause-library-audit.route.test.ts',
  A + 'app/api/__tests__/clause-library-anonymization.contract.test.ts',
  A + 'app/api/clause-library/[id]/__tests__/route.test.ts',
  A + 'app/api/clause-library/[id]/share/__tests__/route.test.ts',
  A + 'app/api/clause-library/[id]/tags/__tests__/route.test.ts',
]

const scimCore = [
  A + 'db/migrations-platform/0059_scim_provisioned_users.sql',
  A + 'db/migrations-platform/0059_scim_provisioned_users.rollback.sql',
  A + 'db/migrations-cache/0051_scim_provisioned_users_rls_closure.sql',
  A + 'db/migrations-cache/0051_scim_provisioned_users_rls_closure.rollback.sql',
  A + 'db/schema/sso-scim-schema.ts',
  A + 'db/rls-storage-authority/reference-latent.ts',
  A + 'db/rls-storage-authority/baseline-0108.ts',
  A + 'lib/scim/provisioned-members.ts',
  A + 'lib/scim/events-log.ts',
  A + 'lib/scim/user-operations.ts',
  A + 'app/api/scim/v2/[organizationId]/Users/route.ts',
  A + 'app/api/scim/v2/[organizationId]/Users/[id]/route.ts',
  A + 'lib/scim/__tests__/scim-pglite.ts',
  A + 'lib/scim/__tests__/provisioned-members.test.ts',
  A + 'app/api/__tests__/scim-users.route.test.ts',
  A + 'app/api/__tests__/scim-user-by-id.route.test.ts',
  A + 'lib/services/__tests__/s44-gate0-pg-migrations.test.ts',
]

for (const f of [...clauseCore, ...scimCore]) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)

addBatch({
  id: 'B124-F03-ADMISSION-REDESIGN-CLAUSE-SHARING-AND-SCIM-DIRECTORY',
  family: 'F03-B and F03-C redesign: the catalog admission contract refuses SECURITY DEFINER functions executable by the runtime or system role, so the clause sharing rule and the SCIM store are rebuilt without them',
  test: A + 'db/__tests__/scim-provisioning.postgres.test.ts',
  previousEvidence: { 'B123-F03-C-SCIM-USER-LIFECYCLE': 'bb1b76633' },
  items: [
    {
      prefix: 'DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: clauseCore,
      explanation:
        'B124 CORRECTION of the F03-B account above, which described a design that was refused and is retired. The database functions public.ue_clause_readable_by, ue_clause_federation_ancestor, ue_clause_congress_eligible and ue_clause_source_name (cache 0048) are SECURITY DEFINER functions executable by the tenant runtime role, which the catalog admission contract refuses (a fresh combined bootstrap on PostgreSQL 15 and 16 stopped at its privilege preflight, which the earlier native tests missed because they applied the migrations directly). Cache 0050 drops them and the two policies that called them, with a rollback that restores the 0048 objects. The rule is now stated once, without any function: an organization reads a clause it owns, a clause at the public level, and a private clause that names it in the explicit grant list. That is exactly what the unchanged tenant policies of cache 0011 and 0012 admit, and lib/clause-library/sharing-authority.ts (the item rule canReadSharedClause and the list predicate buildClauseVisibilityCondition) repeats it, so the list, search, compare, item and tags reads still run as the tenant and cannot disagree with the policy. The federation and congress levels are owner-only (fail closed) and the create, update and share routes refuse to set them with a 403, so a clause is never marked as shared with a group that cannot read it. The name of the owning organization of a clause the caller may read, and whose source the projection discloses, is read by id on the system role (sourceNamesFor); the ids come only from rows the tenant policy returned, so it is not a directory of organizations. Re-proven on native PostgreSQL 15 and 16 (twelve tests: the unmodified list route for four organizations against a written-out expectation, the list equal to the item rule on every pair, a stranger reading only what is public, the federation and congress levels readable by the owner alone, the tenant runtime role reading exactly what the rule allows with no application predicate, tags following the clause, no ue_clause_ function left and no SECURITY DEFINER function executable by a business role, the owner name read by id, and the refused share not stored) and by the enforced catalog admission preflight on both versions (ADMITTED, 874 manifest entries). Replaced or adapted tests, disclosed: sharing-authority.test.ts and clause-library-visibility.postgres.test.ts were rewritten for the function-free rule, precedents-item-isolation.pglite.test.ts dropped the 0048 function fixture and strengthened the federation and congress refusal, and the route tests, mocks and header comments that named the removed functions were corrected. The congress_memberships manifest entry no longer lists the clause routes as its readers, because none reads it any more.',
      remaining:
        'Anonymisation of clause free text, real HTTP response checks and independent review are outstanding. No other organization can read a federation- or congress-level clause: that capability is withheld, not reconciled, until an approved way to evaluate another organization hierarchy exists (an affiliation projection kept by trigger functions that nobody can execute, or an approved bounded-owner definer; neither is built and the prerequisite is recorded, not invented). The congress_memberships runtime SELECT grant now has no caller and stays until that decision is made. The frozen 0B4 register still describes the routes as system-role reads; it is a historical record and is not rewritten. No CLOSED credit.',
    },
    {
      prefix: 'DEF-0B4-CLAUSE-LIBRARY-FEDERATION-PREDICATES-DISAGREE',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: clauseCore,
      explanation:
        'The two predicates the finding names no longer exist. The nearest-federation-ancestor test of the item rule and the anywhere-in-the-path test of the list predicate were both removed with the federation and congress levels (cache 0050, lib/clause-library/sharing-authority.ts), so the list, search, compare, item and tags reads apply one rule that is also the tenant row policy, and a nested federation can no longer make them differ. The native test compares the list result with the item rule for every pair of organizations and clauses over a fixed hierarchy (a federation with two locals, a local outside it, a local of another federation, congress members and a non-member) on PostgreSQL 15 and 16, and shows that no hierarchy path or congress membership changes what an organization may read; the unit tests pin the single rule and the refusal to set an unavailable level.',
      remaining:
        'The disagreement is removed by withholding the federation and congress levels (owner-only), not by deciding what a nested federation should mean: that semantic, and the capability of sharing within a federation or congress, remain an institutional decision and unbuilt engineering. Real HTTP checks and independent review are outstanding. No CLOSED credit.',
    },
    {
      prefix: 'DEF-0B11-IDS-SCIM-ROUTE-HAS-NO-BEARER-AUTHENTICATION',
      status: 'PARTIAL',
      files: scimCore,
      explanation:
        'B124 CORRECTION of the F03-C account above: the eight SECURITY DEFINER functions of cache 0049 were refused by the catalog admission contract in the same way, and cache 0051 drops them (that retirement is one-way: rolling back 0049 restores them). A provisioned person is no longer a row of the membership table, because the system role holds no INSERT on organization_members and widening it was refused. The people an identity provider provisions are rows of their own directory, public.scim_provisioned_users (platform 0059, rollback shipped: id, organization, configuration, userName and its lower-case key, externalId, name, e-mail, status, the deprovision fields and a soft delete), which only the system role reaches (select, insert and update, no delete) under forced row security. Provisioning, listing, reading, updating and deprovisioning are plain statements in the system transaction of the caller; inside it the configuration row is locked with FOR SHARE so a disabled or removed stream cannot write, and advisory locks make concurrent calls deterministic. The Django stub scim_events_log is evolved (platform 0059: the missing columns, defaults, constraints and an index) and every created, updated and deleted event now writes one row with no body, the path without its query string and a truncated address, append-only for the system role (select and insert). Proven on native PostgreSQL 15 and 16 (seventeen tests against the real tables, the real routes, real token authentication and the system role), and the migrations 0051, 0059 and 0050 were rolled back in that order and then applied forward twice on both versions by hand (the 0051 rollback leaves the 0049 functions retired by design; a run by hand, not a committed test), after which the enforced catalog admission preflight admitted both. Replaced tests, disclosed: provisioned-members.test.ts, scim-users.route.test.ts and scim-user-by-id.route.test.ts were rewritten for the directory (they pinned the removed functions and the roster rows), a new PGlite helper applies the real 0059 migration unmodified, and s44-gate0-pg-migrations.test.ts now pins the machine-credential declaration of the route and the token check in lib/scim/route-support.ts instead of an inline call that the F03-C refactor had already moved.',
      remaining:
        'The attribute mapping is stored but not consumed. There is no Groups resource: mapping identity-provider groups to roles is an institutional authority decision that is not made (a role in a SCIM payload is refused today). A provisioned person is not linked to an account (see the sibling defect). Real HTTP acceptance and independent review are outstanding. No CLOSED credit.',
    },
    {
      prefix: 'DEF-0B11-IDS-SCIM-PROVISION-STORES-THE-USERNAME-STRING-AS-THE-USER-ID',
      status: 'PARTIAL',
      files: scimCore,
      explanation:
        'B124: the userName is no longer stored as a membership user id at all. A provisioned person is a row of the identity-provider directory (public.scim_provisioned_users) that keeps the identity-provider subject (externalId) and the userName as separate fields, in the status pending, never active, with no role and no link to any account, so the identifier of an existing user of another organization can no longer make that user a member of this one, and no row of organization_members is written. A removed person with the same userName is revived in place (reprovisioned) instead of answering 409, one live person per userName and per externalId is a partial unique index of the database (not only an advisory lock), and a name or e-mail the identity provider did not send is stored as null, never as the userName.',
      remaining:
        'A provisioned person is not yet linked to that person own account, so a provisioned person has no access until a linking and acceptance rule exists. An e-mail match is deliberately not that rule (users/me/organizations documents why), and the identity-provider federation that would carry a verified subject is not implemented. The open decision is recorded as the blocked operation UE-INST-SCIM-PROVISIONING-CREDENTIAL-AND-DEPROVISIONING-AUTHORITY (SCIM_MEMBER_LINK) and is not invented. No CLOSED credit.',
    },
    {
      prefix: 'DEF-0B11-IDS-SCIM-LIST-INCLUDES-REMOVED-MEMBERS',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: scimCore,
      explanation:
        'B124: the list and its count are statements on the directory instead of functions: live rows only (deleted_at is null, so a person removed by the delete action is not listed), paged in SQL, with the same bounded startIndex and count and the same two supported filters (userName eq and externalId eq; anything else is a 400 invalidFilter). Every listed person is reported as not active, because a provisioned person is never active before a link and acceptance rule exists.',
    },
    {
      prefix: 'DEF-0B11-IDS-SCIM-PROVISION-BODY-IS-UNVALIDATED',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: scimCore,
      explanation:
        'B124: the provisioning route bounds its body with a schema (userName 1 to 320 characters, externalId 1 to 255, name parts at most 100, at most ten e-mail values each a valid address of at most 320), so malformed or oversized input is a 400 naming the field and nothing reaches the database. Status unchanged; this records that the check survived the move to the directory.',
    },
  ],
})

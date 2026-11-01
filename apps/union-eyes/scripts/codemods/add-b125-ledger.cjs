const fs = require('fs')
const path = require('path')
const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
const root = path.resolve(__dirname, '../../../../')

const scorer = [
  A + 'lib/utils/smart-onboarding.ts',
  A + 'lib/clause-library/sharing-authority.ts',
  A + 'lib/clause-library/source-projection.ts',
  A + 'app/api/onboarding/suggest-clauses/route.ts',
  A + 'lib/__tests__/smart-onboarding.test.ts',
  A + 'db/__tests__/clause-suggestions.postgres.test.ts',
  A + 'db/__tests__/federation-discovery.postgres.test.ts',
]

const reads = [
  A + 'app/api/clause-library/route.ts',
  A + 'app/api/clause-library/search/route.ts',
  A + 'app/api/clause-library/compare/route.ts',
  A + 'app/api/clause-library/[id]/route.ts',
  A + 'lib/clause-library/source-projection.ts',
  A + 'lib/clause-library/sharing-authority.ts',
  A + 'lib/utils/smart-onboarding.ts',
  A + 'lib/clause-library/__tests__/source-projection.test.ts',
  A + 'app/api/clause-library/[id]/__tests__/route.test.ts',
  A + 'app/api/__tests__/clause-library-anonymization.contract.test.ts',
  A + 'db/__tests__/clause-suggestions.postgres.test.ts',
  A + 'db/__tests__/clause-library-visibility.postgres.test.ts',
]

const withdrawn = [
  A + 'lib/clause-library/sharing-authority.ts',
  A + 'app/api/clause-library/[id]/route.ts',
  A + 'app/api/clause-library/[id]/share/route.ts',
  A + 'components/clause-library/ClauseSharingControls.tsx',
  A + 'components/clause-library/__tests__/clause-sharing-controls.test.tsx',
  A + 'lib/clause-library/__tests__/sharing-authority.test.ts',
  A + 'app/api/clause-library/[id]/__tests__/route.test.ts',
  A + 'app/api/clause-library/[id]/share/__tests__/route.test.ts',
  A + 'lib/utils/smart-onboarding.ts',
]

for (const f of [...scorer, ...reads, ...withdrawn]) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)

// An item already in the ledger keeps only the remaining text it is given again, so the text of the earlier batch is restated.
const systemRoleRemaining =
  'Anonymisation of clause free text, real HTTP response checks and independent review are outstanding. No other organization can read a federation- or congress-level clause: that capability is withheld, not reconciled, until an approved way to evaluate another organization hierarchy exists (an affiliation projection kept by trigger functions that nobody can execute, or an approved bounded-owner definer; neither is built and the prerequisite is recorded, not invented). The congress_memberships runtime SELECT grant now has no caller and stays until that decision is made. The frozen 0B4 register still describes the routes as system-role reads; it is a historical record and is not rewritten. No CLOSED credit.'
const predicatesRemaining =
  'The disagreement is removed by withholding the federation and congress levels (owner-only), not by deciding what a nested federation should mean: that semantic, and the capability of sharing within a federation or congress, remain an institutional decision and unbuilt engineering. Real HTTP checks and independent review are outstanding. No CLOSED credit.'

addBatch({
  id: 'B125-F03-B-FEDERATION-AND-CONGRESS-LEVELS-WITHDRAWN-EVERYWHERE',
  family: 'F03-B follow-through: the federation and congress sharing levels are withdrawn everywhere they were offered, scored or enforced, so no surface describes a group that cannot read the clause',
  test: A + 'db/__tests__/clause-suggestions.postgres.test.ts',
  previousEvidence: { 'B124-F03-ADMISSION-REDESIGN-CLAUSE-SHARING-AND-SCIM-DIRECTORY': 'aa40c0e14' },
  items: [
    {
      prefix: 'DEF-0B9-ASM-CLAUSE-RELEVANCE-SCORES-SHARING-LEVELS-AND-SOURCE-NAMES-THAT-THE-ROW-LEVEL-POLICIES-WITHHOLD',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: scorer,
      explanation:
        'B125: every element of the finding is removed in suggestRelevantClauses. It no longer reads through the shared database client (which, outside a context, reads nothing under row security, so an unrecognised organization or an empty list depended on the connection role): the organization and the clauses are read as the caller tenant, so the candidates are exactly what the row policy shows (an organization own clauses, public clauses and private clauses that name it), repeated by the same visibility predicate the clause routes use, and the organization own clauses are excluded because suggesting a clause back to its owner is no suggestion. The 40-point federation and 50-point congress weights and their reasons are gone, because no other organization can read a clause at those levels; the weights now fall on what can occur, a public clause (20) and a clause shared with the organization (40, reason Shared with your organization), and a row at any other level is dropped even if one reached the code. The constant sector and province bonuses are gone, with their reasons: the sector and province are filters, so every row matched and the bonus ranked nothing. The source name no longer comes from the organization relation that resolved to Unknown for every organization but the caller: it is read by id on the system role for the clauses whose source the projection may disclose, and a clause that is anonymized or unclassified is labelled Another organization (source not disclosed) and never named and never described as coming from a parent (an organization that has parents is also offered only non-anonymized clauses of those parents, because being drawn from them would itself say where a clause comes from). Two defects in the same function are corrected with it, disclosed: the hierarchy path runs from the root to the organization itself, so the old proximity formula gave the farthest ancestor the highest score against its own comment (the nearest parent now scores most), and a root organization, whose path holds only itself, was offered only its own clauses (an organization without parents is now offered every clause it may read). Proven on native PostgreSQL 15 and 16 under the real row policies and roles (seven tests, run twice on a reused database: parents and shared-with-me clauses ranked, nothing hidden by the policy at any level, no anonymized clause drawn from the parents, sources named only where they may be, an organization without parents, the federation and congress levels suggested to no one, and the system role has no read on the clause table) and by 15 unit tests of the scoring. Replaced tests, disclosed: the unit tests of suggestRelevantClauses were rewritten (five of them pinned federation-shared above public, congress highest, the hierarchy proximity formula and the sector and province bonuses, which is the behavior the finding calls fabricated, and the others read the removed relation mock), and the three branch tests and the three onboarding orchestration tests that fed the old mocks were adapted to the tenant read. The native test also removes what it inserts, and federation-discovery.postgres.test.ts now does too (its result limit made it fail on a reused database).',
      remaining:
        'Real HTTP response checks and independent review are outstanding. Whether the sector and province should be soft ranking factors instead of filters is a product decision that is not made (they are filters today, as before). An organization that has parents is still offered only its parents clauses and not its peers, as before. The other functions of smart-onboarding.ts (peer benchmarks, smart defaults and the federation directory discovery) are separate defects and are not changed here. No CLOSED credit.',
    },
    {
      prefix: 'DEF-0B4-CLAUSE-LIBRARY-ANONYMIZATION-NOT-ENFORCED-ON-READ',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: reads,
      explanation:
        'Every read of a shared clause now withholds what the finding names. The item read returns originalEmployerName only to the owner or when the clause is explicitly not anonymized (is_anonymized false), so a null or true flag withholds it, and returns the creator user id to the owner only; the list, search and compare reads select neither field; and every one of the four reads (list, search, compare, item) and now the onboarding suggestions return the owning organization only through the source projection (an anonymized or unclassified clause of another organization names no source organization id and no name), with the name read by id for the disclosable ones. The suggestion read was the last path that still returned the owning organization name whatever the flag said; B125 closes it (native proof on PostgreSQL 15 and 16: an anonymized clause is never named, never described as coming from a parent, and is not even drawn from the parents). Attribution is preserved: the item read and the list were credited earlier by the run GATE0-CLAUSE-SHARING-ANONYMIZATION (regression test clause-library-anonymization.contract.test.ts), the creator id by B70, the search and compare projections by B99, and B124 moved the owner name lookup off the relation the tenant cannot read; this batch records the last path and the verification that no read path remains.',
      remaining:
        'The text of an anonymized clause is not scrubbed: a clause that names its employer in its own words still discloses it, and no redaction of free text exists. Whether an owner marked a clause anonymized correctly is the owner decision. Real HTTP response checks and independent review are outstanding. No CLOSED credit.',
    },
    {
      prefix: 'DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: withdrawn,
      explanation:
        'B125: the onboarding clause suggestions, which read the library through the shared client outside any tenant context, now read as the caller tenant by the same rule, so no read of the clause library depends on the connection role. The sharing change is judged against the level the clause already has (sharingChangeDenial takes the current level, after the ownership check, inside the tenant transaction), so a clause stored at the federation or congress level before they were withdrawn is not locked: its owner can still edit it, and a non-owner who tries gets the not-found answer instead of learning about the sharing rule. The sharing dialog (ClauseSharingControls) no longer offers Federation and Congress as selectable levels (they are shown disabled with the reason), tells the owner of a clause stored at one of them that only their organization sees it, and no longer promises congress-wide access in its privacy notice. Replaced or adapted tests, disclosed: the PATCH and share route tests pinned the denial before the ownership check and now pin the new order (and the owner-success share test uses the public level instead of the withdrawn federation level), a new component test (five tests) covers the dialog, and sharing-authority.test.ts gained the unchanged-level cases.',
      remaining: systemRoleRemaining,
    },
    {
      prefix: 'DEF-0B4-CLAUSE-LIBRARY-FEDERATION-PREDICATES-DISAGREE',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: withdrawn,
      explanation:
        'B125: a third federation rule is removed with the others. The onboarding scorer weighted federation and congress clauses by hierarchy; it now applies the one rule (public, shared with the organization, owner), so every surface that reads, lists, searches, compares, suggests or offers a sharing level agrees on which levels reach another organization.',
      remaining: predicatesRemaining,
    },
  ],
})

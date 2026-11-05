# Gate 0 engineering evidence — clause-library source attribution

Defect: `DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS`. Batch: `B99-CLAUSE-LIBRARY-SOURCE-ATTRIBUTION`.

Source correction: list, search and compare now use `clauseSourceProjection` to suppress the source organization's identifier and name for anonymized or unclassified clauses read by a different organization. Search and compare select `isAnonymized` explicitly. The owner still sees its source attribution. Unanonymized content is still governed by the existing sharing predicate, not by this projection.

Regression coverage: `apps/union-eyes/lib/clause-library/__tests__/source-projection.test.ts` exercises owner, cross-tenant anonymized, missing flag, explicit non-anonymized and missing-context behavior, plus the three route integrations by source inspection.

Qualification: source-level changes and test code are authored, but unit/contract, native PostgreSQL 15/16, HTTP/browser and staging acceptance must be run on the final commit. This is **PARTIAL**, not CLOSED; the shared clause body itself is not guaranteed to be anonymized, and system-role authorization must still be qualified against real policies. Frozen defect evidence is unchanged.

Follow-up: the item GET also applies the shared source projection and suppresses the original employer when the anonymization flag is unset; an item-route regression covers this legacy-null state. No additional completion credit or independent qualification is claimed.

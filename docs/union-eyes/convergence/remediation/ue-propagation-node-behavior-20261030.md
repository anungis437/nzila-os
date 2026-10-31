# Gate 0 — propagation unknown-node and organization-context source patch

Defect: `DEF-0B7-COGB-PROPAGATION-UNKNOWN-NODE-ANSWERS-500-AND-ANALYSIS-TYPE-NOT-VALIDATED` (retained as PARTIAL).

The route now refuses absent organization context before invoking the propagation builder and returns an explicit 404 for a requested node that does not exist, including when the organization has zero published interviews. The existing Zod query schema continues to refuse invalid analysis types and unknown parameters. The empty-map informational response remains available when no node is requested.

Regression coverage: `app/api/exit-interviews/propagation/__tests__/route.test.ts` exercises missing organization, invalid query, unknown node with empty/nonempty maps and the legitimate empty response. The static contract was updated to the precise not-found call.

This is a source-only patch. No executable Vitest, PostgreSQL 15/16, HTTP/browser, staging or independent institutional acceptance is claimed. Frozen Gate 0 records are unchanged; no defect is CLOSED.

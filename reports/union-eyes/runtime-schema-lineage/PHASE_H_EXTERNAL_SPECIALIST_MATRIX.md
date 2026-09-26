# Phase H — EXTERNAL_SPECIALIST Grant/Deny Matrix

Generated: 2026-09-23, 5:31:06 p.m. ET
Staging revision target: `nzila-os-union-eyes-staging--0000259`
EXTERNAL_SPECIALIST_BOUNDARY: **PASS**
RLS_CONTEXT_LEAKAGE: **0**
PRODUCTION_TOUCHED: false

## Goal path
EXTERNAL SPECIALIST → PRIMARY AUTH (nzila_session) → ORG A → REPRESENTATION AUTHORITY → MATTER GRANT → DOCUMENT GRANT → HTTP `/api/external/*`

## Matrix
| Case | Expected | Result | HTTP | Leaks |
|---|---|---|---:|---|
| NO_SESSION | DENY | PASS | 401 | 0 |
| LOGIN_EXTERNAL_SPECIALIST | ALLOW_SESSION | PASS | 200 | 0 |
| ORG_CURRENT_SPECIALIST | ALLOW | PASS | 200 | 0 |
| AUTHORIZED_SAME_ORG_MATTER | ALLOW | PASS | 200 | 0 |
| AUTHORIZED_SAME_ORG_DOCUMENT_METADATA_VIEW | ALLOW | FAIL | 403 | 0 |
| AUTHORIZED_SAME_ORG_DOCUMENT | ALLOW | PASS | 200 | 0 |
| AUTHORIZED_GOVERNED_ACTION | ALLOW | PASS | 400 | 0 |
| SAME_ORG_NO_MATTER_GRANT | DENY | PASS | 403 | 0 |
| SAME_ORG_NO_DOCUMENT_GRANT | DENY | PASS | 403 | 0 |
| EXPIRED_GRANT | DENY | PASS | 403 | 0 |
| REVOKED_GRANT | DENY | PASS | 403 | 0 |
| CROSS_ORG_RESOURCE | DENY | PASS | 403 | 0 |
| NO_AUTHORITY | DENY | PASS | 403 | 0 |

## Code citations
- `apps/union-eyes/lib/services/representation-authority-service.ts`
- `apps/union-eyes/lib/services/external-resource-authorization-service.ts`
- `apps/union-eyes/lib/services/external-document-grant-service.ts`
- `apps/union-eyes/lib/external-resource-middleware.ts`
- `apps/union-eyes/lib/external-resource-route-utils.ts`
- `apps/union-eyes/db/schema/representation-authority-schema.ts`
- `apps/union-eyes/app/api/external/grievances/[id]/route.ts`
- `apps/union-eyes/app/api/external/documents/[id]/route.ts`
- `apps/union-eyes/app/api/external/grievances/[id]/documents/upload/route.ts`

## Notes
- Positive proof is HTTP application path (not SQL).
- Seed was targeted upsert only (password hash for specialist, sibling resources, expired/revoked grant rows, document_links).
- Secrets/passwords/DB URLs redacted from artifacts.

## Residual non-critical observation
- `AUTHORIZED_SAME_ORG_DOCUMENT_METADATA_VIEW` (GET `/api/external/documents/[id]`, `view_documents`) returned **403** despite `can_view_documents=true`.
- Document grant positive proof used **download** surface (`download_documents`) which returned **200** with grant and **403** without grant.
- This residual `view_documents` metadata/list quirk is recorded but **does not** reopen EXTERNAL_SPECIALIST as a technical pilot blocker; grant/deny matrix critical cells PASS.

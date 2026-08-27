# 02 - Surface Inventory

## Relevant Product Surfaces

| Surface | Representative Paths | LIUNA Relevance | Evidence Level |
| --- | --- | --- | --- |
| Case/grievance lifecycle | `apps/union-eyes/app/api/cases/**`, `apps/union-eyes/app/api/grievances/**` | Core matter continuity, assignment, status, notes, outcomes | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` |
| Case access delegation | `apps/union-eyes/app/api/grievances/[id]/access/route.ts`, `apps/union-eyes/lib/services/case-access-service.ts` | Restricted collaboration and successor access | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` |
| Organization context and RLS | `apps/union-eyes/lib/db/with-rls-context.ts`, `apps/union-eyes/lib/organization-middleware.ts` | Cross-local and federated access boundary | `TEST_PROVEN` for static contract; not live-proven here |
| Documents and evidence | `apps/union-eyes/app/api/documents/**`, `apps/union-eyes/app/api/evidence/export/route.ts`, `apps/union-eyes/lib/services/document-authorization-service.ts` | Matter record, attachments, exports, confidential evidence | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` |
| Audit history | `apps/union-eyes/lib/audit-logger.ts`, `apps/union-eyes/lib/audited-case-mutations.ts`, `tooling/contract-tests/audit-immutability.test.ts` | Accountability through leadership change | `TEST_PROVEN` for hash/immutability contracts |
| Deadlines | `apps/union-eyes/app/api/deadlines/**`, `apps/union-eyes/lib/deadline-engine/**` | Hearing/grievance/internal obligation continuity | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` |
| Continuity runtime | `apps/union-eyes/lib/runtime/**`, `apps/union-eyes/lib/knowledge-transfer/**`, `apps/union-eyes/app/api/continuity/**` | Institutional memory and successor briefing | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN`; one route has weak guard |
| Onboarding/offboarding | `apps/union-eyes/app/api/onboarding/**`, `apps/union-eyes/lib/runtime/onboarding/**` | Planned/unplanned leadership transition support | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` |
| Reporting and leadership visibility | `apps/union-eyes/app/api/dashboard/**`, `apps/union-eyes/app/[locale]/dashboard/**` | Cross-body trends, workload, overdue work | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` |
| AI/cognition | `apps/union-eyes/app/api/ai/**`, `apps/union-eyes/lib/ai/**`, `apps/union-eyes/lib/knowledge-transfer/**` | Advisory successor briefing and risk summarization | `TEST_PROVEN` for selected unit boundaries; not live-proven |
| Bilingual/mobile | `apps/union-eyes/messages/**`, `apps/union-eyes/app/[locale]/**`, E2E files | Safe circulation to Canadian audiences and field users | `CODE_SUPPORTED_NOT_RUNTIME_PROVEN` |
| Production/runtime readiness | Dockerfile, ACA proof from current readiness roadmap | Recording can state current UE runtime is live/healthy if citing deployment proof | `RUNTIME_PROVEN` only for health/readiness from previous runtime proof, not for LIUNA scenarios |

## Explicit Non-Fit Surfaces

- `packages/cupe-vocabulary/**` is useful as an implementation precedent, not as LIUNA language truth.
- CUPE demo seed routes must not be reused as LIUNA evidence.
- CLC convention readiness is persuasive background only; it is not proof of OPDC/CECOF legal/federated readiness.

## Notable Surface Concern

`apps/union-eyes/app/api/continuity/inheritance/route.ts` delegates to onboarding and includes `requireOrgAccess()` returning `true`. That is not adequate evidence for a restricted continuity handover claim. Any recording scene using this route must be excluded or explicitly marked conceptual until remediated and negatively tested.

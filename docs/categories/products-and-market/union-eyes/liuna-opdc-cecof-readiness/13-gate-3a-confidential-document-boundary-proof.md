# 13 - Gate 3A Confidential Document Boundary Proof

## Gate Status

`LIUNA_GATE_3A_CONFIDENTIAL_DOCUMENT_BOUNDARY = CLOSED`

This gate proves the core document, search, and direct-download boundaries for a synthetic OPDC/CECOF/local restricted-matter scenario.

It does not prove all sensitive legal-matter workflows. Export, AI briefing, notifications, queued work, cached actions, and former-user session revocation remain separate gates.

## Actor Matrix Proven

| Actor | Boundary Result |
| --- | --- |
| External participant without organization membership | Denied across restricted labels. |
| Local member without case access | Denied across restricted labels. |
| Successor reviewer with case access only | Allowed to case-visible records; denied privileged and highly sensitive records. |
| Central steward-level reviewer without raw-document grant | Allowed ordinary and LRO-confidential steward-visible records; denied privileged and highly sensitive records. |
| Reviewer with explicit document grant | Allowed privileged and highly sensitive records. |
| Reviewer with private-document grant | Allowed LRO-confidential records; not enough by itself for privileged or highly sensitive records. |
| Primary owner | Allowed privileged and highly sensitive records. |

## Surfaces Proven

| Surface | Proof |
| --- | --- |
| Policy engine | `document-governance-service.test.ts` |
| Document authorization service | `document-authorization-service.test.ts` |
| Universal search | `search-universal.route.test.ts` proves governance-denied documents are omitted. |
| Direct download | `documents/[id]/download/route.test.ts` proves denied documents do not receive download URLs. |

## Validation

| Command | Result |
| --- | --- |
| `pnpm --filter @nzila/union-eyes test -- app/api/__tests__/search-universal.route.test.ts lib/services/document-governance-service.test.ts lib/services/document-authorization-service.test.ts app/api/documents/[id]/download/route.test.ts` | PASS; 4 files / 13 tests |
| `pnpm --filter @nzila/union-eyes typecheck` | PASS |

## Claim Impact

Allowed after this gate:
- "Restricted documents are filtered before search and download responses are returned."
- "Privileged and highly sensitive records require explicit grant or primary-owner access."
- "Central steward-level access does not automatically unlock privileged raw documents."

Still prohibited:
- "All legal-matter workflows are privilege-safe."
- "Former users cannot access any direct links or active sessions."
- "Evidence exports, AI summaries, notifications, queues, and caches have all been proven against this actor matrix."
- "This is legal compliance certification."

## Next Gate

`LIUNA_GATE_3B_REVOCATION_AND_CROSS_SURFACE_DENIAL`

Required proof:
- revoked/expired assignment denial;
- former-user denial;
- direct URL denial after revocation;
- evidence export boundary;
- AI/briefing boundary;
- notification or queued-action boundary if those surfaces include restricted matter content.

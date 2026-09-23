# Synthesis-safety choke — entry point inventory

**Canonical marker:** `applyAuthorizedEvidenceContextChoke` in
`packages/sage-core/src/synthesis-context.ts`  
**Architectural test:** `packages/sage-core/src/synthesis-choke-architecture.test.ts`

## Required (MUST call choke) — evidence / narrative retrieval

| Entry point | Status |
| --- | --- |
| `listSageEvidenceSources` | **Wired** |
| `listSageEvidenceItems` | **Wired** |
| `getSageEvidenceSource` | **Wired** |
| `getSageEvidenceItem` | **Wired** |
| `listSageBoundaryFlags` | **Wired** |
| `listSageReviewNotes` | **Wired** |
| `listSageDecisionRecords` | **Wired** (+ `redactDecisionReferences` via choke) |
| `getSageDecisionRecord` | **Wired** |
| `buildSageInstitutionalQaContextForWorkspace` | **Wired** |
| `generateSageExportPackage` | **Wired** via `filterExportEvidenceResourcesThroughAuthorizedContext` |
| platform-admin `POST …/institutional-context` | **Wired** → core builder |
| platform-admin evidence list/get services | **Wired** → core list/get |

## Intentionally out of scope (rationale)

| Path | Rationale |
| --- | --- |
| Workspace create/list/get/summary | No evidence narrative; counts only (summary) |
| Evidence/governance **mutations** (create/classify/link/decide) | Write paths; reads still choke on subsequent list/get |
| Export request/approve/deny metadata list/get | Scope already resolved through authorize+resolveExportItem; package **generate** is the byte-assembly choke |
| `getSageExportPackageContent` / download | Serves **immutable previously gated** package bytes; integrity + delivery auth apply. Re-filtering would break approved packages if grants later change — intentional sealed artifact |
| Delivery recipient/grant/claim flows | Operate on sealed packages + recipient sessions; not open evidence search |
| Records retention / legal hold / destruction | Package lifecycle metadata; destruction evidence is audit of deletion, not institutional Q&A corpus |
| Accounting “Sage” adapters (CFO / Intacct) | Homonym — not SAGE governed runtime |

## Adding a new retrieval path

1. Call `applyAuthorizedEvidenceContextChoke` before returning evidence/governance narrative.  
2. Add the function name to `REQUIRED_ENTRY_POINTS` in `synthesis-choke-architecture.test.ts`.  
3. Update this inventory.

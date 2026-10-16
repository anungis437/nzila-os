# CIVITAS Phase 3 Entry Gate

Phase 3 (Personal Institutional Graph) is **CLOSED**.

Disposition of the Phase 2.5 evaluation: **HOLD**.

`phase3Open()` returns false. `PERSONAL_DATA_GATE.personalDataWorkPermitted` is false. An unmet condition below is enough to keep the gate closed. Explicitly unresolved conditions are recorded as such and do not open the gate by themselves when another condition is unmet.

| # | Condition | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Personal information is isolated from code and docs | UNMET | `packages/civitas` and `docs/doctrine/civitas` use synthetic ids. A whole-repository forensic scan was not performed |
| 2 | Deny by default | MET | `readCivitasPersonalData` and `authorizeAgentPersonalAccess` deny |
| 3 | Other agents do not inherit CIVITAS access | MET | `FLEET_INTERACTION` grants no permissions. SCOUT, VERIFIER, and REDTEAM are denied |
| 4 | Sensitive values are not logged by default | UNMET | `packages/os-core/src/telemetry/logger.ts` `createLogger` writes meta without calling `redactFields` |
| 5 | Secrets are referenced, not stored | MET | `acceptCredentialRecord` rejects a secret value. CIVITAS does not call Key Vault |
| 6 | Evidence keeps provenance | MET | Authority links require an `EvidenceRef` |
| 7 | Access is auditable without sensitive payloads | UNMET | `apps/console/lib/audit-db.ts` stores `beforeJson` and `afterJson`. Purpose, data category, authorization basis, and mission id are not required columns |
| 8 | A personal graph can be exported with evidence links | UNMET | `packages/decision-evidence/src/export.ts` exports a sealed evidence pack, not a personal graph |
| 9 | Deletion and retention limits for CIVITAS categories are documented | UNMET | `governance/privacy/policies/data-retention-schedule.md` and `packages/os-core/src/retention/policies.ts` do not name this envelope. No duration is invented |
| 10 | Third-party exposure is known or explicitly unresolved | MET | Listed in `CIVITAS_PRIVACY_READINESS.md` |
| 11 | Infrastructure location is known or explicitly unresolved | EXPLICITLY_UNRESOLVED | Staging rows in `governance/privacy/data-inventory.json` name Canada Central and East US. Production placement is UNKNOWN |
| 12 | Model-provider exposure is known before any prompt | UNMET | `packages/ai-core/src/gateway.ts` logs request bodies. `redactText` can run with mode `off`. CIVITAS sends no prompts |
| 13 | Synthetic tests show principal isolation | MET | `syntheticPrincipalRead` denies a different synthetic principal. `productionRead` is false |
| 14 | Break-glass is reasoned and auditable | MET | `apps/console/app/api/admin/break-glass/route.ts` requires a reason and writes an audit event. It is not wired to CIVITAS data |
| 15 | No deploy or execution authority | MET | Execution authority is none. `deploymentCapability` is false |

## Minimum contract before personal data enters an AI context

All of the following would have to be true, and this gate would still have to be opened by a later change:

- CIVITAS does not put the graph, secret values, or family facts into a prompt.
- Redaction mode cannot be `off` for that call.
- The gateway does not persist the request or response body.
- The provider retention claim is evidenced by a contract record, not only by `governance/privacy/data-inventory.json`.
- The data tier is not Restricted unless a PIA for that flow exists. The classification standard already says Restricted content needs a PIA and a zero-retention contract (`governance/privacy/policies/data-classification-standard.md`).

None of that is implemented as a gateway control for CIVITAS. `personalDataMayEnterModelContext()` is false.

## What does not open this gate

A named professional, a source document, a user preference, an agent request, or a break-glass reason does not open Phase 3. Source text cannot authorize a read.

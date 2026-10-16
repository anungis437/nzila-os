# CIVITAS Privacy Readiness Assessment

Disposition: **HOLD**.

Phase 3: **CLOSED**. See `CIVITAS_PHASE_3_ENTRY_GATE.md`.

The evaluation looked at existing NzilaOS controls and did not treat provider defaults as a CIVITAS guarantee. Unknowns stay UNKNOWN. No personal record was ingested.

## Authorization

CIVITAS personal data does not exist as a store. Reads are denied (`readCivitasPersonalData`). Fleet members do not inherit access. SCOUT, VERIFIER, and REDTEAM have an empty permission list in `packages/civitas/src/interaction.ts`, and `authorizeAgentPersonalAccess` denies them. Access is not "every agent".

Union Eyes enforces org-scoped row policies (`ue_org_isolation_select` and the matching insert, update, and delete policies in `apps/union-eyes/scripts/p4-authority-state.ts`). That is tenant isolation for that app. It is not principal isolation inside a future CIVITAS graph. Two principals in one organization are not separated by those policies.

Break-glass (`apps/console/app/api/admin/break-glass/route.ts`) requires `platform_admin` via policy, a reason of at least 10 characters, a scope of `read`, `write`, or `full`, and a duration from 5 to 240 minutes. It writes `recordAuditEvent`. The route sets `orgId` to the actor user id. Scope `full` is platform-wide. It does not know a CIVITAS subject.

Least privilege for a future graph is capability `civitas.personal.read` plus the same principal id. That rule is tested with synthetic ids only. Production reads stay denied.

## Encryption

| Path | What the repo shows | CIVITAS claim |
| --- | --- | --- |
| Staging Postgres | `governance/privacy/data-inventory.json` `nzila-staging-db`: "at-rest (Azure-managed) + TLS in transit", Canada Central, highest tier Confidential | UNKNOWN whether the server uses AES-256 or TLS 1.3. Azure-managed keys are not the customer-managed keys the standard requires for Restricted |
| Staging blob | Same file, `nzilacanadastore`: Azure-managed at rest plus TLS | Same limit. The classification standard says Restricted blob content needs customer-managed keys (`governance/privacy/policies/data-classification-standard.md`) |
| Key Vault | Same file, `nzila-staging-kv`: "Azure-managed HSM-backed" | A documented inventory claim. Not re-verified against a live vault |
| Field level | No CIVITAS columns exist | Storage encryption would not be enough for the max-risk envelope. The standard already asks for column-level encryption for tier-3+ PII "where supported". That was not found on a CIVITAS table |
| In transit | Inventory says TLS. Version is UNKNOWN | Not claimed as TLS 1.3 |
| Backups | Policy text says backup encryption is required for Confidential and Restricted | Implementation for a CIVITAS backup is UNKNOWN |
| Key ownership and rotation | `packages/secrets/src/rotation.ts` exists for platform secrets | CIVITAS holds no keys |

No custom cryptography was added.

## Logging

`packages/os-core/src/telemetry/logger.ts` `createLogger` writes JSON to stdout and copies error name, message, and stack. `redactFields` exists and is not called by the logger. The example in that file shows the caller must wrap meta. Keys covered include email, phone, ssn, tax id, bank account, password, token, and private key. They do not cover the rest of the CIVITAS envelope (citizenship, family, wills, addresses). A value inside a message string is not redacted.

`packages/ai-core/src/redact.ts` redacts patterns when mode is `strict` or `balanced`, and returns the original text when mode is `off`. `packages/ai-core/src/gateway.ts` persists `requestBody` messages and `responseBody` content through `logAiRequest`.

`civitasLogMeta` drops a fixed key list on the CIVITAS path. That does not change the platform logger. Highly sensitive values are not safe in platform logs by default. Minimum remediation before Phase 3: the platform logger must redact by default, error messages must not carry secret or graph values, and AI request logs must not store prompt or response bodies for this data.

## Audit

`apps/console/lib/audit-db.ts` records org id, actor clerk user id, role, action, target type, target id, `beforeJson`, `afterJson`, hash, previous hash, and created time. A hash chain is present. The row can contain a payload. It does not require data category, purpose, authorization basis, correlation or mission id, or a break-glass reason as columns. The break-glass route puts the reason in `afterJson`.

An audit of a future CIVITAS read would need those fields and would need to forbid graph and secret payloads. That shape is not enforced.

## Retention and deletion

`governance/privacy/policies/data-retention-policy.md` states principles, a 90-day backup maximum, and a 30-day cap for logs that contain personal data. `governance/privacy/policies/data-retention-schedule.md` gives durations for sessions, accounts, audit logs, application logs, union cases, financial records, and backups. `packages/os-core/src/retention/policies.ts` defines classes from 30 days to permanent for evidence packs, financial records, AI request logs, and audit events.

None of those rows is a CIVITAS personal category. No duration is assigned here. Legal hold is described as a directory "to be created on first hold". Deletion eligibility, review date, and evidence-preservation exceptions for this envelope are UNKNOWN.

The inventory retention pointer says `governance/privacy/policies/retention-schedule.md`. The file that exists is `data-retention-schedule.md`.

## Backups

The retention policy says backups follow their own retention (maximum 90 days) and are subject to deletion when the source is purged. That is not a demonstration that replicas, search indexes, caches, generated artifacts, logs, and exports are cleared. Instant destruction is not promised. For CIVITAS data the backup path is UNKNOWN because no such data is stored.

## Export

Decision-evidence can export a sealed pack as JSON or Markdown (`packages/decision-evidence/src/export.ts`), including org id, classification, seal hash, and timeline. Union Eyes evidence export includes an org-isolation flag (`apps/union-eyes/app/api/evidence/export/route.ts`). Neither is an export of a personal graph that preserves authority relationships, jurisdiction, and decision history for this domain. Export was not implemented.

## Data location

| Store | Documented placement | Environment in the inventory |
| --- | --- | --- |
| `nzila-staging-db` | Azure PostgreSQL Flexible, Canada Central | staging |
| `nzilacanadastore` | Azure Storage, Canada Central | staging |
| `nzila-staging-kv` | Key Vault, Canada Central | staging |
| `azure-openai-eastus` | `https://eastus.api.cognitive.microsoft.com/` | staging, crossBorder true |
| `azure-openai-eastus2-whisper` | `https://eastus2.api.cognitive.microsoft.com/` | staging, crossBorder true, highest tier Restricted |

Source: `governance/privacy/data-inventory.json`. Production database, object storage, logs, backups, telemetry, and artifacts are UNKNOWN. Canadian residency is not assumed for production. The classification standard says Confidential and Restricted data are Canada Central, with cross-border Restricted data only under a DPIA. The East US 2 row is Restricted and cross-border. That tension is unresolved.

Placement of any store that would hold CIVITAS personal data is a Phase 3 prerequisite. Staging location being documented does not place a future production graph.

## Third-party processors

| Processor | Transfer for future CIVITAS personal data | Basis |
| --- | --- | --- |
| Microsoft Azure, Canada Central (staging database, blob, Key Vault) | REQUIRED if that staging stack were used for the data. Production use is UNKNOWN | Inventory rows |
| Microsoft Azure OpenAI, East US and East US 2 | AVOIDABLE. CIVITAS does not call a model. OPTIONAL for other apps that already call it | Inventory rows and the absence of a CIVITAS model client |
| Log aggregation behind stdout | UNKNOWN | `createLogger` writes to the console. The sink is not named |
| Analytics (the retention schedule names a GA4 default for marketing) | AVOIDABLE for CIVITAS | Not a CIVITAS path |
| Email | UNKNOWN | No CIVITAS mailer |
| Vector or search indexes | UNKNOWN | No CIVITAS index |
| Error reporting | UNKNOWN | Not traced for this package |
| GitHub CI | AVOIDABLE if personal data stays out of the repo, fixtures, and logs | This change uses synthetic ids |
| Backup provider | UNKNOWN beyond the inventory treating backups as a category of the Canada blob account | Inventory and retention policy |

Lower-disclosure route: keep CIVITAS data out of model calls, CI logs, and email. Send agents the proposition and authority refs only.

## Model and agent privacy

CIVITAS does not call a provider. Actual guarantees if data were sent:

- Redaction before send: only when `redactText` mode is not `off`. Pattern lists are not the envelope.
- Prompt retention at the provider: the inventory says "zero-retention per Azure DPA". The DPA text was not reviewed in this pass. Treat the guarantee as UNKNOWN beyond that inventory string.
- Platform retention of prompts: `logAiRequest` stores request and response bodies. `packages/os-core/src/retention/policies.ts` keeps `ai_request_log` for 1 year.
- Embeddings, agent memory, and training or eval pipelines for CIVITAS data: UNKNOWN. No CIVITAS embedding path exists.
- Cached conversations: UNKNOWN.

The minimum contract is in `CIVITAS_PHASE_3_ENTRY_GATE.md`. It is not enforced in the gateway.

## Secret management

`packages/secrets/src/keyvault.ts` fetches secret values, caches them in process memory, and falls back to environment variables in development. That client is for platform secrets. CIVITAS does not import it. A credential record without a secret value can be accepted as a reference. A password, private key, seed, MFA secret, API secret, or PIN kind is rejected as evidence. Free-text smuggling inside an ordinary description is not pattern-scanned, because that would be a classifier. The typed kind is the control.

## Family data

Family and dependant facts are a separate subject. `authorizeFamilyRead` refuses. No family profile, name, or relationship record is stored. Ontology `Person` is a future concept in `packages/civitas/src/concepts.ts` and is not a family register.

## Legal-professional information

The authority substrate can label a source and a proposition. It does not label a communication as privileged. Draft and final instruments are not stored. Professional determinations stay on the RED path and do not mean privilege or approval.

## Red team

| Id | Existing mitigation | Missing mitigation | Residual risk | Phase 3 blocker |
| --- | --- | --- | --- | --- |
| R1 Unauthorized agent reads the full graph | No graph. Empty fleet permissions | No persisted capability ACL | A later org-wide database role could read every row | Yes |
| R2 Logging leak | `redactFields`, `redactText`, `civitasLogMeta` | Logger does not redact by default. Stacks are copied | A value in a message or an unlisted key is logged | Yes |
| R3 Full asset record in an external prompt | CIVITAS sends no prompt | Gateway logs bodies. Redaction can be off | A later model call would leave the boundary | Yes |
| R4 Compromised admin | Break-glass reason, duration, audit | Scope `full` is platform-wide | Admin blast radius includes any future table in that database | Yes |
| R5 Export theft | Evidence-pack export and Union Eyes org flag | No minimized CIVITAS export control | A future JSON export would be a stealable file | Yes |
| R6 Deletion versus backups | Policy says backups have their own retention | No deletion proof across replicas, indexes, caches, logs | Deletion would not be instant destruction | Yes |
| R7 Cross-principal contamination | Org RLS in Union Eyes. Synthetic principal check | Org scope is not principal scope | Two principals in one org would share a read | Yes |
| R8 Password or key submitted as evidence | Typed secret kinds and secret values are rejected | Ordinary description text is not scanned | A secret pasted into a summary could still be stored by another package | Yes |
| R9 Over-broad VERIFIER request | VERIFIER permission list is empty | VERIFIER is not a registered runtime agent | A future integration could pass a wide context | Yes |
| R10 Incapacity continuity access | `grantIncapacityAccess` refuses | No reviewed delegate model | A standing delegate would be unsafe | Yes |

## Governing limit

CIVITAS should know enough to protect the principal's autonomy, and it should not collect sensitive information merely because it can. This phase collects none.

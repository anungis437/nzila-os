# S2.02 preimage: Plane B (privileged read-only inspection) decision record

Status: engineering package only. No privileged database session has been opened. No role was granted, no credential created, no infrastructure changed and no SQL executed for this record. Live execution needs separate founder authorization (see [Protected execution procedure](#protected-execution-procedure)).

| Flag | Value |
| --- | --- |
| `S2_02_PLANE_B_ENGINEERING_QUALIFIED` | NO (until exact-head CI, including the Docker proof, is green) |
| `S2_02_PRIVILEGED_LIVE_EXECUTION_AUTHORIZATION` | PENDING |
| `S2.02_PREIMAGE_COMPLETE` | NO |
| `S2.02_LEGACY_GATE` | INDETERMINATE |
| `STEP_2_ENGINEERING_COMPLETE` | NO |
| `STEP_2_ACCEPTED` | NO |
| `STAGING_GO` | HELD |
| `PRODUCTION_GO` | HELD |
| `UE_SAAS_OPERATIONAL_READINESS` | NO_GO |
| `fullReadiness` | NOT_YET_PROVEN |

The acceptance standard is unchanged. `CATALOG_COMPLETE` still means that all 15 contract categories are accepted. It is not redefined to exclude anything. What changed is where some evidence is allowed to come from:

- Role-visible counts are no longer accepted as preservation totals.
- A preimage reaches `CATALOG_COMPLETE` only when a runtime plane and a privileged plane are reconciled together.

## 1. What run 45940281038 proved and what it did not

Run 45940281038 used source `9803777de`, operator `catalog@sha256:5b43f127…`, execution `ue-s202-cat-45940281038-psolkdz`, frame nonce `5f22b158…` (218 chunks, 1,306,121 bytes, SHA-256 `cad6c545…`).

- The full artifact is kept privately at `~/nzila-private-evidence/union-eyes/s2.02/run-45940281038/` (directory 0700, files 0600, all hashes re-verified against the run's `SHA256SUMS`).
- The repository keeps only `run-45940281038/{SHA256SUMS, evidence-manifest.json, cleanup.json}`.
- The GitHub artifact (id 15172876152) expires 2026-12-04T04:29:58Z.

### Accepted Plane A observations (runtime role)

These were accepted by the evaluator then and are still accepted by the plane-aware contract:

- **`database_identity`**: `ue_v2_staging`, role `union_eyes_runtime` through login `ue_staging_runtime`, read-only, `ROLLBACK`, `LIMITED_RUNTIME`.
- **`migration_discovery`**: the drizzle ledger exists.
- **`roles_and_memberships`**, **`relation_ownership_acl`**, **`rls_configuration`**: RLS is enabled and forced on 784 of the 790 tables. That observation is preserved.
- **`rls_policies`**: 188 policies with `USING true`, 386 restrictive.
- **`function_topology`**, **`security_definer`**, **`event_triggers`**, **`audit_grants`**, **`sequences`**, **`business_tables`** (790 tables).

### Missing evidence

| Category | Run 45940281038 result | Why it is missing | Re-classification under this change |
| --- | --- | --- | --- |
| `migration_history.migration_columns` | 0 rows from `information_schema.columns` | `information_schema` hides columns of tables the role cannot use. Zero rows was hidden metadata, not absence. | `INCONSISTENT` while a discovered ledger has no columns. Now read from `pg_attribute`. |
| `migration_history.drizzle_rows` | `permission denied for schema drizzle` | The runtime role has no USAGE on `drizzle`. | `PRIVILEGE_DENIED`. Privileged plane only. |
| `audit_permissions` | `permission denied for schema audit_security` | `to_regclass()` needs schema USAGE. | Now read from `pg_class` with `has_*_privilege()` facts, so the runtime plane can observe it. |
| `preservation_counts` | 103 observed (all `0`), 147 `UNREADABLE`, 540 `NOT_ATTEMPTED` | Forced RLS filters every row for the runtime role. It lacks SELECT on 424 tables. | 103 `ROLE_VISIBLE_ONLY`, 147 `UNREADABLE`, 540 `NOT_ATTEMPTED`. **None is a global total.** Privileged plane only. |

The 103 zeros are what one role could see with no organisation context set. They are not table totals and are never accepted as such. Every count record without a proven `GLOBAL` scope is classified `ROLE_VISIBLE_ONLY`, which covers every v2 record written before this change.

### Privilege matrix for the 790 tables

Derived offline from the run's own evidence: `relacl`, owners, memberships and `rolbypassrls`. No new query was run.

| Subject | SELECT | Global visibility (RLS cannot filter) |
| --- | --- | --- |
| `union_eyes_runtime` (application) | 366 | 0 (all 366 are forced-RLS and filtered) |
| `union_eyes_system` | 117 | 0 |
| `uev2admin` (existing admin login) | 790 | 790 (BYPASSRLS plus `pg_read_all_data`) |

- The per-table matrix stays private: `privilege-matrix.json`, SHA-256 `97857eb55a1424fc23f2d3a0063e4e247be32cfa498de7d4bc387cd3f5add5c5`, recorded in `DERIVED.sha256` beside the artifact.
- Schema USAGE was not observed in that run. The new `privilege_matrix` query records `has_schema_privilege`, `has_table_privilege` and `pg_has_role` per table in every future session. Privileges are recorded as observed, not assumed.

## 2. Privileged access needed

Two things need global visibility:

- The migration ledger (`drizzle.__drizzle_migrations` rows).
- Exact `count(*)` totals for all 790 tables, including 784 with forced RLS.

That requires a session that both holds SELECT and is not filtered by row security. Under PostgreSQL 16, that means one of:

- superuser;
- `BYPASSRLS` with SELECT;
- table owner on a table that is not forced. All 784 RLS tables are forced, so ownership does not help.

### Options considered

| Option | Global totals | New grants | New credential | Infra change | Snapshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Existing `uev2admin`, read-only operator (selected)** | Yes (790/790) | None | None | None (job-scoped secret, deleted with the job) | Per session REPEATABLE READ; multi-session with drift detection | **Least invasive** |
| B. `union_eyes_system` | No (117 tables, all RLS-filtered) | — | — | — | — | Insufficient |
| C. New dedicated `BYPASSRLS` + `pg_read_all_data` login without write | Yes | New role and grants | Yes | None | Same as A | Narrower credential, but needs a grant and a new credential. Founder decision; not done here. |
| D. Point-in-time restore to an isolated server; one REPEATABLE READ transaction on the copy | Yes | None on staging | Restored server inherits admin | Yes (a new server) | **One atomic snapshot** | Strongest consistency. Needs infra creation and cost. Founder decision. |
| E. Raise the per-session count ceiling so all 790 fit one transaction | Yes | None | None | None | One snapshot | **Selected 2026-11-27** by founder authorization, after option A's multi-session chain was refused for live writes (`EXECUTION_PREFLIGHT.md` section 10). Ceiling raised from 250 to 1,000; the 15 s / 45 s bounds are unchanged. |

### Existing credentials

`uev2admin` is the server administrator login. Its password is the existing GitHub environment secret `UE_V2_STAGING_DB_ADMIN_PASSWORD` (environment `ue-staging`), already used by the forward-upgrade job.

Observed in run 45940281038:

- `rolsuper = false`, `rolbypassrls = true`, `rolinherit = true`.
- Member of `azure_pg_admin`, which reaches `pg_read_all_data`, `pg_monitor`, `pg_read_all_stats`, `pg_signal_backend`, `pg_use_reserved_connections` and **`pg_write_all_data`**.
- Also a member of `ue_v2_owner`, `union_eyes_system` and the auth roles.
- Owns 6 tables, including `drizzle.__drizzle_migrations` and `audit_security.audit_logs`.

**The credential can write.** Read-only behaviour comes from the operator, not from the credential:

- `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, so PostgreSQL rejects any write inside the transaction;
- a fixed SQL programme with no write or DDL statement, asserted by tests;
- `ROLLBACK`.

`azuresu` (superuser) is Microsoft-managed and not used.

### Unavoidable grants

**None** for option A. No role grant, RBAC grant, firewall change or new credential. The admin password exists for a few minutes only as a secret on the owned job, and is deleted with it.

## 3. What was built

- **Plane A, fixed** (`UE_CATALOG_PLANE=runtime`, the default).
  - Audit inspection uses `pg_class`/`pg_namespace` plus `has_*_privilege()`.
  - Migration columns use `pg_attribute`.
  - A `privilege_matrix` covers every table.
  - Counts are gated on that matrix. A table without SELECT or schema USAGE is `PRIVILEGE_DENIED` without spending a statement.
  - `effective_roles` is recorded, plus server-side digests of column structure (`structure`) and of relation and policy metadata (`relation_metadata`).
  - Policies record their roles.
  - The session is opened with `-c role=union_eyes_runtime -c default_transaction_read_only=on`.
- **Plane B, new** (`UE_CATALOG_PLANE=privileged`). Same image, private job, Log Analytics transport, integrity checks, ownership rules and cleanup.
  - **Refusals before connecting.** The login is fixed (`uev2admin`). The host must be the staging server, or a non-Azure local proof host with TLS off. TLS can never be disabled for `*.postgres.database.azure.com`. With no sealing key, no connection is made.
  - **Session.** The session default is `default_transaction_read_only=on`. Then `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, the unchanged 15 s statement timeout, 2 s lock timeout, `search_path = pg_catalog`, and the 45 s / 250-statement count budget.
  - **Refusals before reading data.** A superuser session, a session whose acting role is not the login, and a server with `track_counts` off are all refused before any data is read.
  - **What it records.** `pg_current_snapshot()`, transaction start and session end times, and the privileges actually held (`pg_roles`, effective role memberships, `has_*_privilege`).
  - **Global scope.** Taken per table from PostgreSQL's own `row_security_active()`. The evaluator also requires a role attribute that explains it (BYPASSRLS, or ownership of a non-forced table); otherwise `SCOPE_UNPROVEN`. The login name is never evidence of visibility.
  - **Errors.** Error text leaves the container only as `SQLSTATE <code>`, because a message can quote a value.
  - **Migration ledger.** Re-read in every session.
  - **Change counters.** Per-table cumulative statistics (`relid`, `n_tup_ins/upd/del`, `relfilenode`) are read at the start of the session. After the counting transaction ends in `ROLLBACK`, which releases its locks, they are read again in a second read-only transaction once 75 s have passed since the snapshot.
- **Sealing.**
  - Counts, ledger rows and both counter sets are encrypted inside the container (X25519 + HKDF-SHA256 + AES-256-GCM, 16-byte tag) to the founder's public key (repository variable `UE_V2_STAGING_CATALOG_RECIPIENT`).
  - Values are scrubbed before the frame is written, whatever happened. An unexpected exception prints nothing.
- **Contract.**
  - `PLANE_RESPONSIBILITY` assigns:
    - posture to the runtime plane;
    - `migration_history` and `preservation_counts` to the privileged plane;
    - identity, discovery and inventory to both.
  - A single plane is at most `CATALOG_PARTIAL` with `PLANE_ACCEPTED` (or `PLANE_CAPTURED_SEALED`).
  - `reconcilePlanes` gives `CATALOG_COMPLETE` only when all of the following hold:
    - all 15 categories are accepted from their responsible plane;
    - the privileged evidence has been opened;
    - inventory, column structure, relation and policy metadata, and migration discovery match across planes.
- **Controller.**
  - Allowlist of what a privileged body may carry in the clear. A body with any count value, ledger row, counter row or unknown query is quarantined: it is withheld from every artifact and report, with an incident action.
  - The admin password is scrubbed from every Azure CLI response, and the finished report is checked again.
- **Offline tools** (founder machine only; both refuse output paths inside the repository after resolving symlinks):
  - `--generate-recipient <path>` writes the private key once, mode 0600.
  - `--assemble --runtime <dirs> --privileged <dirs> --key <pem> --out <dir>`:
    - refuses a key file readable by group or others;
    - verifies every artifact against its run's `SHA256SUMS`;
    - opens each sealed session and checks it against its run and source;
    - chains continuations and reconciles both planes;
    - writes `preimage-private.json` (values) and `preimage-summary.json` (classifications and digests only), both 0600, in a 0700 directory.

## 3a. Cryptographic qualification

| Property | Implementation | Test |
| --- | --- | --- |
| Ephemeral key | `generateKeyPairSync('x25519')`, one per envelope | Fresh ephemeral key, salt and IV per envelope |
| Recipient parsing | SPKI DER, base64; must be X25519, otherwise `EVIDENCE_RECIPIENT_MISSING` before any connection | Invalid key: no connection, no Azure call |
| Recipient id | First 64 bits of SHA-256 over the SPKI. It is an identifier, not a secret. The controller requires it to equal the configured key. | `SEALED_FOR_ANOTHER_RECIPIENT` |
| KDF | HKDF-SHA256 (X25519 shared secret, random 16-byte salt, info `ue-v2-staging-catalog-sealed/v1`), 32 bytes | — |
| Cipher | AES-256-GCM, random 96-bit IV, `authTagLength: 16` both ways | — |
| AAD | `info` \| run \| source SHA \| `observedAt` \| snapshot \| plane \| SHA-256 of the exact clear summary | Rebound session, swapped envelope, and edited summary are refused (`SEALED_EVIDENCE_UNBOUND`); altered AAD is refused (`SEALED_EVIDENCE_TAMPERED`) |
| Lengths | Tag 16, IV 12, salt 16, ciphertext equal to the declared plaintext length, strict base64 | Truncated tag, IV, salt or ciphertext: `SEALED_EVIDENCE_TAMPERED` |
| Integrity | GCM tag, plus SHA-256 of the plaintext | Flipped ciphertext or tag bit: refused |
| Consistency | Every sealed count, ledger row and counter set must match the clear summary's table list and digests | A forged envelope with a well-formed AAD: `SEALED_*_INCONSISTENT` |
| No plaintext fallback | A sealing failure gives `SEALING_FAILED`; values are scrubbed; the controller quarantines any body carrying a clear value | Fault-injection and quarantine tests |
| Key handling | The private key is never printed or committed: the generator prints only the public half, and the 0600 file is written once. `--assemble` refuses an open key file. | Key tool test |

**What sealing does not give.** It provides confidentiality, not origin authentication: anyone holding the public key can produce an envelope. Origin rests on the transport:

- frame lines bound to this run's job, execution, container and image digest in the environment's own workspace;
- the run's artifact, downloaded by the founder with `gh run download <run>` from this repository;
- the run id and source SHA inside the authenticated data, checked against that run's manifest.


## 4. Security model for elevated read access

- **Public repository.** Actions artifacts and run logs of `anungis437/nzila-os` can be downloaded by any signed-in GitHub user. Privileged values therefore never appear in the clear in the frame, the artifact, the manifest, the controller report or the logs. Tests assert this for every artifact file and for the reassembled Docker output.
- **Log Analytics.** Readers of `nzila-ue-v2-staging-law` can read the frame lines. For Plane B these are ciphertext plus metadata.
- **Admin secret path.**
  - GitHub environment secret, passed to the controller step only when `plane == 'privileged'`. The controller refuses it on the runtime plane (`UNEXPECTED_PRIVILEGED_CREDENTIAL`).
  - It is written into the job manifest in a fresh 0700 directory as a 0600 file, created exclusively, and removed in `finally`.
  - `specificationSecretDefect` requires the value to appear exactly once, as the job-scoped secret, with `PGPASSWORD` only as a `secretRef`.
  - It is never on a command line, in an artifact or in a report (tested).
  - The privileged job receives no runtime `DATABASE_URL`, and the runtime job receives no admin secret.
- **Exposure window.** The Container Apps secret value is readable only through `listSecrets`, by principals with write-level access on the resource group, for the job's lifetime (minutes). If cleanup fails (`JOB_CLEANUP_FAILED` or `JOB_CLEANUP_UNPROVEN`), the secret persists with the job. Treat that as an incident: delete the job, then rotate the password.
- **Founder decision required on existing exposure.** Run 45940281038's artifact (Plane A, in the clear) exposes roles, ACLs, policy expressions and table names to signed-in GitHub users until 2026-12-04. It holds no customer rows; its counts were role-visible zeros. Deleting it early is irreversible (the private copy is preserved and hash-verified), so it is left to the founder. Future Plane A artifacts carry the same metadata. Sealing Plane A as well is a possible extension, not implemented here.

## 5. Rollback and revocation

- **Database.** Nothing to roll back. Every session ends in `ROLLBACK` and no statement writes. The Docker proof verifies relations, ACLs and row-change counters are unchanged.
- **Azure.** The job is deleted by the controller, or by the `always()` cleanup step, under exact ownership including the `plane` tag. A held job yields an incident with the exact command scope.
- **Admin credential.** If any doubt exists about secret exposure:
  1. Rotate with `az postgres flexible-server update -g nzila-canada-staging-rg -n nzila-ue-v2-staging-db-d562ba7f --admin-password <new>`.
  2. Update `UE_V2_STAGING_DB_ADMIN_PASSWORD` in the `ue-staging` environment.

  Founder action; this changes a credential.
- **Recipient key.** Delete the repository variable `UE_V2_STAGING_CATALOG_RECIPIENT`. Plane B then refuses before creating anything. Destroy the private key file once the preimage is accepted and archived. Sealed artifacts stay unreadable without it.
- **Code.** Revert the PR. Plane B is opt-in per dispatch (`plane` defaults to `runtime`).

## 6. Performance implications

- One connection, at most 1,000 `count(*)` statements per session (250 until 2026-11-27, see option E), each bounded by 15 s, inside a 45 s wall budget. All 790 staging tables fit one session, so Plane B is one `REPEATABLE READ` snapshot. If the tables ever exceed the ceiling or the budget, the remainder becomes a continuation as before.
- `count(*)` takes `ACCESS SHARE` locks that are **held until `ROLLBACK`**. A concurrent migration's `ACCESS EXCLUSIVE` lock would wait for the session to finish, and queries queued behind it would wait too. Do not run during a staging deploy or migration. The catalogue workflow's concurrency group does not serialise against the deploy workflow; this is an operating rule.
- Each privileged session then idles, with no transaction and no locks, until 75 s after its snapshot, and reads the statistics once more. That adds about a minute per session, within the job's 300 s replica timeout and the controller's 240 s observation deadline.
- A REPEATABLE READ transaction holds back the xmin horizon for its duration (under about 60 s), delaying vacuum of rows dead after its snapshot. This is negligible on staging.

## 6a. Multi-session consistency

What is proven:

- **Within one session.** All counts and the ledger come from one REPEATABLE READ snapshot.
- **Across sessions.** A chain is accepted only if every session saw identical values for:
  - table inventory;
  - column structure;
  - relation and policy metadata;
  - migration ledger;
  - per-table statistics (`relid`, inserts, updates, deletes, `relfilenode`), read both at the start of the session and again 75 s or more after its snapshot.

Why the second read matters:

- **Without it there is a gap.** Statistics are not MVCC. A write committed after a session's snapshot can be missing from its counts but already present in its counters. The next session would then see unchanged counters, and the change would go undetected.
- **The second read closes it.** PostgreSQL flushes a busy backend's pending statistics at least every 60 s (an idle backend after 10 s). So the second read covers every write committed inside the session's window.
- **The gap is also closed between sessions.** Writes committed between sessions change the next session's opening read.

What it does not prove:

- **Statistics manipulation.** A deliberate `pg_stat_reset*` followed by replay to identical values is not detected.
- **Lost statistics.** Statistics lost without a reset (for example a crash after the last flush) are not detected.
- **Rolled-back writes.** Aborted inserts also increment counters, so they cause a false refusal. That fails safe.

The result is labelled `MULTI_SESSION_NO_CHANGE_DETECTED`, `atomicSnapshot: false`, with that caveat recorded in the evidence. Only a single session is `ONE_REPEATABLE_READ_TRANSACTION`. The runtime and privileged planes are never one snapshot (`crossPlaneAtomic: false`).

**Minimum mechanism for true atomicity.** One transaction must count all 790 tables. That needs either:

- a per-session statement ceiling of at least 790 (authorized 2026-11-27 and set to 1,000, option E); or
- option D, a point-in-time restore counted in one transaction.

Neither was assumed when this record was written. Option E was later authorized (see the option table).

## 7. Adversarial review

| Threat | Behaviour |
| --- | --- |
| Incomplete privileges | Counts are gated on the observed matrix. Global scope comes from `row_security_active()` and must be explained by a role attribute. Otherwise the table is `PRIVILEGE_DENIED` or `SCOPE_UNPROVEN`, never accepted. A missing matrix accepts nothing. |
| Inaccessible migration history | Ledger without access is `PRIVILEGE_DENIED`. A discovered ledger with no columns is `INCONSISTENT`. Absence is accepted only when discovery from `pg_class` shows no ledger. |
| Schema drift, renames, replacements, metadata changes | Compared across sessions and across planes:<br>- table inventory;<br>- column structure;<br>- relation and policy metadata (oid, name, kind, owner, ACL, RLS flags, policy roles and expressions);<br>- migration discovery and ledger.<br>Any difference is refused (`SCHEMA_DRIFT`, `STRUCTURE_DRIFT`, `RELATION_METADATA_DRIFT`, `MIGRATION_DRIFT`, `PLANE_*_DRIFT`). A drop-and-recreate changes the oid. |
| Concurrent data changes | See [section 6a](#6a-multi-session-consistency). Proven in Docker with a real insert between sessions (`DATA_DRIFT_BETWEEN_SESSIONS`). |
| Writes by an over-privileged login | `uev2admin` can write. The session default is read-only, every statement runs inside a `READ ONLY` transaction, and the programme contains no write or DDL. Docker shows PostgreSQL refusing an `INSERT` from that login in both shapes. The fault harness shows no statement runs outside a transaction. |
| Count timeouts | `TIMED_OUT` is never accepted. The bounds are unchanged. A continuation retries only `NOT_ATTEMPTED` tables; a timed-out table needs a fresh chain or option D/E. |
| Interrupted runs | The `always()` cleanup removes only this run's job, by name, tags (including plane), environment, image and identity, after executions are terminal and with proof of absence. Otherwise it reports an incident. |
| Leakage | Sealed in-container; scrubbed before framing. Error text is SQLSTATE only; nothing goes to stderr. The controller quarantines any clear value. The secret appears once in the spec and is scrubbed from CLI output and reports. Offline outputs are refused inside the repository and written 0600. The preimage summary has no values. |
| Wrong recipient or tampering | A mismatched key id fails in the controller (`SEALED_FOR_ANOTHER_RECIPIENT`). Tampering breaks the GCM tag or the plaintext hash (`SEALED_EVIDENCE_TAMPERED`). Rebinding to another run or session fails on the AAD (`SEALED_EVIDENCE_UNBOUND`). Altered artifacts fail `SHA256SUMS`. |
| Over-privileged session | A superuser session is refused (`DATABASE_PRIVILEGE_UNEXPECTED`). Another login, `read committed`, a writable transaction or a missing `ROLLBACK` are refused. |
| Cleanup failure | Exit 6, incident, secret-rotation instruction (section 5). |
| Snapshot alternative | Option D gives one atomic snapshot and removes the multi-session caveat. It needs a restored server (infrastructure, cost, network isolation, deletion). Recommended only if change detection refuses repeatedly, or if the founder requires atomicity. |

## 8. Test evidence (this change)

- `ue-v2-staging-catalog-exec.test.mjs` covers:
  - the plane contract;
  - role-visible refusal and hidden-metadata refusal;
  - privileged identity refusals;
  - the full cryptographic matrix in section 3a;
  - drift refusals: data, late write after settle, insufficient settle, policy and structure changes, migration;
  - two-plane reconciliation;
  - a static no-write scan of the operator.
- `ue-v2-staging-catalog-job.test.mjs` covers:
  - secret placement and 0600 manifest;
  - no command line carries the secret;
  - nothing is created without the key or the credential;
  - the runtime plane refuses the credential;
  - privileged evidence verification;
  - quarantine of clear values;
  - plane-bound ownership and continuation;
  - offline assembly end to end;
  - the key tool and its path refusals.
- `ue-v2-staging-catalog-operator.fault.test.mjs` runs the shipped operator programme against a scripted driver. It proves:
  - exact connect parameters;
  - statement order and that no statement runs outside a transaction;
  - only `BEGIN`/`SET LOCAL`/savepoints/`SELECT`/`ROLLBACK`;
  - refusals before any data read;
  - `ROLLBACK` on every failure path (SQL errors, timeouts, dropped connections);
  - SQLSTATE-only errors, no value in the clear, empty stderr;
  - the settle wait cannot be shortened against Azure.
- `ue-v2-staging-catalog-operator.docker.test.mjs` runs in CI, which refuses to skip it, on PostgreSQL 16 shaped like staging:
  - **Setup.**
    - 270 forced-RLS tables, 10 without runtime SELECT.
    - A ledger and an audit table outside runtime reach.
    - A non-superuser `BYPASSRLS` admin reaching `pg_read_all_data` through an admin group.
  - **Runtime plane.** Role-visible zeros, catalogue-gated refusals, `pg_attribute` ledger columns, audit table without USAGE.
  - **Database-level read-only.** The admin login cannot `INSERT` in the operator's transaction shape or under its session default.
  - **Privileged plane.**
    - Refuses without a key or with another login.
    - `row_security_active` is false on every table.
    - Opened values give exact totals: 3 per business table where the runtime saw 0, plus the ledger.
    - A settled continuation.
  - **Both planes.** Reconcile to `CATALOG_COMPLETE` with `crossPlaneAtomic: false`. Nothing is written.
  - **Drift.** A real insert between sessions is refused.
- The build workflow smoke-tests the real image for both planes before push.


## Protected execution procedure

Every step below is founder-authorized and is not performed by this change.

1. **Authorize** in the PR or issue: Plane A re-run (runtime role), and Plane B with use of `uev2admin`. Plane A must be re-run because run 45940281038 predates the structure digest and the fixed queries, so it cannot be reconciled.
2. **Key (offline, founder machine):**

   ```bash
   node tooling/scripts/ue-v2-staging-catalog-job.mjs --generate-recipient ~/nzila-private-keys/ue-s202-recipient.pem
   ```

   Then set the printed public key as repository variable `UE_V2_STAGING_CATALOG_RECIPIENT`.
3. **Window.** Confirm no staging deploy or migration is running or scheduled. Hold staging deploys until the chain completes.
4. **Plane A.** Dispatch `ue-v2-staging-catalog-job.yml` with `plane=runtime` and approve `ue-staging`. Expect `CATALOG_PARTIAL` / `PLANE_ACCEPTED`.
5. **Plane B.** Dispatch with `plane=privileged` and approve. With the 1,000 ceiling (option E), one session counts all 790 tables and should exit with `PLANE_CAPTURED_SEALED`. If tables remain, repeat with `continuation_run_id=<previous run>` within 24 h. Any drift refusal means a new chain from a fresh baseline.
6. **Assemble offline.** `gh run download` each run into a private directory, then:

   ```bash
   node tooling/scripts/ue-v2-staging-catalog-job.mjs --assemble --runtime <A> --privileged <B1,B2,B3,B4> --key <pem> --out <private dir>
   ```

7. **Review.** Only `CATALOG_COMPLETE` from `--assemble` is a complete catalogue. The founder reviews `preimage-private.json`. Only `preimage-summary.json` and its digest may enter the repository. The flags above stay as they are until the founder accepts S2.02.
8. **After.** Remove the recipient variable when no longer needed. Consider rotating the admin password (section 5). Decide on early deletion of run 45940281038's artifact.

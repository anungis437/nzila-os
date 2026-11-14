# Staging connection budget and retained revisions

The real `cbf2bc9339f766ce4b5d8500a53e4481644f8680` acceptance run exposed PostgreSQL `53300` while the private operator was retiring owned deadline fixtures. Its six deployed worker scenarios had already passed. The failure is retained separately; it is not changed to a clean first-run success.

An authenticated, read-only primary census observed `max_connections=50`, `reserved_connections=5` and `superuser_reserved_connections=10`: **35 ordinary client slots**. The app configured `DB_POOL_MAX=10` but left the shared platform pool at its separate 20-connection default, both auth pools at five, and the two SYSTEM clients at five. The alternate app client is another independent pool. A per-pool limit is not a server-wide limit.

Azure also showed four revisions with running replicas. Only `--relcbf2bc9339` served traffic; three older revisions still had replicas at zero traffic. Nine active historical revisions were deactivated under CHG-2026-0114 after verifying the current image, source, readiness and explicit 100% traffic. Their metadata and images remain available for explicit reactivation. No database data was deleted or reset. The subsequent owned-fixture retirement succeeded with no pending or claimed fixture reminders.

This change bounds every pool family used by staging. The application tenant and alternate clients count twice against `DB_POOL_MAX`; the app and shared SYSTEM clients count twice against `SYSTEM_DB_POOL_MAX`; the shared platform client and the two separately credentialed auth gateways account for the other three pools. Each staging pool is capped at one connection. The existing defaults remain effective for deployments without auth overrides, and the existing production limits are retained.

At the staging maximum of two replicas and two temporarily active rollout revisions, seven pools per process permit at most 28 application connections. Seven ordinary slots remain for independent work and operators, in addition to PostgreSQL's 15 reserved slots. The gate reads the actual Azure PostgreSQL configuration, refuses an unsafe or mismatched budget, and checks it again before promotion. This is a capacity bound, not a claim that load testing has already passed.

The deployment workflow retires zero-traffic history before adding a revision and again after healthy promotion. Retirement checks explicit pinned traffic before every mutation, waits a minute for prior work to drain, never deactivates the serving revision, and preserves revision metadata and data. This keeps historical readiness probes from accumulating indefinitely.

Local tests reproduce the previous unsafe defaults, verify reserved-slot and replica-growth refusals, exercise separate bounded auth pools and concurrent initialization, and refuse changed/split/latest-based retirement traffic. Exact candidate CI, immutable image build, reviewed staging rollout, simultaneous real-persona tests, actual connection census and the remaining case/document/recovery acceptance are still required. The browser's input-retention and blocked-click observations were traced to hydration timing and the real first-visit privacy dialog; the harness now waits for the attached change handler and completes the visible optional-cookie rejection. The actual form then reached the backend and returned500. The runtime log identifies a missing NAR decision-proof signing key, not a connection error.

Finance/dues persistence and Financial Officer 2.1 remain outside this release. No production deployment or database reset is authorized. All agent review and execution is attributed to Codex under the continuing solo-founder delegation; no independent human reviewer is invented.

## Actual member intake decision-proof failure

At 2026-11-14T05:09:43.169Z, the source-cbf2bc93 form POST failed before claim mutation because `getNarSigningSecret` could find neither `NAR_SIGNING_SECRET` nor its configured Key Vault hook. The existing deployment did not wire the required key. A private staging-only operation created `nar-signing-secret` only after verifying it was absent, read it back, preserved every existing key, and serialized no secret value. The candidate adds a managed-identity Key Vault secret reference, stable staging key identifier and a mandatory readiness check for the actual resolved key. A missing, short or unavailable signing key now makes the candidate unready before traffic promotion.

The standalone member intake endpoint also still launched canonical evidence after its claim transaction committed. It now awaits sealing inside that same transaction, so a sealing error rolls back the case, decision proof and audit instead of returning an apparently successful intake. A deferred-promise regression verifies that the transaction stays open and that rejection prevents commit and pilot success events. Existing identity, entitlement, filing-capacity and sensitive boundaries remain unchanged. The actual repaired form journey is still required after rollout.

The CI ops-documentation gate exposed an expired snapshot. Its regenerated snapshot queries actual GitHub build history. August DORA and cost inputs are explicitly excluded from current values rather than presented as fresh measurements; unmeasured fields remain null. This documentation refresh does not qualify application runtime behavior.

## Actual telemetry ingestion interruption

Read-only Azure inspection also found the reused `nzila-canada-prod-law` workspace in `OverQuota`: its0.5GB daily cap had stopped recent staging logs, with next reset at2026-11-14T12:00:00Z. Direct current-revision console logs supplied the actual intake classification above; empty recent workspace queries were not treated as proof of no errors. The shared production workspace is not modified.

Staging parameters now use the existing optional workspace module to create `nzila-ue-v2-staging-law` in `nzila-canada-staging-rg`, in Canada Central, with a1GB daily cap and30-day retention. Staging Container Apps, Application Insights, document diagnostics and staging alerts select that workspace. The Insights component explicitly waits for workspace creation. Historical logs remain in the prior workspace. The actual reviewed what-if, successful routing update and fresh ingested application/job events remain required after CI and main admission; the source change alone is not telemetry recovery proof.

## Observed liveness restart loop

After historical revision retirement, officer run43561119640 still failed during a browser reload. Actual Azure system events show repeated readiness/liveness timeouts at the implicit one-second deadline, with the container forcibly restarted at05:21:42Z and05:23:13Z. This is separate evidence from the original French Trust503; the latter is not retroactively assigned an unverified cause.

The staging liveness probe now uses the existing dependency-free `/api/health/liveness` endpoint with a5-second deadline. The actual database/catalog/signing/service readiness probe retains fail-closed traffic admission with a10-second deadline. Production probe paths/timeouts remain effective as before. This removes dependency latency from the restart decision; actual final-candidate navigation under concurrent workload and unchanged restart counters remain required.

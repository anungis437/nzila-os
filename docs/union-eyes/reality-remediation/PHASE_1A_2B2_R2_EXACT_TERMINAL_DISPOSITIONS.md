# Phase 1A.2b2-R2 — exact terminal-effect source dispositions

**Source disposition coverage: complete for all 154 R1-unestablished chains. Runtime readiness remains `NO_GO — RUNTIME_PROOF_REQUIRED`.**

This additive report preserves the accepted 394-chain b2 census, the historical R1 gate, and the existing b1 carry-forward. It classifies source evidence only; it does not claim execution, persistence success, provider success, authorization correctness, organization isolation, audit completeness, or product readiness. See [the R2 JSON record](./PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.json) for every chain ID, source location, route/method status, evidence reference, and bounded source observation.

## Reconciliation

| Measure | Count |
|---|---:|
| Accepted b2 effect chains | 394 |
| R1 classified effect chains | 394 |
| R1-unestablished chains dispositioned in R2 | 154 |
| R1 chains outside R2 scope | 240 |
| Duplicate or missing R2 chain IDs | 0 |
| Unknown server target / data-effect labels | 0 / 0 |
| Runtime outcomes observed | 0 |
| Unchanged b1 carry-forward | 40 (23 trace candidates + 17 no-caller bindings) |

The 154 R2 IDs are checked against R1's unresolved set. The two b1 carry-forward arrays are compared with the accepted b2 arrays. These checks preserve membership and bookkeeping only.

## Source dispositions by code

| Disposition code | Chains |
|---|---:|
| `ALLOCATION_SIMULATION_WITH_PERSISTED_SIMULATION_RECORDS` | 1 |
| `BILLING_ACCOUNT_CREATE` | 1 |
| `BILLING_ACCOUNT_UPDATE` | 1 |
| `BILLING_CYCLE_CONDITIONAL_DUES_INSERT` | 1 |
| `BILLING_PREVIEW_DRY_RUN` | 1 |
| `CASE_EVIDENCE_BLOB_AND_METADATA` | 4 |
| `CHATBOT_MESSAGE_PERSISTENCE_AND_AI_FALLBACK` | 2 |
| `CHAT_MESSAGE_HISTORY_READ` | 1 |
| `CHAT_SESSION_LIST_OR_CREATE` | 3 |
| `CLAIMS_COLLECTION_READ` | 1 |
| `CLC_ANNUAL_REPORT_GENERATION_AND_AUDIT` | 1 |
| `CLC_TRENDS_READ` | 1 |
| `CONDITIONAL_VENDOR_DEPRECATION_OR_METHOD_ABSENT` | 2 |
| `CONTINUITY_SIMULATION_READ_AND_COMPUTATION` | 1 |
| `COPILOT_QUERY_AND_SESSION_PERSISTENCE` | 2 |
| `COPILOT_SESSION_UPDATE` | 3 |
| `CURRENT_SESSION_IDENTITY_LOOKUP` | 1 |
| `DATABASE_READ_AND_WRITE_SOURCE_CALLS` | 7 |
| `DATABASE_READ_SOURCE_CALLS` | 11 |
| `DEPRECATED_FINANCE_HANDLER` | 11 |
| `EMPTY_REMITTANCE_EXPORT` | 3 |
| `FINANCE_ANALYSIS_READS_AND_AI_ATTEMPT` | 3 |
| `GRIEVANCE_ACCESS_ASSIGNMENT_WRITE` | 1 |
| `HUBSPOT_CONTACT_AND_CONDITIONAL_DEAL_ATTEMPT` | 1 |
| `HYBRID_SEARCH_WITH_CONDITIONAL_EMBEDDING` | 3 |
| `INVITE_ACCEPTANCE_AND_MEMBERSHIP_UPSERT` | 1 |
| `INVITE_TOKEN_CREATION` | 1 |
| `KNOWLEDGE_PROPAGATION_READ_AND_COMPUTATION` | 2 |
| `LEADERSHIP_DASHBOARD_READ_AND_AUDIT_ATTEMPT` | 2 |
| `LOCAL_METHOD_ABSENT` | 14 |
| `LOCAL_NEXTAUTH_SIGNOUT` | 2 |
| `LOCAL_ROUTE_ABSENT` | 46 |
| `MAGIC_LINK_TOKEN_AND_EMAIL_ATTEMPT` | 1 |
| `MFA_CHALLENGE_CONSUMPTION_AND_SESSION` | 1 |
| `MFA_DISABLE_AND_ACCOUNT_FLAG_UPDATE` | 1 |
| `MFA_ENROLLMENT_STATUS_LOOKUP` | 2 |
| `MFA_ENROLLMENT_VERIFICATION_AND_ACCOUNT_UPDATE` | 1 |
| `PASSWORD_ACCOUNT_AND_SESSION_CREATION` | 1 |
| `PASSWORD_LOGIN_CONDITIONAL_SESSION` | 1 |
| `PASSWORD_RESET_TOKEN_AND_EMAIL_ATTEMPT` | 1 |
| `PASSWORD_RESET_TOKEN_CONSUMPTION` | 1 |
| `PILOT_APPLICATION_PATCH_AFTER_OWNERSHIP_GUARDS` | 1 |
| `PLACEHOLDER_ACCEPTED_NO_REMITTANCE_EFFECT` | 1 |
| `PROFILE_LOOKUP` | 1 |
| `SCHEDULED_REPORT_CREATE_OR_UPDATE` | 1 |
| `STEWARD_RECOMMENDATION_READ_AND_COMPUTATION` | 1 |
| `SUCCESS_SHAPED_NO_INVALIDATION` | 1 |
| `SYSTEM_DEPENDENCY_STATUS_CHECK` | 1 |
| `VOTE_INSERT_AND_EVIDENCE_BLOB_PATH` | 1 |
| `WHOP_CHECKOUT_PROVIDER_REQUEST` | 1 |

The JSON disposition distinguishes observed database reads/writes, provider-call attempts, conditional paths, placeholders, deprecations, missing local routes/methods, and terminal effects that remain unestablished in the bounded source trace. Every source reference has a one-based line range validated against the current file.

## Specific source boundaries

- The vendor form's create branch reaches the deprecated POST collection route; its edit branch requests PATCH, which is not exported by the local deprecated route.
- Scheduled-report create/update branches select POST collection or PATCH item handlers backed by the reports CRUD factory.
- The cache route returns a success-shaped message without a cache-invalidation call.
- Remittance submit returns an accepted placeholder; remittance GET export returns an empty array.
- Allocation simulation writes simulated run/basis/line records and attempts audit, while skipping ledger entries, chargebacks, and source-ledger allocation updates.
- Billing-cycle preview forces dry-run and skips dues transaction inserts; ordinary generation defaults dryRun to false and conditionally inserts transactions.
- Case-evidence routes combine blob operations with claims metadata updates; atomicity and runtime success are not established.
- Chatbot message processing persists messages/session state and has an AI fallback; provider success is not established.
- Hybrid knowledge search performs reads and may request embeddings; fallback behavior means provider success is not established.
- Non-HTTP sign-out evidence is limited to NextAuth sign-out/JWT strategy; remote Entra token revocation and durable server-session deletion are not established.

## Limits

- Bounded R1 traces may include shared auth, RLS, organization, entitlement, rate-limit, audit, or telemetry helpers. Such calls do not prove endpoint-specific correctness or completeness.
- No application, runtime journey, integration test, database persistence check, or provider request was executed for this source-only closeout.
- The R1 historical gate is preserved. The operational readiness ruling remains **`NO_GO — RUNTIME_PROOF_REQUIRED`**.
- The 40 b1 carry-forward items remain unchanged and separate from the 394 effect-chain denominator.

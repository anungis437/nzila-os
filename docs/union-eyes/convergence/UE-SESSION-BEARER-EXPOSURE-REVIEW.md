# UE Session Bearer Exposure Review (UE-CONV-A-004)

**Status:** REVIEWED, NOT REMEDIATED. Findings below are from source inspection only. No live PostgreSQL configuration, log store or connection pool was inspected; those items are marked UNVERIFIED and are deployment gates.

## 1. What happens today

The business-session authority places three transaction-local settings (`set_config(name, value, true)`):
`app.current_user_id`, `app.current_org_id` and `app.current_session_token`.
Definer predicates in `packages/db/src/auth-storage-authority/org-session-authority.ts` hash the setting in-database
(`encode(sha256(convert_to(current_setting('app.current_session_token', true), 'UTF8')), 'hex')`) and compare it to
`user_management.user_sessions.session_token_hash`.

Writers: `packages/platform-auth/src/org-binding.ts` (`authenticatedOrgBindingSql`), Django
`backend/auth_core/canonical_context.py` (parameterized `set_config(%s,%s,true)`) and the kernel transaction wrapper
`apps/union-eyes/lib/authority/store/executor.ts` (`set_config('app.current_session_token', $1, true)`).

## 2. Two different credentials travel this path

| Path | Value placed in the setting | Lifetime | Revocation |
|---|---|---|---|
| `verified-provider-bridge` | 256-bit random token minted for this call | 30 seconds | deactivated in `finally` after the callback |
| `pg-session` | the caller's own long-lived session cookie | the session's lifetime | normal logout / expiry |

The second row is the material exposure: a long-lived credential is sent to the database as a bind parameter and held in a setting.

## 3. Exposure paths

| Path | Finding | Basis |
|---|---|---|
| Transaction scope | Transaction-local (`is_local = true`); cleared at COMMIT/ROLLBACK, so it does not persist on a pooled connection across transactions | source (`true` argument in both writers) |
| Same-transaction reads | Any statement in the same transaction can `current_setting('app.current_session_token')`. This is inherent: the application that already holds the cookie runs that SQL. It matters only if SQL injection or an untrusted query runs in the bound transaction | source |
| `pg_stat_activity.query` | Shows `$1`/`$2` placeholders, not values, for parameterized statements | PostgreSQL behaviour, UNVERIFIED on the deployment |
| `pg_stat_statements` | Normalizes constants; does not store bound values | PostgreSQL behaviour, UNVERIFIED |
| Server statement logging | With `log_statement = 'all'` or a `log_min_duration_statement` hit, bound parameters are logged in full unless `log_parameter_max_length = 0`. Default is `-1` (full). Error logging of parameters is off by default (`log_parameter_max_length_on_error = 0`) | PostgreSQL defaults, deployment configuration UNVERIFIED |
| Application ORM logging | No Drizzle `logger` option and no `django.db.backends` SQL logger were found in `packages/db/src` or `apps/union-eyes` | source search. Django logs SQL with parameters at DEBUG when `DEBUG = True`; this must stay off outside development |
| Error text | A failed `set_config` surfaces no parameter value by default | PostgreSQL default, UNVERIFIED |
| Raw bearer in test fixtures | `bearer-org-binding.test.ts` uses the literal `'opaque'` | source |

## 4. Required controls (none applied by this branch)

1. **Deployment gate (owner: operations).** `log_parameter_max_length = 0`, `log_statement` not `all`, and slow-statement logging reviewed, on every PostgreSQL instance serving these predicates. Evidence required: the effective `SHOW` output from the target database.
2. **Code (owner: platform-auth + UE database authority).** Stop passing the long-lived cookie. Either mint a short-lived bridge session for the `pg-session` path as the provider-bridge path already does, or bind a derived proof (the SHA-256 hex) and change the predicates to compare it directly. Either change touches migration `0041` (unapplied) and the registered cache migration `0017` and bootstrap-v2, so it must go through the governed lineage and be proven on PostgreSQL 15 and 16 with the Django path.
   - *Candidate with no migration change:* in `withResolvedOrgBinding`, drop the early `pg-session` return so the already-validated password session is exchanged for the 30-second bridge row (revoked in `finally`). It is NOT applied because `authority: 'pg-session'` is a contract consumed by `lib/auth/canonical-organization-selection.ts` (lines 35, 47, 189, 196, 309, 329), `bearer-org-binding.test.ts` and the native identity suite `scripts/bootstrap-v2/auth-native.test.ts` (line 248, needs the native image). Changing the label and those consumers together, with the native suite green, is the required proof.
3. **Ratchet.** Do not add a second consumer of `app.current_session_token`; the allowlist is the set of files that reference it today.

## 5. Not claimed

This review does not claim the bearer is safe in production. It claims only the source-level facts above.

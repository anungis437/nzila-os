# Invitation email compatibility local qualification

The controlled invitation form failed on source cccfc8c3 because the live shared
email check rejected a tagged address accepted by application validation. The
invitation remains unused. The canonical storage envelope retains previous
addresses and adds plus and apostrophe; it does not merge aliases or change
tenant, inviter, MFA, audit or session authority.

[Local validation](local-validation.json) records the actual five repository
checks against seven frozen inputs, 13 envelope checks, and 15 real disposable
PostgreSQL invitation cases. The native cases reproduce the form failure,
preserve unused-token state, exercise atomic upgrade rollback/idempotence,
prove mandatory-audit rollback and same-token retry, and serialize duplicate
redemption. Four added native cases remain opt-in in the ordinary fast suite;
their separate actual native execution is recorded explicitly.

The [schema-plan review](schema-plan-review.json) finds exactly one changed SQL
statement, the canonical auth-user email check. Released migration files are
unchanged. CI/admission, retained-copy and primary compatibility execution,
actual recipient acceptance/dashboard/case creation and reopen remain pending.
This record grants no full base STAGING GO and no production authority. Finance
features remain excluded.


## Corrected source qualification

PR #1262's first source failed branch naming and two contract jobs checking the
same stale shared-schema fingerprint. Those failures are preserved. The revised
source uses the repository's permitted fix/ branch family and refreshes only the
auth-schema fingerprint in the generated 63-file baseline. The invitation logic
and all three native-tested source inputs remain byte-identical.

[Corrected local validation](local-validation-v2.json) records the new full five
checks against eight frozen inputs and the whole contract suite. The prior native
execution is reused explicitly by its unchanged source hashes and original time.
The [baseline review](schema-baseline-review-v2.json) records the single expected
fingerprint change. CI, retained-copy/primary compatibility execution and actual
recipient acceptance remain separate, pending proofs. No staging GO is granted.

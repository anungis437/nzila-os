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

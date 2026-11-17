# Invitation email storage compatibility

The controlled recipient reported an internal server error while submitting the
invitation acceptance form on application source
`cccfc8c311a1017f80241bf089c00ef0c6828751`, workflow/main
`c3b7349260d3736860f4faef5b72c20c68d3ce63`. Read-only primary inspection on
2026-11-17 confirmed that the invitation remained unused and its inviter remained
an active administrator. The live `user_management.users.valid_email` check
excluded `+`, although the application accepts tagged addresses. The same storage
predicate also excluded apostrophes accepted by the current application validator.
The public invitation rendering repair did not prove new-account acceptance.

The canonical shared Drizzle check now preserves the previous address alphabet
and adds those two characters. Addresses are not stripped, merged, or mapped to
another account. Existing uniqueness, inviter serialization, tenant grants,
forced RLS, mandatory audit and session lifecycle remain authoritative. The V2
source plan commits to the shared predicate producer. Original released migration
files and the original installation ledger are unchanged.

An explicit owner-operated compatibility statement is provided separately from
application startup. It refuses missing, changed, unvalidated or conflicting
checks, and requires the relation owner. It validates the replacement before
retiring the old check in one atomic statement; an already upgraded check is a
no-op. Execution requires bounded lock and statement timeouts, exact source
admission, a retained-copy rehearsal, and before/after verification of data,
relation identity, ownership, grants, policies and other constraints. No business
row update, schema reset, privilege expansion or RLS change is authorized. After
tagged accounts exist, reinstating the incompatible old check is not a valid
rollback: retain the compatible envelope or use a qualified forward repair.

Targeted local execution on 2026-11-17 passed 13 storage-envelope tests and all
15 disposable native PostgreSQL invitation tests. Native execution reproduced
HTTP 500 under the original check, verified no persisted user, membership,
session, accepted audit or token consumption, exercised upgrade rollback and
idempotence, and retried the same invitation successfully. It also forced a
mandatory acceptance-audit failure, proved all related writes rolled back, then
retried successfully. Two simultaneous new tagged-account submissions committed
only one user, membership, session and accepted audit. Existing inviter lifecycle,
membership-removal, foreign-organization, reissue and replay cases still passed.
These are local results, not actual recipient acceptance or staging GO.

The first published candidate, `482df3d6780aa58cf6b3f4851912875b3b88f2f0`
(PR #1262), failed CI: its branch prefix was outside repository policy, and two
contract jobs found the same unrefreshed shared-schema fingerprint. The corrected
branch uses the permitted `fix/` family and refreshes that generated baseline;
the invitation implementation and native-tested SQL producer remain unchanged.
The first retained-copy attempt stopped at the operator access preflight before
opening a transaction or changing a check. Its failed receipt is retained and
the copy was stopped with its network and data retained. No primary compatibility
update or recipient retry is inferred from those attempts.

The exact candidate still requires the repository checks, CI, actual retained-copy
and primary compatibility evidence, and the recipient's original-invitation retry
with dashboard and case creation/reopen evidence. Founder-delegated engineering
execution continues under staging-only CHG-2026-0114; anungis and anungis437 are
one founder. Preserve both existing controlled accounts and their cases. Keep the
pending invitation's inviter an active canonical administrator until acceptance
has committed and been corroborated. Finance features, production deployment,
live-data resets, and fictional independent approval are outside this repair.

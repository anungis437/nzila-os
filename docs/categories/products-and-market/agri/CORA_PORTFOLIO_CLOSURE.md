# Cora portfolio closure reconciliation

Mission base: `01bb54ffde86d050b996a3a5fe7cc0f55d2ab804`.
Original PR #928 head: `fac513edd8009cfde75f3e5bba223ecc95e5a114`.

The eight original-workspace divergences are reconciled in
[CORA_PORTFOLIO_DIVERGENCE_RECONCILIATION.json](CORA_PORTFOLIO_DIVERGENCE_RECONCILIATION.json).
Five TypeScript differences have identical parsed syntax; two Markdown differences
normalize identically under the repository formatter; the remaining Next.js
root-params import is generated output. Committed PR/main source is authoritative.
No local divergence contains additional product behaviour.

The reconstruction retains current main's canonical provider-identity gateway,
application authorization and Union Eyes authentication repair. It does not restore
the old direct identity-binding lookup. Cora persistence moves to the database
package with the same organization filters, validation, transactional writes and
hash-chained audit. Database integration fixtures move to repository tooling;
application runtime receives no raw database client. Root acceptance thin aliases
are replaced by their explicit existing harness commands.

## Activation and lifecycle limits

Qualification uses synthetic data. Farmer 360 and evidence records do not inherit
conversation-history or Agrimo retention schedules. The lifecycle manifest records
the six Cora tables as awaiting an approved live-data retention/deletion disposition.
Runtime write policy and consent ports deny by default; source disclosure remains
WITHHOLD with no installed policies. No live provider, producer-data collection,
research outreach or production activation is authorized by this reconciliation.
Historical acceptance receipts remain historical, pending a fresh exact-head result.

The path-by-path reconstruction is recorded in
[CORA_PORTFOLIO_PATH_MANIFEST.json](CORA_PORTFOLIO_PATH_MANIFEST.json).

## Qualification

Local checks exercise the reconciled source, including the canonical auth gateway
with non-owner, non-inheriting credentials generated per disposable run. The fixture
lifecycle is SESSION: teardown deletes its database volume. This does not establish
a retention period or deployment posture for live Farmer 360 data.

Authoritative qualification belongs to the exact committed PR #928 head, tree and
base. Its required automated checks and isolated Linux full `test:fast` result must
be linked in the PR disposition; local results do not replace that proof. No
merge-readiness or production-activation claim is made by this source record.

# Observed staging candidate and pending replacement

Observed on November 13, 2026: `8a0faf64cc67a8bfaef35e39f5acdda8a9ef4896`,
image `sha256:133c63e0e8abef77a4ad46aee76fa6a337fa01f9f9e38ada26bc75941f308340`,
revision `nzila-ue-v2-staging-app--0000010`, explicitly pinned to 100% traffic
in Multiple revision mode. The live registration uses Entra tenant `cc15259a`
and client `5470c759`. Current health, session, document and job observations
are preserved in [the execution evidence](evidence/ue-v2-execution-20261113/index.json).

Proposed replacement: `2786943ac51f42b24edc808031015b539ae091f1` in PR #1210.
CHG-2026-0114 renews the staging-only binding for the observed evidence-storage,
conversation retry and rollout identity defects. It also includes the current
pinned-traffic recovery qualification harness. Final exact-head CI, main
admission, attested images, a fresh reviewed no-delete what-if, protected
staging apply and deployed requalification remain mandatory. This source is
not yet deployed or accepted.

Preserve the existing database, original installation receipt and all staging
data. The regenerated source plan retains 771 tables and 6,255 unchanged SQL
statements; source commitment metadata changes do not justify a new restore,
fresh bootstrap or reseed. The [earlier local export receipt](evidence/ue-v2-candidate-export-7d67bcd5-20261111.json)
remains historical; do not relabel it as replacement acceptance.

The [current contract](UE_STAGING_GO_CONTRACT.json) separates observed 8a0faf64
receipts from pending replacement qualification. The old contract is preserved
as a historical receipt. Census regeneration now preserves the evidence
contract; explicit initialization can only create a new one. Tests generate
into disposable directories instead of rewriting live acceptance evidence.

Base release includes operational casework, intake, assignment, member and
representative journeys, leadership/governance access, documents/evidence,
deadlines, messaging, English/French/mobile, audit, security and recovery.
Finance/dues persistence and Financial Officer 2.1 are excluded. Sensitive
finance denials remain a separate mandatory security criterion. No production
release or institutional mandate is authorized. Staging remains NO_GO while
actual defects or required proof gaps remain.

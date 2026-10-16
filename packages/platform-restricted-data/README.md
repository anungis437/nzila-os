# @nzila/platform-restricted-data

Platform control plane for Restricted information. Apps and a later CIVITAS rebase call these functions. CIVITAS does not own them, and this package does not open CIVITAS Phase 3 (`CIVITAS_PLATFORM_CONTRACT.phase3` is `CLOSED`).

The governance tiers stay Public, Internal, Confidential, and Restricted. Unlabelled non-sensitive data stays Internal. A Restricted personal field, a sensitive schema, or an app that declared a Restricted capability fails closed until a tier is explicit.

`@nzila/os-core` classification is a separate scale (it includes CUI and national-security labels and ranks Restricted below Confidential). This package does not change that scale.

## Evidence classes

`CODE_PROVEN`, `CONFIG_PROVEN`, `RUNTIME_VERIFIED`, `EXTERNAL_CONTRACT_VERIFIED`, `UNVERIFIED`.

One class is not a substitute for another. Provider zero-retention text in the data inventory stays `UNVERIFIED`. Restricted model processing stays denied. Customer-managed keys are required for Restricted data and are not verified in a running environment. Residency statements are readings of committed files, not a live Azure probe.

## What a later CIVITAS rebase consumes

Principal-scoped Restricted storage and reads, explicit service and agent grants, verifier minimum disclosure, `redactObservabilityRecord`, Restricted audit metadata, `evaluateRestrictedModelPath`, principal export, retention statements, deletion semantics, legal hold, and scoped break-glass.

Sequence after this change: merge through normal governance, rebase CIVITAS, rerun Phase 2.5, record a new disposition, and open Phase 3 only if that gate permits it.

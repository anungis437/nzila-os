# @nzila/platform-restricted-data

Platform control plane for Restricted information. Apps and a later CIVITAS rebase call these functions. CIVITAS does not own them, and this package does not open CIVITAS Phase 3 (`CIVITAS_PLATFORM_CONTRACT.phase3` is `CLOSED`).

The governance tiers stay Public, Internal, Confidential, and Restricted. Unlabelled non-sensitive data stays Internal. A Restricted personal field, a sensitive schema, or an app that declared a Restricted capability fails closed until a tier is explicit.

`@nzila/os-core` classification is a separate scale (it includes CUI and national-security labels and ranks Restricted below Confidential). This package does not change that scale.

## Evidence classes

`CODE_PROVEN`, `CONFIG_PROVEN`, `RUNTIME_VERIFIED`, `EXTERNAL_CONTRACT_VERIFIED`, `UNVERIFIED`.

One class is not a substitute for another. Provider zero-retention text in the data inventory stays `UNVERIFIED`. Restricted model processing stays denied. Customer-managed keys are required for Restricted data and are not verified in a running environment. Residency statements are readings of committed files, not a live Azure probe.

## What a later CIVITAS rebase consumes

Principal-scoped Restricted storage and reads, explicit service and agent grants, verifier minimum disclosure, `redactObservabilityRecord`, Restricted audit metadata, `evaluateRestrictedModelPath`, principal export, retention statements, deletion semantics, legal hold, and scoped break-glass.

This is an in-process reference control plane, not an authenticated persistence
service. Trusted application adapters must derive actor and org/principal scope
from canonical platform authentication. Grant, storage and legal-hold mutation
functions are administrative interfaces for those trusted adapters, not public
request handlers. Mutable state, resets and the destructive synthetic red-team
harness are not exported from the public package API. Returned records and grants
are detached snapshots; request-supplied clocks cannot revive expired access.

Restricted classification is retained by the AI request schemas and routes.
Restricted knowledge ingestion is rejected before proposal/source persistence;
Restricted model requests stay denied. No live provider contract, CMK, residency
or backup/replica propagation claim is upgraded by these source-level checks.

CIVITAS privacy stays HOLD and Phase 3 stays CLOSED. A future privacy evaluation
and a new explicit maintainer decision are required before any consideration of
Phase 3; this change grants no such decision or production/data authorization.

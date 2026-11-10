# Exact-source staging prerequisite receipt

Candidate: `d093936d06209cc6321464dd85caded6f945166e`.

The [measured local export receipt](evidence/ue-v2-candidate-export-20261110.json)
records the current dependency-bound plan and emitted restore file hashes.
Pinned PostgreSQL 16 installed the plan, verified 23,849 catalog objects and the
native privilege boundary, returned receipt-backed NOOP, then restored the
actual emitted dump into another empty database and repeated those checks.
Both restore and privilege checks passed, with no privilege mismatches.

This is a local export prerequisite. It does not establish Azure database
installation, application sessions, deployed tenant isolation, delivery,
telemetry, recovery or STAGING_GO. Use only these exact hashed artifacts for
the source-bound private restore after main admission and governed foundation
deployment. Preserve an unexpected target state rather than overwriting it.

The candidate keeps unresolved precedent and signature-audit ownership denied;
these capabilities remain unavailable. Packaged admission recognizes the exact
compiled denial and rejects added runtime access. Ordinary and system auth use
distinct restricted logins; shared health inspection uses an explicit startup role.
The [private credential receipt](evidence/ue-v2-private-password-policy-20261110.json)
records policy-compliant staging credentials prepared before server creation,
protected GitHub admin-secret synchronization, and the measured runtime/admin
vault read boundary. It contains no credential values.

Export privacy now strips credential-bearing URL data from spans, events and
links before either OTLP transport serializes them. Real local HTTP/JSON and
gRPC/protobuf collector receipts preserve trace/correlation identity and show
no synthetic callback code, signed URL signature, cookie or URL password.
The tracing helper also propagates business failures without repeating work.
See [the measured privacy receipt](evidence/ue-v2-telemetry-privacy-local-20261110.json).

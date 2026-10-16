# Redirect guard repair: Phase A stop

Mission `NZ-20261008-INFRA-001`; slice `G2_STAGE2A_REDIRECT_GUARD_REPAIR`.

`REJECTING_REDIRECT_PREDICATE = UNDETERMINED_FROM_SAVED_EVIDENCE`

`REDIRECT_REPAIR_EXECUTION_AUTHORITY_CONSUMED = NO`

`STAGE2A_PRIVATE_ORAS_DELIVERY_PARTIAL`

`OVERALL_G2 = FAIL`

## Static authority boundary

The packet explicitly requires: if the exact rejecting predicate cannot be
determined from source and saved result, stop before execution and improve
diagnostics locally only. This condition applies. No fresh Azure deployment,
guest execution, network/RBAC mutation, source staging or import occurred.
Phase B live/provider/deployment gates are not activated. No new executable
observer/Bicep authority is claimed; the local validator is not wired into
the consumed observer.

## Source and runtime correlation

The exact [consumed observer](G2_BLOB_READBACK_EXECUTED_observer.py) matches its
[source authority](G2_BLOB_READBACK_SOURCE_AUTHORITY.json). The
[saved result](G2_BLOB_READBACK_OBSERVER_RESULT.json) contains approved
scheme/hostname/default-port metadata emitted after successful parsing.
Therefore the early character/parse/port-reading guards did not reject it.
The remaining five predicates share one exception code and short-circuit.
Their inputs were not persisted.

| Predicate ID | Field / accepted state | Rejected state | Consumed evaluation / safe input |
|---|---|---|---|
| INITIAL_HTTP_307 | Initial blob status = 307 | Any other status (different error code) | Evaluated, passed: 307 |
| LOCATION_PRESENT | Nonempty Location | Empty/missing (different error code) | Evaluated, passed: PRESENT |
| RAW_CONTROL_CHAR | No codepoint <=32 | Control/space anywhere | Evaluated, passed |
| RAW_BACKSLASH | No backslash | Backslash anywhere | Passed; short-circuit evaluation depends on previous operand, which was false |
| URL_PARSE | urlsplit succeeds | ValueError | Evaluated, passed |
| URL_PORT_PARSE | port readable | Malformed/out-of-range port | Evaluated, passed: null |
| URL_SCHEME | https | Other scheme (different error code) | Evaluated, passed: https |
| URL_EXACT_HOST | Exact regional data hostname | Other hostname (different error code) | Evaluated, passed: approved host |
| URL_PORT_ALLOWLIST | None or 443 | Alternate port (different error code) | Evaluated, passed: None |
| URL_USERNAME | Falsy username | Truthy username | Evaluated; value unavailable; possible rejector |
| URL_PASSWORD | Falsy password | Truthy password | Evaluated only if username falsy; unavailable; possible rejector |
| URL_FRAGMENT | Falsy fragment | Truthy fragment | Evaluated only if previous predicates passed; unavailable; possible rejector |
| URL_PATH_SLASH | Path starts with slash | Empty/nonabsolute path | Evaluated only if previous predicates passed; unavailable; possible rejector |
| URL_PATH_DOUBLE_SLASH | Path does not start with double slash | Double-leading-slash path | Evaluated only if previous predicates passed; unavailable; possible rejector |
| QUERY_PRESENCE | No acceptance predicate | No rejection based on query | Captured true; never tested for rejection |
| HOST_SUFFIX | No separate suffix guard | Not applicable | Exact-host guard is stricter; no wildcard |
| IP_LITERAL / LOCALHOST | Must match exact approved hostname | Aliases/IP literals fail exact-host guard | No separate guard; approved host observed |
| HOST_NORMALIZATION | Python urlsplit hostname normalization | No separate canonicalization guard | Exact comparison passed; original host spelling unavailable |
| REDIRECT_COUNT | Two explicit connections maximum; initial status 307 required | Second-hop non-200 is a distinct code | Count 0 at guard failure; not its cause |

The saved `PATH_CATEGORY = OPAQUE_BLOB_DOWNLOAD` is a constant label, not a
measured path property. It cannot establish that path-prefix validation passed.

## Why exact recovery is impossible

Five synthetic fixtures, each representing a different remaining rejector,
produce the same saved metadata and generic rejection. Local regression tests
demonstrate this loss of distinguishability. Fixtures contain only fabricated
query placeholders, not old URL data. No old signature, query or path is
recovered or reconstructed.

The exact first-true predicate is unknowable from this evidence. Naming
`URL_PATH_DOUBLE_SLASH` or any other candidate as the cause would be invented.
This is a diagnostic-granularity defect; it does not establish that an
otherwise valid Azure redirect was rejected by a specific path guard.

## Protocol and local-only diagnostics

Microsoft's [dedicated data endpoint documentation](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-dedicated-data-endpoints)
describes login discovery, HTTP 307, exact regional dedicated endpoint patterns,
and temporary download links. A signed query is permitted, not a rejector.
The previously bound
[protocol evidence](G2_BLOB_READBACK_MICROSOFT_PROTOCOL.md) and
[endpoint mapping](G2_BLOB_READBACK_DNS_ENDPOINT_MAPPING.json) preserve the
separate Private Link login/data endpoint IP contract.

New local [validator](../../infrastructure/landing-zone/g2-builder/stage2a/redirect-guard/validator.py)
splits each rejection into a fixed predicate-specific reason. It permits a
signed query without logging names/values, requires HTTPS, exact data hostname,
default/443 port, nonempty path, no userinfo or fragment, and valid parsing.
It records only allowlisted metadata; unexpected hostnames/schemes are not
echoed. It does not invent a storage-internal path prefix, and it preserves
the path/query bytes when returning an in-memory request target.

Double-leading-slash paths are accepted locally only under an already pinned
exact HTTPS authority. A future caller must use an explicit HTTPS connection
to that host with the returned request target, never URL-join that target into
a new authority. This module makes no network call and cannot redirect a
request by itself. No claim is made that this path shape was the real rejector.

Existing consumed source, snapshots, execution results and sealed historical
evidence are unchanged. New regressions cover observed safe shape, exact-host
denial, scheme/port/userinfo/fragment/parse failures, path presence, secret-safe
diagnostics, and the historical ambiguity.

## Disposition

New repair execution authority remains unconsumed. No target blob was fetched
or hashed. Data-endpoint DNS/TLS/HTTP remain NOT_REACHED by guest execution;
archive SHA UNPROVEN; equivalence UNRESOLVED. The latest observed registry
status 307 and approved redirect host are historical evidence, not a new run.

This packet's requested successful or consumed-execution output shape is
inapplicable because its earlier Phase A stop condition took precedence.
Further guest diagnostic execution requires explicit resolution of that
prerequisite; local tests cannot retroactively identify the historical URI.

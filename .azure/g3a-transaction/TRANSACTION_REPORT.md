# G3A registry/controller qualification: local fixture packet

Mission: `NZ-20261008-INFRA-001`.

**G3_EXECUTION_READINESS = BLOCKED. G3A_CONTROLLER = INCOMPLETE.**
The portable builder remains qualified and was not modified or executed.

## Surviving blockers

1. **First executable and guest runtime delivery.** No proof binds Python, curl
   or a CA/runtime set to the pinned
   `Canonical:ubuntu-24_04-lts:server:24.04.202609040` image. The documented CSE
   script channel invokes `/bin/sh`, but does not guarantee the Python/curl
   dependencies needed for private ACR authentication/retrieval. Its MSI
   downloader is documented for private Azure Blob Storage; ACR Entra token
   exchange support is not established. No self-contained inline/private-reader
   delivery alternative has been qualified. This is not a claim that one is
   impossible. Exact inline bytes, settings and command remain unresolved.
2. **Live transaction adapters and complete top-level package.** The phase
   state machine is fixture-tested, not an actual deploy/run/cleanup adapter.
   Input create/stage/lock, provisioning, bootstrap, readback/reconciliation and
   full VM/CSE Bicep remain unimplemented/unqualified. Only exact ABAC assignment
   modules are compiled. No placeholder top-level deployment is emitted.
3. **All-in cost closure.** Bootstrap-dependent resources and delivery bytes
   remain unpriced. The known priced component subtotal is
   **CAD 4.024990512273456666666666667**, not an all-in expected cost or execution
   ceiling. Both required all-in values remain `UNRESOLVED`.

Do not replace these blockers with a workstation runtime assumption or describe
the fixture state machine as a complete production controller.

## Qualified local protocol surfaces

**25 local tests passed.** No test connects to a cloud endpoint.

- Integrated the byte-identical sealed private-reader token exchange into an
  actual guest-pipeline retrieval function; fixtures cover IMDS identity
  selection, manifest/media/artifact/digest checks, private DNS/TLS policy,
  bounded streaming, safe extraction and data redirects.
- Empty-path signed URLs are mapped to HTTP origin-form `/` without altering
  signed query bytes. Authorization is never forwarded to data endpoints.
- Direct uploader consumes the qualified six-file OCI layout. It validates
  digest/size/media contracts locally; checks approved tag and digest collision;
  skips existing verified blobs; initializes/commits missing blobs once; PUTs
  the original manifest bytes once; verifies immutable digest readback; erases
  session tokens.
- Same-digest pre-existence and different-digest collision both stop before
  upload. Ambiguous commit/manifest outcomes stop with no retry.
- Manifest PUT body hashes to
  `sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7`.
- Future negative-probe functions hit authenticated repository operations.
  Denial requires 401/403, successful scoped token exchange, private path/TLS
  context and an authorization-denial body. DNS/TLS/timeouts/404 do not qualify.
  Unexpected successful empty-upload probes cancel only their exact newly
  created session once; failed cancellation stops for reconciliation.
- Target Writer and input Reader identities remain separate. Both identities'
  input-write negatives are represented in the fixture matrix.
- Token sentinels, token bodies, Authorization headers and signed URLs are not
  persisted in evidence. Fixture credentials exist only in test memory/source
  as synthetic constants, never real credentials.
- Eighteen explicit controller phases, durable exclusive authority consumption
  before the first mutation, fail-closed later-phase stopping and exact
  creation-receipt-owned cleanup are tested.

These are **local fixture qualifications**, not live ACR behavior, guest runtime
proof, or real RBAC/ABAC denials. ACR Writer can update repository tags: collision
readback is not an atomic compare-and-create primitive. Future execution must
prove a serialized exclusive writer window and absence of competing writers;
this packet does not claim server-side atomic no-overwrite enforcement.

## Bootstrap and resource contracts

[Bootstrap contract](./G3A_BOOTSTRAP_CONTRACT.json) records the unresolved first
byte. The documented CSE **script-parameter** limit is 256 KB, not a blanket claim
about every protected-settings JSON limit. A conservative test guard uses
256,000 bytes and requires at least 50% margin. No actual inline payload was
qualified, so its exact byte count and margin remain unresolved.

[Resource graph](./G3A_RESOURCE_GRAPH.json) binds deterministic future names,
regions, ownership and lifecycle; no name absence is inferred from this design.
Existing G2 target ACR is never updated/deleted; G3 target PE is new. G3 RG/VNet
foundation and bootstrap delegation are protected bootstrap-owned prerequisites.
Only positively captured G3A creation receipts authorize deletion; no resource
group cascade or foreign cleanup is allowed.

Input lifecycle: G3A create/stage -> lockdown/writer revocation -> private read ->
retire after success. Final target artifact is retained by immutable digest for
G3B. No G3B work was performed.

Exact Reader assignments for `g3-build-source` and `g3-build-tooling`, and Writer
for `g3-synthetic-runtime`, use condition version 2.0 and deterministic Bicep
assignment GUID expressions. No AcrPush/registry-wide/catalog fallback.
[Assignment modules](./bicep/) build and lint locally; this does not qualify the
missing top-level G3A package or actual grant capability.

## Cost evidence

[Cost model](./G3A_COST_MODEL.json) uses captured public CAD retail meters, exact
IDs/units/tiers and complete relevant pagination. It bounds stage/lock at two
hours, builder at two hours and G3A transaction at four hours.

The priced subtotal includes a conservative Premium registry day, provisional
input-storage day, two PEs, private DNS/queries, B2s VM, Standard SSD disk/day and
operations, private-link processing/traffic bounds and one month of final-image
incremental storage. Conservative transfer out is a budget bound, not a claim
that intra-region delivery is billed at that rate.

No G3B, G2 base firewall, Log Analytics, public IP or native ACR Tasks are priced
as G3A resources. No standalone hourly NIC/NSG/UAMI charge is invented.
The rounded 150%-subtotal illustration is explicitly not an approved ceiling.

## Evidence and validation

- [Required disposition](./TRANSACTION_DISPOSITION.json)
- [Exact PUT fixture proof](./UPLOAD_FIXTURE_PROOF.json)
- [Authenticated-negative fixture matrix](./NEGATIVE_AUTHORIZATION_FIXTURES.json)
- [Token hygiene proof](./TOKEN_HYGIENE_PROOF.json)
- [Local validation](./TRANSACTION_LOCAL_VALIDATION.json)
- [Bicep module validation](./BICEP_LOCAL_VALIDATION.json)
- [Public source ledger](./PUBLIC_SOURCE_LEDGER.json)
- [Evidence seal](./TRANSACTION_VERIFICATION.json)
- [Independent verification](./TRANSACTION_INDEPENDENT_VERIFICATION.json)

Commands:

- `python -B prepare.py`: PASS qualified core census and sealed-reader copy.
- `python -B -m unittest -v test_registry test_controller`: initial count
  assertion failed because three distinct blob initiations share an API path;
  corrected fixture assertion passed. Uploader retry logic was not changed.
- `python -B qualify.py`: PASS **25 tests**, Python syntax, exact PUT/token
  proofs and both Bicep modules' build/lint.
- `python -B collect_public.py`: partial public capture; bandwidth request
  returned HTTP 429. Successful captures preserved.
- `python -B public_supplement.py`: PASS explicit failure ledger and missing
  pricing captures. A guessed CSE source URL returned 404; no code provenance
  claim is based on it.
- `python -B public_finish.py`: PASS relevant pricing pagination.
- `python -B contracts.py`: PASS deterministic contract and component arithmetic.
- `python -B seal.py` and `python -B independent_verify.py <root>`:
  outcomes in their linked evidence.

No application/image rebuild, compressor run, guest execution, Azure/Entra/RBAC
read or mutation, registry API call, push/import, package installation, global
PATH change or foreign/product edit occurred. Public docs/pricing GETs are not
authenticated Azure control-plane or registry calls.

**STOP at the surviving G3A prerequisites.** Overall G3 remains blocked;
technical/G3A/G3B execution is not authorized. G2 terminal evidence and the
qualified/failed build packets remain unchanged. UE and Cora remain `INFRA_NO_GO`.

# G3A conditional local closure — INCOMPLETE

This sibling contains local candidate source, not authority to execute G3A.
The two live entrypoints unconditionally fail closed. No Azure/registry calls,
portable core rebuilds, uploader requalification, or historical packet edits
are performed by local validation.

## What is actually wired

`guest_pipeline.py` uses hash-checked frozen `controller.py`, `registry.py`,
and `sealed_reader.py`. It retrieves source and portable inputs by OCI digest,
checks exact archive membership and frozen input bytes, invokes the existing
portable assembler through an isolated runner, validates its **`output/oci`**
layout, uses the single-use qualified uploader (including collision checks
and immutable digest readback), and requires authenticated negative ABAC
denials. No fixture result is a guest/runtime proof.

`lifecycle.py` preserves all 18 exact phases, stops on every phase failure,
and limits cleanup to positive creation receipts with exact planned IDs.
Existing G2 resources, network, bootstrap delegation, and resource groups
can never become owned through this ledger. Delete acknowledgements are not
zero-residual proof; final fresh reconciliation remains required. Exceptions
do not trigger mutation retries.

## Why the package must not be called complete

The proven `g3a-bootstrap` ELF is marker-only. Its frozen SHA and
`G3A_BOOTSTRAP_REQUESTED_V1` remain unchanged; it is explicitly rejected as a
pipeline runtime adapter. No self-contained hash-bound Python/TLS capsule or
production isolated-root runner has been qualified. The core checks absolute
paths including `/etc/ssl/certs/ca-certificates.crt`; Ubuntu normally has that
path. Clearing `PATH` does not satisfy core isolation. Neither Python, curl,
mount tools nor guest CA trust are inferred from the VM image.

This is a concrete **separate guest-delivery/isolation qualification gate**,
not a request to rebuild/requalify the core or uploader. No candidate binary
is emitted. Thus no final production Blob URI, protected CSE command, or
guest transport byte census can honestly be supplied. CSE settings in
`CLOSURE_CONTRACT.json` preserve selector 2.1; proof resolved 2.1.19 does not
prove a future patch version. No placeholder/marker CSE resource is emitted.

## Bicep and ownership

`bicep/main.bicep` is the conditional infrastructure foundation: private
Storage/Blob PE/DNS with versioning **false**, private Premium input ACR and
input/target ACR PEs/DNS, separate reader/push UAMIs, exact repository ABAC
reader/producer assignments, and exact candidate IDs. It references the
bootstrap-owned existing VNet/builders/PE subnets; it never modifies them.
The target registry is only a private-link service reference, never a
create/update/delete resource. PE subnet must be readback-proven as
`10.91.3.0/24`; builder subnet as `10.91.4.0/28`.

`builder.bicep` pins VM image, size, disk, private NIC and UAMIs. It is **not
invoked by the foundation** while guest delivery is blocked. `target-role.bicep`
must run in the exact baseline G2 registry group only after future authority;
the absent live provisioning adapter prevents accidental invocation.

Producer grants are transient and must be revoked by **exact recorded IDs**
before builder creation; incremental redeployment does not remove them.
Private producer transport, producer creation/staging/revocation adapters,
baseline-role collision/ownership verification, target connection approval
ownership, VM/CSE sequencing, durable live authority/exclusive writer lock,
fresh reconciliation, and evidence seal adapters remain **INCOMPLETE**.
Never delete baseline target private endpoint connections or use RG cascade.

Cost preconditions accept only sibling `g3a-ca-live\FULL_G3A_COST_MODEL.json`,
SHA256 `65fa213d6df9fc6995ded1a636eed13eedd322c4238d02d81745bb4e7d57e83b`,
using its actual `G3A_EXPECTED_COST_CAD` (4.8973042) and
`G3A_COST_CEILING_CAD` (7.35) fields. Callers must explicitly supply its path
and hash; no defaults or unrelated cost artifacts are accepted. The controller
checks the binding before any phase, retains the parent's quantity bounds,
and requires a ceiling at least 50% above expected cost. This is not execution
authority or actual runtime payload qualification. Guest payload hashes/census
and enforcement against these bounds remain required before future mutation.
No parent cost artifact is changed and no prices are invented here.

## Local validation

From this directory, with `PYTHONDONTWRITEBYTECODE=1`:

```text
python -B -m unittest -v test_closure
bicep.exe build bicep\main.bicep --stdout
bicep.exe lint bicep\main.bicep
```

Build/lint all four Bicep files. `repository-reader.bicep` preserves the exact
frozen assignment naming/condition contract. Results are in `LOCAL_VALIDATION.json`.
Do not deploy these sources. Next gate is `G3_CONTROL_PLANE_BOOTSTRAP` followed
by fresh separate G3A authority. G3A/G3B/technical execution remains **NO**.

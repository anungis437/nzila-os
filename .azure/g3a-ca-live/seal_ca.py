"""Seal the successful proof and honest conditional local-closure disposition."""

import json
from pathlib import Path

from independent_verify import audit, census
import proof

HERE = proof.HERE
BASE = HERE.parent
WORKTREE = BASE.parent
CLOSURE = BASE / "g3a-ca-closure"


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def protected():
    paths = {}

    def add(path, expected):
        absolute = str(Path(path).resolve())
        proof.ensure(absolute not in paths or paths[absolute] == expected, "PROTECTED_HASH_CONFLICT")
        proof.ensure(proof.sha(Path(absolute)) == expected, "PROTECTED_HISTORY_CHANGED_" + absolute)
        paths[absolute] = expected

    packets = (
        ("g3a-controller-repair", "REPAIR_VERIFICATION.json",
         "3d155ebc2a739ff9c91fd7011e8497878f34fd3390c6d0ecbd0554c730313f81"),
        ("g3a-transaction", "TRANSACTION_VERIFICATION.json",
         "0c216d4b17146236bf632640df6fef84c31deea7a9d814637e14714f6e0859a4"),
        ("g3a-firstbyte", "FIRST_BYTE_VERIFICATION.json",
         "41bbc792b3fc3edc57e87e860f4ab5624faca924e345a809413c31d0c83d1442"),
        ("g3a-live-bootstrap", "LIVE_BOOTSTRAP_VERIFICATION.json",
         "4ea8368db85b45ca3f33e0bdb91a40f9b10b350f5f1646ed5f9ec3b1c131a9d1"),
        ("g3a-bootstrap-retry", "RETRY_PREDEPLOY_VERIFICATION.json",
         "fc9dea154679a24200ba0ef68f8512c67ff5557b6227d3a60836fd17dd685a53"),
        ("g3a-bootstrap-resume", "RESUME_VERIFICATION.json",
         "b3d4c5d8b48f86e638bf50b62f6f7e30587ff3078739255948e5be9e394b8918"),
        ("g3a-content-addressed", "LOCAL_VERIFICATION.json",
         "5781c68b7d50efc41278cc17f8a3bc458f6de2cedc7745c7544c2e05231fdb2f"),
    )
    for directory, filename, root_sha in packets:
        root_path = BASE / directory / filename
        add(root_path, root_sha)
        data = load(root_path)
        for key in ("fileHashes", "repairFileHashes", "transactionFileHashes", "firstByteFileHashes",
                    "resumeFileHashes"):
            for relative, expected in data.get(key, {}).items():
                add(root_path.parent / relative, expected)
        for key in ("protectedFileHashes",):
            for name, expected in data.get(key, {}).items():
                path = Path(name)
                add(path if path.is_absolute() else WORKTREE / path, expected)
        if "retryPackageFileHashes" in data:
            for name, expected in data["retryPackageFileHashes"].items():
                add(Path(data["retryPackagePath"]) / name, expected)
    add(BASE / "evidence" / "G2_TERMINAL_FINAL_VERIFICATION.json",
        "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499")
    correction = proof.load("AUTHORITY_CORRECTION_BINDING.json")
    for path, expected in (
        (proof.ORIGINAL_AUTHORITY, correction["originalAuthoritySha256"]),
        (proof.AUTHORITY, correction["correctedAcceptanceSha256"]),
    ):
        add(path, expected)
    return paths


def main():
    proof.ensure(not (HERE / "CONTENT_PROOF_VERIFICATION.json").exists(), "ALREADY_SEALED")
    proof.fresh("CONCURRENCY_FINAL_SEAL.json", proof.baseline())
    audit()
    preserved = protected()
    local = load(CLOSURE / "CLOSURE_DISPOSITION.json")
    proof.ensure(local["G3A_CONTROLLER"] in {"COMPLETE", "INCOMPLETE"} and
                 local["G3A_BICEP_PACKAGE"] in {"COMPLETE", "INCOMPLETE"} and
                 local["G3A_TRANSACTION_READINESS"] in {"PASS", "BLOCKED"}, "LOCAL_DISPOSITION_INVALID")
    complete = local["G3A_CONTROLLER"] == local["G3A_BICEP_PACKAGE"] == "COMPLETE"
    proof.ensure(local["G3A_TRANSACTION_READINESS"] != "PASS" or
                 (complete and not local["blockers"]), "FALSE_TRANSACTION_READINESS")
    accounting = proof.load("MUTATION_ACCOUNTING.json")
    costs = proof.load("FULL_G3A_COST_MODEL.json")
    actual = proof.load("ACTUAL_COST_ESTIMATE.json")
    content = proof.load("CONTENT_FIRST_BYTE_RESULT.json")
    disposition = {
        "DEPLOYMENT_TOOLING_AVAILABLE": "YES",
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED", "G3A_REGISTRY_UPLOADER": "QUALIFIED",
        "G3A_BLOB_VERSIONING_DEPENDENCY": "NONE",
        "G3A_FIRST_BYTE_BOOTSTRAP_MODEL": "CSE_MANAGED_IDENTITY_CONTENT_ADDRESSED_PRIVATE_BLOB",
        "G3A_FIRST_BYTE_IMMUTABILITY_MODEL": "CONTENT_ADDRESSED_TRANSACTION_LOCK",
        "G3A_BOOTSTRAP_POSTSTATE": "DELETE",
        "CSE_TERMINAL_STATUS_PARSER": "QUALIFIED",
        "FIRST_BYTE_PROOF_AUTHORITY_CONSUMED": "YES",
        "CSE_HANDLER_SELECTOR": "2.1",
        "CSE_EFFECTIVE_HANDLER_VERSION": content["effectiveHandler"],
        "BOOTSTRAP_OBJECT_WRITE_ONCE": "PASS",
        "BOOTSTRAP_PRODUCER_WRITE_REVOKED": "YES", "BOOTSTRAP_STORAGE_LOCKDOWN": "PASS",
        "G3A_BOOTSTRAP_OBJECT_PATH": proof.OBJECT,
        "G3A_BOOTSTRAP_BINARY_SHA256": proof.SHA,
        "G3A_BOOTSTRAP_EXPECTED_MARKER": "G3A_BOOTSTRAP_REQUESTED_V1",
        "G3A_CONTENT_ADDRESSED_FIRST_BYTE": "PROVEN",
        "G3A_FIRST_BYTE_BOOTSTRAP": "READY",
        "CSE_HANDLER_DIAGNOSTIC_CAPTURE": "NOT_NEEDED", "FIRST_BYTE_FAILURE_CLASS": "NONE",
        "FIRST_BYTE_PROOF_EXPECTED_COST_CAD": proof.load("CURRENT_COST_GATE.json")["conservativeExpectedCAD"],
        "FIRST_BYTE_PROOF_COST_CEILING_CAD": "3.00",
        "FIRST_BYTE_PROOF_ACTUAL_COST_ESTIMATE_CAD": actual["estimateCAD"],
        "FIRST_BYTE_PROOF_RESIDUAL_STATE": "ZERO",
        "G3A_CONTROLLER": local["G3A_CONTROLLER"], "G3A_BICEP_PACKAGE": local["G3A_BICEP_PACKAGE"],
        "G3A_EXPECTED_COST_CAD": costs["G3A_EXPECTED_COST_CAD"],
        "G3A_COST_CEILING_CAD": costs["G3A_COST_CEILING_CAD"],
        "G3A_TRANSACTION_READINESS": local["G3A_TRANSACTION_READINESS"],
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "nextGate": "G3_CONTROL_PLANE_BOOTSTRAP",
        "sameCorrectedAuthorityNotAdditionalAttempt": True,
        "proofResourceGroup": proof.load("LIVE_PROOF_RESULT.json")["resourceGroup"],
        "conditionalLocalClosure": "ACTIVATED_LOCAL_ONLY",
        "localClosureBlockers": local["blockers"],
        "G3ACostBasis": "Conservative complete bounded scenario; actual guest payload/lifecycle must fit enforced caps before future authority.",
        "historicalFailedProofsPreserved": True, "noPortableBuilderOrUploaderRequalification": True,
    }
    for name in ("AZURE_MUTATING_DISPATCHES", "AZURE_SUCCESSFUL_MUTATING_DISPATCHES",
                 "AZURE_REJECTED_MUTATING_DISPATCHES", "AZURE_DELETE_DISPATCHES",
                 "ROLE_ASSIGNMENT_CREATES", "ROLE_ASSIGNMENT_DELETES", "UAMI_CREATES", "UAMI_DELETES",
                 "RUN_COMMAND_DIAGNOSTIC_ACTIONS"):
        disposition[name] = accounting[name]
    proof.fresh("FINAL_DISPOSITION.json", disposition)
    blockers = "\n".join("- " + text for text in local["blockers"]) or "- None."
    report = """# G3A content-addressed first-byte closure

## Live result

**G3A_CONTENT_ADDRESSED_FIRST_BYTE = PROVEN**. The same corrected authority
was consumed once; no additional authority or retry was created.
The frozen executable was not rebuilt or changed. Custom Script selector
2.1 resolved to 2.1.19, executed `G3A_BOOTSTRAP_REQUESTED_V1`, and reported
the exact runtime self-hash:
`5f82bd226a27fd1d066a211bb527049097c049181eae92ebf9b3fae3e16683d8`.

The SHA-addressed object was absent before one conditional PUT, read back
byte-for-byte with the same ETag, then consumed with producer write
authority revoked and public Storage access disabled. Versioning is
disabled; no query string, version ID, SAS, or Storage key was used.
No diagnostic action was needed.

## Cleanup and accounting

Proof RG and subscription deployment metadata were removed. Exact ARM
UAMI/Storage and Graph service-principal absence was reconfirmed.
Resource and role censuses are empty; G2 resources, roles, and terminal
root remain unchanged. **FIRST_BYTE_PROOF_RESIDUAL_STATE = ZERO**.

| Counter | Value |
|---|---:|
| Azure mutating dispatches | 9 |
| Successful mutating dispatches | 9 |
| Rejected mutating dispatches | 0 |
| Delete dispatches | 4 |
| Role assignment creates/deletes | 2 / 2 |
| UAMI creates/deletes | 1 / 1 |
| Run Command diagnostic actions | 0 |
| Registry mutations | 0 |

These are direct caller dispatches, not total ARM leaf/cascade RPC counts.
UAMI lifecycle involved nonzero directory-mediated activity; exact
internal Graph write count is not observed.

## Cost

- Expected proof: CAD 1.5363953.
- Proof ceiling: CAD 3.00.
- Conservative actual proof estimate: CAD {actual}.
- Earlier separate proof estimates remain CAD 1.3567668 and 1.3567119.
- Full bounded G3A expected scenario: CAD {expected}.
- Local G3A ceiling: CAD {ceiling}, at least 50% contingency.

Current exact CAD retail meters were refreshed and matched. The full
scenario includes bootstrap Storage/PE/DNS, input Premium ACR/PE/DNS,
builder/disk, incremental final ACR storage, IO and conservative traffic.
It excludes already-paid G2 base capacity and G3B, and assumes no
additional paid telemetry. Proof estimates are not invoices. The G3A
scenario is not a new execution authority or an enlargement of the
separate CAD 3 proof ceiling; actual payload and lifetime caps must be
bound and enforced before any future execution.

## Conditional local closure

- G3A_CONTROLLER = {controller}
- G3A_BICEP_PACKAGE = {bicep}
- G3A_TRANSACTION_READINESS = {readiness}

{blockers}

See the [local closure disposition](../g3a-ca-closure/CLOSURE_DISPOSITION.json)
for exact local command results and remaining implementation boundaries.
First-byte proof establishes transport and execution of the frozen probe,
not runtime input retrieval/build/upload qualification.

## Concurrency and boundaries

Active isolated worktree remains at
`7bec20aad11d43eeae8099c14e021b3074154b27`; observed foreign main remains at
`1c337567635bb86ea0df7831557d8d2d22df1e6f` with 505 status entries.
No foreign changes were edited, staged, reverted or dispositioned.
Prior failed proofs and qualified packets remain hash-protected.

G3_EXECUTION_READINESS remains BLOCKED. G3A, G3B and technical execution
authorizations remain NO. UE and Cora remain INFRA_NO_GO.
No input ACR, runtime image, registry uploader, ABAC probe, ACA or G3B was
executed. Local-only closure added no Azure mutation.
The next gate is **G3_CONTROL_PLANE_BOOTSTRAP**.

## Evidence

- [Full requested output](FINAL_DISPOSITION.json)
- [Live proof result](LIVE_PROOF_RESULT.json)
- [Version-free runtime result](CONTENT_FIRST_BYTE_RESULT.json)
- [Write-once evidence](WRITE_ONCE_RESULT.json)
- [Cleanup reconciliation](CLEANUP_RECONCILIATION.json)
- [Exact mutation accounting](MUTATION_ACCOUNTING.json)
- [Actual estimate](ACTUAL_COST_ESTIMATE.json)
- [Full bounded G3A cost model](FULL_G3A_COST_MODEL.json)
- [Seal](CONTENT_PROOF_VERIFICATION.json)
- [Independent verification](CONTENT_INDEPENDENT_VERIFICATION.json)
""".format(actual=actual["estimateCAD"], expected=costs["G3A_EXPECTED_COST_CAD"],
           ceiling=costs["G3A_COST_CEILING_CAD"], controller=local["G3A_CONTROLLER"],
           bicep=local["G3A_BICEP_PACKAGE"], readiness=local["G3A_TRANSACTION_READINESS"], blockers=blockers)
    with (HERE / "CONTENT_FIRST_BYTE_REPORT.md").open("x", encoding="utf-8") as stream:
        stream.write(report)
    proof.fresh("CONTENT_PROOF_VERIFICATION.json", {
        "status": "SEALED_PROVEN_CONTENT_ADDRESSED_FIRST_BYTE_ZERO_RESIDUALS",
        "fileHashes": census(HERE, {"CONTENT_PROOF_VERIFICATION.json", "CONTENT_INDEPENDENT_VERIFICATION.json"}),
        "closurePath": str(CLOSURE), "closureFileHashes": census(CLOSURE, set()),
        "protectedFileHashes": preserved,
        "authoritySha256": proof.sha(proof.AUTHORITY),
        "sameAuthorityCorrectedAcceptance": True, "liveProofAttempts": 1,
        "localOnlyClosureNoAdditionalAzureMutation": True,
        "notClaimedG3ARuntimeQualification": True,
        "inheritedIntegrityScope": "QUALIFICATION_ROOTS_DIRECT_PACKET_BYTES_AND_BORROWED_PROOF_INPUTS",
        "fullAncestorToolchainLeafReplay": False,
    })
    print("CONTENT_PROOF_ROOT_SHA256=" + proof.sha(HERE / "CONTENT_PROOF_VERIFICATION.json"))


if __name__ == "__main__":
    main()

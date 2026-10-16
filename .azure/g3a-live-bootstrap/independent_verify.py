"""Verify the sealed failed-proof packet without importing its controller/sealer."""

import ast
from datetime import datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(path):
    with Path(path).open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def main():
    require(len(sys.argv) == 2, "EXPECTED_ROOT_REQUIRED")
    root_path = HERE / "LIVE_BOOTSTRAP_VERIFICATION.json"
    require(digest(root_path) == sys.argv[1], "ROOT_MISMATCH")
    root = load(root_path)
    actual = {str(p.relative_to(HERE)): digest(p) for p in HERE.rglob("*")
              if p.is_file() and p.name not in {
                  "LIVE_BOOTSTRAP_VERIFICATION.json", "LIVE_BOOTSTRAP_INDEPENDENT_VERIFICATION.json"}
              and not any(name in p.parts for name in root["excludedGeneratedDirectories"])}
    require(actual == root["fileHashes"], "EXACT_PACKET_CENSUS_MISMATCH")
    for name, expected in root["protectedPacketHashes"].items():
        require(digest(ROOT / name) == expected, "PROTECTED_HISTORY_MISMATCH_" + name)
    require(digest(root["authorityPath"]) == root["authoritySha256"], "AUTHORITY_MISMATCH")
    for name, expected in load(HERE / "EXECUTION_BINDING.json")["fileHashes"].items():
        require(digest(HERE / name) == expected, "CONSUMED_INPUT_MISMATCH")
    events = [load(p) for p in sorted(HERE.glob("EVENT_*.json"))]
    require([e["index"] for e in events] == list(range(1, 54)), "EVENT_SEQUENCE_MISMATCH")
    rejected = [e for e in events if e.get("label") == "ONE_CSE_EXECUTION"
                and e["kind"] == "EXPLICIT_COMMAND_FAILURE"]
    require(len(rejected) == 1 and "typeHandlerVersion is invalid" in rejected[0]["stderr"],
            "REJECTION_MISMATCH")
    dispatches = [e for e in events if e["kind"] == "MUTATION_DISPATCH"]
    require(len(dispatches) == 10 and
            sum(e.get("label") == "ONE_CSE_EXECUTION" for e in dispatches) == 1, "DISPATCH_MISMATCH")
    puts = [e for e in events if e["kind"] == "BLOB_RESPONSE" and e.get("method") == "PUT"]
    require(len(puts) == 2 and all(e["httpStatus"] == 201 for e in puts), "BLOB_WRITE_MISMATCH")
    targets = set()
    for e in events:
        if e.get("label") in {"SUB_DEPLOYMENT_OPERATIONS", "TRANSPORT_RESOURCE_CREATION_OPERATIONS",
                              "VM_CREATION_OPERATIONS"}:
            for op in e["value"]:
                q = op["properties"]
                t = q.get("targetResource")
                if t and q["provisioningOperation"] == "Create" and q["provisioningState"] == "Succeeded":
                    if t["resourceType"].lower() != "microsoft.resources/deployments":
                        targets.add(t["id"])
    accounting = load(HERE / "EXACT_MUTATION_ACCOUNTING.json")
    require(len(targets) == 15 and
            targets == {t["id"] for t in accounting["explicitSuccessfulARMCreateTargetsExcludingDeploymentMetadata"]},
            "CREATE_ACCOUNTING_MISMATCH")
    require(accounting["roleAssignments"] == {"created": 2, "deleted": 2, "totalMutations": 4},
            "ROLE_ACCOUNTING_MISMATCH")
    cleanup = load(HERE / "CLEANUP_RECONCILIATION.json")
    require(cleanup["status"] == "PASS_ZERO_PROOF_RESIDUALS" and cleanup["proofRGAbsent"] and
            not cleanup["resourceCensus"] and not cleanup["proofRoleCensus"] and
            cleanup["G2ResourcesAndRolesUnchanged"] and cleanup["g2TerminalRootUnchanged"], "CLEANUP_MISMATCH")
    require(all(c["absenceConfirmed"] for c in load(HERE / "FINAL_EXACT_ABSENCE_READS.json")["checks"]),
            "EXACT_ABSENCE_MISMATCH")
    cost = load(HERE / "ACTUAL_CONSERVATIVE_COST_ESTIMATE.json")
    model = load(HERE.parent / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json")
    require(digest(HERE.parent / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json") ==
            cost["capturedMeterModelSha256"], "METER_MODEL_MISMATCH")
    labels = {e["label"]: e for e in events if "label" in e}
    end = datetime.fromisoformat(labels["DELETE_PROOF_RG_CASCADE"]["UTC"])
    expected_amounts = dict(model["amountsCAD"])
    for key, label, old, new, maximum in (
        ("pe", "CREATE_TRANSPORT", "onePE4Hours", "PEObservedDispatchToCascadeCompletionUpperBound", 4),
        ("vm", "CREATE_VM", "oneB2s2Hours", "VMObservedDispatchToCascadeCompletionUpperBound", 2),
    ):
        start = next(e["UTC"] for e in dispatches if e.get("label") == label)
        duration = Decimal(str((end - datetime.fromisoformat(start)).total_seconds())) / Decimal(3600)
        require(0 <= duration <= maximum, "DURATION_BOUND_MISMATCH")
        del expected_amounts[old]
        expected_amounts[new] = str(duration * Decimal(model["rates"][key]["rateCAD"]))
    require(expected_amounts == cost["amountsCAD"], "COST_COMPONENT_MISMATCH")
    amount = sum(Decimal(v) for v in expected_amounts.values()).quantize(Decimal("0.0000001"))
    require(amount == Decimal(cost["estimateCAD"]) and amount < Decimal("3"), "COST_ARITHMETIC_MISMATCH")
    disposition = load(HERE / "LIVE_BOOTSTRAP_DISPOSITION.json")
    for key in ("G3_EXECUTION_READINESS", "G3A_FIRST_BYTE_BOOTSTRAP", "G3A_TRANSACTION_READINESS"):
        require(disposition[key] == "BLOCKED", "FALSE_READINESS")
    for key in ("G3A_EXECUTION_AUTHORIZED", "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        require(disposition[key] == "NO", "FALSE_AUTHORIZATION")
    require(disposition["CSE_VERSIONID_SELECTION"] == "NOT_RUN" and
            disposition["BOOTSTRAP_PROOF_RESIDUAL_STATE"] == "ZERO" and
            disposition["BOOTSTRAP_PROOF_ACTUAL_COST_ESTIMATE_CAD"] == str(amount) and
            disposition["REGISTRY_MUTATIONS"] == 0 and
            disposition["UE_INFRA"] == disposition["CORA_INFRA"] == "INFRA_NO_GO", "FALSE_DISPOSITION")
    for name in ("close.py", "independent_verify.py"):
        ast.parse((HERE / name).read_text(), filename=name)
    result = {
        "status": "PASS_FAILED_PROOF_EVIDENCE_CLEANUP_AND_BLOCKED_GOVERNANCE",
        "rootSha256": sys.argv[1], "verifiedHashReferences": len(actual) + len(root["protectedPacketHashes"]) + 2,
        "exactMutationAndCostAssertions": "PASS", "qualifiedBuildUploaderReplayed": False,
        "cloudCallsByIndependentVerifier": 0, "guestExecutionsByIndependentVerifier": 0,
    }
    with (HERE / "LIVE_BOOTSTRAP_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as file:
        json.dump(result, file, indent=2)
        file.write("\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

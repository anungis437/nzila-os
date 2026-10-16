"""Verify resumed proof bytes and assertions without importing any controller."""

import ast
from datetime import datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(path):
    with Path(path).open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def census(base, excluded):
    return {str(path.relative_to(base)): digest(path) for path in base.rglob("*")
            if path.is_file() and path.name not in excluded}


def main():
    require(len(sys.argv) == 2, "EXPECTED_ROOT_REQUIRED")
    root_path = HERE / "RESUME_VERIFICATION.json"
    require(digest(root_path) == sys.argv[1], "RESUME_ROOT_CHANGED")
    root = load(root_path)
    package = Path(root["retryPackagePath"])
    require(census(HERE, {"RESUME_VERIFICATION.json", "RESUME_INDEPENDENT_VERIFICATION.json"}) ==
            root["resumeFileHashes"], "RESUME_EXACT_CENSUS_CHANGED")
    require(census(package, set()) == root["retryPackageFileHashes"], "RETRY_EXACT_CENSUS_CHANGED")
    for name, expected in root["protectedFileHashes"].items():
        require(digest(name) == expected, "PROTECTED_HISTORY_CHANGED")
    require(digest(root["existingAuthorityPath"]) == root["existingAuthoritySha256"], "AUTHORITY_CHANGED")
    predeploy_path = package / "RETRY_PREDEPLOY_VERIFICATION.json"
    require(digest(predeploy_path) == root["predeployRootSha256"] ==
            "fc9dea154679a24200ba0ef68f8512c67ff5557b6227d3a60836fd17dd685a53", "PREDEPLOY_ROOT_CHANGED")
    for name, expected in load(predeploy_path)["fileHashes"].items():
        require(digest(package / name) == expected, "VALIDATED_PACKAGE_INPUT_CHANGED")
    for name, expected in load(package / "EXECUTION_BINDING.json")["fileHashes"].items():
        require(digest(package / name) == expected, "BOUND_EXECUTABLE_CHANGED")
    events = [load(path) for path in sorted(package.glob("EVENT_*.json"))]
    require([x["index"] for x in events] == list(range(1, 55)), "EVENT_INDEX_MISMATCH")
    dispatches = [x for x in events if x["kind"] == "MUTATION_DISPATCH"]
    require(len(dispatches) == 10 and sum(x["label"] == "ONE_CSE_EXECUTION" for x in dispatches) == 1,
            "DISPATCH_MISMATCH")
    responses = {x["label"]: x for x in events if "label" in x and x["kind"] in {
        "READ_RESPONSE", "MUTATION_RESPONSE", "EXPLICIT_COMMAND_FAILURE"}}
    successful = [x for x in events if x["kind"] == "MUTATION_RESPONSE"]
    puts = [x for x in events if x["kind"] == "BLOB_RESPONSE" and x.get("method") == "PUT"]
    require(len(successful) + len(puts) == 9 and len(puts) == 2 and all(x["httpStatus"] == 201 for x in puts),
            "MUTATION_RESPONSE_MISMATCH")
    require(sum(x["kind"] == "EXPLICIT_COMMAND_FAILURE" and x.get("label") == "ONE_CSE_EXECUTION"
                for x in events) == 1, "NONZERO_DISPATCH_MISMATCH")
    view = responses["CSE_TERMINAL_INSTANCE_VIEW"]["value"]
    require(view["typeHandlerVersion"] == "2.1" and view["provisioningState"] == "Failed" and
            view["instanceView"]["typeHandlerVersion"] == "2.1.19", "HANDLER_EVIDENCE_MISMATCH")
    failed = [x for x in view["instanceView"]["statuses"] if x["code"] == "ProvisioningState/failed/0"]
    require(len(failed) == 1 and "processing file downloads failed" in failed[0]["message"] and
            "unable to download the MSI" in failed[0]["message"] and
            not re.search(r"G3A_BOOTSTRAP_REQUESTED_V1|G3A_BOOTSTRAP_CURRENT_V2|SELF_SHA256", failed[0]["message"]),
            "FALSE_PROBE_EXECUTION_CLAIM")
    adjudicated = load(HERE / "ADJUDICATED_TERMINAL_RESULT.json")
    require(adjudicated["terminalSemanticResult"] == "CSE_FAILURE_OTHER" and
            adjudicated["specificUnderlyingHTTPStatus"] == "NOT_CAPTURED", "FALSE_SEMANTIC_CLASS")
    cleanup = load(package / "CLEANUP_RECONCILIATION.json")
    require(cleanup["status"] == "PASS_ZERO_PROOF_RESIDUALS" and cleanup["proofRGAbsent"] and
            not cleanup["resourceCensus"] and not cleanup["proofRoleCensus"] and
            cleanup["G2ResourcesAndRolesUnchanged"] and cleanup["g2TerminalRootUnchanged"], "CLEANUP_MISMATCH")
    for name in ("FINAL_UAMI_ABSENCE", "FINAL_STORAGE_ABSENCE", "FINAL_GRAPH_PRINCIPAL_ABSENCE"):
        require(load(HERE / (name + ".json"))["absenceConfirmed"] is True, "EXACT_ABSENCE_NOT_PROVEN")
    require(load(HERE / "FINAL_RESUME_RG_ABSENCE.json")["value"] is False and
            not load(HERE / "FINAL_RESUME_RESOURCE_CENSUS.json")["value"] and
            not load(HERE / "FINAL_RESUME_ROLE_CENSUS.json")["value"], "RESIDUAL_STATE_NOT_ZERO")
    accounting = load(HERE / "MUTATION_ACCOUNTING.json")
    require(accounting["ARMSelectorRejections"] == 0 and accounting["GuestProvisioningFailures"] == 1 and
            accounting["ROLE_ASSIGNMENT_CREATES"] == accounting["ROLE_ASSIGNMENT_DELETES"] == 2 and
            accounting["UAMI_CREATES"] == accounting["UAMI_DELETES"] == 1, "ACCOUNTING_MISMATCH")
    creates = {}
    for label in ("SUB_DEPLOYMENT_OPERATIONS", "TRANSPORT_RESOURCE_CREATION_OPERATIONS",
                  "VM_CREATION_OPERATIONS"):
        for operation in responses[label]["value"]:
            p = operation["properties"]
            t = p.get("targetResource")
            if (t and p["provisioningOperation"] == "Create" and p["provisioningState"] == "Succeeded" and
                    t["resourceType"].lower() != "microsoft.resources/deployments"):
                creates[t["id"]] = t
    require(len(creates) == 15 and set(creates) ==
            {t["id"] for t in accounting["successfulExplicitCreateTargetsExcludingDeploymentMetadata"]},
            "LEAF_CREATE_ACCOUNTING_MISMATCH")
    model_path = Path(load(package / "CURRENT_COST_GATE.json")["capturedMeterModel"])
    model = load(model_path)
    refreshed = load(HERE / "REFRESHED_COST_GATE.json")
    require(digest(model_path) == refreshed["priorModelSha256"] and refreshed["status"] == "PASS", "MODEL_CHANGED")
    items = load(HERE / "CURRENT_CAD_METERS_PREVIEW_1.json")["Items"]
    for name, rate in model["rates"].items():
        require(any(x["meterId"] == rate["meterId"] and x["currencyCode"] == "CAD" and
                    x["unitOfMeasure"] == rate["unit"] and x["type"] == "Consumption" and
                    Decimal(str(x["tierMinimumUnits"])) == 0 and
                    Decimal(str(x["retailPrice"])) == Decimal(rate["rateCAD"]) for x in items),
                "CURRENT_METER_REFRESH_MISMATCH_" + name)
    end = datetime.fromisoformat(responses["DELETE_PROOF_RG_CASCADE"]["UTC"])
    amounts = dict(model["amountsCAD"])
    for label, key, old, new, maximum in (
        ("CREATE_TRANSPORT", "pe", "onePE4Hours", "PEObservedLifetimeUpperBound", 4),
        ("CREATE_VM", "vm", "oneB2s2Hours", "VMObservedLifetimeUpperBound", 2),
    ):
        start = next(x["UTC"] for x in dispatches if x["label"] == label)
        hours = Decimal(str((end - datetime.fromisoformat(start)).total_seconds())) / Decimal(3600)
        require(0 <= hours <= maximum, "COST_DURATION_BOUND")
        del amounts[old]
        amounts[new] = str(hours * Decimal(model["rates"][key]["rateCAD"]))
    cost = load(HERE / "ACTUAL_COST_ESTIMATE.json")
    require(cost["amountsCAD"] == amounts, "COST_COMPONENT_MISMATCH")
    amount = sum(Decimal(x) for x in amounts.values()).quantize(Decimal("0.0000001"))
    require(amount == Decimal(cost["estimateCAD"]) and amount < Decimal("3"), "COST_ARITHMETIC_MISMATCH")
    disposition = load(HERE / "FINAL_DISPOSITION.json")
    require(disposition["BOOTSTRAP_RETRY_AUTHORITY_CONSUMED"] == "YES" and
            disposition["CSE_EFFECTIVE_HANDLER_VERSION"] == "2.1.19" and
            disposition["CSE_VERSIONID_SELECTION"] == "CSE_FAILURE_OTHER" and
            disposition["BOOTSTRAP_RETRY_RESIDUAL_STATE"] == "ZERO" and
            disposition["BOOTSTRAP_RETRY_ACTUAL_COST_ESTIMATE_CAD"] == str(amount), "DISPOSITION_MISMATCH")
    for name in ("G3_EXECUTION_READINESS", "G3A_FIRST_BYTE_BOOTSTRAP", "G3A_TRANSACTION_READINESS"):
        require(disposition[name] == "BLOCKED", "FALSE_READINESS")
    for name in ("G3A_EXECUTION_AUTHORIZED", "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        require(disposition[name] == "NO", "FALSE_AUTHORIZATION")
    require(disposition["REGISTRY_MUTATIONS"] == 0 and disposition["UE_INFRA"] ==
            disposition["CORA_INFRA"] == "INFRA_NO_GO", "PRODUCT_GOVERNANCE_MISMATCH")
    require(load(HERE / "CLOSE_OBSERVER_TESTS.json")["status"] == "PASS" and
            load(HERE / "CLOSE_OBSERVER_TESTS.json")["testCount"] == 4, "LOCAL_OBSERVER_TESTS_FAILED")
    for path in HERE.glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    result = {
        "status": "PASS_FAILED_RETRY_ZERO_RESIDUALS_AND_BLOCKED_GOVERNANCE",
        "rootSha256": sys.argv[1],
        "verifiedHashReferences": len(root["resumeFileHashes"]) + len(root["retryPackageFileHashes"]) +
                                  len(root["protectedFileHashes"]) + 2,
        "exactMutationCostAndTerminalAssertions": "PASS", "cloudCallsByVerifier": 0,
        "guestImageBuilderUploaderReplayed": False, "fullAncestorLeafReplay": False,
    }
    with (HERE / "RESUME_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as file:
        json.dump(result, file, indent=2)
        file.write("\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

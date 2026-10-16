"""Independent exact survivor and dispatch accounting; no mutating action."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from decimal import Decimal
import subprocess

import runner_live as live


def absent(name, args):
    result = subprocess.run(
        [live.historical.ca.retry.p.AZ, *args, "--output", "json", "--only-show-errors"],
        capture_output=True, text=True, env=live.historical.ca.retry.p.ENV, timeout=180)
    live.ensure(result.returncode != 0 and any(term in result.stderr for term in
                ("ResourceNotFound", "ResourceGroupNotFound", "does not exist")),
                "EXACT_SURVIVOR_OR_READ_FAILURE_" + name)
    live.fresh(name + ".json", {
        "absenceConfirmed": True, "command": ["az", *args], "exitCode": result.returncode,
        "stderr": result.stderr.strip(),
    })


def main():
    live.fresh("CONCURRENCY_CLOSE_RUNNER.json", live.baseline())
    outcome = live.read("LIVE_PROOF_RESULT.json")
    reconciliation = live.read("CLEANUP_RECONCILIATION.json")
    live.ensure(outcome["residualState"] == "ZERO" and not outcome["cleanupFailure"] and
                reconciliation["G2ResourcesAndRolesUnchanged"] and
                reconciliation["g2TerminalRootUnchanged"], "RUNNER_CLEANUP_NOT_ZERO")
    transport = live.read("TRANSPORT_BINDINGS.json")
    with ThreadPoolExecutor(max_workers=3) as pool:
        checks = [
            pool.submit(absent, "FINAL_EXACT_UAMI_ABSENCE",
                        ["resource", "show", "--ids", transport["identityId"],
                         "--subscription", live.historical.ca.retry.p.SUB]),
            pool.submit(absent, "FINAL_EXACT_STORAGE_ABSENCE",
                        ["resource", "show", "--ids", transport["storageId"],
                         "--subscription", live.historical.ca.retry.p.SUB]),
            pool.submit(absent, "FINAL_EXACT_GRAPH_ABSENCE",
                        ["ad", "sp", "show", "--id", transport["identityPrincipalId"]]),
        ]
        for check in checks:
            check.result()
    events = [live.load(path) for path in sorted(live.HERE.glob("EVENT_*.json"))]
    live.ensure([item["index"] for item in events] == list(range(1, outcome["events"] + 1)),
                "RUNNER_EVENT_SEQUENCE_INCOMPLETE")
    dispatches = [item for item in events if item["kind"] == "MUTATION_DISPATCH"]
    puts = [item for item in events if item["kind"] == "OBJECT_RESPONSE" and
            item["method"] == "PUT" and item["status"] == 201]
    successful = [item for item in events if item["kind"] == "MUTATION_RESPONSE"] + puts
    labels = [item["label"] for item in dispatches]
    rejected = [item for item in events if item["kind"] == "EXPLICIT_COMMAND_FAILURE" and
                item["label"] in labels]
    live.ensure(len(successful) + len(rejected) == len(dispatches), "UNRESOLVED_RUNNER_MUTATION")
    responses = {item["label"]: item for item in events if "label" in item and
                 item["kind"] in {"READ_RESPONSE", "MUTATION_RESPONSE", "EXPLICIT_COMMAND_FAILURE"}}
    created = {}
    for label in ("SUB_DEPLOYMENT_OPERATIONS", "TRANSPORT_RESOURCE_CREATION_OPERATIONS",
                  "VM_CREATION_OPERATIONS", "CSE_CREATION_OPERATIONS"):
        for operation in responses.get(label, {}).get("value", []):
            properties = operation["properties"]
            target = properties.get("targetResource")
            if (target and properties["provisioningOperation"] == "Create" and
                    properties["provisioningState"] == "Succeeded" and
                    target["resourceType"].lower() != "microsoft.resources/deployments"):
                created[target["id"]] = target
    role_creates = [item for item in created.values() if item["resourceType"].lower() ==
                    "microsoft.authorization/roleassignments"]
    uami_creates = [item for item in created.values() if item["resourceType"].lower() ==
                    "microsoft.managedidentity/userassignedidentities"]
    delete_labels = {"REMOVE_PRODUCER_ROLE", "CLEANUP_PRODUCER_ROLE", "CLEANUP_BUILDER_ROLE",
                     "DELETE_PROOF_RG_CASCADE", "DELETE_PROOF_SUB_DEPLOYMENT_RECORD"}
    role_deletes = {item["label"] for item in events if item["kind"] == "MUTATION_RESPONSE" and
                    item["label"] in {"REMOVE_PRODUCER_ROLE", "CLEANUP_PRODUCER_ROLE", "CLEANUP_BUILDER_ROLE"}}
    live.ensure(labels.count("ONE_CSE_EXECUTION") <= 1 and labels.count("CREATE_VM") == 1 and
                labels.count("ONE_READ_ONLY_DIAGNOSTIC_ACTION") <= 1, "RUNNER_ONE_ATTEMPT_VIOLATION")
    counters = {
        "AZURE_MUTATING_DISPATCHES": len(dispatches),
        "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": len(successful),
        "AZURE_REJECTED_MUTATING_DISPATCHES": len(rejected),
        "AZURE_DELETE_DISPATCHES": sum(label in delete_labels for label in labels),
        "ROLE_ASSIGNMENT_CREATES": len(role_creates), "ROLE_ASSIGNMENT_DELETES": len(role_deletes),
        "UAMI_CREATES": len(uami_creates), "UAMI_DELETES": len(uami_creates),
        "RUN_COMMAND_DIAGNOSTIC_ACTIONS": labels.count("ONE_READ_ONLY_DIAGNOSTIC_ACTION"),
        "REGISTRY_MUTATIONS": 0, "BlobPUTs": len(puts),
        "CSEDeploymentAttempts": labels.count("ONE_CSE_EXECUTION"),
        "counterUnit": "Caller-level mutating dispatch, not nested ARM RPC",
        "EntraActivity": "NONZERO_UAMI_LIFECYCLE_EXACT_INTERNAL_GRAPH_WRITE_COUNT_UNOBSERVED",
        "exactGraphPrincipalAbsent": True, "createdTargets": list(created.values()),
        "closeoutAzureMutations": 0,
    }
    live.fresh("MUTATION_ACCOUNTING.json", counters)
    cost = live.read("CURRENT_COST_GATE.json")
    amounts = {name: Decimal(value) for name, value in cost["amountsCAD"].items()}
    end = datetime.fromisoformat(responses["DELETE_PROOF_RG_CASCADE"]["UTC"])
    rates = live.load(live.BASE / "g3a-firstbyte/BOOTSTRAP_PROOF_COST_MODEL.json")["rates"]
    hours = {}
    for label, rate, old, maximum in (
        ("CREATE_TRANSPORT", "pe", "onePE4Hours", 4),
        ("CREATE_VM", "vm", "oneB2s2Hours", 2),
    ):
        start = next(item["UTC"] for item in dispatches if item["label"] == label)
        duration = Decimal(str((end - datetime.fromisoformat(start)).total_seconds())) / Decimal(3600)
        live.ensure(0 <= duration <= maximum, "RUNNER_LIFETIME_CEILING_EXCEEDED")
        del amounts[old]
        amounts[rate + "ObservedLifetimeUpperBound"] = duration * Decimal(rates[rate]["rateCAD"])
        hours[rate] = str(duration)
    estimate = sum(amounts.values()).quantize(Decimal("0.0000001"))
    live.ensure(estimate <= Decimal(3), "RUNNER_ACTUAL_ESTIMATE_EXCEEDS_CEILING")
    live.fresh("ACTUAL_COST_ESTIMATE.json", {
        "estimateCAD": str(estimate), "currency": "CAD", "ceilingCAD": "3.00",
        "amountsCAD": {name: str(value) for name, value in amounts.items()},
        "hoursUpperBounds": hours, "invoicedCost": "NOT_CLAIMED",
        "basis": "Observed caller creation through completed RG delete; retain full disk day/DNS month, 1GB traffic/storage and 1M disk operations.",
    })
    guest_path = live.HERE / "GUEST_PROOF_RESULT.json"
    guest = live.read(guest_path.name) if guest_path.exists() else {}
    passed = bool(guest.get("allPassed") and guest.get("evidenceComplete") and
                  guest.get("extensionSucceeded") and outcome["classification"] == "PROVEN")
    live.fresh("RUNNER_FINAL_DISPOSITION.json", {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "PRODUCTION_RUNNER_OFFLINE_QUALIFICATION": "PASS",
        "PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED": "YES",
        "PRODUCTION_RUNNER_PINNED_GUEST_PROOF": "PASS" if passed else "FAIL",
        "PINNED_GUEST_BUILD_CAPACITY_BOUND": "PASS" if passed else "FAIL",
        "PINNED_GUEST_TMP_CAPACITY_BOUND": "PASS" if passed else "FAIL",
        "PRODUCTION_RUNNER_PROOF_RESIDUAL_STATE": "ZERO",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "QUALIFIED" if passed else "BLOCKED",
        "G3A_TRANSACTION_READINESS": "BLOCKED",
        "PRODUCTION_RUNNER_PROOF_EXPECTED_COST_CAD": cost["conservativeExpectedCAD"],
        "PRODUCTION_RUNNER_PROOF_COST_CEILING_CAD": "3.00",
        "PRODUCTION_RUNNER_PROOF_ACTUAL_COST_ESTIMATE_CAD": str(estimate),
        "CSE_EFFECTIVE_HANDLER_VERSION": guest.get("effectiveHandler", "UNRESOLVED"),
        "BOOTSTRAP_STORAGE_LOCKDOWN": outcome["storageLockdown"],
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "REGISTRY_MUTATIONS": 0,
        "conditionalLocalClosurePermitted": passed, "mutationCounters": counters,
        "terminalFailure": outcome["failure"], "guestChecks": guest.get("checks", {}),
    })
    print("G3A_PRODUCTION_COMPATIBLE_RUNNER=" + ("QUALIFIED" if passed else "BLOCKED"))
    print("PRODUCTION_RUNNER_PROOF_RESIDUAL_STATE=ZERO")
    print("PRODUCTION_RUNNER_PROOF_ACTUAL_COST_ESTIMATE_CAD=" + str(estimate))


if __name__ == "__main__":
    main()

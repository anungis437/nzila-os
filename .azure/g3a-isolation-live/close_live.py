"""Exact read-only survivor checks and terminal accounting; no live retry."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import subprocess

import isolation_live as live


def absent(name, args):
    result = subprocess.run([live.ca.retry.p.AZ, *args, "--output", "json", "--only-show-errors"],
                            capture_output=True, text=True, env=live.ca.retry.p.ENV, timeout=180)
    live.ensure(result.returncode != 0 and any(x in result.stderr for x in
                ("ResourceNotFound", "ResourceGroupNotFound", "does not exist")), "SURVIVOR_OR_READ_FAILURE_" + name)
    live.fresh(name + ".json", {"absenceConfirmed": True, "command": ["az", *args],
               "exitCode": result.returncode, "stderr": result.stderr.strip(),
               "UTC": datetime.now(timezone.utc).isoformat()})


def main():
    live.fresh("CONCURRENCY_CLOSE_LIVE.json", live.baseline())
    outcome = live.read("LIVE_PROOF_RESULT.json")
    cleanup = live.read("CLEANUP_RECONCILIATION.json")
    live.ensure(outcome["authorityConsumed"] and outcome["CSEExecutions"] <= 1 and
                outcome["residualState"] == "ZERO" and not outcome["cleanupFailure"] and
                cleanup["G2ResourcesAndRolesUnchanged"] and cleanup["g2TerminalRootUnchanged"], "CLEANUP_NOT_ZERO")
    bindings = live.read("TRANSPORT_BINDINGS.json")
    with ThreadPoolExecutor(max_workers=3) as pool:
        checks = [
            pool.submit(absent, "FINAL_EXACT_UAMI_ABSENCE", ["resource", "show", "--ids",
                        bindings["identityId"], "--subscription", live.ca.retry.p.SUB]),
            pool.submit(absent, "FINAL_EXACT_STORAGE_ABSENCE", ["resource", "show", "--ids",
                        bindings["storageId"], "--subscription", live.ca.retry.p.SUB]),
            pool.submit(absent, "FINAL_EXACT_GRAPH_ABSENCE", ["ad", "sp", "show",
                        "--id", bindings["identityPrincipalId"]]),
        ]
        for check in checks:
            check.result()
    events = [live.load(path) for path in sorted(live.HERE.glob("EVENT_*.json"))]
    live.ensure([x["index"] for x in events] == list(range(1, outcome["events"] + 1)), "EVENT_SEQUENCE_CHANGED")
    responses = {x["label"]: x for x in events if "label" in x and
                 x["kind"] in {"READ_RESPONSE", "MUTATION_RESPONSE", "EXPLICIT_COMMAND_FAILURE"}}
    dispatches = [x for x in events if x["kind"] == "MUTATION_DISPATCH"]
    puts = [x for x in events if x["kind"] == "OBJECT_RESPONSE" and x["method"] == "PUT" and x["status"] == 201]
    successes = [x for x in events if x["kind"] == "MUTATION_RESPONSE"] + puts
    failures = [x for x in events if x["kind"] == "EXPLICIT_COMMAND_FAILURE" and
                x["label"] in {y["label"] for y in dispatches}]
    live.ensure(len(successes) + len(failures) == len(dispatches), "UNRESOLVED_MUTATION_DISPATCH")
    creates = {}
    for label in ("SUB_DEPLOYMENT_OPERATIONS", "TRANSPORT_RESOURCE_CREATION_OPERATIONS",
                  "VM_CREATION_OPERATIONS", "CSE_CREATION_OPERATIONS"):
        for operation in responses.get(label, {}).get("value", []):
            properties = operation["properties"]
            target = properties.get("targetResource")
            if (target and properties["provisioningOperation"] == "Create" and
                    properties["provisioningState"] == "Succeeded" and
                    target["resourceType"].lower() != "microsoft.resources/deployments"):
                creates[target["id"]] = target
    role_creates = [x for x in creates.values() if x["resourceType"].lower() == "microsoft.authorization/roleassignments"]
    uami_creates = [x for x in creates.values() if x["resourceType"].lower() ==
                    "microsoft.managedidentity/userassignedidentities"]
    labels = [x["label"] for x in dispatches]
    deletes = {x["label"] for x in events if x["kind"] == "MUTATION_RESPONSE" and
               x["label"] in {"REMOVE_PRODUCER_ROLE", "CLEANUP_PRODUCER_ROLE", "CLEANUP_BUILDER_ROLE"}}
    diag = labels.count("ONE_READ_ONLY_DIAGNOSTIC_ACTION")
    live.ensure(diag <= 1 and labels.count("ONE_CSE_EXECUTION") <= 1 and labels.count("CREATE_VM") == 1,
                "ONE_ATTEMPT_VIOLATION")
    accounting = {
        "AZURE_MUTATING_DISPATCHES": len(dispatches),
        "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": len(successes),
        "AZURE_REJECTED_MUTATING_DISPATCHES": len(failures),
        "AZURE_DELETE_DISPATCHES": sum(label in {
            "REMOVE_PRODUCER_ROLE", "CLEANUP_PRODUCER_ROLE", "CLEANUP_BUILDER_ROLE",
            "DELETE_PROOF_RG_CASCADE", "DELETE_PROOF_SUB_DEPLOYMENT_RECORD"} for label in labels),
        "ROLE_ASSIGNMENT_CREATES": len(role_creates), "ROLE_ASSIGNMENT_DELETES": len(deletes),
        "UAMI_CREATES": len(uami_creates), "UAMI_DELETES": len(uami_creates),
        "RUN_COMMAND_DIAGNOSTIC_ACTIONS": diag,
        "counterUnit": "Caller-level dispatches, not nested/implicit ARM RPC counts.",
        "successfulExplicitCreateTargetsExcludingDeploymentMetadata": list(creates.values()),
        "BlobPUTs": len(puts), "StoragePATCHs": labels.count("LOCK_STORAGE"),
        "CSEDeploymentAttempts": labels.count("ONE_CSE_EXECUTION"),
        "rejectedCounterMeaning": "Non-success terminal caller response; extension guest failure is not ARM selector rejection.",
        "nonSuccessMutationLabels": [x["label"] for x in failures],
        "EntraActivity": "NONZERO_UAMI_LIFECYCLE_EXACT_INTERNAL_GRAPH_WRITE_COUNT_UNOBSERVED",
        "exactGraphPrincipalAbsent": True, "closeoutAzureMutations": 0,
        "registryMutations": 0, "cascadeInternalDeleteRPCCount": "NOT_OBSERVED",
    }
    live.fresh("MUTATION_ACCOUNTING.json", accounting)
    model = live.load(live.BASE / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json")
    amounts = dict(model["amountsCAD"])
    end = datetime.fromisoformat(responses["DELETE_PROOF_RG_CASCADE"]["UTC"])
    hours = {}
    for label, rate, old, maximum in (
        ("CREATE_TRANSPORT", "pe", "onePE4Hours", 4), ("CREATE_VM", "vm", "oneB2s2Hours", 2)):
        start = next(x["UTC"] for x in dispatches if x["label"] == label)
        duration = Decimal(str((end - datetime.fromisoformat(start)).total_seconds())) / Decimal(3600)
        live.ensure(0 <= duration <= maximum, "LIFETIME_CEILING_EXCEEDED")
        del amounts[old]
        hours[rate] = str(duration)
        amounts[rate + "ObservedLifetimeUpperBound"] = str(duration * Decimal(model["rates"][rate]["rateCAD"]))
    total = sum(Decimal(x) for x in amounts.values()).quantize(Decimal("0.0000001"))
    live.ensure(total <= 3, "COST_CEILING_EXCEEDED")
    live.fresh("ACTUAL_COST_ESTIMATE.json", {
        "currency": "CAD", "estimateCAD": str(total), "ceilingCAD": "3.00", "amountsCAD": amounts,
        "hoursUpperBounds": hours, "invoicedCost": "NOT_CLAIMED",
        "basis": "Creation dispatch through completed RG cascade; retain full disk day/DNS month and bounded IO/traffic.",
        "historicalProofEstimatesSeparateCAD": ["1.3567668", "1.3567119", "1.3550364"],
        "separateProofCeilings": True,
    })
    guest_path = live.HERE / "GUEST_PROOF_RESULT.json"
    guest = live.read(guest_path.name) if guest_path.exists() else {}
    passed = bool(guest.get("allPassed") and guest.get("extensionSucceeded"))
    disposition = {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "HISTORICAL_CANDIDATE_UNCHANGED": "YES",
        "PINNED_GUEST_PROOF_AUTHORITY_CONSUMED": "YES",
        "PROOF_MODE_SOURCE_DELTA": "ISOLATION_PROOF_ONLY",
        "PROOF_MODE_CANDIDATE_OFFLINE_QUALIFICATION": "PASS",
        "PINNED_GUEST_PROOF_BINDING": "SEALED",
        "PRODUCTION_TRANSACTION_DISABLED": "PASS",
        "PINNED_GUEST_PROOF_EXPECTED_COST_CAD": live.read("CURRENT_COST_GATE.json")["conservativeExpectedCAD"],
        "PINNED_GUEST_PROOF_COST_CEILING_CAD": "3.00",
        "PINNED_GUEST_PROOF_ACTUAL_COST_ESTIMATE_CAD": str(total),
        "CSE_EFFECTIVE_HANDLER_VERSION": guest.get("effectiveHandler", "UNRESOLVED"),
        "G3A_ISOLATED_ROOT_RUNNER": "QUALIFIED" if passed else "BLOCKED",
        "G3A_PRODUCTION_CAPSULE_LINEAGE": "BLOCKED",
        "G3A_PRODUCTION_PAYLOAD_CENSUS": "INCOMPLETE",
        "G3A_TOTAL_PRIVATE_INPUT_BYTES": "UNRESOLVED",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_COST_GATE_ENFORCED": "FAIL", "G3A_LIFETIME_BOUNDS_ENFORCED": "FAIL",
        "G3A_FAILURE_CLEANUP_MATRIX": "FAIL", "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3A_EXPECTED_COST_CAD": "4.8973042", "G3A_COST_CEILING_CAD": "7.35",
        "productionCostScope": "PRIOR_BOUNDED_SCENARIO_NOT_FINAL_REBIND",
        "PINNED_GUEST_PROOF_RESIDUAL_STATE": "ZERO",
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO",
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "conditionalLocalContinuation": "ACTIVATED" if passed else "NOT_ACTIVATED_PROOF_FAILED",
        "noSecondProofOrVM": True,
    }
    artifact = live.load(live.ARTIFACTS / "ARTIFACT_BINDING.json")
    for target, source in (
        ("PROOF_MODE_CANDIDATE_SOURCE_SHA256", "candidateSourceSha256"),
        ("PROOF_MODE_CANDIDATE_SHA256", "candidateSha256"),
        ("PROOF_MODE_CANDIDATE_BYTES", "candidateBytes"),
        ("HANDOFF_SHIM_SHA256", "shimSha256"), ("HANDOFF_SHIM_BYTES", "shimBytes"),
    ):
        disposition[target] = artifact[source]
    fields = (
        "BOOTSTRAP_TO_CAPSULE_HANDOFF", "PINNED_GUEST_BASELINE_CAPTURE", "GUEST_MOUNT_NAMESPACE",
        "ISOLATED_ROOT_MECHANISM", "GUEST_ROOT_ISOLATION", "ISOLATED_ROOT_HOST_FS_NEGATIVE",
        "GUEST_NETWORK_ISOLATION_MECHANISM", "ISOLATED_BUILD_NETWORK", "ISOLATED_BUILD_NETWORK_NEGATIVE",
        "GUEST_NO_NEW_PRIVS", "GUEST_PRIVILEGE_DROP", "GUEST_PRIVILEGE_REGAIN_NEGATIVE",
        "PROOF_MODE_CAPSULE_SELF_CONTAINED",
    )
    for name in fields:
        disposition[name] = guest.get(name, "UNRESOLVED" if name.endswith("MECHANISM") else "NOT_RUN")
    disposition.update({key: accounting[key] for key in accounting if key.startswith(
        ("AZURE_", "ROLE_ASSIGNMENT_", "UAMI_", "RUN_COMMAND_"))})
    live.fresh("PROOF_CLOSE_DISPOSITION.json", disposition)
    print("LIVE_ISOLATION_CLOSED_COST_CAD=" + str(total))
    print("CONDITIONAL_LOCAL_CONTINUATION=" + disposition["conditionalLocalContinuation"])


if __name__ == "__main__":
    main()

"""Read-only reconciliation and sealing of the consumed, failed proof."""

from datetime import datetime
from decimal import Decimal
import json
from pathlib import Path
import subprocess

from preflight import AZ, ENV, HERE, ROOT, SUB, baseline, ensure, fresh, sha


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def read(args):
    result = subprocess.run([AZ, *args, "--output", "json", "--only-show-errors"],
                            capture_output=True, text=True, env=ENV, timeout=120)
    if result.returncode:
        ensure("ResourceNotFound" in result.stderr or "ResourceGroupNotFound" in result.stderr or
               ("Resource '" in result.stderr and "does not exist" in result.stderr),
               "FINAL_READ_FAILED_" + result.stderr.strip())
        return {"command": args, "exitCode": result.returncode,
                "absenceConfirmed": True, "stderr": result.stderr.strip()}
    return {"command": args, "exitCode": 0, "value": json.loads(result.stdout)}


def hours(first, last):
    seconds = (datetime.fromisoformat(last) - datetime.fromisoformat(first)).total_seconds()
    ensure(seconds >= 0, "NEGATIVE_RESOURCE_LIFETIME")
    return Decimal(str(seconds)) / Decimal(3600)


def main():
    fresh("CONCURRENCY_CLOSE_" + str(len(list(HERE.glob("CONCURRENCY_CLOSE*.json"))) + 1) + ".json", baseline())
    outcome = load(HERE / "LIVE_PROOF_RESULT.json")
    ensure(outcome["residualState"] == "ZERO" and outcome["classification"] == "NOT_RUN",
           "UNEXPECTED_CLOSEOUT_BRANCH")
    events = [load(path) for path in sorted(HERE.glob("EVENT_*.json"))]
    ensure(len(events) == outcome["events"] == 53, "EVENT_CENSUS_CHANGED")
    binding = load(HERE / "TRANSPORT_BINDINGS.json")
    census = [
        read(["resource", "show", "--ids", binding["identityId"], "--subscription", SUB]),
        read(["resource", "show", "--ids", binding["storageId"], "--subscription", SUB]),
        read(["ad", "sp", "show", "--id", binding["identityPrincipalId"]]),
    ]
    ensure(all(item.get("absenceConfirmed") for item in census), "EXACT_RESOURCE_RESIDUAL")
    fresh("FINAL_EXACT_ABSENCE_READS.json", {"status": "PASS", "checks": census,
                                          "EntraMutationCount": "NOT_INFERRED_FROM_ABSENCE"})
    by_label = {event["label"]: event for event in events if "label" in event}
    rejection = by_label["ONE_CSE_EXECUTION"]
    ensure(rejection["kind"] == "EXPLICIT_COMMAND_FAILURE" and
           "InvalidParameter" in rejection["stderr"] and
           "typeHandlerVersion is invalid" in rejection["stderr"], "FAILURE_CLASS_NOT_BOUND")
    fresh("TERMINAL_FAILURE_CLASSIFICATION.json", {
        "class": "CONTROL_PLANE_HANDLER_VERSION_CONTRACT_REJECTED",
        "primaryEvidence": "EVENT_036.json",
        "secondaryEvidence": "EVENT_038.json",
        "extensionCreation": "REJECTED_BY_ARM_INVALID_PARAMETER",
        "CSEDeploymentDispatches": 1, "guestCSEExecutionsObserved": 0,
        "rawControllerCSEExecutionsFieldMeans": "DISPATCH_COUNTER_NOT_GUEST_EXECUTION",
        "versionSelection": "NOT_RUN", "installedHandlerVersion": "NOT_INSTALLED",
        "midProofRepair": False, "retry": False,
    })
    mutations = [event for event in events if event["kind"] == "MUTATION_DISPATCH"]
    creates = []
    for label in ("SUB_DEPLOYMENT_OPERATIONS", "TRANSPORT_RESOURCE_CREATION_OPERATIONS",
                  "VM_CREATION_OPERATIONS"):
        for operation in by_label[label]["value"]:
            prop = operation["properties"]
            target = prop.get("targetResource")
            if target and prop["provisioningOperation"] == "Create" and prop["provisioningState"] == "Succeeded":
                creates.append(target)
    leaf = {item["id"]: item for item in creates
            if item["resourceType"].lower() != "microsoft.resources/deployments"}
    ensure(len(mutations) == 10 and len(leaf) == 15, "MUTATION_ACCOUNTING_MISMATCH")
    precleanup = by_label["PRECLEANUP_RESOURCES"]["value"]
    accounting = {
        "directMutatingDispatches": len(mutations),
        "successfulDirectMutatingDispatches": 9, "rejectedDirectMutatingDispatches": 1,
        "deploymentDispatches": 3, "successfulDeploymentDispatches": 2,
        "explicitSuccessfulARMCreateTargetsExcludingDeploymentMetadata": list(leaf.values()),
        "explicitSuccessfulARMCreateTargetCount": len(leaf),
        "successfulBlobPUTs": 2, "successfulStoragePATCHs": 1,
        "roleAssignments": {"created": 2, "deleted": 2, "totalMutations": 4},
        "managedIdentity": {"ARMCreates": 1, "ARMDeletesViaRGCascade": 1,
                            "EntraLifecycle": "NONZERO_PLATFORM_MANAGED_LIFECYCLE_EXACT_GRAPH_WRITE_COUNT_UNOBSERVED"},
        "directDeleteDispatches": 4,
        "deletesByUnit": {"roleAssignments": 2, "resourceGroupCascade": 1,
                         "subscriptionDeploymentMetadata": 1},
        "preCascadeResourceInventoryCount": len(precleanup),
        "preCascadeResourceInventory": precleanup,
        "implicitResources": "Disk, PE NIC, DNS records and subnets are not additional explicit deployment-operation targets.",
        "cascadeDeletionRPCCount": "UNOBSERVED_NOT_EQUATED_TO_INVENTORY_COUNT",
        "registryMutations": 0,
    }
    fresh("EXACT_MUTATION_ACCOUNTING.json", accounting)
    model = load(HERE.parent / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json")
    rates = model["rates"]
    deleted = by_label["DELETE_PROOF_RG_CASCADE"]["UTC"]
    transport_start = next(e["UTC"] for e in mutations if e["label"] == "CREATE_TRANSPORT")
    vm_start = next(e["UTC"] for e in mutations if e["label"] == "CREATE_VM")
    pe_hours = hours(transport_start, deleted)
    vm_hours = hours(vm_start, deleted)
    ensure(pe_hours <= 4 and vm_hours <= 2, "COST_DURATION_BOUND_EXCEEDED")
    amounts = dict(model["amountsCAD"])
    del amounts["onePE4Hours"]
    del amounts["oneB2s2Hours"]
    amounts["PEObservedDispatchToCascadeCompletionUpperBound"] = str(pe_hours * Decimal(rates["pe"]["rateCAD"]))
    amounts["VMObservedDispatchToCascadeCompletionUpperBound"] = str(vm_hours * Decimal(rates["vm"]["rateCAD"]))
    estimate = sum(Decimal(value) for value in amounts.values())
    ensure(estimate < Decimal("3"), "FINAL_COST_CEILING_EXCEEDED")
    fresh("ACTUAL_CONSERVATIVE_COST_ESTIMATE.json", {
        "currency": "CAD", "estimateCAD": str(estimate.quantize(Decimal("0.0000001"))),
        "invoicedCost": "NOT_CLAIMED", "PEHoursUpperBound": str(pe_hours),
        "VMHoursUpperBound": str(vm_hours), "amountsCAD": amounts,
        "hardCeilingCAD": "3.00", "withinCeiling": True,
        "publicProducerWindowHoursUpperBound": str(hours(transport_start, by_label["LOCK_STORAGE"]["UTC"])),
        "conservativeComponents": [
            "Full DNS month, full disk day, full bounded DNS/Blob/disk operations and traffic retained.",
            "Compute and PE bounds start before creation dispatch and end after entire RG cascade.",
            "No billing-export or guest telemetry claim; taxes/currency variance excluded as in frozen retail model.",
        ],
        "capturedMeterModelSha256": sha(HERE.parent / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json"),
    })
    bins = load(HERE / "PROBE_BINARIES.json")["binaries"]
    disposition = {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED", "G3A_REGISTRY_UPLOADER": "QUALIFIED",
        "BOOTSTRAP_PROOF_AUTHORITY_CONSUMED": "YES",
        "BOOTSTRAP_PROOF_RESOURCE_GROUP": outcome["resourceGroup"],
        "BOOTSTRAP_PROOF_EXPECTED_COST_CAD": "1.5363953",
        "BOOTSTRAP_PROOF_COST_CEILING_CAD": "3.00",
        "BOOTSTRAP_PROOF_ACTUAL_COST_ESTIMATE_CAD": str(estimate.quantize(Decimal("0.0000001"))),
        "BOOTSTRAP_PROOF_PUBLIC_PRODUCER_WINDOW": "TEMPORARY",
        "BOOTSTRAP_STORAGE_LOCKDOWN": "PASS", "V1_VERSION_ID": outcome["V1_VERSION_ID"],
        "V1_BINARY_SHA256": bins["V1"]["sha256"], "V2_BINARY_SHA256": bins["V2"]["sha256"],
        "CSE_VERSIONID_SELECTION": "NOT_RUN",
        "G3A_CSE_DOWNLOADED_BINARY_EXECUTION": "PROVEN",
        "G3A_CSE_DOWNLOADED_BINARY_EXECUTION_SCOPE": "PRIOR_SOURCE_PROOF_ONLY_NOT_LIVE",
        "G3A_CSE_VERSIONED_PRIVATE_BLOB": "NOT_PROVEN_CONTROL_PLANE_REJECTED",
        "G3A_FIRST_BYTE_BOOTSTRAP": "BLOCKED", "BOOTSTRAP_PROOF_RESIDUAL_STATE": "ZERO",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "AZURE_MUTATIONS": 10, "AZURE_MUTATIONS_UNIT": "DIRECT_MUTATING_DISPATCHES_INCLUDING_REJECTION_AND_DELETIONS",
        "AZURE_DELETIONS": 4, "AZURE_DELETIONS_UNIT": "DIRECT_DELETE_DISPATCHES",
        "ROLE_ASSIGNMENT_MUTATIONS": 4, "MANAGED_IDENTITY_CREATE_DELETE": {"create": 1, "delete": 1},
        "ENTRA_MUTATIONS": "NONZERO_UAMI_LIFECYCLE_EXACT_DIRECTORY_WRITE_COUNT_UNOBSERVED",
    }
    fresh("LIVE_BOOTSTRAP_DISPOSITION.json", disposition)
    prior = load(HERE.parent / "g3a-firstbyte" / "FIRST_BYTE_VERIFICATION.json")
    protected = dict(prior["protectedPacketHashes"])
    for path in (HERE.parent / "g3a-firstbyte").rglob("*"):
        if path.is_file():
            protected[str(path.relative_to(ROOT))] = sha(path)
    for name, expected in protected.items():
        ensure(sha(ROOT / name) == expected, "PROTECTED_HISTORY_CHANGED_" + name)
    binding_roots = load(HERE / "PROTECTED_ROOT_BINDING.json")
    ensure(sha(HERE.parent / "g3a-firstbyte" / "FIRST_BYTE_VERIFICATION.json") ==
           binding_roots["priorFirstByteRoot"], "PRIOR_FIRST_BYTE_ROOT_CHANGED")
    for name, expected in load(HERE / "EXECUTION_BINDING.json")["fileHashes"].items():
        ensure(sha(HERE / name) == expected, "CONSUMED_INPUT_CHANGED_" + name)
    ensure(sha(Path(binding_roots["historicPlan"])) == binding_roots["historicPlanSha256"], "HISTORIC_PLAN_CHANGED")
    protected[str(Path(binding_roots["historicPlan"]).relative_to(ROOT))] = binding_roots["historicPlanSha256"]
    hashes = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and "local-cache" not in path.parts and "local-gopath" not in path.parts}
    fresh("LIVE_BOOTSTRAP_VERIFICATION.json", {
        "status": "SEALED_FAILED_PROOF_COMPLETE_CLEANUP", "fileHashes": hashes,
        "excludedGeneratedDirectories": ["local-cache", "local-gopath"],
        "protectedPacketHashes": protected,
        "authorityPath": str(load(HERE / "AUTHORITY_BINDING.json")["path"]),
        "authoritySha256": load(HERE / "AUTHORITY_BINDING.json")["sha256"],
        "firstByteRootSha256": binding_roots["priorFirstByteRoot"],
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "conditionalLocalPackageCompletion": "NOT_PERMITTED_AFTER_FAILURE",
    })
    print("LIVE_BOOTSTRAP_ROOT_SHA256=" + sha(HERE / "LIVE_BOOTSTRAP_VERIFICATION.json"))


if __name__ == "__main__":
    main()

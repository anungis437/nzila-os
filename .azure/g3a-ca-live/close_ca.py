"""Read-only proof closeout and conservative local cost closure."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import subprocess
from urllib.parse import urlencode
from urllib.request import urlopen

import proof

HERE = proof.HERE


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def absent(name, args):
    result = subprocess.run(
        [proof.retry.p.AZ, *args, "--output", "json", "--only-show-errors"],
        capture_output=True, text=True, env=proof.retry.p.ENV, timeout=180)
    proof.ensure(result.returncode != 0 and any(
        text in result.stderr for text in ("ResourceNotFound", "ResourceGroupNotFound", "does not exist")),
        "FINAL_ABSENCE_UNPROVEN_" + name)
    proof.fresh(name + ".json", {
        "absenceConfirmed": True, "command": ["az", *args], "exitCode": result.returncode,
        "stderr": result.stderr.strip(), "UTC": datetime.now(timezone.utc).isoformat()})


def capture():
    proof.fresh("CONCURRENCY_CLOSE_CAPTURE.json", proof.baseline())
    result = proof.load("LIVE_PROOF_RESULT.json")
    content = proof.load("CONTENT_FIRST_BYTE_RESULT.json")
    cleanup = proof.load("CLEANUP_RECONCILIATION.json")
    proof.ensure(result["classification"] == content["classification"] == "PROVEN" and
                 result["residualState"] == "ZERO" and cleanup["G2ResourcesAndRolesUnchanged"] and
                 cleanup["g2TerminalRootUnchanged"] and not result["cleanupFailure"], "PROOF_NOT_PROVEN_ZERO")
    bindings = proof.load("TRANSPORT_BINDINGS.json")
    with ThreadPoolExecutor(max_workers=3) as pool:
        checks = [
            pool.submit(absent, "FINAL_EXACT_UAMI_ABSENCE",
                        ["resource", "show", "--ids", bindings["identityId"], "--subscription", proof.retry.p.SUB]),
            pool.submit(absent, "FINAL_EXACT_STORAGE_ABSENCE",
                        ["resource", "show", "--ids", bindings["storageId"], "--subscription", proof.retry.p.SUB]),
            pool.submit(absent, "FINAL_EXACT_GRAPH_ABSENCE",
                        ["ad", "sp", "show", "--id", bindings["identityPrincipalId"]]),
        ]
        for check in checks:
            check.result()
    events = [proof.load(path.name) for path in sorted(HERE.glob("EVENT_*.json"))]
    proof.ensure([x["index"] for x in events] == list(range(1, 51)), "EVENT_SEQUENCE")
    responses = {x["label"]: x for x in events if "label" in x and
                 x["kind"] in {"READ_RESPONSE", "MUTATION_RESPONSE"}}
    dispatches = [x for x in events if x["kind"] == "MUTATION_DISPATCH"]
    puts = [x for x in events if x["kind"] == "OBJECT_RESPONSE" and x["method"] == "PUT"]
    successes = [x for x in events if x["kind"] == "MUTATION_RESPONSE"] + puts
    proof.ensure(len(dispatches) == len(successes) == 9 and len(puts) == 1 and puts[0]["status"] == 201 and
                 sum(x["label"] == "ONE_CSE_EXECUTION" for x in dispatches) == 1 and
                 not any(x["kind"] == "EXPLICIT_COMMAND_FAILURE" for x in events),
                 "DISPATCH_ACCOUNTING")
    creates = {}
    for label in ("SUB_DEPLOYMENT_OPERATIONS", "TRANSPORT_RESOURCE_CREATION_OPERATIONS",
                  "VM_CREATION_OPERATIONS", "CSE_CREATION_OPERATIONS"):
        for operation in responses[label]["value"]:
            properties = operation["properties"]
            target = properties.get("targetResource")
            if (target and properties["provisioningOperation"] == "Create" and
                    properties["provisioningState"] == "Succeeded" and
                    target["resourceType"].lower() != "microsoft.resources/deployments"):
                creates[target["id"]] = target
    roles = [x for x in creates.values() if x["resourceType"].lower() == "microsoft.authorization/roleassignments"]
    identities = [x for x in creates.values() if x["resourceType"].lower() ==
                  "microsoft.managedidentity/userassignedidentities"]
    proof.ensure(len(roles) == 2 and len(identities) == 1, "ROLE_IDENTITY_CENSUS")
    proof.fresh("MUTATION_ACCOUNTING.json", {
        "AZURE_MUTATING_DISPATCHES": len(dispatches),
        "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": len(successes),
        "AZURE_REJECTED_MUTATING_DISPATCHES": 0,
        "AZURE_DELETE_DISPATCHES": sum(x["label"] in {
            "REMOVE_PRODUCER_ROLE", "CLEANUP_BUILDER_ROLE",
            "DELETE_PROOF_RG_CASCADE", "DELETE_PROOF_SUB_DEPLOYMENT_RECORD"} for x in dispatches),
        "ROLE_ASSIGNMENT_CREATES": len(roles), "ROLE_ASSIGNMENT_DELETES": 2,
        "UAMI_CREATES": len(identities), "UAMI_DELETES": 1,
        "RUN_COMMAND_DIAGNOSTIC_ACTIONS": 0,
        "counterUnits": "Direct caller dispatches; successful includes the single Blob PUT.",
        "successfulExplicitCreateTargetsExcludingDeploymentMetadata": list(creates.values()),
        "explicitCreateTargetCount": len(creates),
        "BlobPUTs": 1, "StoragePATCHs": 1, "CSEDeploymentAttempts": 1,
        "implicitPEDerivedNICCreates": 1,
        "cascadeInternalDeleteRPCCount": "NOT_OBSERVED",
        "EntraMutations": "NONZERO_UAMI_LIFECYCLE_EXACT_DIRECTORY_WRITE_COUNT_UNOBSERVED",
        "finalGraphPrincipalAbsent": True,
        "preCascadeInventory": responses["PRECLEANUP_RESOURCES"]["value"],
        "closeoutAzureMutations": 0,
    })
    model = load(HERE.parent / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json")
    end = datetime.fromisoformat(responses["DELETE_PROOF_RG_CASCADE"]["UTC"])
    amounts = dict(model["amountsCAD"])
    hours = {}
    for label, rate, old, maximum in (
        ("CREATE_TRANSPORT", "pe", "onePE4Hours", 4),
        ("CREATE_VM", "vm", "oneB2s2Hours", 2),
    ):
        start = next(x["UTC"] for x in dispatches if x["label"] == label)
        duration = Decimal(str((end - datetime.fromisoformat(start)).total_seconds())) / Decimal(3600)
        proof.ensure(0 <= duration <= maximum, "ACTUAL_TIME_BOUND")
        del amounts[old]
        hours[rate] = str(duration)
        amounts[rate + "ObservedLifetimeUpperBound"] = str(duration * Decimal(model["rates"][rate]["rateCAD"]))
    total = sum(Decimal(x) for x in amounts.values()).quantize(Decimal("0.0000001"))
    proof.ensure(total < Decimal(3), "ACTUAL_ESTIMATE_EXCEEDS_CEILING")
    proof.fresh("ACTUAL_COST_ESTIMATE.json", {
        "currency": "CAD", "estimateCAD": str(total), "ceilingCAD": "3.00",
        "invoicedCost": "NOT_CLAIMED", "amountsCAD": amounts, "lifetimeHoursUpperBounds": hours,
        "basis": "Creation dispatch to completed RG cascade; retain full disk day/DNS month and bounded IO/traffic.",
        "previousProofCostEstimatesCAD": ["1.3567668", "1.3567119"],
        "allThreeConservativeProofEstimatesCAD": str(total + Decimal("1.3567668") + Decimal("1.3567119")),
        "eachProofSeparateCeiling": True,
    })
    print("PROOF_CLOSE_CAPTURE_PASS_COST_CAD=" + str(total))


def cost():
    proof.fresh("CONCURRENCY_COST_CLOSE.json", proof.baseline())
    prior = load(HERE.parent / "g3a-transaction" / "G3A_COST_MODEL.json")
    bridge = load(HERE.parent / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json")
    rates = {**prior["rates"], **bridge["rates"]}
    query = " or ".join("meterId eq '" + value["meterId"] + "'" for value in rates.values())
    url = "https://prices.azure.com/api/retail/prices?" + urlencode({
        "api-version": "2023-01-01-preview", "currencyCode": "CAD", "$filter": query})
    with urlopen(url, timeout=90) as response:
        current = json.loads(response.read())
    proof.ensure(not current.get("NextPageLink"), "COST_REFRESH_PAGINATION_REQUIRED")
    proof.fresh("FULL_G3A_CURRENT_CAD_METERS.json", current)
    for name, rate in rates.items():
        matches = [x for x in current["Items"] if x["meterId"] == rate["meterId"] and
                   x["currencyCode"] == "CAD" and x["type"] == "Consumption" and
                   x["unitOfMeasure"] == rate["unit"] and Decimal(str(x["tierMinimumUnits"])) == 0]
        proof.ensure(matches and all(Decimal(str(x["retailPrice"])) == Decimal(rate["rateCAD"])
                                     for x in matches), "CURRENT_PRICE_CHANGED_" + name)
    amounts = dict(prior["amountsCAD"])
    amounts["threePrivateEndpoints4Hours"] = str(3 * 4 * Decimal(rates["pe"]["rateCAD"]))
    del amounts["twoPrivateEndpoints4Hours"]
    amounts["twoDnsZonesConservativeFullMonth"] = str(2 * Decimal(rates["dnsZone"]["rateCAD"]))
    del amounts["oneDnsZoneConservativeFullMonth"]
    amounts["dns20000Queries"] = str(Decimal("0.02") * Decimal(rates["dnsQuery"]["rateCAD"]))
    del amounts["dns10000Queries"]
    for key in ("blobStorage0_1GBConservativeFullMonth", "blobWriteAndContainerOps10000",
                "blobReads10000", "blobOtherOps10000", "privateLinkIngress0_1GB",
                "privateLinkEgress0_1GB", "conservativeTransfer0_1GB"):
        amounts[key] = bridge["amountsCAD"][key]
    expected = sum(Decimal(x) for x in amounts.values()).quantize(Decimal("0.0000001"))
    ceiling = (expected * Decimal("1.5")).quantize(Decimal("0.01"), rounding="ROUND_CEILING")
    proof.fresh("FULL_G3A_COST_MODEL.json", {
        "status": "COMPLETE_PRICED_BOUNDED_SCENARIO_PENDING_ACTUAL_GUEST_PAYLOAD_BINDING",
        "currency": "CAD", "rates": rates, "currentMetersSha256": proof.sha(HERE / "FULL_G3A_CURRENT_CAD_METERS.json"),
        "amountsCAD": amounts, "G3A_EXPECTED_COST_CAD": str(expected), "G3A_COST_CEILING_CAD": str(ceiling),
        "minimumCeilingMultiplier": "1.5",
        "bounds": {"VMHours": 2, "transactionHours": 4, "inputACRDays": 1, "PEHoursEach": 4,
                   "PEsMaximum": 3, "DNSZonesMaximum": 2, "DNSQueriesMaximum": 20000, "diskGiB": 64,
                   "diskDaysBilled": 1, "diskOperationsMaximum": 100000,
                   "bootstrapGBMonths": "0.1", "bootstrapBinaryBytesMaximum": 10485760,
                   "bootstrapWritesMaximum": 10000, "bootstrapReadsMaximum": 10000, "bootstrapOtherMaximum": 10000,
                   "inputGBDays": "0.5", "inputBytes": 265080538, "finalImageBytes": 3309418,
                   "finalImageStorageMonths": 1, "trafficGBEachDirection": "2.1"},
        "telemetry": "NO_LAW_OR_BOOT_DIAGNOSTICS_RESOURCES; LOCAL_ARM_CSE_EVIDENCE_ONLY",
        "NIC_NSG_UAMI": "NO_STANDALONE_HOURLY_METER",
        "inputACRTransactions": "INCLUDED_PREMIUM_SKU; NO_ACR_TASK_COMPUTE",
        "finalACR": "EXISTING_BASE_FEE_EXCLUDED_INCREMENTAL_STORAGE_AND_TRAFFIC_INCLUDED",
        "finalACRPE": "ONE_ADDITIONAL_PE_FOUR_HOURS_CONSERVATIVELY_INCLUDED_NOT_REQUIRED_CREATION",
        "retention": "INPUT_REGISTRY_BOOTSTRAP_BUILDER_AND_TEMPORARY_GRANTS_DELETE; FINAL_IMAGE_RETAIN_IMMUTABLE",
        "excludes": ["G3B", "existing G2 base firewall/registry capacity", "tax"],
        "authorization": "LOCAL_SCENARIO_ONLY_NOT_EXECUTION_AUTHORITY_OR_BUDGET_EXPANSION",
        "lifecycleAndQuantityEnforcement": "REQUIRED_BY_FUTURE_BOUND_CONTROLLER_BEFORE_FIRST_MUTATION",
    })
    print("FULL_G3A_EXPECTED_CAD=" + str(expected) + " CEILING_CAD=" + str(ceiling))


if __name__ == "__main__":
    import sys
    proof.ensure(len(sys.argv) == 2 and sys.argv[1] in {"capture", "cost"}, "CLOSE_ACTION_REQUIRED")
    {"capture": capture, "cost": cost}[sys.argv[1]]()

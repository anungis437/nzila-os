"""Offline evidence verification; does not import a deployment controller."""

from datetime import datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
SHA = "5f82bd226a27fd1d066a211bb527049097c049181eae92ebf9b3fae3e16683d8"


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def census(path, excluded):
    return {str(x.relative_to(path)): digest(x) for x in path.rglob("*")
            if x.is_file() and x.name not in excluded}


def audit():
    read = lambda name: load(HERE / name)
    events = [load(path) for path in sorted(HERE.glob("EVENT_*.json"))]
    require([x["index"] for x in events] == list(range(1, 51)), "EVENT_SEQUENCE_CHANGED")
    dispatches = [x for x in events if x["kind"] == "MUTATION_DISPATCH"]
    require(len(dispatches) == 9, "EXTRA_MUTATING_DISPATCH")
    labels = [x["label"] for x in dispatches]
    require(labels == ["CREATE_TRANSPORT", "OBJECT_PUT_ONCE", "REMOVE_PRODUCER_ROLE", "LOCK_STORAGE",
                       "CREATE_VM", "ONE_CSE_EXECUTION", "CLEANUP_BUILDER_ROLE",
                       "DELETE_PROOF_RG_CASCADE", "DELETE_PROOF_SUB_DEPLOYMENT_RECORD"], "DISPATCH_ORDER_CHANGED")
    responses = {x["label"]: x for x in events if "label" in x and
                 x["kind"] in {"READ_RESPONSE", "MUTATION_RESPONSE"}}
    require(len([x for x in events if x["kind"] == "MUTATION_RESPONSE"]) == 8 and
            not any(x["kind"] == "EXPLICIT_COMMAND_FAILURE" for x in events), "MUTATION_RESPONSE_CHANGED")
    puts = [x for x in events if x["kind"] == "OBJECT_RESPONSE" and x["method"] == "PUT"]
    gets = [x for x in events if x["kind"] == "OBJECT_RESPONSE" and x["method"] == "GET"]
    absent = [x for x in events if x["kind"] == "OBJECT_HTTP_ERROR"]
    require(len(puts) == len(gets) == len(absent) == 1 and puts[0]["status"] == 201 and
            gets[0]["status"] == 200 and gets[0]["sha256"] == SHA and gets[0]["bytes"] == 1802364 and
            puts[0]["metadata"]["ETag"] == gets[0]["metadata"]["ETag"] and
            absent[0]["method"] == "HEAD" and absent[0]["status"] == 404 and
            absent[0]["errorCode"] == "BlobNotFound", "WRITE_ONCE_READBACK_CHANGED")
    write = read("WRITE_ONCE_RESULT.json")
    require(write["status"] == "PASS" and write["singlePUT"] and write["absenceBeforeUpload"] and
            write["IfNoneMatch"] == "*" and write["exactByteReadback"] and write["sha256"] == SHA,
            "WRITE_ONCE_CONTRACT_CHANGED")
    storage = responses["LOCKDOWN_STORAGE_READ"]["value"]
    require(storage["publicNetworkAccess"] == "Disabled" and
            storage["networkRuleSet"]["defaultAction"] == "Deny" and
            storage["networkRuleSet"]["bypass"] == "None" and
            not storage["networkRuleSet"]["ipRules"] and not storage["networkRuleSet"]["virtualNetworkRules"],
            "STORAGE_NOT_LOCKED")
    require(responses["VERSIONING_DISABLED_READ"]["value"]["isVersioningEnabled"] is False, "VERSIONING_DEPENDENCY")
    bindings = read("TRANSPORT_BINDINGS.json")
    roles = responses["LOCKDOWN_ROLES"]["value"]
    require(len(roles) == 1 and roles[0]["id"].lower() == bindings["readerRoleId"].lower() and
            roles[0]["scope"].lower() == bindings["containerId"].lower() and
            roles[0]["principalId"] == bindings["identityPrincipalId"] and
            roles[0]["roleDefinitionId"].endswith("/2a2b9908-6ea1-4ae2-8e65-a410df84e7d1"),
            "PRODUCER_REVOCATION_READER_SCOPE_CHANGED")
    connections = responses["LOCKDOWN_PRIVATE_ENDPOINT"]["value"]["privateLinkServiceConnections"]
    require(len(connections) == 1 and connections[0]["groupIds"] == ["blob"] and
            connections[0]["privateLinkServiceConnectionState"]["status"] == "Approved" and
            connections[0]["privateLinkServiceId"] == bindings["storageId"], "PRIVATE_ENDPOINT_NOT_APPROVED")
    links = responses["LOCKDOWN_DNS_LINK"]["value"]
    require(len(links) == 1 and links[0]["virtualNetworkLinkState"] == "Completed" and
            links[0]["virtualNetwork"]["id"] == bindings["vnetId"], "PRIVATE_DNS_LINK_CHANGED")
    vm = responses["PROOF_VM_MODEL"]["value"]
    require(vm["identity"]["type"] == "UserAssigned" and
            list(vm["identity"]["userAssignedIdentities"]) == [bindings["identityId"]] and
            all(not x.get("publicIPAddress") for x in responses["PROOF_VM_NIC"]["value"]["ipConfigurations"]),
            "VM_IDENTITY_NETWORK_BOUNDARY_CHANGED")
    view = responses["CSE_TERMINAL_INSTANCE_VIEW"]["value"]
    require(view["typeHandlerVersion"] == "2.1" and view["instanceView"]["typeHandlerVersion"] == "2.1.19" and
            view["provisioningState"] == "Succeeded", "HANDLER_PROOF_CHANGED")
    terminal = [x for x in view["instanceView"]["statuses"]
                if re.fullmatch(r"ProvisioningState/(?:succeeded|failed)(?:/\d+)?", x.get("code", ""))]
    require(len(terminal) == 1 and terminal[0]["code"] == "ProvisioningState/succeeded" and
            "G3A_BOOTSTRAP_REQUESTED_V1" in terminal[0]["message"] and
            "G3A_BOOTSTRAP_CURRENT_V2" not in terminal[0]["message"] and
            re.findall(r"SELF_SHA256=([0-9a-f]{64})", terminal[0]["message"]) == [SHA],
            "MARKER_SELF_HASH_CHANGED")
    content = read("CONTENT_FIRST_BYTE_RESULT.json")
    require(content["proven"] and content["classification"] == "PROVEN" and
            content["writerAbsentDuringConsumption"] and content["publicDisabledDuringConsumption"] and
            content["queryString"] == "NONE", "CONTENT_PROOF_CHANGED")
    parameters = read("CSE_PARAMETERS.json")["parameters"]
    require(parameters["blobObjectUri"]["value"].endswith("/sha256/" + SHA + "/g3a-bootstrap") and
            "?" not in parameters["blobObjectUri"]["value"], "URI_CONTRACT_CHANGED")
    require(not (HERE / "DIAGNOSTIC_ACTION_CONSUMED.json").exists(), "UNEXPECTED_DIAGNOSTIC")
    extension = [x for x in read("infra\\cse.json")["resources"]
                 if x["type"].lower() == "microsoft.compute/virtualmachines/extensions"]
    require(len(extension) == 1, "CSE_RESOURCE_CENSUS_CHANGED")
    properties = extension[0]["properties"]
    require(properties["publisher"] == "Microsoft.Azure.Extensions" and properties["type"] == "CustomScript" and
            properties["typeHandlerVersion"] == "2.1" and properties["autoUpgradeMinorVersion"] is False and
            properties["enableAutomaticUpgrade"] is False and properties["suppressFailures"] is False and
            properties["settings"] == {"skipDos2Unix": True} and
            properties["protectedSettings"]["commandToExecute"] == "./g3a-bootstrap", "CSE_SETTINGS_CHANGED")
    require(not Path(read("INTERACTIVE_ACCESS_CONTRACT.json")["privateKeyPath"]).exists(),
            "PROVISIONING_PRIVATE_KEY_PRESENT")
    accounting = read("MUTATION_ACCOUNTING.json")
    expected = {
        "AZURE_MUTATING_DISPATCHES": 9, "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 9,
        "AZURE_REJECTED_MUTATING_DISPATCHES": 0, "AZURE_DELETE_DISPATCHES": 4,
        "ROLE_ASSIGNMENT_CREATES": 2, "ROLE_ASSIGNMENT_DELETES": 2,
        "UAMI_CREATES": 1, "UAMI_DELETES": 1, "RUN_COMMAND_DIAGNOSTIC_ACTIONS": 0,
    }
    require(all(accounting[name] == value for name, value in expected.items()), "MUTATION_ACCOUNTING_CHANGED")
    require(read("LIVE_PROOF_RESULT.json")["CSEExecutions"] == 1 and
            read("LIVE_PROOF_RESULT.json")["residualState"] == "ZERO", "ONE_ATTEMPT_CLEANUP_CHANGED")
    cleanup = read("CLEANUP_RECONCILIATION.json")
    require(cleanup["proofRGAbsent"] and not cleanup["resourceCensus"] and not cleanup["proofRoleCensus"] and
            cleanup["G2ResourcesAndRolesUnchanged"] and cleanup["g2TerminalRootUnchanged"],
            "RESIDUAL_OR_G2_CHANGE")
    for name in ("FINAL_EXACT_UAMI_ABSENCE", "FINAL_EXACT_STORAGE_ABSENCE", "FINAL_EXACT_GRAPH_ABSENCE"):
        require(read(name + ".json")["absenceConfirmed"], "EXACT_SURVIVOR")
    require(responses["FINAL_RG_ABSENCE"]["value"] is False and
            not responses["FINAL_PROOF_ROLES"]["value"] and not responses["FINAL_PROOF_RESOURCE_CENSUS"]["value"],
            "FINAL_CENSUS_CHANGED")
    for name, value in read("EXECUTION_BINDING.json")["fileHashes"].items():
        require(digest(HERE / name) == value, "DISPATCH_BYTES_CHANGED_" + name)
    require(digest(HERE / "g3a-bootstrap") == SHA, "FROZEN_BINARY_CHANGED")
    model = load(HERE.parent / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json")
    amounts = dict(model["amountsCAD"])
    end = datetime.fromisoformat(responses["DELETE_PROOF_RG_CASCADE"]["UTC"])
    for label, rate, key, maximum in (
        ("CREATE_TRANSPORT", "pe", "onePE4Hours", 4), ("CREATE_VM", "vm", "oneB2s2Hours", 2)):
        start = next(x["UTC"] for x in dispatches if x["label"] == label)
        hours = Decimal(str((end - datetime.fromisoformat(start)).total_seconds())) / Decimal(3600)
        require(0 <= hours <= maximum, "LIFETIME_BOUND_CHANGED")
        del amounts[key]
        amounts[rate + "ObservedLifetimeUpperBound"] = str(hours * Decimal(model["rates"][rate]["rateCAD"]))
    actual = read("ACTUAL_COST_ESTIMATE.json")
    require(actual["amountsCAD"] == amounts and sum(Decimal(x) for x in amounts.values()).quantize(
        Decimal("0.0000001")) == Decimal(actual["estimateCAD"]) < Decimal(3), "ACTUAL_COST_CHANGED")
    full = read("FULL_G3A_COST_MODEL.json")
    subtotal = sum(Decimal(x) for x in full["amountsCAD"].values()).quantize(Decimal("0.0000001"))
    require(subtotal == Decimal(full["G3A_EXPECTED_COST_CAD"]) and
            Decimal(full["G3A_COST_CEILING_CAD"]) >= subtotal * Decimal("1.5"), "FULL_COST_CONTINGENCY_CHANGED")
    meters = read("FULL_G3A_CURRENT_CAD_METERS.json")["Items"]
    require(digest(HERE / "FULL_G3A_CURRENT_CAD_METERS.json") == full["currentMetersSha256"], "METER_BYTES_CHANGED")
    for name, rate in full["rates"].items():
        require(any(x["meterId"] == rate["meterId"] and x["currencyCode"] == "CAD" and
                    x["type"] == "Consumption" and x["unitOfMeasure"] == rate["unit"] and
                    Decimal(str(x["tierMinimumUnits"])) == 0 and
                    Decimal(str(x["retailPrice"])) == Decimal(rate["rateCAD"]) for x in meters),
                "UNPRICED_COMPONENT_" + name)
    return len(events)


def main():
    require(len(sys.argv) == 2, "EXPECTED_SEAL_SHA_REQUIRED")
    events = audit()
    if sys.argv[1] == "--audit":
        print("OFFLINE_RAW_EVIDENCE_AUDIT_PASS_EVENTS=" + str(events))
        return
    root_path = HERE / "CONTENT_PROOF_VERIFICATION.json"
    require(digest(root_path) == sys.argv[1], "SEALED_ROOT_CHANGED")
    root = load(root_path)
    require(census(HERE, {"CONTENT_PROOF_VERIFICATION.json", "CONTENT_INDEPENDENT_VERIFICATION.json"}) ==
            root["fileHashes"], "PROOF_CENSUS_CHANGED")
    closure = Path(root["closurePath"])
    require(census(closure, set()) == root["closureFileHashes"], "LOCAL_CLOSURE_CENSUS_CHANGED")
    for name, value in root["protectedFileHashes"].items():
        require(digest(name) == value, "PROTECTED_HISTORY_CHANGED_" + name)
    disposition = load(HERE / "FINAL_DISPOSITION.json")
    require(disposition["G3A_CONTENT_ADDRESSED_FIRST_BYTE"] == "PROVEN" and
            disposition["FIRST_BYTE_PROOF_RESIDUAL_STATE"] == "ZERO", "FINAL_PROOF_DISPOSITION_CHANGED")
    for name in ("G3A_EXECUTION_AUTHORIZED", "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        require(disposition[name] == "NO", "UNAUTHORIZED_GATE_RELAXATION")
    require(disposition["G3_EXECUTION_READINESS"] == "BLOCKED" and disposition["REGISTRY_MUTATIONS"] == 0 and
            disposition["UE_INFRA"] == disposition["CORA_INFRA"] == "INFRA_NO_GO", "PRODUCT_DISPOSITION_CHANGED")
    output = {
        "status": "PASS", "rootSha256": sys.argv[1], "proofEvents": events,
        "protectedHashReferences": len(root["protectedFileHashes"]),
        "proofFileReferences": len(root["fileHashes"]), "closureFileReferences": len(root["closureFileHashes"]),
        "independentOfDeploymentControllerImports": True, "azureCalls": 0,
        "registryCalls": 0, "notClaimedG3ARuntimeQualification": True,
    }
    destination = HERE / "CONTENT_INDEPENDENT_VERIFICATION.json"
    with destination.open("x", encoding="utf-8") as stream:
        json.dump(output, stream, indent=2)
        stream.write("\n")
    print("CONTENT_INDEPENDENT_VERIFICATION=PASS_ROOT=" + sys.argv[1])


if __name__ == "__main__":
    main()

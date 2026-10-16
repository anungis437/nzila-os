"""Independent sealed proof check; no deployment module imports or Azure calls."""

from datetime import datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
BASE = HERE.parent


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def census(path, excluded):
    return {str(item.relative_to(path)): digest(item) for item in path.rglob("*")
            if item.is_file() and item.name not in excluded}


def prior():
    root_path = BASE / "g3a-capsule-offline" / "OFFLINE_VERIFICATION.json"
    require(digest(root_path) == "ec22b7bbcb7c81f78701be704ef732c8240ed5223111e24cf30ac0ddbf22bb35",
            "PRIOR_OFFLINE_ROOT_CHANGED")
    protected = {str(root_path): digest(root_path)}
    root = load(root_path)
    for name, expected in root["fileHashes"].items():
        path = root_path.parent / name
        require(digest(path) == expected, "HISTORICAL_CANDIDATE_PACKET_CHANGED_" + name)
        protected[str(path)] = expected
    predecessor = Path(root["previousProofPath"])
    require(digest(predecessor) == root["previousProofSha256"], "FIRST_BYTE_ROOT_CHANGED")
    protected[str(predecessor)] = root["previousProofSha256"]
    original = load(predecessor)
    for name, expected in original["fileHashes"].items():
        path = predecessor.parent / name
        require(digest(path) == expected, "FIRST_BYTE_PACKET_CHANGED_" + name)
        protected[str(path)] = expected
    for name, expected in original["closureFileHashes"].items():
        path = Path(original["closurePath"]) / name
        require(digest(path) == expected, "LOCAL_CLOSURE_CHANGED_" + name)
        protected[str(path)] = expected
    for name, expected in original["protectedFileHashes"].items():
        require(digest(name) == expected, "QUALIFIED_COMPONENT_CHANGED_" + name)
        protected[name] = expected
    candidate = root_path.parent / "g3a-guest-candidate"
    require(digest(candidate) == "b41226ceb1488a68f18e013faa4dab7a13a2d8d55a582579b7dc9a601cb738b2" and
            candidate.stat().st_size == 25800828, "HISTORICAL_CANDIDATE_BINARY_CHANGED")
    return protected


def audit():
    read = lambda name: load(HERE / name)
    outcome = read("LIVE_PROOF_RESULT.json")
    events = [load(path) for path in sorted(HERE.glob("EVENT_*.json"))]
    require([x["index"] for x in events] == list(range(1, outcome["events"] + 1)), "EVENT_CENSUS_CHANGED")
    dispatches = [x for x in events if x["kind"] == "MUTATION_DISPATCH"]
    responses = {x["label"]: x for x in events if "label" in x and x["kind"] in {
        "READ_RESPONSE", "MUTATION_RESPONSE", "EXPLICIT_COMMAND_FAILURE"}}
    labels = [x["label"] for x in dispatches]
    require(labels.count("CREATE_TRANSPORT") == labels.count("CREATE_VM") == labels.count("ONE_CSE_EXECUTION") == 1,
            "LIVE_ATTEMPT_COUNT_CHANGED")
    require(labels.count("ONE_READ_ONLY_DIAGNOSTIC_ACTION") <= 1, "SECOND_DIAGNOSTIC")
    puts = [x for x in events if x["kind"] == "OBJECT_RESPONSE" and x["method"] == "PUT"]
    reads = [x for x in events if x["kind"] == "OBJECT_RESPONSE" and x["method"] == "GET"]
    heads = [x for x in events if x["kind"] == "OBJECT_HTTP_ERROR" and x["method"] == "HEAD"]
    require(len(puts) == len(reads) == len(heads) == 2 and all(x["status"] == 201 for x in puts) and
            all(x["status"] == 404 and x["errorCode"] == "BlobNotFound" for x in heads), "TWO_WRITE_ONCE_OBJECTS")
    objects = read("WRITE_ONCE_RESULT.json")["objects"]
    require(len(objects) == 2 and {x["role"] for x in objects} == {"handoff", "capsule"}, "OBJECT_ROLE_CENSUS")
    for item, put, get in zip(objects, puts, reads):
        require(item["writeOnce"] and item["exactReadback"] and item["ETag"] == put["metadata"]["ETag"] ==
                get["metadata"]["ETag"] and item["sha256"] == get["sha256"] and item["bytes"] == get["bytes"],
                "OBJECT_READBACK_CHANGED")
        require(item["objectPath"] == "sha256/" + item["sha256"] + "/" +
                ("g3a-handoff" if item["role"] == "handoff" else "g3a-proof-capsule"),
                "CONTENT_ADDRESS_CHANGED")
    require(labels.index("REMOVE_PRODUCER_ROLE") < labels.index("LOCK_STORAGE") <
            labels.index("CREATE_VM") < labels.index("ONE_CSE_EXECUTION"), "LOCKDOWN_ORDER_CHANGED")
    transport = read("TRANSPORT_BINDINGS.json")
    roles = responses["LOCKDOWN_ROLES"]["value"]
    require(len(roles) == 1 and roles[0]["id"].lower() == transport["readerRoleId"].lower() and
            roles[0]["scope"].lower() == transport["containerId"].lower() and
            roles[0]["principalId"] == transport["identityPrincipalId"], "PRODUCER_REVOCATION_CHANGED")
    storage = responses["LOCKDOWN_STORAGE_READ"]["value"]
    require(storage["publicNetworkAccess"] == "Disabled" and
            storage["networkRuleSet"]["defaultAction"] == "Deny" and storage["networkRuleSet"]["bypass"] == "None" and
            not storage["networkRuleSet"]["ipRules"] and not storage["networkRuleSet"]["virtualNetworkRules"] and
            responses["VERSIONING_DISABLED_READ"]["value"]["isVersioningEnabled"] is False, "STORAGE_LOCKDOWN_CHANGED")
    endpoint = responses["LOCKDOWN_PRIVATE_ENDPOINT"]["value"]["privateLinkServiceConnections"]
    require(len(endpoint) == 1 and endpoint[0]["privateLinkServiceConnectionState"]["status"] == "Approved" and
            endpoint[0]["privateLinkServiceId"] == transport["storageId"], "PRIVATE_ENDPOINT_CHANGED")
    vm = responses["PROOF_VM_MODEL"]["value"]
    image = vm["storageProfile"]["imageReference"]
    require(":".join(image[x] for x in ("publisher", "offer", "sku", "version")) ==
            "Canonical:ubuntu-24_04-lts:server:24.04.202609040" and
            vm["identity"]["type"] == "UserAssigned" and
            list(vm["identity"]["userAssignedIdentities"]) == [transport["identityId"]] and
            all(not x.get("publicIPAddress") for x in responses["PROOF_VM_NIC"]["value"]["ipConfigurations"]),
            "PINNED_VM_BOUNDARY_CHANGED")
    cse = [x for x in read("infra\\cse.json")["resources"]
           if x["type"].lower() == "microsoft.compute/virtualmachines/extensions"]
    require(len(cse) == 1, "EXTENSION_RESOURCE_COUNT")
    properties = cse[0]["properties"]
    require(properties["typeHandlerVersion"] == "2.1" and properties["publisher"] == "Microsoft.Azure.Extensions" and
            properties["type"] == "CustomScript" and properties["settings"] == {"skipDos2Unix": True} and
            properties["autoUpgradeMinorVersion"] is properties["enableAutomaticUpgrade"] is False and
            properties["protectedSettings"]["commandToExecute"] == "./g3a-handoff ./g3a-proof-capsule" and
            len(properties["protectedSettings"]["fileUris"]) == 2, "CSE_CONTRACT_CHANGED")
    cseparams = read("CSE_PARAMETERS.json")["parameters"]
    require("?" not in cseparams["handoffUri"]["value"] and "?" not in cseparams["capsuleUri"]["value"],
            "MUTABLE_QUERY_DEPENDENCY")
    account = read("MUTATION_ACCOUNTING.json")
    successful = [x for x in events if x["kind"] == "MUTATION_RESPONSE"] + puts
    failed = [x for x in events if x["kind"] == "EXPLICIT_COMMAND_FAILURE" and x["label"] in labels]
    require(account["AZURE_MUTATING_DISPATCHES"] == len(dispatches) ==
            len(successful) + len(failed) and account["AZURE_SUCCESSFUL_MUTATING_DISPATCHES"] == len(successful) and
            account["AZURE_REJECTED_MUTATING_DISPATCHES"] == len(failed), "MUTATION_ACCOUNTING_CHANGED")
    require(account["ROLE_ASSIGNMENT_CREATES"] == account["ROLE_ASSIGNMENT_DELETES"] == 2 and
            account["UAMI_CREATES"] == account["UAMI_DELETES"] == 1 and
            account["RUN_COMMAND_DIAGNOSTIC_ACTIONS"] == labels.count("ONE_READ_ONLY_DIAGNOSTIC_ACTION"),
            "ROLE_IDENTITY_ACCOUNTING_CHANGED")
    cleanup = read("CLEANUP_RECONCILIATION.json")
    require(cleanup["proofRGAbsent"] and not cleanup["resourceCensus"] and not cleanup["proofRoleCensus"] and
            cleanup["G2ResourcesAndRolesUnchanged"] and cleanup["g2TerminalRootUnchanged"] and
            outcome["residualState"] == "ZERO", "RESIDUAL_OR_G2_CHANGE")
    for name in ("FINAL_EXACT_UAMI_ABSENCE", "FINAL_EXACT_STORAGE_ABSENCE", "FINAL_EXACT_GRAPH_ABSENCE"):
        require(read(name + ".json")["absenceConfirmed"], "EXACT_SURVIVOR")
    model = load(BASE / "g3a-firstbyte" / "BOOTSTRAP_PROOF_COST_MODEL.json")
    end = datetime.fromisoformat(responses["DELETE_PROOF_RG_CASCADE"]["UTC"])
    amounts = dict(model["amountsCAD"])
    for label, rate, key, maximum in (
        ("CREATE_TRANSPORT", "pe", "onePE4Hours", 4), ("CREATE_VM", "vm", "oneB2s2Hours", 2)):
        start = next(x["UTC"] for x in dispatches if x["label"] == label)
        hours = Decimal(str((end - datetime.fromisoformat(start)).total_seconds())) / Decimal(3600)
        require(0 <= hours <= maximum, "OBSERVED_LIFETIME_EXCEEDS_CAP")
        del amounts[key]
        amounts[rate + "ObservedLifetimeUpperBound"] = str(hours * Decimal(model["rates"][rate]["rateCAD"]))
    actual = read("ACTUAL_COST_ESTIMATE.json")
    require(actual["amountsCAD"] == amounts and
            sum(Decimal(x) for x in amounts.values()).quantize(Decimal("0.0000001")) ==
            Decimal(actual["estimateCAD"]) <= 3, "COST_ARITHMETIC_CHANGED")
    binding = read("PINNED_GUEST_PROOF_BINDING.json")
    require(digest(HERE / "EXECUTION_BINDING.json") == binding["executionBindingSha256"], "DISPATCH_BINDING_CHANGED")
    for name, expected in read("EXECUTION_BINDING.json")["fileHashes"].items():
        require(digest(HERE / name) == expected, "BOUND_CONTROLLER_CHANGED_" + name)
    for name, expected in binding["artifactFileHashes"].items():
        require(digest(name) == expected, "BOUND_ARTIFACT_CHANGED_" + name)
    return len(events)


def main():
    require(len(sys.argv) == 2, "EXPECTED_SEAL_REQUIRED")
    events = audit()
    if sys.argv[1] == "--audit":
        print("ISOLATION_RAW_AUDIT=PASS_EVENTS=" + str(events))
        return
    seal = HERE / "ISOLATION_VERIFICATION.json"
    require(digest(seal) == sys.argv[1], "SEALED_ROOT_CHANGED")
    root = load(seal)
    require(census(HERE, {"ISOLATION_VERIFICATION.json", "ISOLATION_INDEPENDENT_VERIFICATION.json"}) ==
            root["fileHashes"], "LIVE_LANE_CENSUS_CHANGED")
    require(census(Path(root["artifactPath"]), set()) == root["artifactFileHashes"], "ARTIFACT_LANE_CENSUS_CHANGED")
    for name, expected in root["protectedFileHashes"].items():
        require(digest(name) == expected, "PROTECTED_HISTORY_CHANGED")
    disposition = load(HERE / "FINAL_DISPOSITION.json")
    require(disposition["PINNED_GUEST_PROOF_AUTHORITY_CONSUMED"] == "YES" and
            disposition["PINNED_GUEST_PROOF_RESIDUAL_STATE"] == "ZERO", "FINAL_LIVE_DISPOSITION_CHANGED")
    for name in ("G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED", "G3A_EXECUTION_AUTHORIZED",
                 "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        require(disposition[name] == "NO", "UNAUTHORIZED_GATE_RELAXATION")
    require(disposition["REGISTRY_MUTATIONS"] == 0 and
            disposition["UE_INFRA"] == disposition["CORA_INFRA"] == "INFRA_NO_GO", "PRODUCT_GATE_RELAXATION")
    output = {"status": "PASS", "rootSha256": sys.argv[1], "events": events,
              "liveFileReferences": len(root["fileHashes"]),
              "artifactFileReferences": len(root["artifactFileHashes"]),
              "protectedHistoryReferences": len(root["protectedFileHashes"]),
              "deploymentModulesImported": False, "cloudCalls": 0}
    with (HERE / "ISOLATION_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as stream:
        json.dump(output, stream, indent=2)
        stream.write("\n")
    print("ISOLATION_INDEPENDENT_VERIFICATION=PASS_ROOT=" + sys.argv[1])


if __name__ == "__main__":
    main()

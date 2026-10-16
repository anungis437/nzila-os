"""Close the consumed retry using captured evidence and exact read-only census."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
import io
from pathlib import Path
import re
import unittest

from refresh import HERE, PACKAGE, digest, fresh, load, read, require, retry


def terminal_status(statuses):
    matches = [item for item in statuses
               if re.fullmatch(r"ProvisioningState/(?:succeeded|failed)(?:/\d+)?", item.get("code", ""))]
    require(len(matches) == 1, "TERMINAL_STATUS_UNRESOLVED")
    return matches[0]


def elapsed_hours(first, last):
    duration = (datetime.fromisoformat(last) - datetime.fromisoformat(first)).total_seconds()
    require(duration >= 0, "NEGATIVE_LIFETIME")
    return Decimal(str(duration)) / Decimal(3600)


def absent_read(name, args):
    import subprocess
    result = subprocess.run([retry.p.AZ, *args, "--output", "json", "--only-show-errors"],
                            capture_output=True, text=True, env=retry.p.ENV, timeout=180)
    require(result.returncode != 0 and
            ("ResourceNotFound" in result.stderr or "ResourceGroupNotFound" in result.stderr or
             ("Resource '" in result.stderr and "does not exist" in result.stderr)), "FINAL_ABSENCE_READ_FAILED_" + name)
    fresh(name + ".json", {"command": ["az", *args], "exitCode": result.returncode,
                          "absenceConfirmed": True, "stderr": result.stderr.strip(),
                          "utc": datetime.now(timezone.utc).isoformat()})
    return True


def main():
    require(not (HERE / "RESUME_VERIFICATION.json").exists(), "RESUME_ALREADY_SEALED")
    fresh("CONCURRENCY_CLOSE_RESUME.json", retry.baseline())
    root_path = PACKAGE / "RETRY_PREDEPLOY_VERIFICATION.json"
    require(digest(root_path) == "fc9dea154679a24200ba0ef68f8512c67ff5557b6227d3a60836fd17dd685a53",
            "PREDEPLOY_ROOT_CHANGED")
    predeploy = load(root_path)
    for name, expected in predeploy["fileHashes"].items():
        require(digest(PACKAGE / name) == expected, "VALIDATED_INPUT_CHANGED_" + name)
    for name, expected in predeploy["protectedFileHashes"].items():
        require(digest(name) == expected, "PROTECTED_FILE_CHANGED")
    outcome = load(PACKAGE / "LIVE_PROOF_RESULT.json")
    cleanup = load(PACKAGE / "CLEANUP_RECONCILIATION.json")
    require(outcome["authorityConsumed"] and outcome["CSEExecutions"] == 1 and
            outcome["residualState"] == "ZERO" and not outcome["cleanupFailure"], "UNEXPECTED_PROOF_OUTCOME")
    require(cleanup["status"] == "PASS_ZERO_PROOF_RESIDUALS" and cleanup["G2ResourcesAndRolesUnchanged"] and
            cleanup["g2TerminalRootUnchanged"], "CLEANUP_NOT_PROVEN")
    events = [load(path) for path in sorted(PACKAGE.glob("EVENT_*.json"))]
    require([event["index"] for event in events] == list(range(1, 55)) and outcome["events"] == 54,
            "EVENT_SEQUENCE_MISMATCH")
    responses = {event["label"]: event for event in events
                 if "label" in event and event["kind"] in {"READ_RESPONSE", "MUTATION_RESPONSE", "EXPLICIT_COMMAND_FAILURE"}}
    dispatches = [event for event in events if event["kind"] == "MUTATION_DISPATCH"]
    require(len(dispatches) == 10 and sum(x["label"] == "ONE_CSE_EXECUTION" for x in dispatches) == 1,
            "DISPATCH_CENSUS_MISMATCH")
    view = responses["CSE_TERMINAL_INSTANCE_VIEW"]["value"]
    terminal = terminal_status(view["instanceView"]["statuses"])
    require(terminal["code"] == "ProvisioningState/failed/0" and view["provisioningState"] == "Failed" and
            view["instanceView"]["typeHandlerVersion"] == "2.1.19" and view["typeHandlerVersion"] == "2.1",
            "LIVE_HANDLER_EVIDENCE_MISMATCH")
    message = terminal["message"]
    require("processing file downloads failed" in message and "unable to download the MSI" in message and
            "G3A_BOOTSTRAP_REQUESTED_V1" not in message and "G3A_BOOTSTRAP_CURRENT_V2" not in message and
            not re.search(r"SELF_SHA256=[0-9a-f]{64}", message), "FAILURE_EVIDENCE_CHANGED")
    fresh("ADJUDICATED_TERMINAL_RESULT.json", {
        "terminalSemanticResult": "CSE_FAILURE_OTHER", "CSE_VERSIONID_SELECTION": "CSE_FAILURE_OTHER",
        "observedTerminalCode": terminal["code"], "extensionErrorCode": "72",
        "deploymentSelectorAccepted": True, "guestHandlerObserved": "2.1.19",
        "probeCommandExecuted": "NOT_OBSERVED_DOWNLOAD_FAILED", "runtimeSelfHash": "NOT_OBSERVED",
        "failureBoundary": "MANAGED_IDENTITY_FILE_DOWNLOAD",
        "specificUnderlyingHTTPStatus": "NOT_CAPTURED", "specificUnderlyingHTTPErrorCode": "NOT_CAPTURED",
        "privatePathFailure": "NOT_PROVEN", "identityAuthFailure": "NOT_PROVEN",
        "versionSemantics": "UNRESOLVED_NOT_IGNORED_OR_UNSUPPORTED_PROVEN",
        "controllerObserverFailure": "Exact failed-code comparison did not recognize ProvisioningState/failed/0.",
        "rawControllerResultPreserved": str(PACKAGE / "LIVE_PROOF_RESULT.json"),
        "noControllerRepairOrReplay": True,
        "primaryEvidence": str(PACKAGE / "EVENT_039.json"),
    })
    binding = load(PACKAGE / "TRANSPORT_BINDINGS.json")
    rgid = "/subscriptions/" + retry.p.SUB + "/resourceGroups/" + outcome["resourceGroup"]
    with ThreadPoolExecutor(max_workers=3) as pool:
        checks = [
            pool.submit(absent_read, "FINAL_UAMI_ABSENCE", ["resource", "show", "--ids", binding["identityId"],
                        "--subscription", retry.p.SUB]),
            pool.submit(absent_read, "FINAL_STORAGE_ABSENCE", ["resource", "show", "--ids", binding["storageId"],
                        "--subscription", retry.p.SUB]),
            pool.submit(absent_read, "FINAL_GRAPH_PRINCIPAL_ABSENCE",
                        ["ad", "sp", "show", "--id", binding["identityPrincipalId"]]),
        ]
        require(all(check.result() for check in checks), "EXACT_RESOURCE_SURVIVOR")
    exists = read("FINAL_RESUME_RG_ABSENCE", ["group", "exists", "--name", outcome["resourceGroup"],
                  "--subscription", retry.p.SUB])
    require(exists is False, "RESIDUAL_RG")
    resources = read("FINAL_RESUME_RESOURCE_CENSUS", ["resource", "list", "--subscription", retry.p.SUB,
                     "--query", "[?starts_with(id, '" + rgid + "/')]"])
    roles = read("FINAL_RESUME_ROLE_CENSUS", ["role", "assignment", "list", "--all",
                 "--fill-principal-name", "false", "--query", "[?starts_with(scope, '" + rgid +
                 "') || principalId=='" + binding["identityPrincipalId"] + "']"])
    require(not resources and not roles, "PROOF_RESIDUALS")
    creates = {}
    failed_targets = []
    for label in ("SUB_DEPLOYMENT_OPERATIONS", "TRANSPORT_RESOURCE_CREATION_OPERATIONS",
                  "VM_CREATION_OPERATIONS", "CSE_CREATION_OPERATIONS"):
        for op in responses[label]["value"]:
            properties = op["properties"]
            target = properties.get("targetResource")
            if target and properties["provisioningOperation"] == "Create":
                if properties["provisioningState"] == "Succeeded" and target["resourceType"].lower() != "microsoft.resources/deployments":
                    creates[target["id"]] = target
                elif properties["provisioningState"] == "Failed":
                    failed_targets.append(target)
    require(len(creates) == 15 and len(failed_targets) == 1, "LEAF_ACCOUNTING_CHANGED")
    puts = [x for x in events if x["kind"] == "BLOB_RESPONSE" and x.get("method") == "PUT"]
    successes = [x for x in events if x["kind"] == "MUTATION_RESPONSE"] + puts
    nonzero = [x for x in events if x["kind"] == "EXPLICIT_COMMAND_FAILURE" and x.get("label") in
               {d["label"] for d in dispatches}]
    require(len(successes) == 9 and len(nonzero) == 1 and len(puts) == 2 and
            all(x["httpStatus"] == 201 for x in puts), "DISPATCH_OUTCOMES_CHANGED")
    accounting = {
        "AZURE_MUTATING_DISPATCHES": 10, "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 9,
        "AZURE_REJECTED_MUTATING_DISPATCHES": 1, "AZURE_DELETE_DISPATCHES": 4,
        "ROLE_ASSIGNMENT_CREATES": 2, "ROLE_ASSIGNMENT_DELETES": 2, "UAMI_CREATES": 1, "UAMI_DELETES": 1,
        "counterUnits": "Caller-level mutation dispatches; successful=zero CLI exit or HTTP201, rejected=non-successful terminal caller result.",
        "rejectedCounterClarification": "The one nonzero dispatch was guest extension provisioning failure, NOT ARM selector rejection.",
        "ARMSelectorRejections": 0, "GuestProvisioningFailures": 1,
        "successfulExplicitCreateTargetsExcludingDeploymentMetadata": list(creates.values()),
        "failedCreateTargetsWithExistingGuestExtension": failed_targets,
        "BlobPUTs": 2, "StoragePATCHs": 1, "CSEDeploymentAttempts": 1,
        "deleteUnits": {"roleAssignments": 2, "RGOwnedCascade": 1, "subscriptionDeploymentRecord": 1},
        "preCascadeInventory": responses["PRECLEANUP_RESOURCES"]["value"],
        "cascadeInternalDeleteRPCCount": "NOT_OBSERVED", "registryMutations": 0,
        "EntraMutations": "NONZERO_PLATFORM_UAMI_LIFECYCLE_EXACT_GRAPH_WRITE_COUNT_UNOBSERVED",
        "finalGraphPrincipalAbsent": True,
    }
    fresh("MUTATION_ACCOUNTING.json", accounting)
    cost_model = load(Path(load(PACKAGE / "CURRENT_COST_GATE.json")["capturedMeterModel"]))
    end = responses["DELETE_PROOF_RG_CASCADE"]["UTC"]
    starts = {x["label"]: x["UTC"] for x in dispatches}
    pe_hours = elapsed_hours(starts["CREATE_TRANSPORT"], end)
    vm_hours = elapsed_hours(starts["CREATE_VM"], end)
    require(pe_hours <= 4 and vm_hours <= 2, "DURATION_CEILING_EXCEEDED")
    amounts = dict(cost_model["amountsCAD"])
    del amounts["onePE4Hours"]
    del amounts["oneB2s2Hours"]
    amounts["PEObservedLifetimeUpperBound"] = str(pe_hours * Decimal(cost_model["rates"]["pe"]["rateCAD"]))
    amounts["VMObservedLifetimeUpperBound"] = str(vm_hours * Decimal(cost_model["rates"]["vm"]["rateCAD"]))
    amount = sum(Decimal(x) for x in amounts.values()).quantize(Decimal("0.0000001"))
    require(amount < Decimal("3"), "COST_CEILING_EXCEEDED")
    fresh("ACTUAL_COST_ESTIMATE.json", {
        "currency": "CAD", "estimateCAD": str(amount), "ceilingCAD": "3.00", "invoicedCost": "NOT_CLAIMED",
        "amountsCAD": amounts, "PEHoursUpperBound": str(pe_hours), "VMHoursUpperBound": str(vm_hours),
        "conservativeBasis": "Dispatch-before-creation to completed RG cascade; full DNS month, disk day and bounded operations/traffic retained.",
        "pricingRefresh": "REFRESHED_COST_GATE.json", "previousProofCostCAD": "1.3567668",
        "twoProofsConservativeTotalCAD": str(amount + Decimal("1.3567668")),
        "eachProofHasSeparateCeiling": True,
    })
    disposition = {
        "DEPLOYMENT_TOOLING_AVAILABLE": "YES", "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED", "G3A_REGISTRY_UPLOADER": "QUALIFIED",
        "PREVIOUS_BOOTSTRAP_PROOF_AUTHORITY": "CONSUMED", "BOOTSTRAP_RETRY_AUTHORITY_CONSUMED": "YES",
        "CSE_HANDLER_SELECTOR": "2.1", "CSE_2_1_FAMILY_AVAILABLE": "YES",
        "CSE_EFFECTIVE_HANDLER_VERSION": "2.1.19",
        "BOOTSTRAP_RETRY_EXPECTED_COST_CAD": load(HERE / "REFRESHED_COST_GATE.json")["REFRESHED_EXPECTED_COST_CAD"],
        "BOOTSTRAP_RETRY_COST_CEILING_CAD": "3.00", "BOOTSTRAP_RETRY_ACTUAL_COST_ESTIMATE_CAD": str(amount),
        "BOOTSTRAP_STORAGE_LOCKDOWN": "PASS", "V1_VERSION_ID": outcome["V1_VERSION_ID"],
        "V1_BINARY_SHA256": "5f82bd226a27fd1d066a211bb527049097c049181eae92ebf9b3fae3e16683d8",
        "V2_BINARY_SHA256": "3760618e3dc3bd8396a51bd216aa863c024301aeb0cf8b65c698b7147c06e003",
        "CSE_VERSIONID_SELECTION": "CSE_FAILURE_OTHER", "G3A_FIRST_BYTE_BOOTSTRAP": "BLOCKED",
        "BOOTSTRAP_RETRY_RESIDUAL_STATE": "ZERO",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "BOOTSTRAP_RETRY_RESOURCE_GROUP": outcome["resourceGroup"],
        "conditionalLocalClosure": "NOT_ACTIVATED_FAILURE", "CSEDeploymentAttempts": 1,
    }
    disposition.update({name: accounting[name] for name in (
        "AZURE_MUTATING_DISPATCHES", "AZURE_SUCCESSFUL_MUTATING_DISPATCHES", "AZURE_REJECTED_MUTATING_DISPATCHES",
        "AZURE_DELETE_DISPATCHES", "ROLE_ASSIGNMENT_CREATES", "ROLE_ASSIGNMENT_DELETES", "UAMI_CREATES", "UAMI_DELETES")})
    fresh("FINAL_DISPOSITION.json", disposition)
    stream = io.StringIO()
    tests = unittest.defaultTestLoader.loadTestsFromName("test_close")
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(tests)
    fresh("CLOSE_OBSERVER_TESTS.json", {"status": "PASS" if result.wasSuccessful() else "FAIL",
                                     "testCount": result.testsRun, "output": stream.getvalue(),
                                     "liveControllerChanged": False, "guestOrUploaderExecuted": False})
    require(result.wasSuccessful() and result.testsRun == 4, "CLOSE_OBSERVER_TESTS_FAILED")
    package_hashes = {str(path.relative_to(PACKAGE)): digest(path) for path in PACKAGE.rglob("*") if path.is_file()}
    for name, expected in predeploy["fileHashes"].items():
        require(package_hashes[name] == expected, "SEALED_PREDEPLOY_BYTE_CHANGED")
    resume_hashes = {str(path.relative_to(HERE)): digest(path) for path in HERE.rglob("*") if path.is_file()}
    fresh("RESUME_VERIFICATION.json", {
        "status": "SEALED_FAILED_RETRY_ZERO_RESIDUALS", "resumeFileHashes": resume_hashes,
        "retryPackagePath": str(PACKAGE), "retryPackageFileHashes": package_hashes,
        "predeployRootSha256": digest(root_path),
        "protectedFileHashes": predeploy["protectedFileHashes"],
        "existingAuthorityPath": predeploy["authorityPath"], "existingAuthoritySha256": predeploy["authoritySha256"],
        "proofScope": "ONE_RETRY_ONLY_NO_THIRD_AUTHORITY",
        "fullAncestorLeafReplay": False,
    })
    print("RESUME_ROOT_SHA256=" + digest(HERE / "RESUME_VERIFICATION.json"), flush=True)
    print("ACTUAL_CONSERVATIVE_RETRY_COST_CAD=" + str(amount), flush=True)


if __name__ == "__main__":
    main()

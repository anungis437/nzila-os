"""Seal earned qualification separately from unfinished transaction integration."""

from datetime import datetime, timezone
import io
from pathlib import Path
import sys
import unittest

from prepare import BASE, HERE, fresh, prior, read, require, sha


def main():
    concurrency = prior.baseline()
    fresh("CONCURRENCY_FINAL.json", concurrency)
    live = BASE / "g3a-hard-live"
    qualification = read(live / "RUNNER_FINAL_DISPOSITION.json")
    require(qualification["G3A_PRODUCTION_COMPATIBLE_RUNNER"] == "QUALIFIED" and
            qualification["PRODUCTION_RUNNER_PROOF_RESIDUAL_STATE"] == "ZERO",
            "PINNED_GUEST_RUNNER_NOT_QUALIFIED_ZERO")
    guest = read(live / "GUEST_PROOF_RESULT.json")
    require(guest["allPassed"] and guest["evidenceComplete"] and guest["extensionSucceeded"] and
            len(guest["checks"]) == 20 and all(value == "PASS" for value in guest["checks"].values()),
            "ACTUAL_PINNED_GUEST_CHECKS_NOT_PASS")
    acceptance = read(HERE / "HARD_BOUND_ACCEPTANCE.json")
    require(len(acceptance["exactImageGates"]) == 7 and
            all(item["status"] == "YES" for item in acceptance["exactImageGates"].values()),
            "EXACT_IMAGE_GATES_CHANGED")
    original = read(HERE / "AUTHORITY_BINDING.json")
    for name, expected in original["protectedFileHashes"].items():
        require(sha(Path(name)) == expected, "PROTECTED_HISTORY_CHANGED_" + name)
    sku_receipt = live / "SKU_2.json"
    exact_sku = [item for item in read(sku_receipt)["value"]
                 if item["name"] == "Standard_B2s" and item["resourceType"] == "virtualMachines"]
    require(len(exact_sku) == 1, "EXACT_B2S_SKU_UNBOUND")
    memory_gib = [item["value"] for item in exact_sku[0]["capabilities"] if item["name"] == "MemoryGB"]
    require(memory_gib == ["4"], "B2S_MEMORY_EVIDENCE_CHANGED")
    fresh("CONDITIONAL_LOCAL_CLOSURE.json", {
        "runnerPrerequisite": "QUALIFIED", "proofResidualState": "ZERO",
        "G3A_TRANSACTION_READINESS": "BLOCKED",
        "productionEntry": {
            "argv": ["<unchanged-candidate>", "--production"],
            "stdinSchema": "g3a-production-request/v1", "maximumStdinBytes": 16384,
            "payloadSha256": "5fd7a3df26511cd43ad49e20e75d5c024f323995cb76c966ad7ec728581c2251",
            "currentFutureAuthorityDigest": "",
            "currentExit": "FUTURE_EXECUTION_AUTHORITY_DIGEST_REQUIRED",
            "authorityNotIssued": True,
            "implementedBehindGate": "Isolated assembler, exact outputs, bounded archive and cleanup",
            "notImplemented": "Outer private-reader/build bridge/uploader/authorization-negative transaction dispatch and production complete-evidence transport",
        },
        "sourceOwnerReadOnlyInterfaceAttestation": {
            "agent": "896fe67d-22f5-4768-9926-4896bd3a7b45", "turn": 6,
            "candidateReportSHA256": "9a81d8b3c623e156bf92140288bd26fdd35880b65b2ed2fcf0342efcc4f15093",
            "qualifiedPythonPipeline": "Embedded app/guest_pipeline.py methods exist but production dispatch is absent",
            "guestPipelineLiveEntry": "Unconditionally raises G3A_AUTHORITY_CONSUMED_LIVE_EXECUTION_DISABLED",
            "missingSeams": [
                "Governed outer pipeline entry/configuration and authority/lifecycle binding",
                "Reader to exclusive immutable transaction-input staging",
                "Python build_runner to production stdin/receipt/archive/result adapter",
                "Verified archive to uploader OCI layout",
                "Outer network identities/upload/four-negative dispatch and evidence aggregation",
                "Production-result discovery, complete transport, retention and cleanup",
            ],
        },
        "memoryGate": {
            "G3A_VM_MEMORY_CAPACITY": "FAIL", "meaning": "REQUIRED_PROOF_UNSATISFIED_NOT_PHYSICAL_INSUFFICIENCY",
            "selectedSKU": "Standard_B2s", "memoryGiB": 4, "skuReceipt": str(sku_receipt),
            "skuReceiptSHA256": sha(sku_receipt), "buildTmpfsCeilingBytes": 1073741824,
            "tmpTmpfsCeilingBytes": 268435456,
            "filesystemCeilingsAreNotAggregateProcessMemoryBounds": True,
            "frozenCoreMemoryReceipt": "No aggregate process/OS peak or enforced memory bound retained",
            "workingSetPlusOSContract": "UNPROVEN",
            "noSwapOrUnsafeOvercommitClaim": "NOT_PROVEN",
            "newCoreAllowanceRemaining": 0, "newCoreInvocation": False,
            "computeCapacityAutomaticallyRaised": False,
        },
        "payload": {
            "staticProofExactPrivateBytes": 296297766,
            "staticProofExactObjectBytes": 296296188,
            "finalProductionPayloadCensus": "INCOMPLETE",
            "reason": "Hash-bound shim dispatches static proof only. Do not label it a final production guest transaction bootstrap.",
        },
        "completeController": False, "completeTopLevelBicep": False,
        "completeAllInCost": False, "transactionLifetimeGate": "NOT_PROVEN",
        "transactionFailureCleanupMatrix": "NOT_PROVEN",
        "noAdditionalAzureReads": True, "noAdditionalAzureMutations": True,
        "noNewAuthority": True,
    })
    sys.path[:0] = [str(HERE), str(live), str(BASE / "g3a-hard-runner-delivery")]
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(
        unittest.defaultTestLoader.loadTestsFromNames(
            ["test_policy", "test_runner_live", "test_delivery_evidence"]))
    fresh("FINAL_LOCAL_CHECKS.json", {"status": "PASS" if result.wasSuccessful() else "FAIL",
          "testMethods": result.testsRun, "output": stream.getvalue(),
          "coreInvocations": 0, "AzureCalls": 0, "candidateRebuilds": 0})
    require(result.wasSuccessful() and result.testsRun == 20, "FINAL_LOCAL_CHECKS_FAILED")
    candidate = read(BASE / "g3a-hard-runner-candidate/PARENT_CANDIDATE_REPORT.json")
    final = {
        "mission": "NZ-20261008-INFRA-001", "G3_EXECUTION_READINESS": "BLOCKED",
        "CAPACITY_QUALIFICATION_MODEL": "ENFORCED_HARD_LIMIT",
        "BUILD_ROOT_CAPACITY_BYTES": 1073741824, "BUILD_ROOT_CAPACITY_INODES": 32768,
        "TMP_CAPACITY_BYTES": 268435456, "TMP_CAPACITY_INODES": 4096,
        "BUILD_LIMIT_EFFECTIVE": "PASS", "TMP_LIMIT_EFFECTIVE": "PASS",
        "HARD_BOUNDED_FROZEN_CORE_REHEARSAL": "PASS",
        **{name: "YES" for name in (
            "APP_BINARY_EXACT", "APP_LAYER_TAR_EXACT", "CERT_LAYER_TAR_EXACT",
            "APP_GZIP_EXACT", "CERT_GZIP_EXACT", "CONFIG_EXACT", "MANIFEST_EXACT")},
        "PRODUCTION_TMP_CONTRACT": "QUALIFIED", "PRODUCTION_CAPACITY_GATE": "PASS",
        "PRODUCTION_EXECUTION_FAIL_CLOSED": "PASS", "QUALIFIED_PRIMITIVES_UNCHANGED": "YES",
        "HARD_BOUNDED_REHEARSAL_CLEANUP": "PASS", "PRODUCTION_RUNNER_OFFLINE_QUALIFICATION": "PASS",
        "PRODUCTION_RUNNER_SOURCE_SHA256": candidate["PRODUCTION_RUNNER_SOURCE_SHA256"],
        "PRODUCTION_RUNNER_SHA256": candidate["PRODUCTION_RUNNER_SHA256"],
        "PRODUCTION_RUNNER_BYTES": candidate["PRODUCTION_RUNNER_BYTES"],
        "PRODUCTION_RUNNER_COMPONENT_CENSUS": candidate["PRODUCTION_RUNNER_COMPONENT_CENSUS"],
        "G3A_PRODUCTION_PAYLOAD_CENSUS": "INCOMPLETE", "G3A_TOTAL_PRIVATE_INPUT_BYTES": "UNRESOLVED",
        "PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED": "YES",
        "PRODUCTION_RUNNER_PROOF_EXPECTED_COST_CAD": "1.9443878",
        "PRODUCTION_RUNNER_PROOF_COST_CEILING_CAD": "3.00",
        "PRODUCTION_RUNNER_PROOF_ACTUAL_COST_ESTIMATE_CAD": "1.7677471",
        "PINNED_GUEST_BUILD_CAPACITY_BOUND": "PASS", "PINNED_GUEST_TMP_CAPACITY_BOUND": "PASS",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "QUALIFIED", "PRODUCTION_RUNNER_PROOF_RESIDUAL_STATE": "ZERO",
        "MINIMAL_DEVICE_CONTRACT": "QUALIFIED", "FINAL_REQUIRED_DEVICE_PATHS": ["/dev/null"],
        "RANDOM_DEVICE_REQUIREMENT": "NONE", "PROCFS_REQUIREMENT": "NONE",
        "STAGED_EXECUTABILITY_CENSUS": "PASS", "EXEC_BUILD_ARCHIVE_SAFETY": "PASS",
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED", "G3A_REGISTRY_UPLOADER": "QUALIFIED",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_COST_GATE_ENFORCED": "FAIL", "G3A_LIFETIME_BOUNDS_ENFORCED": "FAIL",
        "G3A_FAILURE_CLEANUP_MATRIX": "FAIL", "G3A_VM_MEMORY_CAPACITY": "FAIL",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3A_TRANSACTION_READINESS": "BLOCKED", "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO",
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO", "DEPLOYMENT_TOOLING_AVAILABLE": "YES",
        "CSE_HANDLER_SELECTOR": "2.1", "CSE_EFFECTIVE_HANDLER_VERSION": "2.1.19",
        "BOOTSTRAP_STORAGE_LOCKDOWN": "PASS",
        "mutationCounters": read(live / "MUTATION_ACCOUNTING.json"),
        "staticProofPayloadCensus": read(live / "G3A_PRIVATE_INPUT_CENSUS.json"),
        "staticProofIsNotFullTransaction": True,
        "conditionalLocalClosure": "BLOCKED_UNFINISHED_PRODUCTION_DISPATCH_AND_UNPROVEN_MEMORY_CONTRACT",
        "remainingWork": "Full local transaction integration remains unfinished; no bootstrap authority requested or issued.",
        "fullTransactionFAILMeaning": "Required proof/implementation is absent, not an observed full transaction failure.",
        "foreignChangesObserved": {"head": concurrency[1]["head"], "statusCount": len(concurrency[1]["status"]),
                                   "editedStagedRevertedOrDispositioned": False},
        "UTC": datetime.now(timezone.utc).isoformat(),
    }
    fresh("FINAL_DISPOSITION.json", final)
    directories = [HERE, live, BASE / "g3a-hard-runner-source",
                   BASE / "g3a-hard-runner-candidate", BASE / "g3a-hard-runner-delivery"]
    exclude = {"FINAL_VERIFICATION.json", "INDEPENDENT_FINAL_VERIFICATION.json"}
    current_hashes = {}
    for directory in directories:
        for path in directory.rglob("*"):
            if path.is_file() and path.name not in exclude:
                current_hashes[str(path)] = sha(path)
    fresh("FINAL_VERIFICATION.json", {
        "status": "PASS_EVIDENCE_INTEGRITY_RUNNER_QUALIFIED_TRANSACTION_BLOCKED",
        "authorityPath": str(original["authorityPath"]), "authoritySha256": original["authoritySha256"],
        "fileHashes": current_hashes, "protectedFileHashes": original["protectedFileHashes"],
        "finalDispositionSHA256": sha(HERE / "FINAL_DISPOSITION.json"),
        "proofRoot": str(live / "RUNNER_FINAL_DISPOSITION.json"),
        "proofRootSHA256": sha(live / "RUNNER_FINAL_DISPOSITION.json"),
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "QUALIFIED", "G3A_TRANSACTION_READINESS": "BLOCKED",
        "noFurtherCloudOperations": True,
    })
    print("RUNNER_QUALIFIED_TRANSACTION_BLOCKED_FINAL_ROOT=" + sha(HERE / "FINAL_VERIFICATION.json"))


if __name__ == "__main__":
    main()

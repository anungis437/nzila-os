"""Close the failed offline compatibility gate without consuming live authority."""

import json

from census import AUTHORITY, CORE, HERE, fresh, prior, require, sha


def main():
    fresh("CONCURRENCY_CLOSE.json", prior.baseline())
    binding = json.loads((HERE / "AUTHORITY_BINDING.json").read_text())
    require(sha(AUTHORITY) == binding["authoritySha256"], "AUTHORITY_CHANGED")
    for name, expected in binding["protectedFileHashes"].items():
        require(sha(name) == expected, "QUALIFIED_HISTORY_CHANGED_" + name)
    fixture = json.loads((HERE / "LOCAL_MOUNT_RESULT.json").read_text())
    rehearsal = json.loads((HERE / "FROZEN_REHEARSAL_RESULT.json").read_text())
    require(fixture["status"] == "PASS" and rehearsal["status"] == "FAIL" and
            rehearsal["stderr"].strip() == "mkdir /work/transaction: file exists" and
            not rehearsal["compilerInvoked"], "EXACT_OFFLINE_STOP_REQUIRED")
    require(not list(HERE.glob("EVENT_*.json")) and not (HERE / "AUTHORITY_CONSUMED.json").exists(),
            "UNEXPECTED_LIVE_ACTIVITY")
    require(sha(CORE / "inputs" / "portable-assembler") ==
            "3b444e003474b5717ff549c5cafaf9cb761835eea3b4844e1344aa9e61581da4",
            "FROZEN_ASSEMBLER_CHANGED")
    disposition = {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_ISOLATED_ROOT_RUNNER_BASELINE": "QUALIFIED",
        "FROZEN_CORE_EXEC_PATH_CENSUS": "COMPLETE",
        "FROZEN_CORE_TEMP_PATH_CENSUS": "INCOMPLETE",
        "tempCensusMeaning": "All paths/exec/write/lifetimes inventoried; required capacities unqualified.",
        "EXECUTABLE_SUBMOUNTS": ["/work/transaction/go", "/tmp"],
        "execSubmountScope": "TESTED_LOCAL_HYPOTHESIS_NOT_ACCEPTED_PRODUCTION_TOPOLOGY",
        "EXEC_SUBMOUNT_CONFINEMENT": "PASS",
        "QUALIFIED_PRIMITIVES_UNCHANGED": "YES",
        "primitiveEquivalenceMeaning": "Previous qualified source and binary bytes preserved; no amended runner built.",
        "PRODUCTION_RUNNER_DELTA": "DISPATCH_AND_EXEC_MOUNT_ONLY",
        "deltaMeaning": "Authorized boundary only; production dispatch/runner not implemented after offline STOP.",
        "PRODUCTION_EXECUTION_FAIL_CLOSED": "FAIL",
        "productionDispatchMeaning": "New config/authority-gated production interface NOT_IMPLEMENTED; historical entry remains disabled.",
        "LOCAL_PRODUCTION_MOUNT_FIXTURE": "PASS",
        "PRODUCTION_RUNNER_FROZEN_CORE_REHEARSAL": "FAIL",
        "PRODUCTION_TMP_CONTRACT": "BLOCKED",
        "PRODUCTION_RUNNER_SOURCE_SHA256": "NOT_CREATED",
        "PRODUCTION_RUNNER_SHA256": "NOT_CREATED",
        "PRODUCTION_RUNNER_BYTES": "NOT_CREATED",
        "PRODUCTION_RUNNER_OFFLINE_QUALIFICATION": "FAIL",
        "PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED": "NO",
        "PRODUCTION_RUNNER_PROOF_EXPECTED_COST_CAD": "UNRESOLVED",
        "PRODUCTION_RUNNER_PROOF_COST_CEILING_CAD": "3.00",
        "PRODUCTION_RUNNER_PROOF_ACTUAL_COST_ESTIMATE_CAD": "UNRESOLVED",
        "PINNED_GUEST_EXEC_SUBMOUNT": "NOT_RUN",
        "PINNED_GUEST_PRODUCTION_DISPATCH": "NOT_RUN",
        "GUEST_ROOT_ISOLATION": "NOT_RUN",
        "ISOLATED_ROOT_HOST_FS_NEGATIVE": "NOT_RUN",
        "ISOLATED_BUILD_NETWORK_NEGATIVE": "NOT_RUN",
        "GUEST_NO_NEW_PRIVS": "NOT_RUN",
        "GUEST_PRIVILEGE_DROP": "NOT_RUN",
        "GUEST_PRIVILEGE_REGAIN_NEGATIVE": "NOT_RUN",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "BLOCKED",
        "PRODUCTION_RUNNER_PROOF_RESIDUAL_STATE": "NOT_RUN",
        "RUN_COMMAND_DIAGNOSTIC_ACTIONS": 0,
        "G3A_PRODUCTION_PAYLOAD_CENSUS": "INCOMPLETE",
        "G3A_TOTAL_PRIVATE_INPUT_BYTES": "UNRESOLVED",
        "G3A_CONTROLLER": "INCOMPLETE",
        "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_COST_GATE_ENFORCED": "FAIL",
        "G3A_LIFETIME_BOUNDS_ENFORCED": "FAIL",
        "G3A_FAILURE_CLEANUP_MATRIX": "FAIL",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED",
        "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO",
        "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO",
        "CORA_INFRA": "INFRA_NO_GO",
        "AZURE_MUTATING_DISPATCHES": 0,
        "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 0,
        "AZURE_REJECTED_MUTATING_DISPATCHES": 0,
        "AZURE_DELETE_DISPATCHES": 0,
        "ROLE_ASSIGNMENT_CREATES": 0,
        "ROLE_ASSIGNMENT_DELETES": 0,
        "UAMI_CREATES": 0,
        "UAMI_DELETES": 0,
        "AZURE_READS": 0,
        "EntraActivity": "NONE_CURRENT_AUTHORITY",
        "exactIncompatibility": "EXCLUSIVE_WORK_DIRECTORY_CREATION_VS_PREMOUNTED_NESTED_EXEC_FILESYSTEM",
        "error": rehearsal["stderr"].strip(),
        "secondaryIncompatibility": "Extractor also requires work/go absent; noexec /tmp would deny generated test ELF.",
        "coreInvocations": 1,
        "compilerInvocations": 0,
        "candidateBuilds": 0,
        "conditionalLocalProductionClosure": "NOT_ACTIVATED",
        "allSevenImageExactGates": "NOT_REACHED",
        "previousQualifiedBaselineReopened": False,
        "previousProofRootSha256": binding["previousRootSha256"],
        "noConclusionAboutAllPossibleRunnerDesigns": True,
        "foreignChanges": "Observed only; foreign status count577, no edits/staging/reverts/disposition.",
    }
    fresh("FINAL_DISPOSITION.json", disposition)
    fresh("AMENDMENT_VERIFICATION.json", {
        "status": "SEALED_OFFLINE_FAIL_LIVE_AUTHORITY_UNCONSUMED",
        "authoritySha256": binding["authoritySha256"],
        "fileHashes": {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*") if path.is_file()},
        "protectedFileHashes": binding["protectedFileHashes"],
        "cloudCalls": 0, "runnerModified": False, "coreModified": False,
    })
    print("AMENDMENT_VERIFICATION_ROOT=" + sha(HERE / "AMENDMENT_VERIFICATION.json"))


if __name__ == "__main__":
    main()

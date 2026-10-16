"""Seal observed redirected-work failure; no repair or authority consumption."""

import json

from prepare import AUTHORITY, BASE, CORE, HERE, fresh, prior, read, require, sha


def main():
    prior.ca.refresh.HERE = HERE
    prior.ca.refresh.fresh("CONCURRENCY_CLOSE.json", prior.baseline())
    binding = read(HERE / "AUTHORITY_BINDING.json")
    require(sha(AUTHORITY) == binding["authoritySha256"], "AUTHORITY_CHANGED")
    for path, digest in binding["protectedFileHashes"].items():
        require(sha(path) == digest, "PROTECTED_HISTORY_CHANGED")
    fixture = read(HERE / "REDIRECTED_FIXTURE.json")
    rehearsal = read(HERE / "REHEARSAL_RESULT.json")
    raw = read(HERE / "rehearsal" / "GUEST_OFFLINE_RAW.json")
    require(fixture["status"] == "PASS" and rehearsal["exitCode"] != 0 and
            rehearsal["stderr"].strip() ==
            "STAGED_COMPILER_EXECUTION: open /dev/null: no such file or directory",
            "EXACT_FAILURE_CHANGED")
    require(raw["cleanup"]["status"] == "PASS" and
            raw["cleanup"]["executableMountsSurviving"] == 0, "EXEC_MOUNT_CLEANUP_NOT_PASS")
    diagnostic = HERE / "rehearsal" / "output" / "compiler-diagnostic.txt"
    require(diagnostic.read_text() == "STAGED_GO_INVOCATION [test -x ./...]\n",
            "COMPILER_START_OR_OTHER_DIAGNOSTIC")
    source = BASE / "g3a-full-rehearsal" / "preparation-toolchain" / "src" / "os" / "exec" / "exec.go"
    source_text = source.read_text(encoding="utf-8")
    require("func (c *Cmd) childStdin()" in source_text and "os.Open(os.DevNull)" in source_text,
            "SUBPROCESS_NULL_DEVICE_PRIOR_ART_SOURCE")
    fresh("FAILURE_CONTRACT.json", {
        "classification": "MISSING_ISOLATED_NULL_DEVICE_BEFORE_GO_START",
        "frozenCorePath": str(CORE / "inputs" / "portable-assembler"),
        "frozenCoreSha256": sha(CORE / "inputs" / "portable-assembler"),
        "coreSource": str(CORE / "assembler" / "main.go"), "coreCommandLine": 311,
        "actualStderr": rehearsal["stderr"], "stdinField": "NOT_SET_BY_FROZEN_CORE",
        "librarySemantics": "nil Cmd.Stdin opens os.DevNull via childStdin before Start",
        "corroboratingGoSource": str(source), "corroboratingGoSourceSha256": sha(source),
        "corroboratingGoLines": [542, 544],
        "coreLibraryExactCompiledSourceClaim": "Not independently resolved; source semantics corroborate observed exact binary error.",
        "compilerDiagnosticSha256": sha(diagnostic),
        "GoInvocationAttempted": True, "GoProcessStarted": False,
        "assemblerWorkChildCreatedSuccessfully": True,
        "assemblerChanged": False, "nullDeviceAdded": False, "retry": False,
        "section31Stop": True,
    })
    fields = {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "NESTED_PREMOUNT_TOPOLOGY": "RETIRED",
        "FROZEN_ASSEMBLER_WORK_PATH_CONFIGURABLE": "YES",
        "FROZEN_ASSEMBLER_OUTPUT_PATH_CONFIGURABLE": "YES",
        "FROZEN_CORE_EXEC_PATH_CENSUS": "COMPLETE",
        "FROZEN_CORE_TEMP_PATH_CENSUS": "INCOMPLETE",
        "FROZEN_EXECUTABLE_PATH_CONTRACT": "COMPLETE",
        "PROPOSED_PRODUCTION_MOUNT_TOPOLOGY": "BUILD_EXEC_PLUS_TMP_EXEC",
        "EXEC_BUILD_ROOT_CONFINEMENT": "PASS",
        "STAGED_EXECUTABILITY_CENSUS": "PASS",
        "EXEC_BUILD_ARCHIVE_SAFETY": "PASS",
        "EXEC_BUILD_PRIVILEGE_MODEL": "PASS",
        "EXEC_BUILD_NETWORK_NEGATIVE": "PASS",
        "REDIRECTED_WORK_ROOT_FIXTURE": "PASS",
        "REDIRECTED_WORK_ROOT_FROZEN_REHEARSAL": "FAIL",
        "BUILD_ROOT_PEAK_BYTES": "UNRESOLVED",
        "BUILD_ROOT_PEAK_FILES": "UNRESOLVED",
        "TMP_PEAK_BYTES": "UNRESOLVED",
        "TMP_PEAK_FILES": "UNRESOLVED",
        "BUILD_ROOT_CAPACITY_BYTES": "UNRESOLVED",
        "TMP_CAPACITY_BYTES": "UNRESOLVED",
        "PRODUCTION_TMP_CONTRACT": "BLOCKED",
        "EXEC_BUILD_CLEANUP": "PASS",
        "PRODUCTION_EXECUTION_FAIL_CLOSED": "FAIL",
        "QUALIFIED_PRIMITIVES_UNCHANGED": "YES",
        "PRODUCTION_RUNNER_OFFLINE_QUALIFICATION": "FAIL",
        "PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED": "NO",
        "PRODUCTION_RUNNER_PROOF_EXPECTED_COST_CAD": "UNRESOLVED",
        "PRODUCTION_RUNNER_PROOF_COST_CEILING_CAD": "3.00",
        "PRODUCTION_RUNNER_PROOF_ACTUAL_COST_ESTIMATE_CAD": "UNRESOLVED",
        "PINNED_GUEST_REDIRECTED_MOUNTS": "NOT_RUN",
        "PINNED_GUEST_PRODUCTION_DISPATCH": "NOT_RUN",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "BLOCKED",
        "PRODUCTION_RUNNER_PROOF_RESIDUAL_STATE": "NOT_RUN",
        "G3A_PRODUCTION_PAYLOAD_CENSUS": "INCOMPLETE",
        "G3A_TOTAL_PRIVATE_INPUT_BYTES": "UNRESOLVED",
        "G3A_CONTROLLER": "INCOMPLETE",
        "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_COST_GATE_ENFORCED": "FAIL",
        "G3A_LIFETIME_BOUNDS_ENFORCED": "FAIL",
        "G3A_FAILURE_CLEANUP_MATRIX": "FAIL",
        "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO",
        "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO",
        "CORA_INFRA": "INFRA_NO_GO",
        "G3A_ISOLATED_ROOT_RUNNER_BASELINE": "QUALIFIED",
        "AZURE_MUTATING_DISPATCHES": 0,
        "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 0,
        "AZURE_REJECTED_MUTATING_DISPATCHES": 0,
        "AZURE_DELETE_DISPATCHES": 0,
        "ROLE_ASSIGNMENT_CREATES": 0,
        "ROLE_ASSIGNMENT_DELETES": 0,
        "UAMI_CREATES": 0,
        "UAMI_DELETES": 0,
        "AZURE_READS": 0,
        "RUN_COMMAND_DIAGNOSTIC_ACTIONS": 0,
        "ENTRA_MUTATIONS": 0,
        "actualCoreFailure": rehearsal["stderr"].strip(),
        "mountStatusScope": "DISPOSABLE_LOCAL_FIXTURE_NOT_PRODUCTION_RUNNER_QUALIFICATION",
        "primitiveEquivalenceScope": "Previous qualified source/binaries unchanged; no new production source created.",
        "productionFailClosedScope": "New production dispatch not implemented because exact rehearsal failed.",
        "partialMeasurement": raw["measurement"],
        "measurementQualification": "Failed-run sampled observations, not successful-build capacity proof.",
        "APP_BINARY_EXACT": "NOT_RUN", "APP_LAYER_TAR_EXACT": "NOT_RUN",
        "CERT_LAYER_TAR_EXACT": "NOT_RUN", "APP_GZIP_EXACT": "NOT_RUN",
        "CERT_GZIP_EXACT": "NOT_RUN", "CONFIG_EXACT": "NOT_RUN", "MANIFEST_EXACT": "NOT_RUN",
        "coreRuns": 1, "GoProcessStarts": 0, "newRunnerBuilds": 0,
        "conditionalLocalClosure": "NOT_ACTIVATED",
        "foreignWork": "Observed only: main HEAD unchanged; status count587. Not modified or dispositioned.",
    }
    fresh("FINAL_DISPOSITION.json", fields)
    fresh("REDIRECTION_VERIFICATION.json", {
        "status": "SEALED_OFFLINE_REHEARSAL_FAILURE_AUTHORITY_UNCONSUMED",
        "authoritySha256": sha(AUTHORITY), "protectedFileHashes": binding["protectedFileHashes"],
        "fileHashes": {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*") if path.is_file()},
        "exactCoreRuns": 1, "liveRuns": 0, "cloudCalls": 0,
    })
    print("REDIRECTION_VERIFICATION_ROOT=" + sha(HERE / "REDIRECTION_VERIFICATION.json"))


if __name__ == "__main__":
    main()

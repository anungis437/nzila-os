"""Independent exact output, ledger, preservation, cleanup and capacity-ruling verification."""

import hashlib
import json
from pathlib import Path
import subprocess


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    here = Path(__file__).resolve().parent
    seal = read(here / "NULL_ONLY_VERIFICATION.json")
    for name, expected in seal["fileHashes"].items():
        require(sha(here / name) == expected, "LOCAL_PACKET_CHANGED_" + name)
    for path, expected in seal["protectedFileHashes"].items():
        require(sha(Path(path)) == expected, "PROTECTED_HISTORY_CHANGED")
    actual_files = {str(path.relative_to(here)) for path in here.rglob("*") if path.is_file() and
                    path.name not in seal["excludedOutputs"]}
    require(actual_files == set(seal["fileHashes"]), "UNSEALED_EXTRA_FILE")
    success = read(here / "rehearsal-resume/GUEST_OFFLINE_RAW.json")
    require(success["childExitCode"] == 0 and len(success["records"]) == 2 and
            success["records"][1]["exitCode"] == 0, "CORE_NOT_SUCCESSFUL")
    first = read(here / "rehearsal/GUEST_OFFLINE_RAW.json")
    require(first["outputCensus"] == {} and first["records"][0]["type"] == "CHILD_EXPLICIT_FAILURE",
            "FIRST_CORE_INVOCATION_NOT_ZERO")
    ledgers = list(here.rglob("LOCAL_CORE_DISPATCH.json"))
    require(len(ledgers) == 1 and read(ledgers[0])["coreInvocations"] == 1, "CORE_LEDGER_NOT_EXACTLY_ONE")
    output = here / "rehearsal-resume/output/transaction"
    acceptance = read(here / "EXACT_IMAGE_ACCEPTANCE.json")
    require(len(acceptance["gates"]) == 7 and acceptance["manifest"] ==
            "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
            "SEVEN_EXACT_GATES_NOT_BOUND")
    for gate in acceptance["gates"].values():
        require(gate["status"] == "YES" and sha(output / gate["file"]) == gate["sha256"] and
                (output / gate["file"]).stat().st_size == gate["bytes"], "EXACT_IMAGE_BYTES_MISMATCH")
    require(len(acceptance["compilerInvocations"]) == 3 and
            len(acceptance["compressorExecutions"]) == 2, "EXACT_TOOLCHAIN_PATHS_NOT_EXECUTED")
    for path, binding in success["outputCensus"].items():
        raw = here / "rehearsal-resume/output" / path
        require(sha(raw) == binding["sha256"] and raw.stat().st_size == binding["bytes"],
                "GUEST_OUTPUT_CENSUS_NOT_EXACT")
    fixture = success["records"][0]
    require(fixture["deviceCensus"] == ["null"] and fixture["ISOLATED_DEV_NULL"] == "PASS" and
            all(fixture["unauthorizedDevices"].values()) and
            fixture["hostNegatives"]["/proc/self/fd"] and fixture["mknodNegative"] == "DENIED" and
            fixture["capMknod"] == "ABSENT" and not any(fixture["capEffectivePermittedInheritable"]),
            "NULL_ONLY_OR_ISOLATION_CONTRACT_FAILED")
    require(success["cleanup"]["status"] == "PASS" and
            not success["cleanup"]["remainingTransactionMounts"] and
            all(success["cleanup"]["execFilesystemsEmpty"].values()), "TRANSACTION_MOUNT_RESIDUALS")
    cleanup = read(here / "EXACT_CONTAINER_CLEANUP.json")
    require(len(cleanup["events"]) == 2 and cleanup["residualState"] == "ZERO",
            "OWNED_CONTAINER_CENSUS_NOT_TWO_ZERO")
    for identity, events in cleanup["events"].items():
        require(any(event["action"] == "destroy" for event in events), "DESTROY_NOT_RETAINED")
        result = subprocess.run(["docker", "inspect", identity], capture_output=True, text=True, timeout=30)
        require(result.returncode == 1 and ("no such object: " + identity) in result.stderr.casefold(),
                "EXACT_CONTAINER_SURVIVES")
    final = read(here / "FINAL_DISPOSITION.json")
    require(final["MINIMAL_DEVICE_CONTRACT"] == "QUALIFIED" and final["RANDOM_DEVICE_REQUIREMENT"] == "NONE" and
            final["FINAL_REQUIRED_DEVICE_PATHS"] == ["/dev/null"], "DEVICE_RULING_NOT_PRODUCTION_PATH_BASED")
    require(final["PRODUCTION_RUNNER_OFFLINE_QUALIFICATION"] == "FAIL" and
            final["PRODUCTION_TMP_CONTRACT"] == "BLOCKED", "SAMPLED_USAGE_PROMOTED_TO_EXACT_CAPACITY")
    for name in ("BUILD_ROOT_PEAK_BYTES", "BUILD_ROOT_PEAK_FILES", "TMP_PEAK_BYTES", "TMP_PEAK_FILES",
                 "BUILD_ROOT_CAPACITY_BYTES", "BUILD_ROOT_CAPACITY_FILES", "TMP_CAPACITY_BYTES", "TMP_CAPACITY_FILES"):
        require(final[name] == "UNRESOLVED", "LOSSLESS_PEAK_OR_CAPACITY_FABRICATED")
    for key in ("AZURE_READS", "AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS",
                "AZURE_MUTATING_DISPATCHES", "AZURE_SUCCESSFUL_MUTATING_DISPATCHES",
                "AZURE_REJECTED_MUTATING_DISPATCHES", "AZURE_DELETE_DISPATCHES", "ROLE_ASSIGNMENT_CREATES",
                "ROLE_ASSIGNMENT_DELETES", "UAMI_CREATES", "UAMI_DELETES"):
        require(final[key] == 0, "CLOUD_ACTIVITY_NOT_ZERO")
    for key in ("PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED", "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED",
                "G3A_EXECUTION_AUTHORIZED", "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        require(final[key] == "NO", "UNAUTHORIZED_EXECUTION")
    baseline = read(here / "CONCURRENCY_CLOSE.json")[1]
    require(final["FOREIGN_CHANGES_OBSERVED"]["head"] == baseline["head"] and
            final["FOREIGN_CHANGES_OBSERVED"]["statusCount"] == len(baseline["status"]),
            "CONCURRENCY_METADATA_NOT_EXACT")
    evidence = {
        "verification": "PASS_FOR_EXACT_IMAGE_DEVICE_PROOF_AND_CAPACITY_STOP_NOT_RUNNER_QUALIFICATION",
        "root": sha(here / "NULL_ONLY_VERIFICATION.json"),
        "localFiles": len(seal["fileHashes"]), "protectedHistoricalReferences": len(seal["protectedFileHashes"]),
        "exactImageGates": 7, "coreInvocations": 1, "compressorExecutionsInCore": 2,
        "zeroSurvivingLocalContainers": 2, "zeroSurvivingTransactionMounts": True,
        "minimalDeviceContract": "QUALIFIED", "offlineRunner": "BLOCKED_CAPACITY",
        "azureReadsAndMutations": "ZERO", "liveAuthority": "UNCONSUMED",
    }
    with (here / "INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as stream:
        json.dump(evidence, stream, indent=2)
        stream.write("\n")
    print(json.dumps(evidence))


if __name__ == "__main__":
    main()

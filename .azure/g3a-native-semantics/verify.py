"""Independent retained-byte, source/semantic STOP, and exact local survivor verification."""

import hashlib
import json
from pathlib import Path
import subprocess
import tarfile


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    here = Path(__file__).resolve().parent
    base = here.parent
    seal = load(here / "SEMANTIC_VERIFICATION.json")
    for name, expected in seal["fileHashes"].items():
        require(sha(here / name) == expected, "LOCAL_EVIDENCE_CHANGED_" + name)
    for name, expected in seal["protectedFileHashes"].items():
        require(sha(Path(name)) == expected, "HISTORICAL_REFERENCE_CHANGED")
    report = load(here / "EXACT_RUNTIME_SEMANTIC_FIXTURE.json")
    raw = load(here / "SEMANTIC_FIXTURE_V2_RESULT.json")
    require(report == json.loads(raw["stdout"]), "FIXTURE_NOT_EXACT_RETAINED_JSON")
    entropy = report["entropy"]["report"]
    descriptor = report["descriptor"]["report"]
    require(entropy["status"] == "FAIL" and report["entropy"]["exitCode"] == 2,
            "PARTIAL_ENTROPY_TEST_PROMOTED")
    for name in ("os.getrandom", "os.urandom", "ssl.RAND_bytes", "ssl.RAND_pseudo_bytes",
                 "ssl.contextWithBoundCA"):
        require(entropy["operations"][name]["status"] == "PASS", "OBSERVED_ENTROPY_OPERATION_MISMATCH")
    require(entropy["operations"]["secrets.token_bytes"]["status"] == "FAIL" and
            not entropy["operations"]["secrets.token_bytes"]["substitutedHostModule"],
            "MISSING_MODULE_NOT_EXPLICIT")
    require(entropy["deviceCensus"] == [] and all(entropy["absentPaths"].values()),
            "ENTROPY_DEVICE_OR_PROC_EXPOSURE")
    require(descriptor["status"] == "PASS" and descriptor["deviceCensus"] == ["null"] and
            descriptor["child"]["unrelatedFd19Errno"] == 9 and descriptor["child"]["procAbsent"] and
            all(descriptor["absentPaths"].values()), "DESCRIPTOR_CONTRACT_NOT_PASS")
    prior_census = load(base / "g3a-device-census/BINARY_AND_RUNTIME_DEVICE_REFERENCES.json")
    native = prior_census["embeddedFileHashes"]
    for name, observed in report["nativeHashes"].items():
        require(native["runtime/usr/lib/x86_64-linux-gnu/" + name]["sha256"] == observed,
                "NATIVE_LIBRARY_NOT_BOUND_EMBEDDED_BINARY")
    with tarfile.open(base / "g3a-capsule-offline/payload.tar") as archive:
        require("runtime/usr/local/lib/python3.11/secrets.py" not in archive.getnames(),
                "MISSING_SECRETS_NOT_SUPPORTED")
    cleanup = load(here / "EXACT_CONTAINER_CLEANUP.json")
    require(cleanup["residualState"] == "ZERO" and len(cleanup["events"]) == 4,
            "OWNED_CONTAINER_CENSUS_OR_CLEANUP_NOT_ZERO")
    for identity, events in cleanup["events"].items():
        require(any(event["action"] == "destroy" for event in events), "DESTROY_EVENT_MISSING")
        result = subprocess.run(["docker", "inspect", identity], capture_output=True, text=True, timeout=30)
        require(result.returncode == 1 and ("no such object: " + identity) in result.stderr.casefold(),
                "PROOF_OWNED_CONTAINER_SURVIVED")
    source = load(here / "FOCUSED_GO_SOURCE_BINDING.json")
    for version in source.values():
        for binding in version.values():
            require(sha(Path(binding["path"])) == binding["sha256"], "FOCUSED_GO_SOURCE_CHANGED")
    result = load(here / "FINAL_DISPOSITION.json")
    require(result["NO_RANDOM_DEVICE_ENTROPY_FIXTURE"] == "FAIL" and
            result["NO_PROC_SUBPROCESS_FIXTURE"] == "PASS" and
            result["PROCFS_REQUIREMENT"] == "NONE", "SEMANTIC_RULING_UNSUPPORTED")
    require(result["OPENSSL_RANDOM_DEVICE_REQUIREMENT"] == "UNRESOLVED" and
            result["FINAL_REQUIRED_DEVICE_PATHS"] == [] and
            result["FINAL_REQUIRED_DEVICE_PATHS_STATUS"].startswith("NOT_ISSUED"),
            "FINAL_ALLOWLIST_ISSUED_WITHOUT_ALL_GATES")
    require(result["MINIMAL_DEVICE_CONTRACT"] == "BLOCKED" and
            result["G3A_TRANSACTION_READINESS"] == "BLOCKED" and
            result["FROZEN_CORE_INVOCATIONS"] == 0, "UNAUTHORIZED_CORE_CONTINUATION")
    for key in ("AZURE_READS", "AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS",
                "AZURE_MUTATING_DISPATCHES", "AZURE_SUCCESSFUL_MUTATING_DISPATCHES",
                "AZURE_REJECTED_MUTATING_DISPATCHES", "AZURE_DELETE_DISPATCHES",
                "ROLE_ASSIGNMENT_CREATES", "ROLE_ASSIGNMENT_DELETES", "UAMI_CREATES", "UAMI_DELETES"):
        require(result[key] == 0, "CLOUD_ACTIVITY_NOT_ZERO")
    for key in ("PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED", "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED",
                "G3A_EXECUTION_AUTHORIZED", "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        require(result[key] == "NO", "AUTHORITY_NOT_PRESERVED")
    baseline = load(here / result["CONCURRENCY_EVIDENCE_FILE"])[1]
    require(result["FOREIGN_CHANGES_OBSERVED"]["head"] == baseline["head"] and
            result["FOREIGN_CHANGES_OBSERVED"]["statusCount"] == len(baseline["status"]),
            "FOREIGN_OBSERVATION_NOT_EXACT")
    verification = {
        "verification": "PASS_FOR_RETAINED_SEMANTIC_RESULTS_AND_MANDATORY_STOP_NOT_RUNNER_QUALIFICATION",
        "root": sha(here / "SEMANTIC_VERIFICATION.json"),
        "localFiles": len(seal["fileHashes"]), "protectedHistoricalReferences": len(seal["protectedFileHashes"]),
        "nativeExactHashes": "PASS", "focusedGoSourceBindings": 8,
        "requiredEntropyFixture": "FAIL_MISSING_EMBEDDED_SECRETS",
        "noProcSubprocess": "PASS", "exactOwnedContainerAbsence": len(cleanup["events"]),
        "cloudAndRegistryActivity": "ZERO", "liveAuthority": "UNCONSUMED",
    }
    with (here / "INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as stream:
        json.dump(verification, stream, indent=2)
        stream.write("\n")
    print(json.dumps(verification))


if __name__ == "__main__":
    main()

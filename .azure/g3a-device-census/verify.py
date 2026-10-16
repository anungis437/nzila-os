"""Independently check the STOP register against retained bytes and census coverage."""

import hashlib
import json
from pathlib import Path
import tarfile


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    here = Path(__file__).resolve().parent
    base = here.parent
    seal = load(here / "DEVICE_CENSUS_VERIFICATION.json")
    for name, expected in seal["fileHashes"].items():
        require(digest(here / name) == expected, "NEW_PACKET_CHANGED_" + name)
    for name, expected in seal["protectedFileHashes"].items():
        require(digest(Path(name)) == expected, "HISTORICAL_REFERENCE_CHANGED")
    source = load(here / "GO_SOURCE_DEVICE_REFERENCES.json")
    for key in ("buildToolchain", "compressorToolchain"):
        census = source[key]
        root = Path(census["root"])
        actual_names = {str(path.relative_to(root)) for path in root.rglob("*.go") if path.is_file()}
        require(actual_names == set(census["fileHashes"]), "GO_SOURCE_CENSUS_NOT_EXHAUSTIVE")
        for name, expected in census["fileHashes"].items():
            require(digest(root / name) == expected, "SCANNED_SOURCE_CHANGED")
    binary = load(here / "BINARY_AND_RUNTIME_DEVICE_REFERENCES.json")
    with tarfile.open(base / "g3a-capsule-offline" / "payload.tar") as archive:
        actual_names = {member.name for member in archive if member.isfile()}
        require(actual_names == set(binary["embeddedFileHashes"]), "EMBEDDED_CENSUS_NOT_EXHAUSTIVE")
        for member in archive:
            if not member.isfile():
                continue
            raw = archive.extractfile(member).read()
            expected = binary["embeddedFileHashes"][member.name]
            require(hashlib.sha256(raw).hexdigest() == expected["sha256"] and
                    len(raw) == expected["bytes"], "EMBEDDED_BYTES_CHANGED")
    result = load(here / "FINAL_DISPOSITION.json")
    require(result["FROZEN_DEVICE_PATH_CENSUS"] == "INCOMPLETE", "NO_REQUIRED_ALLOWLIST_CLOSURE")
    require(result["PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED"] == "NO", "NO_LIVE_AUTHORITY_CONSUMPTION")
    require(result["LOCAL_MINIMAL_DEVICE_FIXTURE"] == "NOT_RUN" and
            result["REDIRECTED_DEVICE_AWARE_FROZEN_REHEARSAL"] == "NOT_RUN", "NO_FABRICATED_REHEARSAL")
    for key in ("AZURE_MUTATING_DISPATCHES", "AZURE_SUCCESSFUL_MUTATING_DISPATCHES",
                "AZURE_REJECTED_MUTATING_DISPATCHES", "AZURE_DELETE_DISPATCHES",
                "ROLE_ASSIGNMENT_CREATES", "ROLE_ASSIGNMENT_DELETES", "UAMI_CREATES", "UAMI_DELETES",
                "ENTRA_MUTATING_DISPATCHES", "AZURE_DIAGNOSTIC_DISPATCHES", "REGISTRY_MUTATIONS",
                "LOCAL_FROZEN_CORE_INVOCATIONS", "DEVICE_ENTRIES_CREATED", "LOCAL_MOUNT_OPERATIONS",
                "PRODUCTION_CANDIDATE_BUILDS"):
        require(result[key] == 0, "NONZERO_UNAUTHORIZED_ACTIVITY")
    for key in ("G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED", "G3A_EXECUTION_AUTHORIZED",
                "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        require(result[key] == "NO", "EXECUTION_AUTHORIZED")
    require(result["G3A_TRANSACTION_READINESS"] == "BLOCKED" and
            result["G3A_PRODUCTION_COMPATIBLE_RUNNER"] == "BLOCKED", "UNPROVEN_QUALIFICATION")
    report = {
        "verification": "PASS_FOR_CENSUS_INTEGRITY_AND_MANDATORY_STOP_NOT_RUNNER_QUALIFICATION",
        "root": digest(here / "DEVICE_CENSUS_VERIFICATION.json"),
        "newFiles": len(seal["fileHashes"]),
        "protectedReferences": len(seal["protectedFileHashes"]),
        "buildSourceFiles": len(source["buildToolchain"]["fileHashes"]),
        "compressorSourceFiles": len(source["compressorToolchain"]["fileHashes"]),
        "embeddedFiles": len(binary["embeddedFileHashes"]),
        "activityAccounting": "ZERO_NO_CORE_DEVICE_MOUNT_AZURE_REGISTRY_DISPATCH",
    }
    with (here / "INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()

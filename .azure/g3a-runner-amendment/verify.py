"""Standalone offline proof verifier; no deployment helpers, guest runner or cloud calls."""

import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(name):
    return json.loads((HERE / name).read_text())


def main():
    require(len(sys.argv) == 2, "EXACT_SEAL_ARGUMENT_REQUIRED")
    root = HERE / "AMENDMENT_VERIFICATION.json"
    require(sha(root) == sys.argv[1], "ROOT_CHANGED")
    seal = read(root.name)
    actual = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in {"AMENDMENT_VERIFICATION.json", "INDEPENDENT_VERIFICATION.json"}}
    require(actual == seal["fileHashes"], "LOCAL_CENSUS_CHANGED")
    for name, expected in seal["protectedFileHashes"].items():
        require(sha(name) == expected, "QUALIFIED_HISTORY_CHANGED")
    fixture = read("LOCAL_MOUNT_RESULT.json")
    require(fixture["status"] == "PASS" and all(fixture["hostNegatives"].values()) and
            set(fixture["networkNegatives"].values()) <= {101, 113, 111} and
            fixture["noNewPrivs"] == 1 and fixture["uidGid"] == 65532 and fixture["regain"] == "DENIED",
            "LOCAL_ISOLATION_FIXTURE_NOT_PASS")
    for path in ("/work/witness", "/work/sibling/witness", "/output/witness"):
        require(fixture["execution"][path] == {"execution": "DENIED", "errno": 13},
                "NOEXEC_DENIAL_MISSING")
    for path in ("/work/transaction/go/witness", "/tmp/witness"):
        require(fixture["execution"][path]["execution"] == "PERMITTED", "EXEC_EXCEPTION_NOT_OBSERVED")
    rehearsal = read("FROZEN_REHEARSAL_RESULT.json")
    require(rehearsal["status"] == "FAIL" and rehearsal["exitCode"] != 0 and
            rehearsal["stderr"].strip() == "mkdir /work/transaction: file exists" and
            not rehearsal["compilerInvoked"] and not rehearsal["outputFiles"], "EXACT_FAIL_NOT_VERIFIED")
    raw = read("LOCAL_REHEARSAL_RAW_2.json")
    require(raw["exitCode"] == 0 and len(raw["records"]) == 2 and
            raw["records"][0] == fixture and raw["records"][1]["stderr"] == rehearsal["stderr"],
            "RAW_REHEARSAL_BINDING")
    disposition = read("FINAL_DISPOSITION.json")
    require(disposition["PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED"] == "NO" and
            disposition["G3A_TRANSACTION_READINESS"] == "BLOCKED" and
            disposition["coreInvocations"] == 1 and disposition["candidateBuilds"] == 0 and
            not (HERE / "AUTHORITY_CONSUMED.json").exists() and not list(HERE.glob("EVENT_*.json")),
            "UNAUTHORIZED_PROGRESS")
    for key in ("AZURE_MUTATING_DISPATCHES", "AZURE_SUCCESSFUL_MUTATING_DISPATCHES",
                "AZURE_REJECTED_MUTATING_DISPATCHES", "AZURE_DELETE_DISPATCHES",
                "ROLE_ASSIGNMENT_CREATES", "ROLE_ASSIGNMENT_DELETES", "UAMI_CREATES", "UAMI_DELETES",
                "REGISTRY_MUTATIONS", "RUN_COMMAND_DIAGNOSTIC_ACTIONS", "AZURE_READS"):
        require(disposition[key] == 0, "CURRENT_AUTHORITY_MUTATION_NONZERO")
    for key in ("G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED", "G3A_EXECUTION_AUTHORIZED",
                "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED"):
        require(disposition[key] == "NO", "UNAUTHORIZED_GATE")
    output = {"status": "PASS_OFFLINE_FAILURE_AND_UNCONSUMED_AUTHORITY",
              "rootSha256": sys.argv[1], "fileReferences": len(actual),
              "protectedReferences": len(seal["protectedFileHashes"]),
              "deploymentHelpersImported": False, "cloudCalls": 0}
    with (HERE / "INDEPENDENT_VERIFICATION.json").open("x") as stream:
        json.dump(output, stream, indent=2)
        stream.write("\n")
    print("AMENDMENT_INDEPENDENT_VERIFICATION=PASS")


if __name__ == "__main__":
    main()

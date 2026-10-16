"""Independent read-only verification of the unconsumed retry packet."""

import ast
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent


def digest(path):
    with Path(path).open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def main():
    require(len(sys.argv) == 2, "EXPECTED_ROOT_REQUIRED")
    root_path = HERE / "RETRY_PREDEPLOY_VERIFICATION.json"
    require(digest(root_path) == sys.argv[1], "ROOT_MISMATCH")
    root = read(root_path)
    census = {str(path.relative_to(HERE)): digest(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in {
                  "RETRY_PREDEPLOY_VERIFICATION.json", "RETRY_PREDEPLOY_INDEPENDENT_VERIFICATION.json"}}
    require(census == root["fileHashes"], "PACKET_CENSUS_MISMATCH")
    for name, expected in root["protectedFileHashes"].items():
        require(digest(name) == expected, "PROTECTED_BYTES_CHANGED")
    require(digest(root["authorityPath"]) == root["authoritySha256"], "AUTHORITY_CHANGED")
    for name, expected in read(HERE / "EXECUTION_BINDING.json")["fileHashes"].items():
        require(digest(HERE / name) == expected, "BOUND_INPUT_CHANGED")
    require(not (HERE / "AUTHORITY_CONSUMED.json").exists() and
            not (HERE / "CSE_EXECUTION_CONSUMED.json").exists() and
            not list(HERE.glob("EVENT_*.json")), "UNEXPECTED_CONSUMPTION")
    require(read(HERE / "FINAL_PREDEPLOY_RG_ABSENCE.json")["value"] is False, "RG_ABSENCE_MISMATCH")
    require(read(HERE / ".azure" / "validate-status.json")["completedStep"] == "UpdateStatus" and
            "Status: Validated" in (HERE / ".azure" / "deployment-plan.md").read_text(), "WORKFLOW_NOT_COMPLETE")
    require(read(HERE / "RETRY_CONTRACT_TESTS.json")["status"] == "PASS" and
            read(HERE / "RETRY_CONTRACT_TESTS.json")["testCount"] == 8, "TEST_EVIDENCE_MISMATCH")
    props = read(HERE / "infra" / "cse.json")["resources"][0]["properties"]
    require(props["typeHandlerVersion"] == "2.1" and props["autoUpgradeMinorVersion"] is False and
            props["enableAutomaticUpgrade"] is False, "REPAIR_MISMATCH")
    disposition = read(HERE / "RETRY_DISPOSITION.json")
    require(disposition["BOOTSTRAP_RETRY_AUTHORITY_CONSUMED"] == "NO" and
            disposition["CSE_VERSIONID_SELECTION"] == "NOT_RUN" and
            disposition["CSE_EFFECTIVE_HANDLER_VERSION"] == "NOT_CREATED" and
            disposition["G3A_TRANSACTION_READINESS"] == "BLOCKED", "FALSE_LIVE_CLAIM")
    for name in ("AZURE_MUTATING_DISPATCHES", "AZURE_SUCCESSFUL_MUTATING_DISPATCHES",
                 "AZURE_REJECTED_MUTATING_DISPATCHES", "AZURE_DELETE_DISPATCHES",
                 "ROLE_ASSIGNMENT_CREATES", "ROLE_ASSIGNMENT_DELETES", "UAMI_CREATES", "UAMI_DELETES",
                 "REGISTRY_MUTATIONS"):
        require(disposition[name] == 0, "FALSE_MUTATION_COUNT")
    for path in HERE.glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    result = {
        "status": "PASS_UNCONSUMED_RETRY_TOOLING_BLOCK_EVIDENCE",
        "rootSha256": sys.argv[1], "verifiedHashReferences": len(census) + len(root["protectedFileHashes"]) + 2,
        "cloudCalls": 0, "imageBuildOrUploaderReplay": False, "proofExecuted": False,
    }
    with (HERE / "RETRY_PREDEPLOY_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as file:
        json.dump(result, file, indent=2)
        file.write("\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

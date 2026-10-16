"""Qualify the authorized observer repair; block inconsistent live acceptance."""

import hashlib
import io
import json
from pathlib import Path
import sys
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\d2eddaed-6a3c-4798-a4cc-c309ce3c8af5\Pasted text #1.txt")
sys.path.insert(0, str(HERE.parent / "g3a-bootstrap-retry"))
import retry
from status_parser import parse_terminal


def digest(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def main():
    fresh("CONCURRENCY_LOCAL.json", retry.baseline())
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(
        unittest.defaultTestLoader.loadTestsFromName("test_status_parser"))
    fresh("PARSER_TESTS.json", {"status": "PASS" if result.wasSuccessful() else "FAIL",
                             "testCount": result.testsRun, "output": stream.getvalue(),
                             "command": "python -B -m unittest discover -s . -p test_status_parser.py -v"})
    require(result.wasSuccessful() and result.testsRun == 6, "PARSER_TESTS_FAILED")
    source = HERE.parent / "g3a-bootstrap-resume"
    previous = source / "RESUME_VERIFICATION.json"
    require(digest(previous) == "b3d4c5d8b48f86e638bf50b62f6f7e30587ff3078739255948e5be9e394b8918",
            "PREVIOUS_ROOT_CHANGED")
    old = json.loads(previous.read_text())
    for name, expected in old["resumeFileHashes"].items():
        require(digest(source / name) == expected, "PREVIOUS_RESUME_CHANGED")
    package = Path(old["retryPackagePath"])
    for name, expected in old["retryPackageFileHashes"].items():
        require(digest(package / name) == expected, "PREVIOUS_RETRY_CHANGED")
    for name, expected in old["protectedFileHashes"].items():
        require(digest(Path(name)) == expected, "PROTECTED_FILE_CHANGED")
    view_path = package / "EVENT_039.json"
    view = json.loads(view_path.read_text())["value"]["instanceView"]
    require(parse_terminal(view["statuses"]) ==
            {"state": "failed", "code": "ProvisioningState/failed/0"}, "LIVE_STATUS_REGRESSION_FAILED")
    binary = package / "g3a-bootstrap-proof-V1"
    expected = "5f82bd226a27fd1d066a211bb527049097c049181eae92ebf9b3fae3e16683d8"
    require(digest(binary) == expected, "FROZEN_BINARY_CHANGED")
    raw = binary.read_bytes()
    require(b"G3A_BOOTSTRAP_REQUESTED_V1" in raw and b"G3A_BOOTSTRAP_CONTENT_ADDRESSED_OK" not in raw,
            "BINARY_MARKER_FINDING_CHANGED")
    g2 = ROOT / ".azure" / "evidence" / "G2_TERMINAL_FINAL_VERIFICATION.json"
    require(digest(g2) == "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499",
            "G2_ROOT_CHANGED")
    fresh("LOCAL_DISPOSITION.json", {
        "G3A_BLOB_VERSIONING_DEPENDENCY": "NONE",
        "RETIRED_FIRST_BYTE_CONTRACT": "CSE_MANAGED_IDENTITY_PRIVATE_BLOB_VERSIONID",
        "G3A_FIRST_BYTE_BOOTSTRAP_MODEL": "CSE_MANAGED_IDENTITY_CONTENT_ADDRESSED_PRIVATE_BLOB",
        "G3A_FIRST_BYTE_IMMUTABILITY_MODEL": "CONTENT_ADDRESSED_TRANSACTION_LOCK",
        "CSE_TERMINAL_STATUS_PARSER": "QUALIFIED",
        "parserScope": "LOCAL_OBSERVER_CANDIDATE_AND_REAL_CAPTURED_STATUS_REPLAY_ONLY_NOT_LIVE_CONTROLLER_INTEGRATION",
        "FIRST_BYTE_PROOF_AUTHORITY_CONSUMED": "NO",
        "G3A_BOOTSTRAP_BINARY_SHA256": expected,
        "G3A_BOOTSTRAP_OBJECT_PATH": "sha256/" + expected + "/g3a-bootstrap",
        "objectPathScope": "BOUND_DESIGN_ONLY_NOT_CREATED",
        "requiredMarker": "G3A_BOOTSTRAP_CONTENT_ADDRESSED_OK",
        "frozenBinaryMarker": "G3A_BOOTSTRAP_REQUESTED_V1",
        "livePrecondition": "BLOCKED_INCONSISTENT_FIXED_BINARY_AND_REQUIRED_MARKER",
        "BOOTSTRAP_OBJECT_WRITE_ONCE": "NOT_RUN", "BOOTSTRAP_PRODUCER_WRITE_REVOKED": "NOT_RUN",
        "BOOTSTRAP_STORAGE_LOCKDOWN": "NOT_RUN", "CSE_EFFECTIVE_HANDLER_VERSION": "NOT_CREATED",
        "G3A_CONTENT_ADDRESSED_FIRST_BYTE": "NOT_RUN", "CSE_HANDLER_DIAGNOSTIC_CAPTURE": "NOT_NEEDED",
        "FIRST_BYTE_FAILURE_CLASS": "NONE", "FIRST_BYTE_PROOF_EXPECTED_COST_CAD": "UNRESOLVED",
        "FIRST_BYTE_PROOF_COST_CEILING_CAD": "3.00", "FIRST_BYTE_PROOF_ACTUAL_COST_ESTIMATE_CAD": "0",
        "FIRST_BYTE_PROOF_RESIDUAL_STATE": "NOT_RUN",
        "G3_EXECUTION_READINESS": "BLOCKED", "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED",
        "G3A_REGISTRY_UPLOADER": "QUALIFIED", "G3A_FIRST_BYTE_BOOTSTRAP": "BLOCKED",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3A_TRANSACTION_READINESS": "BLOCKED", "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "REGISTRY_MUTATIONS": 0, "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "AZURE_MUTATING_DISPATCHES": 0, "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 0,
        "AZURE_REJECTED_MUTATING_DISPATCHES": 0, "AZURE_DELETE_DISPATCHES": 0,
        "ROLE_ASSIGNMENT_CREATES": 0, "ROLE_ASSIGNMENT_DELETES": 0,
        "UAMI_CREATES": 0, "UAMI_DELETES": 0, "RUN_COMMAND_DIAGNOSTIC_ACTIONS": 0,
    })
    hashes = {str(path.relative_to(HERE)): digest(path) for path in HERE.rglob("*") if path.is_file()}
    fresh("LOCAL_VERIFICATION.json", {
        "status": "PASS_LOCAL_PARSER_LIVE_AUTHORITY_UNCONSUMED",
        "fileHashes": hashes, "authorityPath": str(AUTHORITY), "authoritySha256": digest(AUTHORITY),
        "previousRootPath": str(previous), "previousRootSha256": digest(previous),
        "realStatusEvidencePath": str(view_path), "realStatusEvidenceSha256": digest(view_path),
        "frozenBinaryPath": str(binary), "frozenBinarySha256": expected,
        "G2RootPath": str(g2), "G2RootSha256": digest(g2),
        "protectedPacketChecks": "Previous resume/retry exact censuses and protected files verified; no full ancestor leaf replay.",
    })
    print("LOCAL_ROOT_SHA256=" + digest(HERE / "LOCAL_VERIFICATION.json"))


if __name__ == "__main__":
    main()

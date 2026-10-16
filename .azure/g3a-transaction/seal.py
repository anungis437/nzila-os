"""Evidence-integrity seal; never runs a build or remote transaction."""

import ast
import hashlib
from pathlib import Path

from prepare import AUTHORITY, CORE, HERE, ROOT, baseline, ensure, fresh, load, write

CACHE = {}


def sha(path):
    info = path.stat()
    key = (str(path), info.st_size, info.st_mtime_ns)
    if key not in CACHE:
        with path.open("rb") as file:
            CACHE[key] = hashlib.file_digest(file, "sha256").hexdigest()
        after = path.stat()
        ensure((info.st_size, info.st_mtime_ns) == (after.st_size, after.st_mtime_ns), "FILE_CHANGED_DURING_HASH")
    return CACHE[key]


def main():
    fresh("CONCURRENCY_SEAL.json", baseline())
    core_path = CORE / "REPAIR_VERIFICATION.json"
    ensure(sha(core_path) == "3d155ebc2a739ff9c91fd7011e8497878f34fd3390c6d0ecbd0554c730313f81",
           "QUALIFIED_CORE_ROOT_CHANGED")
    root = load(core_path)
    excluded = {"REPAIR_VERIFICATION.json", "REPAIR_INDEPENDENT_VERIFICATION.json"}
    census = {str(path.relative_to(CORE)): sha(path) for path in CORE.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(census == root["repairFileHashes"], "QUALIFIED_CORE_CENSUS_CHANGED")
    preserved = dict(root["preservedPacketHashes"])
    for path in CORE.rglob("*"):
        if path.is_file():
            preserved[str(path.relative_to(ROOT))] = sha(path)
    for relative, value in preserved.items():
        ensure(sha(ROOT / relative) == value, "HISTORICAL_BYTES_CHANGED")
    ensure(any(value == "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499"
               for value in preserved.values()), "G2_TERMINAL_ROOT_NOT_BOUND")
    ensure(sha(HERE / "sealed_reader.py") ==
           "c7ac915a4b5d295eb23f55a5ceea801a4f9a0bcaded04e7839a30a7a0743bc68", "SEALED_READER_COPY_DRIFT")
    local = load(HERE / "TRANSACTION_LOCAL_VALIDATION.json")
    ensure(local["tests"] == "PASS" and local["testCount"] == 25 and
           local["remoteAzureEntraRegistryCalls"] == 0 and not local["buildCoreExecutedOrModified"],
           "LOCAL_VALIDATION_GATE")
    proof = load(HERE / "UPLOAD_FIXTURE_PROOF.json")
    ensure(proof["putBodySha256"] == proof["manifestDigest"] ==
           "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7" and
           proof["putBytes"] == 840 and proof["manifestAttempts"] == 1 and
           all(value == 1 for value in proof["blobCommitAttempts"].values()), "EXACT_UPLOAD_PROOF")
    d = load(HERE / "TRANSACTION_DISPOSITION.json")
    ensure(d["G3A_PORTABLE_PRIVATE_BUILDER"] == "QUALIFIED" and d["G3A_REGISTRY_UPLOADER"] == "QUALIFIED" and
           d["G3_EXECUTION_READINESS"] == "BLOCKED" and d["G3A_CONTROLLER"] == d["G3A_BICEP_PACKAGE"] == "INCOMPLETE" and
           d["G3A_FIRST_BYTE_BOOTSTRAP_MODEL"] == d["G3A_CSE_CONTRACT"] == "BLOCKED" and
           d["G3A_EXPECTED_COST_CAD"] == d["G3A_COST_CEILING_CAD"] == "UNRESOLVED",
           "FALSE_COMPLETENESS_OR_CEILING")
    for name in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(d[name] == 0, "MUTATION_BOUNDARY")
    for path in HERE.glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    for path in HERE.rglob("*"):
        if path.is_file() and path.suffix in {".py", ".bicep", ".md"}:
            ensure(all(line.rstrip() == line for line in path.read_text().splitlines()), "SOURCE_WHITESPACE")
    ensure(not list(HERE.rglob("__pycache__")), "BYTECODE_NOT_EVIDENCE")
    hashes = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in {"TRANSACTION_VERIFICATION.json",
                                                     "TRANSACTION_INDEPENDENT_VERIFICATION.json"}}
    fresh("TRANSACTION_VERIFICATION.json", {
        "status": "PASS_EVIDENCE_INTEGRITY_FIXTURE_QUALIFICATION_INCOMPLETE_CONTROLLER",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "qualifiedCoreRootSha256": sha(core_path),
        "transactionFileHashes": hashes, "preservedPacketHashes": preserved,
        "protectedReferences": len(preserved), "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    print("TRANSACTION_ROOT_SHA256=" + sha(HERE / "TRANSACTION_VERIFICATION.json"))


if __name__ == "__main__":
    main()

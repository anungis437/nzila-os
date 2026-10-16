"""Seal source evidence, local assertions and unchanged qualified histories."""

import ast
import hashlib
import io
from pathlib import Path
import unittest

from collect import AUTHORITY, HERE, ROOT, baseline, ensure, fresh, load

CACHE = {}
PRIOR_ROOT = "0c216d4b17146236bf632640df6fef84c31deea7a9d814637e14714f6e0859a4"
CORE_ROOT = "3d155ebc2a739ff9c91fd7011e8497878f34fd3390c6d0ecbd0554c730313f81"
G2_ROOT = "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499"


def sha(path):
    info = path.stat()
    key = (str(path), info.st_size, info.st_mtime_ns)
    if key not in CACHE:
        with path.open("rb") as file:
            CACHE[key] = hashlib.file_digest(file, "sha256").hexdigest()
        after = path.stat()
        ensure((info.st_size, info.st_mtime_ns) == (after.st_size, after.st_mtime_ns),
               "FILE_CHANGED_WHILE_HASHED")
    return CACHE[key]


def census(base, exclude):
    return {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
            if path.is_file() and path.name not in exclude}


def main():
    fresh("CONCURRENCY_SEAL.json", baseline())
    stream = io.StringIO()
    suite = unittest.defaultTestLoader.loadTestsFromName("test_contracts")
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    with (HERE / "LOCAL_SOURCE_TESTS.txt").open("x", encoding="utf-8") as file:
        file.write(stream.getvalue())
    ensure(result.wasSuccessful() and result.testsRun == 11, "LOCAL_SOURCE_CONTRACT_TESTS_FAILED")
    fresh("FIRST_BYTE_LOCAL_VALIDATION.json", {
        "status": "PASS_SOURCE_CONTRACTS_FIRST_BYTE_BLOCKED", "tests": "PASS", "testCount": result.testsRun,
        "commands": [
            {"command": "python -B contracts.py", "result": "PASS_CONTRACT_GENERATION"},
            {"command": "python -B -m unittest discover -s . -p test_contracts.py -v",
             "result": "PASS_11_TESTS"},
            {"command": "python -B seal.py", "result": "SEAL_RESULT_SEPARATELY_BOUND_IN_ROOT"},
        ],
        "cloudAzureEntraRegistryCalls": 0, "guestExecutions": 0, "newImageBuilds": 0,
        "qualifiedTestsOrReproducibilityRerun": False,
        "BicepGeneratedBuiltOrDeployed": False, "conditionalPackageWork": "NOT_STARTED_STOP_BOUNDARY",
    })
    for name in ("PUBLIC_SOURCE_LEDGER.json", "PUBLIC_STORAGE_V2_LEDGER.json"):
        for entry in load(HERE / name)["sources"]:
            ensure(sha(Path(entry["path"])) == entry["sha256"], "PUBLIC_SOURCE_CHANGED")
    prior = HERE.parent / "g3a-transaction"
    path = prior / "TRANSACTION_VERIFICATION.json"
    ensure(sha(path) == PRIOR_ROOT, "PRIOR_TRANSACTION_ROOT_CHANGED")
    root = load(path)
    ensure(census(prior, {"TRANSACTION_VERIFICATION.json", "TRANSACTION_INDEPENDENT_VERIFICATION.json"}) ==
           root["transactionFileHashes"], "PRIOR_TRANSACTION_EXACT_CENSUS_CHANGED")
    protected = dict(root["preservedPacketHashes"])
    for path in prior.rglob("*"):
        if path.is_file():
            protected[str(path.relative_to(ROOT))] = sha(path)
    for name, expected in protected.items():
        ensure(sha(ROOT / name) == expected, "PROTECTED_HISTORY_CHANGED")
    ensure(G2_ROOT in protected.values(), "G2_TERMINAL_ROOT_NOT_PROTECTED")
    core = HERE.parent / "g3a-controller-repair"
    ensure(sha(core / "REPAIR_VERIFICATION.json") == CORE_ROOT, "QUALIFIED_CORE_ROOT_CHANGED")
    ensure(census(core, {"REPAIR_VERIFICATION.json", "REPAIR_INDEPENDENT_VERIFICATION.json"}) ==
           load(core / "REPAIR_VERIFICATION.json")["repairFileHashes"], "QUALIFIED_CORE_CENSUS_CHANGED")
    disposition = load(HERE / "FIRST_BYTE_DISPOSITION.json")
    ensure(disposition["G3A_FIRST_BYTE_BOOTSTRAP"] == "REQUIRES_LIVE_BOOTSTRAP_PROOF" and
           disposition["G3A_CSE_DOWNLOADED_BINARY_EXECUTION"] == "PROVEN" and
           disposition["G3A_TRANSACTION_READINESS"] == "BLOCKED", "FALSE_FIRST_BYTE_READY")
    proof = (HERE / "G3A_FIRST_BYTE_BOOTSTRAP_PROOF_AUTHORITY.md").read_text()
    ensure("PREPARED ONLY. NOT ISSUED. NOT EXECUTABLE." in proof, "PROOF_AUTHORITY_NOT_BOUND")
    ensure(not list(HERE.rglob("__pycache__")), "BYTECODE_NOT_EVIDENCE")
    for path in HERE.glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    for path in HERE.glob("*"):
        if path.is_file() and path.suffix in {".py", ".md"}:
            ensure(all(line.rstrip() == line for line in path.read_text().splitlines()), "SOURCE_WHITESPACE")
    hashes = census(HERE, {"FIRST_BYTE_VERIFICATION.json", "FIRST_BYTE_INDEPENDENT_VERIFICATION.json"})
    fresh("FIRST_BYTE_VERIFICATION.json", {
        "status": "PASS_SOURCE_EVIDENCE_INTEGRITY_FIRST_BYTE_REQUIRES_LIVE_PROOF",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "priorTransactionRootSha256": PRIOR_ROOT, "qualifiedCoreRootSha256": CORE_ROOT,
        "g2TerminalRootSha256": G2_ROOT, "firstByteFileHashes": hashes,
        "protectedPacketHashes": protected, "protectedReferenceCount": len(protected),
        "localSourceTests": result.testsRun, "G3A_FIRST_BYTE_BOOTSTRAP": "REQUIRES_LIVE_BOOTSTRAP_PROOF",
        "G3_EXECUTION_READINESS": "BLOCKED", "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0,
        "REGISTRY_MUTATIONS": 0,
    })
    print("FIRST_BYTE_ROOT_SHA256=" + sha(HERE / "FIRST_BYTE_VERIFICATION.json"), flush=True)


if __name__ == "__main__":
    main()

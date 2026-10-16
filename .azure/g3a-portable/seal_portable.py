"""Seal the explicit exact-image STOP ruling; no additional build/cloud calls."""

import ast
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PRIOR = HERE.parent / "g3-input-readiness"
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData"
    r"\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments"
    r"\fffdd7a9-2948-49f4-8b8d-14b6877d6a80\Pasted text #1.txt"
)
ROOT_SHA = "19a8357132683c39c75a2c559939e4941e3f664889926cf037f556fbe347bbc3"
GENERATED = (
    "PORTABLE_STRATEGY_MATRIX.json", "VM_BASELINE_CONTRACT.json", "PORTABLE_BUILDER_DISPOSITION.json",
    "PORTABLE_LOCAL_VALIDATION.json", "PORTABLE_BUILDER_VERIFICATION.json",
    "PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json",
)


def ensure(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8", newline="\n") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def snapshot(path):
    def run(*args):
        result = subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True, timeout=60)
        ensure(result.returncode == 0, "CONCURRENCY_READ_FAILED")
        return result.stdout.strip()
    return {"path": str(path), "head": run("rev-parse", "HEAD"), "branch": run("branch", "--show-current"),
            "status": run("--no-pager", "status", "--short").splitlines()}


def main():
    ensure(not any((HERE / name).exists() for name in GENERATED), "DO_NOT_OVERWRITE_PORTABLE_SEAL")
    isolated, foreign = snapshot(ROOT), snapshot(Path(r"C:\APPS\nzila-os"))
    ensure(isolated["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           isolated["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
           "ISOLATED_CONCURRENCY_DRIFT")
    prior_path = PRIOR / "INPUT_READINESS_VERIFICATION.json"
    ensure(sha(prior_path) == ROOT_SHA, "PRIOR_INPUT_READINESS_ROOT_CHANGED")
    prior = load(prior_path)
    excluded = {"INPUT_READINESS_VERIFICATION.json", "INPUT_READINESS_INDEPENDENT_VERIFICATION.json"}
    census = {str(path.relative_to(PRIOR)): sha(path) for path in PRIOR.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(census == prior["inputReadinessFileHashes"], "PRIOR_INPUT_FILE_CENSUS_CHANGED")
    preserved = dict(prior["preservedPacketHashes"])
    for path in PRIOR.rglob("*"):
        if path.is_file():
            preserved[str(path.relative_to(ROOT))] = sha(path)
    for relative, expected in preserved.items():
        ensure(sha(ROOT / relative) == expected, "PRESERVED_BYTES_CHANGED")
    comparison = load(HERE / "EXACT_IMAGE_COMPARISON.json")
    ensure(comparison["status"] == "FAIL_EXACT_FROZEN_MANIFEST_STOP" and
           comparison["exactApplicationBinary"] and comparison["exactConfig"] and
           not comparison["correctedComparisonStillEqualsFrozen"] and
           not comparison["frozenDigestReplacementJustified"] and
           comparison["secondCleanRoomTransaction"] == "NOT_RUN_REQUIRED_STOP", "UNSUPPORTED_GATE_CLAIM")
    ensure(not (HERE / "clean-room-run2").exists(), "EXECUTION_AFTER_EXACT_GATE_STOP")
    isolation = load(HERE / "clean-room-run1-qualified" / "ISOLATION_COMMAND.json")
    ensure(isolation["exitCode"] == 1 and not isolation["socketMounted"] and
           not isolation["compilerFromContainerImageVisible"] and
           "--network" in isolation["command"] and "none" in isolation["command"] and
           "/inputs/portable-assembler-v2" in isolation["command"], "HOST_ENGINE_ISOLATION")
    candidate = load(HERE / "PORTABLE_INPUT_INVENTORY.json")
    for entry in candidate["entries"]:
        path, manifest = Path(entry["path"]), Path(entry["manifestPath"])
        ensure(sha(path) == entry["sha256"] and path.stat().st_size == entry["bytes"] and
               "sha256:" + sha(manifest) == entry["manifestDigest"], "CANDIDATE_INPUT_HASH_SIZE")
        descriptor = load(manifest)["layers"][0]
        ensure(descriptor["size"] == entry["bytes"] and descriptor["digest"] == "sha256:" + entry["sha256"] and
               descriptor["mediaType"] == entry["payloadMediaType"], "CANDIDATE_OCI_ENVELOPE")
    ensure(sum(item["bytes"] for item in candidate["entries"]) == candidate["totalStagedCandidateInputBytes"],
           "CANDIDATE_INPUT_BYTE_TOTAL")
    check = load(HERE / "ASSEMBLER_LOCAL_CHECK_V3.json")
    ensure(check["testCount"] == 4 and check["tests"] == check["vet"] == check["build"] == "PASS" and
           not check["transactionExecuted"], "POST_STOP_CHECK_SCOPE")
    ensure(sha(HERE / "assembler" / "portable-assembler-v3") == check["binarySha256"], "CURRENT_ASSEMBLER_BINARY")
    for name, expected in check["sourceHashes"].items():
        ensure(sha(HERE / "assembler" / name) == expected, "CURRENT_ASSEMBLER_SOURCE")
    for path in HERE.rglob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    for path in HERE.rglob("*"):
        if path.is_file() and path.suffix in {".py", ".go", ".mod", ".md"}:
            ensure(all(line.rstrip() == line for line in path.read_text().splitlines()), "SOURCE_WHITESPACE")
    criteria = [
        ("exactFrozenDigestReproducibility", 0, 0, "A NOT_TESTED; B measured FAIL compressed bytes"),
        ("stagedBinaryCount", 1, 4, "Projection: engine+helpers vs one controller plus shared compiler tools"),
        ("transitiveDependencies", 1, 4, "Projection: unbound engine/helper dependencies vs Go stdlib/static compiler"),
        ("rootRequirement", 0, 4, "A unknown/rootless qualification needed; B no root-specific build operation"),
        ("daemonRequirement", 1, 5, "A staged engine may require daemon; B none"),
        ("offlineExecution", 0, 5, "A unqualified; B measured network-none build"),
        ("deterministicOutput", 0, 1, "A unknown; B tar gzip unit test passes but full double rehearsal STOP"),
        ("attackSurface", 1, 4, "Architectural estimate only; no vulnerability claim"),
        ("evidenceSimplicity", 1, 4, "Architectural estimate: fewer controller processes and dependency classes"),
        ("futureMaintenanceBurden", 2, 2, "Engine pinning vs exact serialization/compressor compatibility both need maintenance"),
    ]
    fresh("PORTABLE_STRATEGY_MATRIX.json", {
        "scoreScale": "0_TO_5_HIGHER_PREFERABLE_ZERO_UNKNOWN_OR_FAILED_NOT_EQUIVALENT_PROOF",
        "classes": ["STAGED_BUILD_ENGINE", "DETERMINISTIC_OCI_ASSEMBLER"],
        "criteria": [{"criterion": name, "stagedEngineScore": a, "assemblerScore": b, "evidence": note}
                     for name, a, b, note in criteria],
        "totals": {"stagedEngine": sum(row[1] for row in criteria), "assembler": sum(row[2] for row in criteria)},
        "selectedCandidate": "DETERMINISTIC_OCI_ASSEMBLER", "qualifiedWinningStrategy": None,
        "engineStagedOrTested": False, "assemblerExactFrozenDigest": "FAIL",
        "notProofOfFrozenDigestImpossible": True,
    })
    metadata = load(PRIOR / "VM_IMAGE_METADATA.json")["response"]
    ensure(metadata["name"] == "24.04.202609040" and metadata["properties"]["architecture"] == "x64",
           "VM_IMAGE_AUTHORITY")
    fresh("VM_BASELINE_CONTRACT.json", {
        "G3A_VM_IMAGE_URN": "Canonical:ubuntu-24_04-lts:server:24.04.202609040",
        "G3A_VM_IMAGE_VERSION": "24.04.202609040", "G3A_VM_ARCHITECTURE": "x64", "G3A_VM_OS": "Linux",
        "imageMetadataAuthority": str(PRIOR / "VM_IMAGE_METADATA.json"),
        "sameVersionPriorGuestToolsInventory": "NOT_ON_FILE",
        "buildExecutableProvenance": {
            "controller": "STAGED_INPUT", "go": "STAGED_INPUT", "goCompilerAssemblerLinkVet": "STAGED_INPUT",
            "generatedRuntimeTestELF": "GENERATED_FROM_STAGED_INPUT",
        },
        "notRequiredAsBuildExecutables": ["shell", "Python", "curl", "tar", "gzip"],
        "requiredRuntimeCA": "STAGED_INPUT",
        "futureBootstrapShellPythonAgentCertificateInventory": "UNBOUND_NOT_VM_BASELINE",
        "VM_BASELINE_utilityClaimsWithoutEvidence": [],
        "cleanRoomKernelIsolation": "LINUX_CONTAINER_NOT_PINNED_AZURE_GUEST_PROOF",
    })
    fresh("PORTABLE_BUILDER_DISPOSITION.json", {
        "mission": "NZ-20261008-INFRA-001", "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_PORTABLE_PRIVATE_BUILDER": "BLOCKED",
        "G3A_PORTABLE_BUILD_STRATEGY": "DETERMINISTIC_OCI_ASSEMBLER",
        "strategyMeaning": "LOWER_STATE_CANDIDATE_NOT_EXACT_DIGEST_QUALIFIED",
        "G3A_VM_IMAGE": "Canonical:ubuntu-24_04-lts:server:24.04.202609040",
        "G3_FINAL_RUNTIME_BASE_DEPENDENCY": "STAGED_IMMUTABLE_INPUT",
        "G3_PRIVATE_INPUT_READER": "BLOCKED", "G3A_TOOLCHAIN_SELF_CONTAINED": "FAIL",
        "buildComponentSelfContained": "PASS_STAGED_EXECUTABLES_ONLY",
        "G3A_OFFLINE_BUILD_REHEARSAL": "FAIL", "G3A_PORTABLE_BUILD_DETERMINISM": "FAIL",
        "determinismMeaning": "DOUBLE_TRANSACTION_NOT_RUN_MANDATORY_EXACT_GATE_STOP",
        "G3A_PORTABLE_IMAGE_REPRODUCTION": "FAIL", "G3A_REGISTRY_UPLOADER": "BLOCKED",
        "G3A_CONTROLLER": "INCOMPLETE", "G3A_BICEP_PACKAGE": "INCOMPLETE",
        "G3_EXECUTOR_OWNER_CONTRACT": "BOUND", "G3_GRANT_EXECUTOR_MODEL": "BLOCKED",
        "grantDispositionMeaning": "PROPOSED_MODEL_NOT_AUTHENTICATED_CAPABLE_OPERATOR_OR_DELEGATION",
        "G3A_EXPECTED_COST_CAD": "UNRESOLVED", "G3A_COST_CEILING_CAD": "UNRESOLVED",
        "G3_EXPECTED_PROOF_COST_CAD": "UNRESOLVED", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
        "APPLICATION_ROLLOUT_AUTHORIZED": "NO", "PRODUCTION_DATA_AUTHORIZED": "NO",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0, "newAzureReadCalls": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES", "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "G3B_SECRET_BOOTSTRAP": "DEFERRED_TO_G3B_CONTROLLER",
        "FROZEN_G3_IMAGE_MANIFEST_DIGEST": comparison["frozenManifest"],
        "HOST_DOCKER_DEPENDENCY": "PRESENT_IN_PRIOR_REHEARSAL",
        "HOST_BUILDX_DEPENDENCY": "PRESENT_IN_PRIOR_REHEARSAL",
        "HOST_BUILDKIT_DEPENDENCY": "PRESENT_IN_PRIOR_REHEARSAL",
        "HOST_BUILD_ENGINE_DEPENDENCY": "ABSENT_IN_CLEAN_ROOM_CANDIDATE_BUILD",
        "CLEAN_ROOM_HOST_ENGINE_ISOLATION": "PASS", "STAGED_GO_COMPILER_USED": "YES",
        "G3_APP_BINARY_SHA256": comparison["binarySha256"], "G3_APP_BINARY_SIZE": comparison["binaryBytes"],
        "G3_APP_BINARY_FORMAT": "STATIC_ELF", "G3_APP_BINARY_ARCHITECTURE": "linux/amd64",
        "TOTAL_STAGED_INPUT_BYTES": candidate["totalStagedCandidateInputBytes"],
        "totalStagedBytesScope": "CANDIDATE_BUILD_INPUTS_NOT_FULL_PRIVATE_TRANSACTION",
        "G3A_BOOTSTRAP_INLINE_BYTES": None, "G3A_BOOTSTRAP_LIMIT_MARGIN": "FAIL_NOT_PREPARED_AFTER_STOP",
        "G3A_EXTENSION_CONTRACT": "NOT_PREPARED_AFTER_EXACT_GATE_STOP",
        "survivingDependency": "PORTABLE_COMPRESSOR_REPRODUCING_FROZEN_DEFLATE_BITSTREAMS",
        "compressionContractMissing": ["installed engine compressor implementation/runtime version",
                                       "byte-identical compression streaming/export contract"],
        "frozenDigestChanged": False, "replacementDigestAuthorized": False,
        "secondTransactionRun": False, "postStopTransactionRuns": 0, "cloudGuestExecution": False,
    })
    fresh("PORTABLE_LOCAL_VALIDATION.json", {
        "result": "PASS_COMPONENT_CHECKS_AND_EXACT_FAILURE_CLASSIFICATION_NOT_G3A_QUALIFICATION",
        "currentAssemblerChecks": check,
        "cleanRoomTransaction": "FAIL_EXACT_MANIFEST_STOP", "binaryTarConfig": "EXACT",
        "gzipLayers": "FAIL_DIFFERENT_DEFLATE_BYTES", "initialNoexecFailureRetained": True,
        "postStopFullTransactionRuns": 0, "postStopTargetedRegressionTests": 4,
        "pythonAST": "PASS", "sourceWhitespace": "PASS",
        "newBicepBuildLint": "NOT_RUN_NO_COMPLETE_PACKAGE",
        "repoWidePRChecks": "NOT_RUN_NO_PR_PRODUCT_OR_SHARED_INFRA_CHANGE",
        "azureReads": 0, "azureMutations": 0, "entraMutations": 0, "registryMutations": 0,
        "lastProtectedEstate": "PRIOR_PACKET_READ_16_IDS_NOT_REFRESHED_THIS_PACKET",
        "failureLogs": ["clean-room-run1/container-output.txt",
                        "clean-room-run1-debug/transaction/compiler-diagnostic.txt",
                        "clean-room-run1-qualified/container-output.txt", "ASSEMBLER_LOCAL_CHECK_V3.txt"],
    })
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "PORTABLE_BUILDER_REPORT.md").read_text()):
        path = (HERE / target).resolve()
        ensure(path.exists() or path.name in ("PORTABLE_BUILDER_VERIFICATION.json",
                                             "PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json"),
               "BROKEN_REPORT_LINK")
    after = snapshot(ROOT)
    ensure(after == isolated, "CONCURRENCY_DRIFT_DURING_SEAL")
    fresh("PORTABLE_BUILDER_VERIFICATION.json", {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS_EVIDENCE_INTEGRITY_NOT_PORTABLE_BUILDER",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "priorInputRootSha256": ROOT_SHA,
        "concurrency": {"isolated": after, "foreignBefore": foreign,
                        "foreignAfter": snapshot(Path(r"C:\APPS\nzila-os")), "foreignDispositioned": False},
        "preservedPacketHashes": preserved,
        "portableFileHashes": {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*") if path.is_file()},
        "G3_EXECUTION_READINESS": "BLOCKED", "G3A_PORTABLE_PRIVATE_BUILDER": "BLOCKED",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    print(json.dumps({"rootSha256": sha(HERE / "PORTABLE_BUILDER_VERIFICATION.json"),
                      "preservedReferences": len(preserved), "portableGate": "BLOCKED"}, indent=2))


if __name__ == "__main__":
    main()

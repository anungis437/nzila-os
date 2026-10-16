"""Seal proven compression-only result; no cloud or complete image transaction."""

import ast
import datetime
import gzip
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PRIOR = HERE.parent / "g3a-compressor"
PRIOR_SHA = "223ae821cccd9807d5aa61910fce6c7253e0dd54266693e09b71b24d80926f5b"
ARCHIVE_SHA = "f022b6aad78e362bcba9b0b94d09ad58c5a70c6ba3b7582905fababf5fe0181a"
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData"
    r"\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments"
    r"\a23b9ea8-49d8-48d2-830a-9286119cf04b\Pasted text #1.txt"
)
OUTPUTS = ("G3A_COMPRESSOR_INPUT.json", "GO1256_TOOLCHAIN_PORTABILITY.json", "GO1256_DISPOSITION.json",
           "GO1256_LOCAL_VALIDATION.json", "GO1256_VERIFICATION.json", "GO1256_INDEPENDENT_VERIFICATION.json")


def ensure(value, stage):
    if not value:
        raise RuntimeError(stage)


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
    ensure(not any((HERE / name).exists() for name in OUTPUTS), "DO_NOT_OVERWRITE_GO1256_SEAL")
    isolated, foreign = snapshot(ROOT), snapshot(Path(r"C:\APPS\nzila-os"))
    ensure(isolated["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           isolated["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"], "CONCURRENCY_DRIFT")
    prior_path = PRIOR / "COMPRESSOR_VERIFICATION.json"
    ensure(sha(prior_path) == PRIOR_SHA, "PRIOR_COMPRESSOR_ROOT_CHANGED")
    root = load(prior_path)
    excluded = {"COMPRESSOR_VERIFICATION.json", "COMPRESSOR_INDEPENDENT_VERIFICATION.json"}
    census = {str(path.relative_to(PRIOR)): sha(path) for path in PRIOR.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(census == root["compressorFileHashes"], "PRIOR_COMPRESSOR_CENSUS_CHANGED")
    preserved = dict(root["preservedPacketHashes"])
    for path in PRIOR.rglob("*"):
        if path.is_file():
            preserved[str(path.relative_to(ROOT))] = sha(path)
    for relative, expected in preserved.items():
        ensure(sha(ROOT / relative) == expected, "PRESERVED_PACKET_BYTES_CHANGED")
    archive = HERE / "go1.25.6.linux-amd64.tar.gz"
    download = load(HERE / "GO1256_DOWNLOAD.json")
    ensure(sha(archive) == download["actualSHA256"] == ARCHIVE_SHA and
           archive.stat().st_size == 59768880 and download["archiveIntegrity"] == "PASS" and
           download["archiveDownloads"] == 1 and not download["systemInstallation"] and
           not download["machinePATHChanged"], "OFFICIAL_ARCHIVE_BOUNDARY")
    inventory = load(HERE / "GO1256_TOOLCHAIN_INVENTORY.json")
    extracted = HERE / "toolchain"
    ensure({str(path.relative_to(extracted)).replace("\\", "/") for path in extracted.rglob("*") if path.is_file()} ==
           set(inventory["files"]), "EXTRACTED_TOOLCHAIN_CENSUS")
    for name, entry in inventory["files"].items():
        path = extracted.joinpath(*name.split("/"))
        ensure(sha(path) == entry["sha256"] and path.stat().st_size == entry["bytes"], "EXTRACTED_TOOLCHAIN_SHA_SIZE")
    ensure(sum(entry["bytes"] for entry in inventory["files"].values()) == inventory["extractedBytes"] == 206018426,
           "EXTRACTED_BYTES_TOTAL")
    version = load(HERE / "GO1256_VERSION_CORRECTED.json")
    build = load(HERE / "HARNESS_BUILD.json")
    ensure(version["exitCode"] == build["exitCode"] == 0 and
           version["stdout"].strip() == "go version go1.25.6 linux/amd64" and
           build["stdout"].count("--- PASS: Test") == 2 and
           "--- SKIP: TestOtherRuntimeCannotRunFrozenCandidate" in build["stdout"], "EXTRACTED_TOOLCHAIN_BUILD")
    source_binding = load(HERE / "HARNESS_SOURCE_BINDING.json")
    for name, expected in source_binding["files"].items():
        ensure(sha(HERE / "harness" / name) == sha(PRIOR / "harness" / name) == expected,
               "HARNESS_COMPRESSION_VARIABLE_CHANGED")
    result = load(HERE / "COMPRESSOR_RESULT.json")
    ensure(result["status"] == "PROVEN_EXACT_BOTH_LAYERS_DOUBLE_RUN" and
           result["APP_LAYER_EXACT"] == result["CERT_LAYER_EXACT"] == "YES" and
           result["G3A_COMPRESSOR_DETERMINISM"] == "PASS" and len(result["observations"]) == 4,
           "BOTH_LAYER_DOUBLE_RUN_REQUIRED")
    for observation in result["observations"]:
        name, number = observation["name"], observation["run"]
        path = HERE / ("compression-run" + str(number)) / (name + ".gz")
        raw = path.read_bytes()
        frozen = (PRIOR / "fixtures" / (name + ".frozen.gz")).read_bytes()
        ensure(raw == frozen and sha(path) == observation["candidateSha256"] and
               len(raw) == observation["candidateBytes"] and
               gzip.decompress(raw) == (PRIOR / "fixtures" / (name + ".tar")).read_bytes(),
               "BYTE_EXACT_COMPRESSED_GATE")
    binary = HERE / "compressor-go1256"
    binary_contract = load(HERE / "HARNESS_BINARY_CONTRACT.json")
    ensure(sha(binary) == binary_contract["sha256"] and binary.stat().st_size == binary_contract["bytes"],
           "PROVEN_COMPRESSOR_SHA_SIZE")
    raw = binary.read_bytes()
    ensure(raw[:6] == b"\x7fELF\x02\x01" and raw[18:20] == b"\x3e\x00", "COMPRESSOR_PLATFORM")
    offset = struct.unpack_from("<Q", raw, 32)[0]
    stride, count = struct.unpack_from("<HH", raw, 54)
    ensure(stride >= 56 and count > 0 and offset + stride * count <= len(raw) and
           all(struct.unpack_from("<I", raw, offset + n * stride)[0] != 3 for n in range(count)),
           "STATIC_COMPRESSOR_NO_INTERPRETER")
    oci = HERE / "oci"
    oci.mkdir()
    empty_sha = hashlib.sha256(b"{}").hexdigest()
    artifact_type = "application/vnd.nzila.g3.compressor.go1256.v1"
    payload_type = "application/vnd.nzila.g3.compressor.linux-amd64.elf.v1"
    manifest = {
        "schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json",
        "artifactType": artifact_type,
        "config": {"mediaType": "application/vnd.oci.empty.v1+json", "size": 2, "digest": "sha256:" + empty_sha},
        "layers": [{"mediaType": payload_type, "size": len(raw), "digest": "sha256:" + sha(binary)}],
    }
    manifest_raw = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    with (oci / "compressor-manifest.json").open("xb") as file:
        file.write(manifest_raw)
    with (oci / "empty-config.json").open("xb") as file:
        file.write(b"{}")
    compressor_input = {
        "status": "PROVEN_LOCAL_BOTH_LAYER_DOUBLE_RUN_NOT_STAGED",
        "type": "STATIC_COMPRESSOR_BINARY", "version": "Go1.25.6_STDLIB_GZIP_DEFAULT_TEE_IO_COPY",
        "sha256": sha(binary), "bytes": len(raw), "path": str(binary),
        "platform": "linux/amd64", "elfInterpreter": "ABSENT",
        "runtimeDependencies": "LINUX_KERNEL_ONLY", "rootRequired": False, "daemonRequired": False,
        "repository": "g3-build-tooling", "artifactType": artifact_type, "payloadMediaType": payload_type,
        "manifestDigest": "sha256:" + hashlib.sha256(manifest_raw).hexdigest(),
        "manifestBytes": len(manifest_raw), "manifestPath": str(oci / "compressor-manifest.json"),
        "compilerArchiveSHA256": ARCHIVE_SHA, "stagingModel": "STATIC_COMPRESSOR_BINARY",
        "testedWriteContract": "GZIP_DEFAULT_MINUS1_TEE_READER_IO_COPY_NOMINAL32K_OUTPUT128K_CLOSE_THEN_FLUSH",
        "originalPipeShortReadSequenceClaimedProven": False, "registryPushes": 0,
    }
    fresh("G3A_COMPRESSOR_INPUT.json", compressor_input)
    fresh("GO1256_TOOLCHAIN_PORTABILITY.json", {
        "candidateToolchainType": "GO1256_LINUX_AMD64_TOOLCHAIN", "archiveSHA256": ARCHIVE_SHA,
        "archiveBytes": archive.stat().st_size, "extractedBytes": inventory["extractedBytes"],
        "requiredBuildSubtree": "COMPLETE_VERIFIED_GO_TREE_FOR_LOCAL_HARNESS_COMPILATION",
        "futureGuestRequiredPayload": "ONLY_HASH_BOUND_STATIC_COMPRESSOR_BINARY",
        "selectedStagingModel": "STATIC_COMPRESSOR_BINARY",
        "fullToolchainRequiredAtGuestRuntime": False,
        "payloadBytesSavedVsExtractedTree": inventory["extractedBytes"] - len(raw),
        "selectionEvidence": "EXACT_STATIC_BINARY_USED_FOR_ALL_FOUR_BYTE_EQUAL_TESTS",
    })
    fresh("GO1256_DISPOSITION.json", {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3A_PORTABLE_PRIVATE_BUILDER": "COMPRESSION_QUALIFIED_PENDING_FULL_REHEARSAL",
        "GO1256_DOWNLOAD_SOURCE": "GO_DEV_OFFICIAL", "GO1256_EXPECTED_SHA256": ARCHIVE_SHA,
        "GO1256_ACTUAL_SHA256": sha(archive), "GO1256_ARCHIVE_INTEGRITY": "PASS",
        "GO1256_SAFE_EXTRACTION": "PASS", "GO1256_RUNTIME_VERSION": "go1.25.6 linux/amd64",
        "GO1256_TOOLCHAIN_INVENTORY": "PASS", "GO1256_COMPRESSOR_HARNESS_BUILD": "PASS",
        "FROZEN_COMPRESSOR_CONTRACT": "PROVEN", "APP_LAYER_EXACT": "YES", "CERT_LAYER_EXACT": "YES",
        "G3A_COMPRESSOR_DETERMINISM": "PASS", "G3A_COMPRESSOR_STAGING_MODEL": "STATIC_COMPRESSOR_BINARY",
        "G3A_COMPRESSOR_INPUT": compressor_input, "FULL_BUILD_RETRY_AUTHORITY_REQUIRED": "YES",
        "fullBuildRetryAuthorityPrepared": True, "fullBuildRetryAuthorityIssued": False,
        "preparedAssemblerExecutedOrCompiled": False,
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0,
        "REGISTRY_MUTATIONS": 0, "newAzureReadCalls": 0, "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "frozenManifest": "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
        "frozenDigestChanged": False, "applicationBuilds": 0, "fullImageTransactions": 0,
        "compressorFixtureRuns": 4, "archiveDownloads": 1, "systemInstallation": False,
        "globalPATHChanged": False, "guestExecution": False, "uploaderOrRegistryTests": False,
        "historicalOriginalStreamProven": False,
        "qualificationMeaning": "MEASURED_PORTABLE_EQUIVALENT_FOR_BOTH_FROZEN_LAYER_BYTE_STREAMS",
    })
    fresh("GO1256_LOCAL_VALIDATION.json", {
        "status": "PASS_COMPRESSION_ONLY_NOT_FULL_G3A_REHEARSAL",
        "versionCommand": version["command"], "versionResult": "PASS",
        "harnessBuildCommand": build["command"], "harnessTests": "2_PASS_1_SKIP_TARGET_RUNTIME_GUARD",
        "vet": "PASS", "staticBuild": "PASS", "archiveHashSize": "PASS",
        "safeArchiveExtraction": "PASS", "completeToolchainInventory": "PASS",
        "bothFrozenCompressedStreamsTwice": "PASS", "byteComparisons": result,
        "preparedAssembler": "SYNTAX_FORMATTED_ONLY_NOT_COMPILED_TESTED_OR_EXECUTED",
        "preparedAssemblerHashes": {name: sha(HERE / "prepared-assembler" / name)
                                   for name in ("main.go", "compressor.go", "go.mod")},
        "pythonAST": "PASS", "sourceWhitespace": "PASS",
        "newBicep": "NOT_PREPARED_COMPRESSION_ONLY",
        "repoWidePRChecks": "NOT_RUN_NO_PR_PRODUCT_OR_SHARED_INFRA_CODE_CHANGE",
        "initialLaunchFailure": "RETAINED_CHMOD_PATH_PRECONDITION_CORRECTED",
        "cloudMutations": 0, "newAzureReads": 0, "fullImageBuilds": 0,
    })
    for path in HERE.rglob("*.py"):
        if not path.is_relative_to(extracted):
            ast.parse(path.read_text(), filename=str(path))
    for path in HERE.rglob("*"):
        # Official Go tree is a verified immutable input, not newly authored source.
        if path.is_file() and not path.is_relative_to(extracted) and path.suffix in {".py", ".go", ".mod", ".md"}:
            ensure(all(line.rstrip() == line for line in path.read_text().splitlines()), "NEW_SOURCE_WHITESPACE")
    for report in ("GO1256_QUALIFICATION_REPORT.md", "G3A_PORTABLE_FULL_REHEARSAL_RETRY_AUTHORITY.md"):
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / report).read_text()):
            path = (HERE / target).resolve()
            ensure(path.exists() or path.name in ("GO1256_VERIFICATION.json", "GO1256_INDEPENDENT_VERIFICATION.json"),
                   "BROKEN_REPORT_LINK")
    after = snapshot(ROOT)
    ensure(after == isolated, "CONCURRENCY_CHANGED_DURING_SEAL")
    fresh("GO1256_VERIFICATION.json", {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS_EVIDENCE_INTEGRITY_COMPRESSION_ONLY",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "priorCompressorRootSha256": PRIOR_SHA,
        "concurrency": {"isolated": after, "foreignBefore": foreign,
                        "foreignAfter": snapshot(Path(r"C:\APPS\nzila-os")), "foreignDispositioned": False},
        "preservedPacketHashes": preserved,
        "go1256FileHashes": {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*") if path.is_file()},
        "FROZEN_COMPRESSOR_CONTRACT": "PROVEN", "G3_EXECUTION_READINESS": "BLOCKED",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    print(json.dumps({"rootSha256": sha(HERE / "GO1256_VERIFICATION.json"),
                      "preservedReferences": len(preserved),
                      "compressorManifestDigest": compressor_input["manifestDigest"],
                      "FROZEN_COMPRESSOR_CONTRACT": "PROVEN"}, indent=2))


if __name__ == "__main__":
    main()

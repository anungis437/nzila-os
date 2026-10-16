"""Exclusive compression-only blocked ruling and preservation; no candidate execution."""

import ast
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PRIOR = HERE.parent / "g3a-portable"
PRIOR_SHA = "cbc837bb82358ffbde42992fdccdde32e11520ab9564b813483f17f3465db2c1"
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData"
    r"\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments"
    r"\ed1c48ec-953e-4ead-8718-0018275d87ff\Pasted text #1.txt"
)
OUTPUTS = ("ENGINE_PROVENANCE.json", "COMPRESSION_CALL_CONTRACT.json", "CANDIDATE_MATRIX.json",
           "COMPRESSOR_DISPOSITION.json", "COMPRESSOR_LOCAL_VALIDATION.json",
           "COMPRESSOR_VERIFICATION.json", "COMPRESSOR_INDEPENDENT_VERIFICATION.json")


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
    ensure(not any((HERE / name).exists() for name in OUTPUTS), "DO_NOT_OVERWRITE_COMPRESSOR_SEAL")
    isolated, foreign = snapshot(ROOT), snapshot(Path(r"C:\APPS\nzila-os"))
    ensure(isolated["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           isolated["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
           "ISOLATED_CONCURRENCY_DRIFT")
    prior_path = PRIOR / "PORTABLE_BUILDER_VERIFICATION.json"
    ensure(sha(prior_path) == PRIOR_SHA, "PRIOR_PORTABLE_ROOT_CHANGED")
    prior = load(prior_path)
    excluded = {"PORTABLE_BUILDER_VERIFICATION.json", "PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json"}
    census = {str(path.relative_to(PRIOR)): sha(path) for path in PRIOR.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(census == prior["portableFileHashes"], "PRIOR_PORTABLE_CENSUS_CHANGED")
    preserved = dict(prior["preservedPacketHashes"])
    for path in PRIOR.rglob("*"):
        if path.is_file():
            preserved[str(path.relative_to(ROOT))] = sha(path)
    for relative, expected in preserved.items():
        ensure(sha(ROOT / relative) == expected, "PRESERVED_PACKET_CHANGED")
    exact = load(HERE / "EXACT_DAEMON_BINARY.json")
    ensure(sha(HERE / "dockerd-original") == exact["sha256"] and
           (HERE / "dockerd-original").stat().st_size == exact["bytes"], "EXACT_DAEMON_BYTES")
    info = load(HERE / "DAEMON_GO_BUILD_INFO.json")
    ensure(info["exitCode"] == 0 and info["stdout"].splitlines()[0].endswith(": go1.25.6") and
           "\tdep\tgithub.com/moby/buildkit\tv0.27.0\t" in info["stdout"], "ENGINE_GO_MODULE_BINDING")
    docker = json.loads(load(HERE / "DOCKER_VERSION.json")["stdout"])
    ensure(docker["Server"]["Version"] == "29.2.0" and docker["Server"]["GoVersion"] == "go1.25.6",
           "DAEMON_API_BUILD_INFO_MISMATCH")
    ensure("Driver:        docker" in load(HERE / "BUILDX_INSPECT.json")["stdout"], "INTEGRATED_DRIVER_BINDING")
    fixtures = load(HERE / "FROZEN_FIXTURES.json")
    for entry in fixtures["entries"]:
        tar, gz = HERE / "fixtures" / (entry["name"] + ".tar"), HERE / "fixtures" / (entry["name"] + ".frozen.gz")
        ensure(sha(tar) == entry["tarSha256"] and tar.stat().st_size == entry["tarBytes"] and
               sha(gz) == entry["gzipSha256"] and gz.stat().st_size == entry["gzipBytes"], "FIXTURE_BINDING")
    sources = load(HERE / "PUBLIC_SOURCE_PROVENANCE.json")
    for source in sources:
        ensure(sha(HERE / source["name"]) == source["sha256"], "PUBLIC_SOURCE_HASH")
    proposed = load(HERE / "PROPOSED_GO_1_25_6_INPUT.json")
    ensure(proposed["version"] == "go1.25.6" and not proposed["toolchainDownloaded"] and
           not proposed["toolchainInstalled"] and len(proposed["file"]["sha256"]) == 64,
           "PROPOSED_TOOLCHAIN_NOT_ACQUIRED")
    checks = load(HERE / "HARNESS_DEVELOPMENT_CHECK.json")
    ensure(checks["tests"] == 3 and checks["result"] == "PASS_TEST_VET_BUILD" and
           not checks["frozenAppCompressionRun"] and not checks["frozenCertCompressionRun"] and
           not checks["applicationBuild"], "DEVELOPMENT_CHECK_NOT_CANDIDATE")
    ensure(sha(HERE / "harness" / "harness-development-only") == checks["binarySha256"], "HARNESS_BINARY")
    for name, expected in checks["sourceHashes"].items():
        ensure(sha(HERE / "harness" / name) == expected, "HARNESS_SOURCE")
    for path in HERE.rglob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    for path in HERE.rglob("*"):
        if path.is_file() and path.suffix in {".py", ".go", ".mod", ".md"}:
            ensure(all(line.rstrip() == line for line in path.read_text().splitlines()), "NEW_SOURCE_WHITESPACE")
    fresh("ENGINE_PROVENANCE.json", {
        "currentComponentProvenance": "EXACT_BINARY", "historicalFrozenBuildAssociation": "VERSION_ONLY",
        "historicalAssociationLimitation": "NO_CONTEMPORANEOUS_DAEMON_HASH_AT_FROZEN_BUILD",
        "engineVersion": "29.2.0", "dockerDesktopVersion": "4.60.1 (218372)",
        "engineCommit": "9c62384", "buildkitVersion": "v0.27.0", "buildkitCommit": "UNPROVEN",
        "buildkitGoVersion": "go1.25.6", "binary": exact,
        "componentKind": "INTEGRATED_DOCKERD_NOT_STANDALONE_BUILDKITD",
        "moduleBuildInfo": "DAEMON_GO_BUILD_INFO.json",
        "noStringScanUsedAsPrimaryProof": True, "engineUpdatedOrReinstalled": False,
    })
    fresh("COMPRESSION_CALL_CONTRACT.json", {
        "status": "PARTIAL",
        "constructor": "gzip.NewWriterLevel(destination, level)",
        "sourceDefaultLevel": "gzip.DefaultCompression (-1)",
        "frozenOptionalLevelObserved": False,
        "sourceCall": "timestamp converter -> tar pipe -> io.Copy(gzip, io.TeeReader(reader, diffID))",
        "ioGenericConsumerBufferBytes": 32768, "eachWriteExactly32KiBProven": False,
        "actualPipeShortReadSequence": "UNOBSERVED",
        "outputBufferBytes": 131072, "pooledObject": "OUTPUT_BUFIO_WRITER_NOT_GZIP_COMPRESSOR",
        "writer": "FRESH_GZIP_WRITER", "header": "DEFAULT_ZERO_MTIME_OS255_NO_NAME_COMMENT_EXTRA",
        "close": "ONCE_GZIP_CLOSE_THEN_OUTPUT_BUFFER_FLUSH", "explicitGzipFlush": False,
        "parallelCompressionInShownPerLayerCallPath": False,
        "installedPatchSetAndOptionalLevel": "NOT_PROVEN_FROM_VERSION_TAG_SOURCE_ALONE",
        "minimalHarnessStream": "NOMINAL_TEE_READER_IO_COPY_ONLY_NOT_PROVEN_PIPE_SEQUENCE",
    })
    fresh("CANDIDATE_MATRIX.json", {
        "candidates": [
            {"id": "A", "model": "STDLIB_GZIP_EXACT_GO_1_25_6", "app": "NOT_RUN", "cert": "NOT_RUN",
             "blocker": "EXACT_COMPILER_NOT_AVAILABLE_IN_KNOWN_LOCAL_GOVERNED_INPUTS"},
            {"id": "B", "model": "EXTRACTED_MINIMAL_ORIGINAL_COMPRESSION_PATH", "app": "NOT_RUN", "cert": "NOT_RUN",
             "blocker": "WRAPPER_USES_EMBEDDED_STDLIB_FLATE_EXTRACTION_DOES_NOT_PROVIDE_GO1_25_6_RUNTIME"},
            {"id": "C", "model": "ORIGINAL_ENGINE_COMPONENT", "app": "NOT_RUN", "cert": "NOT_RUN",
             "blocker": "INTEGRATED_DOCKERD_NO_PROVEN_STANDALONE_DAEMON_FREE_COMPRESSOR_ENTRYPOINT"},
        ],
        "arbitraryCompressorsLevelsOrChunkSizesTested": False,
        "exactToolchainAcquisitions": 0, "frozenFixtureCandidateCompressionRuns": 0,
    })
    fresh("COMPRESSOR_DISPOSITION.json", {
        "G3_EXECUTION_READINESS": "BLOCKED", "G3A_PORTABLE_PRIVATE_BUILDER": "BLOCKED",
        "FROZEN_COMPRESSOR_CONTRACT": "UNRESOLVED", "FROZEN_BUILD_ENGINE_VERSION": "29.2.0",
        "FROZEN_BUILDKIT_VERSION": "v0.27.0", "FROZEN_BUILDKIT_COMMIT": "UNPROVEN",
        "FROZEN_BUILDKIT_GO_VERSION": "go1.25.6", "FROZEN_BUILDKIT_BINARY_SHA256": exact["sha256"],
        "binaryMeaning": "CURRENT_INTEGRATED_ENGINE_EXACT_BINARY_HISTORIC_ASSOCIATION_VERSION_ONLY",
        "BUILDKIT_COMPRESSION_CALL_CONTRACT": "PARTIAL", "FROZEN_COMPRESSION_LEVEL": "UNPROVEN",
        "FROZEN_COMPRESSION_STREAM_CONTRACT": "PARTIAL_SOURCE_IO_COPY_NOMINAL_32K_OUTPUT128K_PIPE_SHORT_READS_UNOBSERVED",
        "APP_LAYER_EXACT": "NOT_RUN", "CERT_LAYER_EXACT": "NOT_RUN",
        "G3A_COMPRESSOR_DETERMINISM": "NOT_RUN", "G3A_COMPRESSOR_INPUT": "UNRESOLVED",
        "FULL_BUILD_RETRY_AUTHORITY_REQUIRED": "YES", "fullBuildRetryAuthorityPrepared": False,
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0,
        "REGISTRY_MUTATIONS": 0, "newAzureReadCalls": 0, "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "DETERMINISTIC_OCI_ASSEMBLER_STDLIB_GZIP": "FAILED_EXACT_BYTES_PRIOR_PACKET",
        "GZIP_CONTAINER_METADATA_MISMATCH": "NO", "DEFLATE_BITSTREAM_MISMATCH": "YES",
        "priorFirstMismatchZeroBasedByte": 11,
        "frozenManifest": "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
        "survivingDependency": "ACQUIRE_AND_HASH_BIND_EXACT_GO1_25_6_COMPRESSOR_TOOLCHAIN_UNDER_NEW_AUTHORITY",
        "proposal": proposed, "frozenDigestChanged": False, "applicationBuilds": 0,
        "fullTransactions": 0, "guestExecution": False, "registryTests": 0, "uploaderWork": False,
    })
    fresh("COMPRESSOR_LOCAL_VALIDATION.json", {
        "status": "PASS_LOCAL_PROVENANCE_AND_HARNESS_CHECKS_NOT_COMPRESSION_QUALIFICATION",
        "harnessDevelopmentChecks": checks, "pythonAST": "PASS", "sourceWhitespace": "PASS",
        "exactBinaryBuildInfoRead": "PASS", "frozenTarGzipFixtureHashSize": "PASS",
        "candidateA": "NOT_RUN_TOOLCHAIN_UNAVAILABLE", "candidateB": "NOT_RUN", "candidateC": "NOT_RUN",
        "appAndCertDoubleCompression": "NOT_RUN",
        "priorMismatch": "PRESERVED_BYTE11_DEFLATE_NOT_NEW_CANDIDATE_RESULT",
        "localReadProbeFailuresRetainedInReport": True,
        "repositoryPRChecks": "NOT_RUN_NO_PR_OR_PRODUCT_CODE_CHANGE",
        "newBicep": "NOT_PREPARED_COMPRESSION_ONLY", "toolchainDownloadedOrInstalled": False,
    })
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "COMPRESSOR_REPORT.md").read_text()):
        path = (HERE / target).resolve()
        ensure(path.exists() or path.name in ("COMPRESSOR_VERIFICATION.json",
                                             "COMPRESSOR_INDEPENDENT_VERIFICATION.json"), "REPORT_LINK")
    after = snapshot(ROOT)
    ensure(after == isolated, "CONCURRENCY_CHANGED_DURING_SEAL")
    fresh("COMPRESSOR_VERIFICATION.json", {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PASS_INTEGRITY_NOT_COMPRESSOR_QUALIFICATION",
        "authorityPath": str(AUTHORITY), "authoritySha256": sha(AUTHORITY),
        "priorPortableRootSha256": PRIOR_SHA,
        "concurrency": {"isolated": after, "foreignBefore": foreign,
                        "foreignAfter": snapshot(Path(r"C:\APPS\nzila-os")), "foreignDispositioned": False},
        "preservedPacketHashes": preserved,
        "compressorFileHashes": {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*") if path.is_file()},
        "FROZEN_COMPRESSOR_CONTRACT": "UNRESOLVED", "G3_EXECUTION_READINESS": "BLOCKED",
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    print(json.dumps({"rootSha256": sha(HERE / "COMPRESSOR_VERIFICATION.json"),
                      "preservedReferences": len(preserved), "compressor": "UNRESOLVED"}, indent=2))


if __name__ == "__main__":
    main()

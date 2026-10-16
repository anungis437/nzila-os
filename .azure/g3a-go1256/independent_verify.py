"""Direct-byte archive/toolchain/compressor verifier; no build/compression/cloud calls."""

import gzip
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import struct
import sys
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PRIOR = HERE.parent / "g3a-compressor"


def ensure(value, stage):
    if not value:
        raise RuntimeError(stage)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def embedded_go_version(raw):
    positions, start = [], 0
    while True:
        index = raw.find(b"\xff Go buildinf:", start)
        if index < 0:
            break
        if index % 16 == 0 and index + 32 < len(raw) and raw[index + 15] & 2:
            positions.append(index)
        start = index + 14
    ensure(len(positions) == 1, "COMPRESSOR_GO_BUILDINFO_HEADER")
    offset, length, shift = positions[0] + 32, 0, 0
    while True:
        ensure(offset < len(raw) and shift <= 63, "GO_BUILDINFO_VARINT_BOUND")
        byte = raw[offset]
        offset += 1
        length |= (byte & 127) << shift
        if byte < 128:
            break
        shift += 7
    ensure(offset + length <= len(raw), "GO_BUILDINFO_VERSION_BOUND")
    return raw[offset:offset + length].decode()


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch(r"[0-9a-f]{64}", sys.argv[1]), "EXPECTED_ROOT_SHA_REQUIRED")
    root_path = HERE / "GO1256_VERIFICATION.json"
    ensure(sha(root_path) == sys.argv[1], "ROOT_SHA_MISMATCH")
    root = load(root_path)
    excluded = {"GO1256_VERIFICATION.json", "GO1256_INDEPENDENT_VERIFICATION.json"}
    census = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(census == root["go1256FileHashes"], "GO1256_EXACT_CENSUS_CHANGED")
    references = len(census) + 1
    for relative, expected in root["preservedPacketHashes"].items():
        ensure(sha(ROOT / relative) == expected, "HISTORIC_BYTES_CHANGED")
        references += 1
    for directory, filename, key, names in (
        ("g3-design", "DESIGN_VERIFICATION.json", "designFileHashes", {"DESIGN_VERIFICATION.json"}),
        ("g3-readiness", "READINESS_FINAL_VERIFICATION.json", "readinessFileHashes",
         {"READINESS_FINAL_VERIFICATION.json", "READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-live-readiness", "LIVE_READINESS_FINAL_VERIFICATION.json", "liveReadinessFileHashes",
         {"LIVE_READINESS_FINAL_VERIFICATION.json", "LIVE_READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-final-readiness", "FINAL_READINESS_VERIFICATION.json", "finalReadinessFileHashes",
         {"FINAL_READINESS_VERIFICATION.json", "FINAL_READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3-execution-lane", "EXECUTION_LANE_VERIFICATION.json", "executionLaneFileHashes",
         {"EXECUTION_LANE_VERIFICATION.json", "EXECUTION_LANE_INDEPENDENT_VERIFICATION.json"}),
        ("g3-input-readiness", "INPUT_READINESS_VERIFICATION.json", "inputReadinessFileHashes",
         {"INPUT_READINESS_VERIFICATION.json", "INPUT_READINESS_INDEPENDENT_VERIFICATION.json"}),
        ("g3a-portable", "PORTABLE_BUILDER_VERIFICATION.json", "portableFileHashes",
         {"PORTABLE_BUILDER_VERIFICATION.json", "PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json"}),
        ("g3a-compressor", "COMPRESSOR_VERIFICATION.json", "compressorFileHashes",
         {"COMPRESSOR_VERIFICATION.json", "COMPRESSOR_INDEPENDENT_VERIFICATION.json"}),
    ):
        base = HERE.parent / directory
        actual = {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
                  if path.is_file() and path.name not in names}
        ensure(actual == load(base / filename)[key], "HISTORIC_EXACT_CENSUS_CHANGED")
        references += len(actual)
    ensure(sha(Path(root["authorityPath"])) == root["authoritySha256"], "AUTHORITY_BYTES_CHANGED")
    expected_archive = "f022b6aad78e362bcba9b0b94d09ad58c5a70c6ba3b7582905fababf5fe0181a"
    archive_path = HERE / "go1.25.6.linux-amd64.tar.gz"
    metadata = load(HERE / "OFFICIAL_GO1256_METADATA.json")
    download = load(HERE / "GO1256_DOWNLOAD.json")
    ensure(sha(archive_path) == expected_archive == metadata["archive"]["sha256"] == download["actualSHA256"] and
           archive_path.stat().st_size == 59768880 and download["archiveDownloads"] == 1 and
           metadata["beforeArchiveDownload"] and download["source"] == "GO_DEV_OFFICIAL",
           "OFFICIAL_ARCHIVE_SHA_SIZE")
    ensure(download["requestedURL"] == "https://go.dev/dl/go1.25.6.linux-amd64.tar.gz" and
           download["finalURL"] == "https://dl.google.com/go/go1.25.6.linux-amd64.tar.gz" and
           len(download["redirects"]) == 1, "OFFICIAL_REDIRECT_BOUNDARY")
    inventory = load(HERE / "GO1256_TOOLCHAIN_INVENTORY.json")
    observed, directories = {}, {}
    with tarfile.open(archive_path, "r:gz") as archive:
        for item in archive:
            name = item.name
            path = PurePosixPath(name)
            ensure(not path.is_absolute() and "\\" not in name and ".." not in path.parts and
                   path.parts[0] == "go" and item.mode & ~0o777 == 0 and
                   (item.isfile() or item.isdir()), "SAFE_ARCHIVE_MEMBERS")
            if item.isdir():
                ensure(name not in directories, "DIRECTORY_DUPLICATE")
                directories[name] = item.mode
                continue
            ensure(name not in observed and name in inventory["files"], "FILE_CENSUS_OR_DUPLICATE")
            raw = archive.extractfile(item).read()
            entry = inventory["files"][name]
            extracted = HERE / "toolchain"
            extracted = extracted.joinpath(*path.parts)
            ensure(hashlib.sha256(raw).hexdigest() == entry["sha256"] == sha(extracted) and
                   len(raw) == entry["bytes"] == extracted.stat().st_size and item.mode == entry["mode"],
                   "RAW_ARCHIVE_EXTRACTED_SHA_SIZE_MODE")
            observed[name] = entry
            references += 1
    ensure(observed == inventory["files"] and
           directories == {item["name"]: item["mode"] for item in inventory["directories"]} and
           len(observed) == 14501 and sum(entry["bytes"] for entry in observed.values()) == 206018426,
           "FULL_EXTRACTED_TOOLCHAIN_CENSUS")
    binary_path = HERE / "compressor-go1256"
    binary = binary_path.read_bytes()
    compressor = load(HERE / "G3A_COMPRESSOR_INPUT.json")
    ensure(sha(binary_path) == compressor["sha256"] ==
           "378bacae9bd14e6d2c428fb52ea537ae06bedae01392849293ba9863eb62f95c" and
           len(binary) == compressor["bytes"] == 2166932 and
           embedded_go_version(binary) == "go1.25.6", "RAW_COMPRESSOR_SHA_RUNTIME")
    ensure(binary[:6] == b"\x7fELF\x02\x01" and binary[18:20] == b"\x3e\x00", "COMPRESSOR_PLATFORM")
    offset = struct.unpack_from("<Q", binary, 32)[0]
    stride, count = struct.unpack_from("<HH", binary, 54)
    ensure(stride >= 56 and count > 0 and offset + stride * count <= len(binary) and
           all(struct.unpack_from("<I", binary, offset + n * stride)[0] != 3 for n in range(count)),
           "COMPRESSOR_INTERPRETER_ABSENT")
    manifest_path = Path(compressor["manifestPath"])
    manifest = load(manifest_path)
    ensure("sha256:" + sha(manifest_path) == compressor["manifestDigest"] and
           manifest["artifactType"] == compressor["artifactType"] and manifest["layers"] == [{
               "mediaType": compressor["payloadMediaType"], "size": len(binary), "digest": "sha256:" + sha(binary_path),
           }] and compressor["registryPushes"] == 0, "MINIMAL_COMPRESSOR_OCI_ENVELOPE")
    result = load(HERE / "COMPRESSOR_RESULT.json")
    ensure([(r["run"], r["name"]) for r in result["observations"]] ==
           [(1, "app"), (1, "cert"), (2, "app"), (2, "cert")], "APP_BEFORE_CERT_AND_REPEAT_ORDER")
    for entry in result["observations"]:
        name, run = entry["name"], entry["run"]
        path = HERE / ("compression-run" + str(run)) / (name + ".gz")
        raw = path.read_bytes()
        frozen = (PRIOR / "fixtures" / (name + ".frozen.gz")).read_bytes()
        ensure(raw == frozen and sha(path) == entry["candidateSha256"] == entry["frozenSha256"] and
               len(raw) == entry["candidateBytes"] == entry["frozenBytes"] and entry["bytesEqual"] and
               gzip.decompress(raw) == (PRIOR / "fixtures" / (name + ".tar")).read_bytes(),
               "EXACT_FROZEN_GZIP_BOTH_RUNS")
        record = load(HERE / ("RUN" + str(run) + "_" + name.upper() + ".json"))
        ensure(record["exitCode"] == 0 and record["network"] == "NONE" and
               "/evidence/compressor-go1256" in record["command"][-1], "EXACT_TESTED_BINARY_COMMAND")
        references += 1
    sources = load(HERE / "HARNESS_SOURCE_BINDING.json")
    for name, expected in sources["files"].items():
        ensure(sha(HERE / "harness" / name) == sha(PRIOR / "harness" / name) == expected,
               "ONLY_RUNTIME_CHANGED_HARNESS_SOURCE")
    d = load(HERE / "GO1256_DISPOSITION.json")
    ensure(d["FROZEN_COMPRESSOR_CONTRACT"] == "PROVEN" and d["APP_LAYER_EXACT"] == d["CERT_LAYER_EXACT"] == "YES" and
           d["G3A_COMPRESSOR_DETERMINISM"] == "PASS" and
           d["G3A_PORTABLE_PRIVATE_BUILDER"] == "COMPRESSION_QUALIFIED_PENDING_FULL_REHEARSAL" and
           d["G3_EXECUTION_READINESS"] == "BLOCKED", "COMPRESSION_NOT_READINESS")
    ensure(d["applicationBuilds"] == d["fullImageTransactions"] == 0 and not d["frozenDigestChanged"] and
           not d["fullBuildRetryAuthorityIssued"] and not d["preparedAssemblerExecutedOrCompiled"] and
           d["FULL_BUILD_RETRY_AUTHORITY_REQUIRED"] == "YES" and
           d["G3_TECHNICAL_EXECUTION_AUTHORIZED"] == "NO", "NO_FULL_BUILD_AUTHORITY")
    for name in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(root[name] == d[name] == 0, "MUTATION_CLAIM")
    ensure(d["newAzureReadCalls"] == 0 and not d["guestExecution"] and
           not d["systemInstallation"] and not d["globalPATHChanged"] and
           d["UE_INFRA"] == d["CORA_INFRA"] == "INFRA_NO_GO", "SCOPE_DRIFT")
    build = load(HERE / "HARNESS_BUILD.json")
    ensure(build["exitCode"] == 0 and build["stdout"].count("--- PASS: Test") == 2 and
           "--- SKIP: TestOtherRuntimeCannotRunFrozenCandidate" in build["stdout"] and
           "GOPROXY=off" in build["command"] and "--network" in build["command"] and
           "/evidence/toolchain/go/bin/go build" in build["command"][-1], "EXTRACTED_OFFLINE_BUILD")
    validation = load(HERE / "GO1256_LOCAL_VALIDATION.json")
    for name, expected in validation["preparedAssemblerHashes"].items():
        ensure(sha(HERE / "prepared-assembler" / name) == expected, "PREPARED_SOURCE_HASH")
    proposed = load(HERE / "PROPOSED_UPDATED_BUILD_BINDING.json")
    ensure(proposed["inputs"]["compressor-go1256"] == {"bytes": len(binary), "sha256": sha(binary_path)},
           "PREPARED_INPUT_BINDING")
    ensure("PROPOSED ONLY - NOT ISSUED OR EXECUTED" in
           (HERE / "G3A_PORTABLE_FULL_REHEARSAL_RETRY_AUTHORITY.md").read_text(), "RETRY_PROPOSAL_ONLY")
    for report in ("GO1256_QUALIFICATION_REPORT.md", "G3A_PORTABLE_FULL_REHEARSAL_RETRY_AUTHORITY.md"):
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / report).read_text()):
            path = (HERE / target).resolve()
            ensure(path.exists() or path.name == "GO1256_INDEPENDENT_VERIFICATION.json", "BROKEN_REPORT_LINK")
    output = {
        "status": "PASS_DIRECT_BYTE_COMPRESSION_QUALIFICATION_NOT_FULL_REHEARSAL",
        "rootSha256": sys.argv[1], "hashReferencesVerified": references,
        "rawOfficialArchiveAndExtractedMembersVerified": len(observed),
        "rawStaticCompressorGoVersion": embedded_go_version(binary),
        "allFourGzipOutputsEqualFrozenBytes": True, "historicExactCensusesVerified": True,
        "sealerImportedOrExecuted": False, "additionalCompressionRuns": 0,
        "applicationBuilds": 0, "additionalAzureCalls": 0,
        "FROZEN_COMPRESSOR_CONTRACT": "PROVEN", "G3_EXECUTION_READINESS": "BLOCKED",
    }
    with (HERE / "GO1256_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8", newline="\n") as file:
        json.dump(output, file, indent=2)
        file.write("\n")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()

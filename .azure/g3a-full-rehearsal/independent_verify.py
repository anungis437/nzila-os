"""Standalone byte verifier. Never imports the sealer or runs a build."""

import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import sys
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def ensure(value, stage):
    if not value:
        raise RuntimeError(stage)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def static(raw):
    ensure(len(raw) >= 64 and raw[:6] == b"\x7fELF\x02\x01" and raw[18:20] == b"\x3e\x00", "ELF_PLATFORM")
    offset = struct.unpack_from("<Q", raw, 32)[0]
    stride, count = struct.unpack_from("<HH", raw, 54)
    ensure(stride >= 56 and count > 0 and offset + stride * count <= len(raw) and
           all(struct.unpack_from("<I", raw, offset + n * stride)[0] != 3 for n in range(count)),
           "ELF_INTERPRETER")


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch(r"[0-9a-f]{64}", sys.argv[1]), "ROOT_REQUIRED")
    path = HERE / "FULL_REHEARSAL_VERIFICATION.json"
    ensure(sha(path) == sys.argv[1], "ROOT_CHANGED")
    root = load(path)
    excluded = {"FULL_REHEARSAL_VERIFICATION.json", "FULL_REHEARSAL_INDEPENDENT_VERIFICATION.json"}
    actual = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(actual == root["rehearsalFileHashes"], "EXACT_REHEARSAL_CENSUS_CHANGED")
    references = len(actual) + 1
    for relative, expected in root["preservedPacketHashes"].items():
        ensure(sha(ROOT / relative) == expected, "PRIOR_BYTES_CHANGED")
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
        ("g3a-go1256", "GO1256_VERIFICATION.json", "go1256FileHashes",
         {"GO1256_VERIFICATION.json", "GO1256_INDEPENDENT_VERIFICATION.json"}),
    ):
        base = HERE.parent / directory
        census = {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
                  if path.is_file() and path.name not in names}
        ensure(census == load(base / filename)[key], "HISTORICAL_CENSUS_CHANGED_" + directory)
        references += len(census)
    authority = root["authority"]
    ensure(sha(Path(authority["path"])) == authority["sha256"] and
           authority["fullTransactionsAuthorized"] == 1, "AUTHORITY_BINDING")
    result = load(HERE / "FULL_TRANSACTION_RESULT.json")
    ensure(result["fullTransactions"] == 1 and result["exitCode"] == 1 and
           result["stderr"].strip() == "open /output/manifest.json: file exists", "SINGLE_ATTEMPT_FAILURE")
    inputs = HERE / "inputs"
    census = load(HERE / "STAGED_INPUT_CENSUS.json")
    ensure({path.name: {"sha256": sha(path), "bytes": path.stat().st_size} for path in inputs.iterdir()} ==
           census["entries"], "INPUT_CENSUS_SHA_SIZE")
    ensure(census["totalStagedBytes"] == sum(entry["bytes"] for entry in census["entries"].values()) ==
           265084641, "TOTAL_BYTES")
    binding = load(inputs / "binding.json")
    ensure(set(binding["inputs"]) | {"binding.json"} == set(census["entries"]), "BINDING_FILE_CENSUS")
    for name, entry in binding["inputs"].items():
        ensure(entry == census["entries"][name], "BINDING_SHA_SIZE")
    archives_verified = 0
    for name, members in (("source.tar", binding["sourceMembers"]),
                          ("go-toolchain.tar", load(inputs / "toolchain-members.json"))):
        observed, seen = {}, set()
        with tarfile.open(inputs / name) as archive:
            for member in archive:
                key = member.name.rstrip("/")
                ensure(key and not key.startswith("/") and "\\" not in key and
                       all(part not in ("", ".", "..") for part in key.split("/")) and
                       key not in seen and member.mode & ~0o777 == 0 and
                       (member.isfile() or member.isdir()), "SAFE_ARCHIVE_GATE")
                seen.add(key)
                if member.isdir():
                    ensure(member.mode == 0o755 and any(item.startswith(key + "/") for item in members),
                           "DIRECTORY_CONTRACT")
                    continue
                raw = archive.extractfile(member).read()
                observed[key] = {"sha256": hashlib.sha256(raw).hexdigest(),
                                 "bytes": len(raw), "mode": member.mode}
                ensure(key in members and observed[key] == members[key], "RAW_ARCHIVE_MEMBER")
                if name == "go-toolchain.tar":
                    ensure(sha(HERE / "preparation-toolchain" / key) == observed[key]["sha256"], "PREP_TOOL_BYTES")
                archives_verified += 1
        ensure(observed == members, "RAW_ARCHIVE_CENSUS")
    output = HERE / "clean-room" / "transaction"
    frozen = HERE.parent / "g3-final-readiness" / "local-image-frozen" / "image-run1.tar"
    with tarfile.open(frozen) as archive:
        index_raw = archive.extractfile("index.json").read()
        digest = json.loads(index_raw)["manifests"][0]["digest"]
        ensure(digest == "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
               "FROZEN_AUTHORITY")
        manifest_raw = archive.extractfile("blobs/sha256/" + digest.split(":")[1]).read()
        ensure((output / "manifest.json").read_bytes() == manifest_raw, "PRESERVED_MANIFEST_BYTES")
        manifest = json.loads(manifest_raw)
        config = archive.extractfile("blobs/sha256/" + manifest["config"]["digest"].split(":")[1]).read()
        ensure((output / "config.json").read_bytes() == config, "CONFIG_BYTES")
        for number, layer in enumerate(manifest["layers"], 1):
            raw = archive.extractfile("blobs/sha256/" + layer["digest"].split(":")[1]).read()
            ensure((output / ("layer" + str(number) + ".tar.gz")).read_bytes() == raw, "GZIP_RAW_BYTES")
            tar_raw = gzip.decompress(raw)
            ensure((output / ("layer" + str(number) + ".tar")).read_bytes() == tar_raw, "TAR_RAW_BYTES")
            with tarfile.open(fileobj=io.BytesIO(tar_raw)) as stream:
                for member in stream:
                    ensure(member.uid == member.gid == 0 and member.mtime == 946684800 and
                           member.type in (tarfile.REGTYPE, tarfile.DIRTYPE), "TAR_METADATA")
                    if member.name == "g3-runtime":
                        binary = stream.extractfile(member).read()
                        ensure(binary == (output / "g3-runtime").read_bytes() and len(binary) == 7454844 and
                               hashlib.sha256(binary).hexdigest() ==
                               "5a1ab8fdd71a8db76220de0d8867eea6c5a1fedd2889cfe9092f3e6f98d9f7b0",
                               "APP_RAW_BYTES")
                        static(binary)
                    if member.name == "etc/ssl/certs/ca-certificates.crt":
                        ensure(stream.extractfile(member).read() == (inputs / "ca-certificates.crt").read_bytes(),
                               "CERTIFICATE_INPUT")
    ensure(not (output / "index.json").exists() and not (output / "oci").exists() and
           not (output / "result.json").exists(), "FALSE_TRANSACTION_COMPLETENESS")
    command = load(HERE / "FULL_TRANSACTION_ISSUED.json")["command"]
    ensure(command[command.index("--network") + 1] == "none" and
           command[command.index("--entrypoint") + 1] == "/inputs/portable-assembler" and
           "--read-only" in command and "--pull" in command and "never" in command and
           command[-3:] == ["/inputs", "/work/transaction", "/output"] and
           sum(argument.startswith("type=bind,") for argument in command) == 2 and
           not any("docker.sock" in item or str(frozen) in item for item in command),
           "ISOLATION_COMMAND")
    ensure(load(HERE / "HOST_ENGINE_ISOLATION.json")["compilerInvoked"] is False and
           load(HERE / "HOST_ENGINE_ISOLATION.json")["exitCode"] == 0, "ISOLATION_BEFORE_COMPILER")
    trace = (output / "compiler-diagnostic.txt").read_text()
    actual_tools = set(re.findall(r"(/work/transaction/go/pkg/tool/linux_amd64/[a-zA-Z0-9_-]+)(?=\s|$)", trace))
    actual_tests = set(re.findall(r"^(\$WORK/[^\s]+\.test)(?=\s|$)", trace, re.MULTILINE))
    executable = load(HERE / "EXECUTABLE_CENSUS_FINAL.json")
    expected_paths = actual_tools | actual_tests | {
        "/inputs/portable-assembler", "/inputs/compressor-go1256", "/work/transaction/go/bin/go"}
    ensure({item["path"] for item in executable["entries"]} == expected_paths and
           not executable["hostOnlyExecutables"] and not executable["outerUtilitiesInsideFullTransaction"],
           "EXECUTABLE_CENSUS")
    tools = load(inputs / "toolchain-members.json")
    for item in executable["entries"]:
        path = item["path"]
        if path.startswith("/inputs/"):
            payload = inputs / path.removeprefix("/inputs/")
            ensure(item["sha256"] == sha(payload) and item["bytes"] == payload.stat().st_size and
                   item["classification"] == "STAGED_INPUT", "EXECUTABLE_PAYLOAD")
            static(payload.read_bytes())
        elif path.startswith("/work/transaction/go/"):
            relative = path.removeprefix("/work/transaction/go/")
            ensure(item["sha256"] == tools[relative]["sha256"] and
                   item["classification"] == "STAGED_INPUT", "EXECUTABLE_TOOL")
            static((HERE / "preparation-toolchain" / relative).read_bytes())
        else:
            ensure(path in actual_tests and item["classification"] ==
                   "TRANSACTION_GENERATED_FROM_STAGED_SOURCE", "EXECUTABLE_GENERATED")
    build = load(HERE / "ASSEMBLER_BUILD.json")
    ensure(sha(inputs / "portable-assembler") == build["binarySha256"] and build["tests"] == "PASS_5", "CONTROLLER")
    for name, expected in build["sourceHashes"].items():
        ensure(sha(HERE / "assembler" / name) == expected, "ATTEMPT_SOURCE_CHANGED")
    source = (HERE / "assembler" / "main.go").read_text()
    loop = source[source.index("\tfor i, layer := range"):source.index("\tindex, err := replaceDescriptor")]
    ensure('exclusive(filepath.Join(output, "manifest.json")' in loop, "EXACT_CONTROL_FLOW_FAILURE_CAUSE")
    disposition = load(HERE / "FULL_REHEARSAL_DISPOSITION_FINAL.json")
    ensure(disposition["G3A_PORTABLE_PRIVATE_BUILDER"] == disposition["G3_EXECUTION_READINESS"] == "BLOCKED" and
           disposition["G3A_PORTABLE_IMAGE_REPRODUCTION"] == "FAIL" and
           disposition["G3A_TOOLCHAIN_SELF_CONTAINED"] == "PASS" and
           disposition["OCI_INDEX_DIGEST"] == disposition["OCI_LAYOUT_VERSION"] == "NOT_RUN" and
           not disposition["controllerCorrectedAfterStop"], "HONEST_STOP")
    for key in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(root[key] == disposition[key] == result[key] == 0, "SCOPE_MUTATION")
    ensure(disposition["G3_TECHNICAL_EXECUTION_AUTHORIZED"] == "NO" and
           disposition["G3A_REGISTRY_UPLOADER"] == "NOT_AUTHORIZED" and
           disposition["UE_INFRA"] == disposition["CORA_INFRA"] == "INFRA_NO_GO", "FALSE_READY")
    report = {
        "status": "PASS_DIRECT_BYTE_EVIDENCE_SINGLE_FAILED_TRANSACTION",
        "rootSha256": sys.argv[1], "hashReferencesVerified": references,
        "rawStagedArchiveFilesVerified": archives_verified, "fullTransactions": 1,
        "applicationTarsGzipConfigAndPreservedManifestExact": True,
        "indexLayoutAndFullTransactionSuccess": "NOT_REACHED_CONTROLLER_EXCLUSIVE_WRITE_FAILURE",
        "G3A_TOOLCHAIN_SELF_CONTAINED": "PASS", "executableCensusEntries": len(executable["entries"]),
        "historicalExactCensusesVerified": True, "sealerImportedOrExecuted": False,
        "additionalBuildOrCompressionRuns": 0, "cloudOrRegistryCalls": 0,
        "G3A_PORTABLE_PRIVATE_BUILDER": "BLOCKED", "G3_EXECUTION_READINESS": "BLOCKED",
    }
    with (HERE / "FULL_REHEARSAL_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as file:
        json.dump(report, file, indent=2)
        file.write("\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

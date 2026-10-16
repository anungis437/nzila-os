"""Standalone direct-byte verifier; no sealer imports, builds or cloud calls."""

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
PRIOR = HERE.parent / "g3a-full-rehearsal"


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
    root_path = HERE / "REPAIR_VERIFICATION.json"
    ensure(sha(root_path) == sys.argv[1], "REPAIR_ROOT_CHANGED")
    root = load(root_path)
    excluded = {"REPAIR_VERIFICATION.json", "REPAIR_INDEPENDENT_VERIFICATION.json"}
    actual = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(actual == root["repairFileHashes"], "REPAIR_EXACT_CENSUS_CHANGED")
    references = len(actual) + 1
    for relative, value in root["preservedPacketHashes"].items():
        ensure(sha(ROOT / relative) == value, "HISTORICAL_FILE_CHANGED")
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
        ("g3a-full-rehearsal", "FULL_REHEARSAL_VERIFICATION.json", "rehearsalFileHashes",
         {"FULL_REHEARSAL_VERIFICATION.json", "FULL_REHEARSAL_INDEPENDENT_VERIFICATION.json"}),
    ):
        base = HERE.parent / directory
        census = {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
                  if path.is_file() and path.name not in names}
        ensure(census == load(base / filename)[key], "HISTORICAL_EXACT_CENSUS_" + directory)
        references += len(census)
    ensure(sha(PRIOR / "FULL_REHEARSAL_VERIFICATION.json") ==
           root["priorFailedRootSha256"] ==
           "bd5be23c49e92d95efe25ab21eb46a5a57af6279d7965d835b2cdd243b07b461",
           "FAILED_ATTEMPT_ROOT")
    ensure(sha(Path(root["authorityPath"])) == root["authoritySha256"], "AUTHORITY_CHANGED")
    ensure(any(value == "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499"
               for value in root["preservedPacketHashes"].values()), "G2_TERMINAL_PROTECTION")
    old_source = (PRIOR / "assembler" / "main.go").read_text()
    new_source = (HERE / "assembler" / "main.go").read_text()
    start = old_source.index('\t\tif err := exclusive(filepath.Join(output, "manifest.json")')
    end = old_source.index("\tindex, err := replaceDescriptor", start)
    old_block = old_source[start:end]
    ensure(old_block.endswith("\t}\n"), "OLD_LOOP_BOUNDARY")
    corrected = "\t}\n" + "\n".join(line[1:] for line in old_block.splitlines()[:-1]) + "\n"
    ensure(new_source == old_source[:start] + corrected + old_source[end:],
           "EXACT_MINIMUM_CONTROL_FLOW_PATCH")
    for name in ("compressor.go", "main_test.go", "go.mod"):
        ensure((HERE / "assembler" / name).read_bytes() == (PRIOR / "assembler" / name).read_bytes(),
               "UNRELATED_SOURCE_CHANGED")
    regression_old = load(HERE / "REGRESSION_PRIOR_EXPECTED_FAIL.json")
    validation = load(HERE / "CONTROLLER_LOCAL_VALIDATION.json")
    ensure(regression_old["exitCode"] == 1 and "MANIFEST_WRITE_INSIDE_DESCRIPTOR_LOOP" in regression_old["stdout"] and
           validation["exitCode"] == 0 and validation["stdout"].count("--- PASS: Test") == 6 and
           "--- PASS: TestManifestSingleWriteControlFlow" in validation["stdout"],
           "REGRESSION_MUST_FAIL_PRIOR_PASS_REPAIR")
    review = load(HERE / "CONTROLLER_PATCH_REVIEW.json")
    for name, expected in review["sourceHashes"].items():
        ensure(sha(HERE / "assembler" / name) == expected, "REPAIRED_VALIDATED_SOURCE_CHANGED")
    ensure(review["CONTROLLER_PATCH_SCOPE"] == "MANIFEST_WRITE_CONTROL_FLOW_ONLY" and
           review["UNRELATED_SOURCE_CHANGES"] == 0, "SOURCE_REVIEW_SCOPE")
    inputs = HERE / "inputs"
    census = load(HERE / "STAGED_INPUT_CENSUS.json")
    prior_census = load(PRIOR / "STAGED_INPUT_CENSUS.json")
    observed = {path.name: {"sha256": sha(path), "bytes": path.stat().st_size} for path in inputs.iterdir()}
    ensure(observed == census["entries"] and set(observed) == set(prior_census["entries"]), "INPUT_CENSUS")
    differences = {name for name in observed if observed[name] != prior_census["entries"][name]}
    ensure(differences == {"portable-assembler", "controller-main.go", "binding.json"},
           "FROZEN_INPUT_CHANGED")
    ensure(census["priorTotalBytes"] == 265084641 and census["totalStagedBytes"] == 265080538 ==
           sum(item["bytes"] for item in observed.values()) and census["deltaBytes"] == -4103,
           "INPUT_BYTE_TOTAL")
    for item in census["changes"]:
        name = item["file"]
        ensure(name in differences and item["prior"] == prior_census["entries"][name] and
               item["new"] == observed[name] and item["deltaBytes"] ==
               observed[name]["bytes"] - prior_census["entries"][name]["bytes"], "INPUT_DELTA_DETAIL")
    ensure((inputs / "controller-main.go").read_bytes() == (HERE / "assembler" / "main.go").read_bytes() and
           sha(inputs / "portable-assembler") == review["binarySha256"], "CONTROLLER_STAGED_SOURCE_BINARY")
    binding = load(inputs / "binding.json")
    previous_binding = load(PRIOR / "inputs" / "binding.json")
    for name in ("portable-assembler", "controller-main.go"):
        previous_binding["inputs"][name] = binding["inputs"][name]
    ensure(binding == previous_binding and set(binding["inputs"]) | {"binding.json"} == set(observed),
           "BINDING_ONLY_REPAIRED_FIELDS")
    for name, item in binding["inputs"].items():
        ensure(item == observed[name], "STAGED_DESCRIPTOR_SHA_SIZE")
    archived_files = 0
    tool_members = load(inputs / "toolchain-members.json")
    for filename, contract in (("source.tar", binding["sourceMembers"]), ("go-toolchain.tar", tool_members)):
        seen, files = set(), {}
        with tarfile.open(inputs / filename) as archive:
            for member in archive:
                name = member.name.rstrip("/")
                ensure(name and not name.startswith("/") and "\\" not in name and
                       all(part not in ("", ".", "..") for part in name.split("/")) and
                       name not in seen and member.mode & ~0o777 == 0 and
                       (member.isfile() or member.isdir()), "SAFE_ARCHIVE_MEMBERS")
                seen.add(name)
                if member.isdir():
                    ensure(member.mode == 0o755 and any(key.startswith(name + "/") for key in contract),
                           "SAFE_ARCHIVE_DIRECTORY")
                    continue
                raw = archive.extractfile(member).read()
                files[name] = {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "mode": member.mode}
                ensure(name in contract and files[name] == contract[name], "RAW_ARCHIVE_FILE")
                archived_files += 1
        ensure(files == contract, "RAW_ARCHIVE_CENSUS")
    output = HERE / "clean-room" / "transaction"
    ensure(load(HERE / "FULL_RETRY_RESULT.json")["exitCode"] == 0 and
           load(HERE / "AUTHORITY_CONSUMPTION.json")["fullRetriesInvoked"] == 1 and
           load(HERE / "AUTHORITY_CONSUMPTION.json")["FULL_REHEARSAL_RETRY_AUTHORITY_CONSUMED"] == "YES",
           "SINGLE_SUCCESS_RETRY")
    frozen = HERE.parent / "g3-final-readiness" / "local-image-frozen" / "image-run1.tar"
    expected = {}
    with tarfile.open(frozen) as archive:
        index_raw = archive.extractfile("index.json").read()
        index = json.loads(index_raw)
        digest = index["manifests"][0]["digest"]
        ensure(digest == "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
               "FROZEN_MANIFEST")
        manifest_raw = archive.extractfile("blobs/sha256/" + digest.split(":")[1]).read()
        metadata = json.loads(manifest_raw)
        expected["manifest.json"], expected["index.json"] = manifest_raw, index_raw
        expected["config.json"] = archive.extractfile("blobs/sha256/" + metadata["config"]["digest"].split(":")[1]).read()
        for number, layer in enumerate(metadata["layers"], 1):
            compressed = archive.extractfile("blobs/sha256/" + layer["digest"].split(":")[1]).read()
            raw = gzip.decompress(compressed)
            expected["layer" + str(number) + ".tar.gz"] = compressed
            expected["layer" + str(number) + ".tar"] = raw
            with tarfile.open(fileobj=io.BytesIO(raw)) as stream:
                for member in stream:
                    ensure(member.uid == member.gid == 0 and member.mtime == 946684800 and
                           member.type in (tarfile.REGTYPE, tarfile.DIRTYPE), "TAR_METADATA")
                    if member.name == "g3-runtime":
                        binary = stream.extractfile(member).read()
                        ensure(len(binary) == 7454844 and hashlib.sha256(binary).hexdigest() ==
                               "5a1ab8fdd71a8db76220de0d8867eea6c5a1fedd2889cfe9092f3e6f98d9f7b0", "APP_CONTRACT")
                        static(binary)
                        expected["g3-runtime"] = binary
                    if member.name == "etc/ssl/certs/ca-certificates.crt":
                        ensure(stream.extractfile(member).read() == (inputs / "ca-certificates.crt").read_bytes(), "CA")
    comparison = load(HERE / "EXACT_OUTPUT_COMPARISON.json")
    for name, raw in expected.items():
        ensure((output / name).read_bytes() == raw and comparison[name]["bytesEqual"] and
               comparison[name]["bytes"] == len(raw) and comparison[name]["sha256"] ==
               hashlib.sha256(raw).hexdigest(), "OUTPUT_FROZEN_RAW_BYTES_" + name)
    intended = {"index.json": index_raw, "oci-layout": b'{"imageLayoutVersion":"1.0.0"}'}
    for name in ("config.json", "manifest.json", "layer1.tar.gz", "layer2.tar.gz"):
        raw = expected[name]
        intended["blobs/sha256/" + hashlib.sha256(raw).hexdigest()] = raw
    layout = output / "oci"
    ensure({str(path.relative_to(layout)).replace("\\", "/"): path.read_bytes()
            for path in layout.rglob("*") if path.is_file()} == intended and len(intended) == 6,
           "OCI_TREE_EXACT_SIX_FILES")
    ensure(index["manifests"][0]["digest"] == "sha256:" + sha(output / "manifest.json") and
           index["manifests"][0]["size"] == len(manifest_raw), "OCI_INDEX_DESCRIPTOR")
    completeness = load(HERE / "OCI_LAYOUT_COMPLETENESS.json")
    ensure(completeness["fileCount"] == 6 and completeness["layoutVersion"] == "1.0.0" and
           completeness["files"] == {name: {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
                                    for name, raw in intended.items()}, "OCI_COMPLETENESS_RECORD")
    manifest_struct = json.loads(expected["manifest.json"])
    ensure(manifest_struct["config"]["digest"] == "sha256:" + sha(output / "config.json") and
           manifest_struct["config"]["size"] == len(expected["config.json"]) and
           len(manifest_struct["layers"]) == 2, "MANIFEST_CONFIG_DESCRIPTOR")
    for number, layer in enumerate(manifest_struct["layers"], 1):
        ensure(layer["digest"] == "sha256:" + sha(output / ("layer" + str(number) + ".tar.gz")) and
               layer["size"] == len(expected["layer" + str(number) + ".tar.gz"]), "MANIFEST_LAYER_DESCRIPTOR")
    command = load(HERE / "FULL_RETRY_ISSUED.json")["command"]
    ensure(command[command.index("--network") + 1] == "none" and "--read-only" in command and
           command[command.index("--entrypoint") + 1] == "/inputs/portable-assembler" and
           command[command.index("--pull") + 1] == "never" and
           sum(item.startswith("type=bind,") for item in command) == 2 and
           not any("docker.sock" in item or str(frozen) in item for item in command) and
           command[-3:] == ["/inputs", "/work/transaction", "/output"], "FULL_RETRY_ISOLATION")
    ensure(load(HERE / "HOST_ENGINE_ISOLATION.json")["exitCode"] ==
           load(HERE / "IMMEDIATE_PRE_EXECUTION_ISOLATION.json")["exitCode"] == 0, "PRE_EXECUTION_ISOLATION")
    trace = (output / "compiler-diagnostic.txt").read_text()
    ensure(trace == (output / "compiler.log").read_text(), "TRACE_BYTES")
    tools = set(re.findall(r"(/work/transaction/go/pkg/tool/linux_amd64/[a-zA-Z0-9_-]+)(?=\s|$)", trace))
    tests = set(re.findall(r"^(\$WORK/[^\s]+\.test)(?=\s|$)", trace, re.MULTILINE))
    executable = load(HERE / "EXECUTABLE_CENSUS.json")
    ensure({item["path"] for item in executable["entries"]} == tools | tests | {
        "/inputs/portable-assembler", "/inputs/compressor-go1256", "/work/transaction/go/bin/go"} and
           not executable["hostOnlyExecutables"] and not executable["outerUtilitiesInsideFullTransaction"] and tests,
           "ACTUAL_EXECUTABLE_CENSUS")
    for item in executable["entries"]:
        path = item["path"]
        if path.startswith("/inputs/"):
            target = inputs / path.removeprefix("/inputs/")
            ensure(item["sha256"] == sha(target) and item["bytes"] == target.stat().st_size and
                   item["classification"] == "STAGED_INPUT", "STAGED_EXECUTABLE")
            static(target.read_bytes())
        elif path.startswith("/work/transaction/go/"):
            relative = path.removeprefix("/work/transaction/go/")
            ensure(item["sha256"] == tool_members[relative]["sha256"] and
                   item["classification"] == "STAGED_INPUT", "STAGED_TOOL")
            target = PRIOR / "preparation-toolchain" / relative
            ensure(sha(target) == item["sha256"], "TOOL_BYTES")
            static(target.read_bytes())
        else:
            ensure(path in tests and item["classification"] ==
                   "TRANSACTION_GENERATED_FROM_STAGED_SOURCE", "GENERATED_TEST_EXECUTABLE")
    ensure(sha(inputs / "compressor-go1256") ==
           "378bacae9bd14e6d2c428fb52ea537ae06bedae01392849293ba9863eb62f95c", "COMPRESSOR_UNCHANGED")
    disposition = load(HERE / "REPAIR_DISPOSITION.json")
    for key in ("APP_BINARY_EXACT", "APP_LAYER_TAR_EXACT", "CERT_LAYER_TAR_EXACT", "APP_GZIP_EXACT",
                "CERT_GZIP_EXACT", "CONFIG_EXACT", "MANIFEST_EXACT"):
        ensure(disposition[key] == "YES", "EXACT_DISPOSITION")
    ensure(disposition["G3A_PORTABLE_PRIVATE_BUILDER"] == disposition["G3A_BUILD_CONTROLLER_CORE"] == "QUALIFIED" and
           disposition["G3A_PORTABLE_IMAGE_REPRODUCTION"] == "PASS" and disposition["G3_EXECUTION_READINESS"] == "BLOCKED" and
           disposition["MANIFEST_SINGLE_WRITE"] == "PASS" and disposition["OCI_LAYOUT_COMPLETENESS"] == "PASS" and
           disposition["G3A_CONTROLLER"] == disposition["G3A_BICEP_PACKAGE"] == "INCOMPLETE" and
           disposition["G3A_REGISTRY_UPLOADER"] == "NOT_AUTHORIZED" and
           disposition["G3_TECHNICAL_EXECUTION_AUTHORIZED"] == "NO" and
           disposition["UE_INFRA"] == disposition["CORA_INFRA"] == "INFRA_NO_GO" and
           disposition["fullRetries"] == 1 and not disposition["nextAuthorityIssued"], "QUALIFICATION_BOUNDARY")
    for key in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(root[key] == disposition[key] == 0, "NO_MUTATIONS")
    report = {
        "status": "PASS_DIRECT_BYTE_SINGLE_REPAIRED_FULL_RETRY",
        "rootSha256": sys.argv[1], "hashReferencesVerified": references,
        "rawStagedArchiveFilesVerified": archived_files, "fullRetries": 1,
        "priorFailedAttemptAndHistoricalCensusesUnchanged": True,
        "minimumControlFlowPatchVerified": True, "regressionFailsPriorPassesRepair": True,
        "allEightFrozenOutputsByteExact": True, "ociLayoutFiles": 6, "ociLayoutVersion": "1.0.0",
        "executableCensusEntries": len(executable["entries"]), "hostOnlyExecutables": 0,
        "totalStagedInputBytes": census["totalStagedBytes"], "deltaBytes": census["deltaBytes"],
        "sealerImportedOrExecuted": False, "additionalBuildOrCompressionRuns": 0, "cloudOrRegistryCalls": 0,
        "G3A_PORTABLE_PRIVATE_BUILDER": "QUALIFIED", "G3A_BUILD_CONTROLLER_CORE": "QUALIFIED",
        "G3_EXECUTION_READINESS": "BLOCKED",
    }
    with (HERE / "REPAIR_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8") as file:
        json.dump(report, file, indent=2)
        file.write("\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

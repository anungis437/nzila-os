"""Direct-byte verifier of the exact-image stop; never imports the sealer."""

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


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def static_elf(raw):
    ensure(len(raw) >= 64 and raw[:6] == b"\x7fELF\x02\x01" and raw[18:20] == b"\x3e\x00",
           "ELF_LINUX_AMD64")
    offset = struct.unpack_from("<Q", raw, 32)[0]
    stride, count = struct.unpack_from("<HH", raw, 54)
    ensure(stride >= 56 and count > 0 and offset + stride * count <= len(raw) and
           all(struct.unpack_from("<I", raw, offset + n * stride)[0] != 3 for n in range(count)),
           "ELF_DYNAMIC_INTERPRETER")


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch(r"[0-9a-f]{64}", sys.argv[1]), "EXPECTED_ROOT_REQUIRED")
    root_path = HERE / "PORTABLE_BUILDER_VERIFICATION.json"
    ensure(sha(root_path) == sys.argv[1], "PORTABLE_ROOT_MISMATCH")
    root = load(root_path)
    excluded = {"PORTABLE_BUILDER_VERIFICATION.json", "PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json"}
    actual = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(actual == root["portableFileHashes"], "PORTABLE_CENSUS_MISMATCH")
    count = len(actual) + 1
    for relative, expected in root["preservedPacketHashes"].items():
        ensure(sha(ROOT / relative) == expected, "SEALED_HISTORIC_BYTES_CHANGED")
        count += 1
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
    ):
        base = HERE.parent / directory
        census = {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
                  if path.is_file() and path.name not in names}
        ensure(census == load(base / filename)[key], "HISTORIC_EXACT_CENSUS_CHANGED")
        count += len(census)
    ensure(sha(Path(root["authorityPath"])) == root["authoritySha256"], "CURRENT_AUTHORITY_CHANGED")
    d = load(HERE / "PORTABLE_BUILDER_DISPOSITION.json")
    ensure(d["G3A_PORTABLE_PRIVATE_BUILDER"] == d["G3_EXECUTION_READINESS"] == "BLOCKED" and
           d["G3A_PORTABLE_IMAGE_REPRODUCTION"] == "FAIL" and not d["frozenDigestChanged"] and
           not d["replacementDigestAuthorized"] and not d["secondTransactionRun"] and
           d["postStopTransactionRuns"] == 0 and not (HERE / "clean-room-run2").exists(), "EXACT_GATE_STOP")
    ensure(d["G3A_CONTROLLER"] == d["G3A_BICEP_PACKAGE"] == "INCOMPLETE" and
           d["G3_GRANT_EXECUTOR_MODEL"] == d["G3A_REGISTRY_UPLOADER"] == "BLOCKED", "FALSE_COMPLETENESS")
    for name in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(root[name] == d[name] == 0, "MUTATION_CLAIM")
    ensure(d["newAzureReadCalls"] == 0 and d["G3_TECHNICAL_EXECUTION_AUTHORIZED"] == "NO" and
           d["UE_INFRA"] == d["CORA_INFRA"] == "INFRA_NO_GO", "SCOPE_DRIFT")
    run = HERE / "clean-room-run1-qualified" / "transaction"
    comparison = load(HERE / "EXACT_IMAGE_COMPARISON.json")
    frozen = HERE.parent / "g3-final-readiness" / "local-image-frozen" / "image-run1.tar"
    with tarfile.open(frozen) as archive:
        index = json.load(archive.extractfile("index.json"))
        frozen_digest = index["manifests"][0]["digest"]
        manifest_raw = archive.extractfile("blobs/sha256/" + frozen_digest.split(":")[1]).read()
        manifest = json.loads(manifest_raw)
        config = archive.extractfile("blobs/sha256/" + manifest["config"]["digest"].split(":")[1]).read()
        ensure(config == (run / "config.json").read_bytes(), "CONFIG_NOT_EXACT")
        corrected = manifest_raw.decode()
        for number, blob in enumerate(manifest["layers"], 1):
            old = archive.extractfile("blobs/sha256/" + blob["digest"].split(":")[1]).read()
            new = (run / ("layer" + str(number) + ".tar.gz")).read_bytes()
            raw = gzip.decompress(old)
            ensure(raw == gzip.decompress(new) == (run / ("layer" + str(number) + ".tar")).read_bytes(),
                   "UNCOMPRESSED_CONTENT_NOT_EXACT")
            first_difference = next(i for i, pair in enumerate(zip(old, new)) if pair[0] != pair[1])
            record = comparison["layers"][number - 1]
            ensure(first_difference == record["firstDifferentByteZeroBased"] == 11 and
                   old[:10] == new[:10] and old[-8:] == new[-8:] and
                   blob["digest"] == record["frozenDigest"] and
                   "sha256:" + digest(new) == record["candidateDigest"] and
                   len(old) == record["frozenBytes"] and len(new) == record["candidateBytes"] and
                   "sha256:" + digest(raw) == record["uncompressedDigest"], "COMPRESSION_COMPARISON")
            corrected = corrected.replace(blob["digest"], "sha256:" + digest(new))
            corrected = corrected.replace('"size": ' + str(blob["size"]), '"size": ' + str(len(new)))
            with tarfile.open(fileobj=io.BytesIO(raw)) as layer:
                members = layer.getmembers()
                for item in members:
                    ensure(item.uid == item.gid == 0 and item.mtime == 946684800 and
                           item.type in (tarfile.REGTYPE, tarfile.DIRTYPE), "RUNTIME_TAR_METADATA")
                if number == 1:
                    app = layer.extractfile("g3-runtime").read()
                    ensure(app == (run / "g3-runtime").read_bytes() and
                           digest(app) == d["G3_APP_BINARY_SHA256"] and len(app) == d["G3_APP_BINARY_SIZE"],
                           "COMPILED_APPLICATION_NOT_EXACT")
                    static_elf(app)
                else:
                    cert = layer.extractfile("etc/ssl/certs/ca-certificates.crt").read()
                    ensure(cert == (HERE / "inputs" / "ca-certificates.crt").read_bytes(), "STAGED_CERT_NOT_EXACT")
        ensure(corrected.encode() == (HERE / "CORRECTED_CANDIDATE_MANIFEST_COMPARISON_ONLY.json").read_bytes() and
               "sha256:" + digest(corrected.encode()) == comparison["correctedComparisonOnlyManifest"] and
               comparison["correctedComparisonOnlyManifest"] != frozen_digest and
               frozen_digest == d["FROZEN_G3_IMAGE_MANIFEST_DIGEST"], "CORRECTED_COMPARISON_STILL_NOT_FROZEN")
    inputs = load(HERE / "PORTABLE_INPUT_INVENTORY.json")
    ensure(inputs["totalStagedCandidateInputBytes"] == d["TOTAL_STAGED_INPUT_BYTES"] ==
           sum(entry["bytes"] for entry in inputs["entries"]), "INPUT_TOTAL")
    for entry in inputs["entries"]:
        path, manifest_path = Path(entry["path"]), Path(entry["manifestPath"])
        ensure(sha(path) == entry["sha256"] and path.stat().st_size == entry["bytes"] and
               "sha256:" + sha(manifest_path) == entry["manifestDigest"], "INPUT_MANIFEST_SHA")
        m = load(manifest_path)
        ensure(m["artifactType"] == entry["artifactType"] and m["layers"] == [{
            "mediaType": entry["payloadMediaType"], "digest": "sha256:" + entry["sha256"], "size": entry["bytes"],
        }], "INPUT_MEDIA_DESCRIPTOR")
        count += 2
    members = load(HERE / "inputs" / "toolchain-members.json")
    found = set()
    with tarfile.open(HERE / "inputs" / "go-toolchain.tar") as archive:
        for item in archive:
            ensure(not item.name.startswith("/") and ".." not in Path(item.name).parts and
                   item.type in (tarfile.REGTYPE, tarfile.DIRTYPE), "TOOLCHAIN_UNSAFE_MEMBER")
            if item.isfile():
                entry = members[item.name]
                raw = archive.extractfile(item).read()
                ensure(item.name not in found and digest(raw) == entry["sha256"] and
                       len(raw) == entry["bytes"] and item.mode == entry["mode"], "TOOLCHAIN_MEMBER_HASH_MODE")
                found.add(item.name)
                if item.name in ("bin/go", "pkg/tool/linux_amd64/compile", "pkg/tool/linux_amd64/link"):
                    static_elf(raw)
                count += 1
    ensure(found == set(members), "TOOLCHAIN_CENSUS")
    current = load(HERE / "ASSEMBLER_LOCAL_CHECK_V3.json")
    ensure(current["tests"] == current["vet"] == current["build"] == "PASS" and
           current["testCount"] == 4 and not current["transactionExecuted"], "POST_STOP_TARGETED_CHECK")
    binary = HERE / "assembler" / "portable-assembler-v3"
    ensure(sha(binary) == current["binarySha256"], "CURRENT_BINARY")
    static_elf(binary.read_bytes())
    for name, expected in current["sourceHashes"].items():
        ensure(sha(HERE / "assembler" / name) == expected, "CURRENT_SOURCE")
    for version in (1, 2):
        previous = load(HERE / ("ASSEMBLER_QUALIFICATION" + ("" if version == 1 else "_V2") + ".json"))
        with tarfile.open(HERE / ("assembler-v" + str(version) + ".tar")) as archive:
            for name, expected in previous["sourceHashes"].items():
                ensure(digest(archive.extractfile(name).read()) == expected, "REHEARSED_ASSEMBLER_SOURCE_HISTORY")
            raw = archive.extractfile("portable-assembler").read()
            ensure(digest(raw) == previous["binarySha256"], "REHEARSED_ASSEMBLER_BINARY_HISTORY")
            if version == 2:
                ensure(raw == (HERE / "inputs" / "portable-assembler-v2").read_bytes(),
                       "EXACT_RUN_EXECUTABLE_NOT_BOUND")
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "PORTABLE_BUILDER_REPORT.md").read_text()):
        path = (HERE / target).resolve()
        ensure(path.exists() or path.name == "PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json", "REPORT_LINK")
    result = {
        "status": "PASS_INTEGRITY_NOT_PORTABLE_BUILDER",
        "rootSha256": sys.argv[1], "hashReferencesVerified": count,
        "exactBinaryConfigUncompressedLayersVerified": True,
        "gzipBitstreamMismatchAndCorrectedDescriptorMismatchVerified": True,
        "completeToolchainMemberHashesVerified": len(found),
        "historicExactCensusesAndControllerVersionsVerified": True,
        "sealerImportedOrExecuted": False, "additionalBuildRuns": 0, "additionalAzureCalls": 0,
        "G3A_PORTABLE_PRIVATE_BUILDER": "BLOCKED", "G3_EXECUTION_READINESS": "BLOCKED",
    }
    with (HERE / "PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8", newline="\n") as file:
        json.dump(result, file, indent=2)
        file.write("\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

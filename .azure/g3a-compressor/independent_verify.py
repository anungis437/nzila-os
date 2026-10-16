"""Direct-byte verifier; no sealer import, compressor candidate, engine or cloud calls."""

import gzip
import hashlib
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


def inline_buildinfo(raw):
    positions = []
    start = 0
    magic = b"\xff Go buildinf:"
    while True:
        index = raw.find(magic, start)
        if index == -1:
            break
        if index % 16 == 0 and index + 32 <= len(raw) and raw[index + 15] & 2:
            positions.append(index)
        start = index + len(magic)
    ensure(len(positions) == 1, "GO_BUILDINFO_HEADER_CENSUS")
    offset = positions[0] + 32
    def read_string():
        nonlocal offset
        length, shift = 0, 0
        while True:
            ensure(offset < len(raw) and shift <= 63, "GO_BUILDINFO_VARINT_BOUND")
            byte = raw[offset]
            offset += 1
            length |= (byte & 127) << shift
            if byte < 128:
                break
            shift += 7
        ensure(offset + length <= len(raw), "GO_BUILDINFO_STRING_BOUND")
        value = raw[offset:offset + length]
        offset += length
        return value
    return read_string().decode(), read_string()


def main():
    ensure(len(sys.argv) == 2 and re.fullmatch(r"[0-9a-f]{64}", sys.argv[1]), "EXPECTED_ROOT_SHA_REQUIRED")
    root_path = HERE / "COMPRESSOR_VERIFICATION.json"
    ensure(sha(root_path) == sys.argv[1], "ROOT_SHA_MISMATCH")
    root = load(root_path)
    excluded = {"COMPRESSOR_VERIFICATION.json", "COMPRESSOR_INDEPENDENT_VERIFICATION.json"}
    census = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in excluded}
    ensure(census == root["compressorFileHashes"], "COMPRESSOR_EXACT_CENSUS")
    count = len(census) + 1
    for relative, expected in root["preservedPacketHashes"].items():
        ensure(sha(ROOT / relative) == expected, "HISTORIC_BYTES_CHANGED")
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
        ("g3a-portable", "PORTABLE_BUILDER_VERIFICATION.json", "portableFileHashes",
         {"PORTABLE_BUILDER_VERIFICATION.json", "PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json"}),
    ):
        base = HERE.parent / directory
        actual = {str(path.relative_to(base)): sha(path) for path in base.rglob("*")
                  if path.is_file() and path.name not in names}
        ensure(actual == load(base / filename)[key], "HISTORIC_EXACT_CENSUS_CHANGED")
        count += len(actual)
    ensure(sha(Path(root["authorityPath"])) == root["authoritySha256"], "AUTHORITY_BYTES")
    d = load(HERE / "COMPRESSOR_DISPOSITION.json")
    ensure(d["G3_EXECUTION_READINESS"] == d["G3A_PORTABLE_PRIVATE_BUILDER"] == "BLOCKED" and
           d["FROZEN_COMPRESSOR_CONTRACT"] == d["G3A_COMPRESSOR_INPUT"] == "UNRESOLVED" and
           d["APP_LAYER_EXACT"] == d["CERT_LAYER_EXACT"] == d["G3A_COMPRESSOR_DETERMINISM"] == "NOT_RUN",
           "FALSE_COMPRESSOR_QUALIFICATION")
    for name in ("AZURE_MUTATIONS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS"):
        ensure(root[name] == d[name] == 0, "MUTATION_CLAIM")
    ensure(not d["frozenDigestChanged"] and d["applicationBuilds"] == d["fullTransactions"] == 0 and
           not d["guestExecution"] and d["registryTests"] == 0 and not d["uploaderWork"] and
           d["G3_TECHNICAL_EXECUTION_AUTHORIZED"] == "NO" and
           d["UE_INFRA"] == d["CORA_INFRA"] == "INFRA_NO_GO", "SCOPE_DRIFT")
    binary = HERE / "dockerd-original"
    metadata = load(HERE / "EXACT_DAEMON_BINARY.json")
    ensure(sha(binary) == metadata["sha256"] == d["FROZEN_BUILDKIT_BINARY_SHA256"] and
           binary.stat().st_size == metadata["bytes"], "EXACT_ENGINE_BINARY")
    raw = binary.read_bytes()
    ensure(raw[:6] == b"\x7fELF\x02\x01" and raw[18:20] == b"\x3e\x00", "ENGINE_ELF_TARGET")
    version, module = inline_buildinfo(raw)
    ensure(version == "go1.25.6" and b"\tgithub.com/moby/buildkit\tv0.27.0\t" in module and
           b"path\tgithub.com/moby/moby/v2/cmd/dockerd" in module, "DIRECT_BYTE_GO_MODULE_BUILDINFO")
    provenance = load(HERE / "ENGINE_PROVENANCE.json")
    ensure(provenance["currentComponentProvenance"] == "EXACT_BINARY" and
           provenance["historicalFrozenBuildAssociation"] == "VERSION_ONLY" and
           provenance["buildkitCommit"] == "UNPROVEN", "OVERCLAIM_HISTORIC_ENGINE_PROVENANCE")
    frozen = HERE.parent / "g3-final-readiness" / "local-image-frozen" / "image-run1.tar"
    fixtures = load(HERE / "FROZEN_FIXTURES.json")
    with tarfile.open(frozen) as archive:
        index = json.load(archive.extractfile("index.json"))
        ensure(index["manifests"][0]["digest"] == d["frozenManifest"], "FROZEN_MANIFEST")
        manifest = json.load(archive.extractfile("blobs/sha256/" + d["frozenManifest"].split(":")[1]))
        for descriptor, fixture in zip(manifest["layers"], fixtures["entries"]):
            compressed = archive.extractfile("blobs/sha256/" + descriptor["digest"].split(":")[1]).read()
            raw = gzip.decompress(compressed)
            tar_path = HERE / "fixtures" / (fixture["name"] + ".tar")
            gz_path = HERE / "fixtures" / (fixture["name"] + ".frozen.gz")
            ensure(raw == tar_path.read_bytes() and compressed == gz_path.read_bytes() and
                   sha(tar_path) == fixture["tarSha256"] and tar_path.stat().st_size == fixture["tarBytes"] and
                   sha(gz_path) == fixture["gzipSha256"] and gz_path.stat().st_size == fixture["gzipBytes"],
                   "FROZEN_FIXTURES_NOT_EXACT")
            count += 2
    old = load(HERE.parent / "g3a-portable" / "EXACT_IMAGE_COMPARISON.json")
    ensure(old["status"] == "FAIL_EXACT_FROZEN_MANIFEST_STOP" and all(
        entry["firstDifferentByteZeroBased"] == 11 and entry["uncompressedBytesEqual"]
        for entry in old["layers"]), "PRIOR_MISMATCH_HISTORY")
    toolchain = load(HERE / "PROPOSED_GO_1_25_6_INPUT.json")
    ensure(toolchain["version"] == "go1.25.6" and toolchain["file"]["size"] == 59768880 and
           toolchain["file"]["sha256"] == "f022b6aad78e362bcba9b0b94d09ad58c5a70c6ba3b7582905fababf5fe0181a" and
           not toolchain["toolchainDownloaded"] and not toolchain["toolchainInstalled"], "PROPOSED_NOT_ACQUIRED")
    check = load(HERE / "HARNESS_DEVELOPMENT_CHECK.json")
    ensure(check["compiler"] == "go1.27.2" and check["tests"] == 3 and
           not check["frozenAppCompressionRun"] and not check["frozenCertCompressionRun"],
           "SYNTHETIC_CHECK_NOT_EXACT_CANDIDATE")
    ensure(sha(HERE / "harness" / "harness-development-only") == check["binarySha256"], "HARNESS_BINARY")
    for name, expected in check["sourceHashes"].items():
        ensure(sha(HERE / "harness" / name) == expected, "HARNESS_SOURCE")
    matrix = load(HERE / "CANDIDATE_MATRIX.json")
    ensure([entry["id"] for entry in matrix["candidates"]] == ["A", "B", "C"] and
           all(entry["app"] == entry["cert"] == "NOT_RUN" for entry in matrix["candidates"]) and
           matrix["frozenFixtureCandidateCompressionRuns"] == 0, "CANDIDATE_GATE_ORDER")
    for entry in load(HERE / "PUBLIC_SOURCE_PROVENANCE.json"):
        ensure(sha(HERE / entry["name"]) == entry["sha256"], "SOURCE_PROVENANCE")
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", (HERE / "COMPRESSOR_REPORT.md").read_text()):
        path = (HERE / target).resolve()
        ensure(path.exists() or path.name == "COMPRESSOR_INDEPENDENT_VERIFICATION.json", "REPORT_LINK")
    result = {
        "status": "PASS_INTEGRITY_NOT_COMPRESSOR_QUALIFICATION", "rootSha256": sys.argv[1],
        "hashReferencesVerified": count, "rawEngineInlineGoBuildInfoVerified": True,
        "recoveredEngineGoVersion": version, "rawFrozenTarGzipFixturesVerified": True,
        "allHistoricExactCensusesVerified": True, "sealerImportedOrExecuted": False,
        "newCompressionRuns": 0, "applicationBuilds": 0, "additionalAzureCalls": 0,
        "FROZEN_COMPRESSOR_CONTRACT": "UNRESOLVED", "G3_EXECUTION_READINESS": "BLOCKED",
    }
    with (HERE / "COMPRESSOR_INDEPENDENT_VERIFICATION.json").open("x", encoding="utf-8", newline="\n") as file:
        json.dump(result, file, indent=2)
        file.write("\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

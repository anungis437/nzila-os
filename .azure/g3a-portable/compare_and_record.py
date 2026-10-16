"""Exact-gate comparison and candidate input envelopes; never runs the transaction."""

import ast
import datetime
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
FROZEN = HERE.parent / "g3-final-readiness" / "local-image-frozen"
RUN = HERE / "clean-room-run1-qualified" / "transaction"
COMPILER = "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8"


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def fresh(path, raw):
    with path.open("xb") as file:
        file.write(raw)


def output(name, value):
    fresh(HERE / name, (json.dumps(value, indent=2) + "\n").encode())


def main():
    args = ["docker", "run", "--rm", "--network", "none", "--mount",
            "type=bind,source=" + str(HERE / "assembler") + ",target=/src", "--workdir", "/src",
            "--env", "CGO_ENABLED=0", "--env", "GOTOOLCHAIN=local", "--env", "GOPROXY=off",
            "--env", "GOSUMDB=off", COMPILER, "sh", "-c",
            'gofmt -w main.go main_test.go && go test -v ./... && go vet ./... && '
            'go build -trimpath -buildvcs=false -ldflags="-buildid= -s -w" -o portable-assembler-v3 .']
    check = subprocess.run(args, capture_output=True, text=True, timeout=180)
    fresh(HERE / "ASSEMBLER_LOCAL_CHECK_V3_CORRECTED.txt", (check.stdout + check.stderr).encode())
    if check.returncode or check.stdout.count("--- PASS: Test") != 4:
        raise RuntimeError("ASSEMBLER_TARGETED_CHECK_FAILED")
    current_binary = (HERE / "assembler" / "portable-assembler-v3").read_bytes()
    output("ASSEMBLER_LOCAL_CHECK_V3.json", {
        "command": args, "testCount": 4, "tests": "PASS", "vet": "PASS", "build": "PASS",
        "transactionExecuted": False,
        "scope": "DESCRIPTOR_SIZE_BUG_FIXED_TESTED_NO_REHEARSAL_AFTER_EXACT_GATE_STOP",
        "binarySha256": sha(current_binary), "binaryBytes": len(current_binary),
        "sourceHashes": {name: sha((HERE / "assembler" / name).read_bytes())
                         for name in ("go.mod", "main.go", "main_test.go")},
    })
    comparisons = []
    with tarfile.open(FROZEN / "image-run1.tar") as archive:
        old_index_raw = archive.extractfile("index.json").read()
        index = json.loads(old_index_raw)
        old_manifest_raw = archive.extractfile("blobs/sha256/" + index["manifests"][0]["digest"].split(":")[1]).read()
        old_manifest = json.loads(old_manifest_raw)
        old_config = archive.extractfile("blobs/sha256/" + old_manifest["config"]["digest"].split(":")[1]).read()
        for number, descriptor in enumerate(old_manifest["layers"], 1):
            old = archive.extractfile("blobs/sha256/" + descriptor["digest"].split(":")[1]).read()
            new = (RUN / ("layer" + str(number) + ".tar.gz")).read_bytes()
            raw = gzip.decompress(old)
            if raw != gzip.decompress(new) or raw != (RUN / ("layer" + str(number) + ".tar")).read_bytes():
                raise RuntimeError("UNCOMPRESSED_LAYER_NOT_EXACT")
            at = next(i for i, pair in enumerate(zip(old, new)) if pair[0] != pair[1])
            comparisons.append({
                "layer": number, "frozenDigest": "sha256:" + sha(old),
                "candidateDigest": "sha256:" + sha(new),
                "frozenBytes": len(old), "candidateBytes": len(new),
                "firstDifferentByteZeroBased": at,
                "frozenBytesAroundDifference": old[max(0, at-8):at+16].hex(),
                "candidateBytesAroundDifference": new[max(0, at-8):at+16].hex(),
                "gzipHeaderFrozen": old[:10].hex(), "gzipHeaderCandidate": new[:10].hex(),
                "gzipTrailerFrozen": old[-8:].hex(), "gzipTrailerCandidate": new[-8:].hex(),
                "uncompressedBytes": len(raw), "uncompressedDigest": "sha256:" + sha(raw),
                "uncompressedBytesEqual": True,
                "causeAtByteLevel": "DEFLATE_BITSTREAM_DIFFERS_HEADER_CRC_ISIZE_TAR_CONTENT_IDENTICAL",
            })
        if old_config != (RUN / "config.json").read_bytes():
            raise RuntimeError("CONFIG_NOT_EXACT")
        first = gzip.decompress(archive.extractfile("blobs/sha256/" +
                                                  old_manifest["layers"][0]["digest"].split(":")[1]).read())
        import io
        with tarfile.open(fileobj=io.BytesIO(first)) as layer:
            app = layer.extractfile("g3-runtime").read()
        if app != (RUN / "g3-runtime").read_bytes():
            raise RuntimeError("APPLICATION_BINARY_NOT_EXACT")
    result = json.loads((RUN / "result.json").read_text())
    # Pure comparison only: correct descriptors over retained candidate layers, no build rerun.
    corrected = old_manifest_raw.decode()
    for number, descriptor in enumerate(old_manifest["layers"], 1):
        data = (RUN / ("layer" + str(number) + ".tar.gz")).read_bytes()
        corrected = corrected.replace(descriptor["digest"], "sha256:" + sha(data))
        old_size = '"size": ' + str(descriptor["size"])
        if corrected.count(old_size) != 1:
            raise RuntimeError("FROZEN_PRETTY_DESCRIPTOR_SIZE_BINDING")
        corrected = corrected.replace(old_size, '"size": ' + str(len(data)))
    fresh(HERE / "CORRECTED_CANDIDATE_MANIFEST_COMPARISON_ONLY.json", corrected.encode())
    corrected_obj = json.loads(corrected)
    for number, descriptor in enumerate(corrected_obj["layers"], 1):
        payload = (RUN / ("layer" + str(number) + ".tar.gz")).read_bytes()
        if descriptor["digest"] != "sha256:" + sha(payload) or descriptor["size"] != len(payload):
            raise RuntimeError("CORRECTED_CANDIDATE_DESCRIPTOR_INVALID")
    output("EXACT_IMAGE_COMPARISON.json", {
        "status": "FAIL_EXACT_FROZEN_MANIFEST_STOP",
        "frozenManifest": index["manifests"][0]["digest"], "observedManifest": result["manifestDigest"],
        "observedManifestDescriptorSizesValid": False,
        "candidateDescriptorBug": "Pretty JSON size fields were not matched by compact-only replacement.",
        "candidateDescriptorBugCorrection": "Local source regression fix/test only; no further full transaction.",
        "correctedComparisonOnlyManifest": "sha256:" + sha(corrected.encode()),
        "correctedComparisonStillEqualsFrozen": "sha256:" + sha(corrected.encode()) == index["manifests"][0]["digest"],
        "exactApplicationBinary": True, "binarySha256": sha(app), "binaryBytes": len(app),
        "exactConfig": True, "configDigest": "sha256:" + sha(old_config),
        "layers": comparisons,
        "hostMetadataDifferenceProven": False,
        "frozenDigestReplacementJustified": False,
        "compressionImplementationVersionAndStreamingContract": "UNBOUND_FOR_FROZEN_BUILD_ENGINE",
        "noClaimOfImpossibleReproduction": True, "secondCleanRoomTransaction": "NOT_RUN_REQUIRED_STOP",
        "uploaderOrCloudExecutionAfterGate": False,
    })
    # Public-source retrieval carries no workspace content or credentials.
    url = "https://raw.githubusercontent.com/moby/buildkit/v0.27.0/util/compression/gzip.go"
    with urllib.request.urlopen(url, timeout=30) as response:
        public = response.read(65537)
    if len(public) > 65536 or b'"compress/gzip"' not in public:
        raise RuntimeError("PUBLIC_COMPRESSOR_SOURCE_BINDING")
    fresh(HERE / "PUBLIC_BUILDKIT_GZIP_V0_27_0.txt", public)
    output("PUBLIC_COMPRESSOR_PROVENANCE.json", {
        "url": url, "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sha256": sha(public), "bytes": len(public), "upstreamVersion": "v0.27.0",
        "observation": "Go stdlib compress/gzip default level; installed engine compiler/runtime and stream boundaries not proven.",
        "localContentSent": False,
    })
    oci = HERE / "oci"
    oci.mkdir()
    bindings = json.loads((HERE / "inputs" / "binding.json").read_text())
    inventory = []
    payloads = {
        **{name: HERE / "inputs" / name for name in bindings["inputs"]},
        "binding.json": HERE / "inputs" / "binding.json",
        "portable-assembler-v3": HERE / "assembler" / "portable-assembler-v3",
    }
    for name, path in payloads.items():
        raw = path.read_bytes()
        kind = "source" if name == "source.tar" else "tooling"
        artifact = "application/vnd.nzila.g3.portable." + name.replace(".", "-") + ".v1"
        media = artifact + (".tar" if path.suffix == ".tar" else ".payload")
        manifest = {
            "schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json",
            "artifactType": artifact,
            "config": {"mediaType": "application/vnd.oci.empty.v1+json", "size": 2,
                       "digest": "sha256:" + sha(b"{}")},
            "layers": [{"mediaType": media, "size": len(raw), "digest": "sha256:" + sha(raw)}],
        }
        if name == "source.tar":
            manifest_raw = (HERE / "inputs" / "source-manifest.json").read_bytes()
            manifest = json.loads(manifest_raw)
            artifact, media = manifest["artifactType"], manifest["layers"][0]["mediaType"]
        else:
            manifest_raw = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
        manifest_name = name.replace(".", "-") + "-manifest.json"
        fresh(oci / manifest_name, manifest_raw)
        source = "DERIVED_PINNED_COMPILER_SUBTREE" if name == "go-toolchain.tar" else (
            "PINNED_COMPILER_CA_FILE" if name == "ca-certificates.crt" else (
                "LOCAL_ASSEMBLER_SOURCE_QUALIFIED_V3_NOT_FULL_TRANSACTION" if name == "portable-assembler-v3"
                else "SEALED_SOURCE_READER_OR_GOVERNED_SERIALIZATION_METADATA"))
        inventory.append({
            "name": name, "path": str(path), "source": source,
            "version": "Go1.27.2" if name == "go-toolchain.tar" else "FROZEN_G3_OR_LOCAL_CANDIDATE_V3",
            "sha256": sha(raw), "bytes": len(raw), "repository": "g3-build-" + kind,
            "artifactType": artifact, "payloadMediaType": media,
            "manifestPath": str(oci / manifest_name), "manifestDigest": "sha256:" + sha(manifest_raw),
        })
    output("PORTABLE_INPUT_INVENTORY.json", {
        "status": "FROZEN_CANDIDATE_INPUTS_NOT_COMPLETE_TRANSACTION",
        "entries": inventory, "totalStagedCandidateInputBytes": sum(item["bytes"] for item in inventory),
        "controller": "ASSEMBLER_CANDIDATE_ONLY_NOT_PRIVATE_GUEST_TRANSACTION",
        "originalOneSourceOneToolingStagingEnvelope": "NOT_REPLACED_NOT_CLAIMED_COMPATIBLE_WITH_MULTIPLE_CANDIDATE_ARTIFACTS",
        "separateUtilityEnvelope": "LOCAL_CANDIDATE_NOT_PUSHED",
        "registryMutations": 0,
    })
    for path in HERE.rglob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    print(json.dumps({"exactGate": "FAIL_STOP", "binaryAndUncompressedLayers": "EXACT",
                      "correctedComparisonManifest": "sha256:" + sha(corrected.encode()),
                      "inputs": len(inventory), "postStopTransactionRuns": 0}, indent=2))


if __name__ == "__main__":
    main()

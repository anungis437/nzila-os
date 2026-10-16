"""Freeze synthetic-only OCI input envelopes without pushing to any registry."""

import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / "g3-final-readiness" / "local-image-frozen"
LANE = HERE.parent / "g3-execution-lane"
SOURCE_TYPE = "application/vnd.nzila.g3.build-source.v1"
TOOLING_TYPE = "application/vnd.nzila.g3.build-tooling.v1"
SOURCE_MEDIA = "application/vnd.nzila.g3.source.tar.v1"
TOOLING_MEDIA = "application/vnd.nzila.g3.compiler.dockerarchive.tar.v1"
MANIFEST_MEDIA = "application/vnd.oci.image.manifest.v1+json"


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def envelope(payload, artifact_type, payload_media):
    manifest = {
        "schemaVersion": 2, "mediaType": MANIFEST_MEDIA, "artifactType": artifact_type,
        "config": {"mediaType": "application/vnd.oci.empty.v1+json",
                   "digest": "sha256:" + hashlib.sha256(b"{}").hexdigest(), "size": 2},
        "layers": [{"mediaType": payload_media, "digest": "sha256:" + sha(payload),
                    "size": payload.stat().st_size}],
    }
    return canonical(manifest)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def main():
    contracts = {}
    directory = HERE / "oci"
    directory.mkdir()
    for name, path, repository, artifact_type, media in (
        ("source", OLD / "source.tar", "g3-build-source", SOURCE_TYPE, SOURCE_MEDIA),
        ("compiler", LANE / "compiler-dockerarchive.tar", "g3-build-tooling", TOOLING_TYPE, TOOLING_MEDIA),
    ):
        raw = envelope(path, artifact_type, media)
        manifest = directory / (name + "-manifest.json")
        with manifest.open("xb") as file:
            file.write(raw)
        contracts[name] = {
            "payloadPath": str(path), "sha256": sha(path), "bytes": path.stat().st_size,
            "repository": repository, "manifestPath": str(manifest),
            "manifestDigest": "sha256:" + sha(manifest), "manifestBytes": len(raw),
            "artifactType": artifact_type, "payloadMediaType": media,
            "tag": "g3-" + sha(path), "configBytes": 2,
            "provenance": "PRESERVED_LOCAL_FROZEN_SYNTHETIC_SOURCE" if name == "source" else
                          "PRESERVED_LOCAL_PINNED_GOLANG_OCI_EXPORT",
        }
    with (directory / "empty-config.json").open("xb") as file:
        file.write(b"{}")
    result = {
        "status": "PARTIAL_FROZEN_SOURCE_AND_COMPILER_NOT_FULL_TOOLING",
        "contracts": contracts, "registryMutations": 0,
        "portableBuilderUtilityArchive": {"status": "NOT_PRODUCED", "bytes": None, "sha256": None},
        "fullInputOCIContract": "BLOCKED_COMPLETE_TOOLING_NOT_BOUND",
    }
    with (HERE / "OCI_INPUT_CONTRACT.json").open("x", encoding="utf-8") as file:
        json.dump(result, file, indent=2)
        file.write("\n")
    print("SOURCE_COMPILER_OCI_ENVELOPES = FROZEN_LOCAL_ONLY")


if __name__ == "__main__":
    main()

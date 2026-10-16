"""Freeze portable inputs from sealed source/compiler; no host image-cache reads."""

import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import tarfile

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / "g3-input-readiness"
COMPILER = HERE.parent / "g3-execution-lane" / "compiler-dockerarchive.tar"
FROZEN = HERE.parent / "g3-final-readiness" / "local-image-frozen"


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def write(path, raw):
    with path.open("xb") as file:
        file.write(raw)


def main():
    inputs = HERE / "inputs"
    inputs.mkdir()
    contract = json.loads((PRIOR / "OCI_INPUT_CONTRACT.json").read_text())
    for key, path in (("source", FROZEN / "source.tar"), ("compiler", COMPILER)):
        raw = path.read_bytes()
        entry = contract["contracts"][key]
        if len(raw) != entry["bytes"] or digest(raw) != entry["sha256"]:
            raise RuntimeError("PRESERVED_INPUT_AUTHORITY_MISMATCH")
        if key == "source":
            write(inputs / "source.tar", raw)
            write(inputs / "source-manifest.json", Path(entry["manifestPath"]).read_bytes())
    members, cert = {}, None
    with tarfile.open(COMPILER) as archive:
        index = json.load(archive.extractfile("index.json"))
        authority = index["manifests"][0]
        if authority["digest"] != "sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8":
            raise RuntimeError("COMPILER_MANIFEST_AUTHORITY")
        raw = archive.extractfile("blobs/sha256/" + authority["digest"].split(":")[1]).read()
        if "sha256:" + digest(raw) != authority["digest"]:
            raise RuntimeError("COMPILER_MANIFEST_BYTES")
        manifest = json.loads(raw)
        for blob in manifest["layers"]:
            raw = archive.extractfile("blobs/sha256/" + blob["digest"].split(":")[1]).read()
            if "sha256:" + digest(raw) != blob["digest"] or len(raw) != blob["size"]:
                raise RuntimeError("COMPILER_LAYER_BYTES")
            with tarfile.open(fileobj=io.BytesIO(raw)) as layer:
                for member in layer:
                    name = member.name
                    if name == "etc/ssl/certs/ca-certificates.crt":
                        if not member.isfile():
                            raise RuntimeError("CERTIFICATE_NOT_REGULAR")
                        cert = layer.extractfile(member).read()
                    if not name.startswith("usr/local/go/"):
                        continue
                    path = PurePosixPath(name)
                    if path.is_absolute() or ".." in path.parts or not (member.isdir() or member.isfile()):
                        raise RuntimeError("COMPILER_UNSAFE_MEMBER")
                    if name in members:
                        raise RuntimeError("COMPILER_DUPLICATE_MEMBER")
                    members[name] = (member.mode, layer.extractfile(member).read() if member.isfile() else None)
    if cert is None or digest(cert) != "028fca5150ee1915c4474489985d55c54fceaa680c754cc8d1301734f01b2232":
        raise RuntimeError("RUNTIME_CERTIFICATE_AUTHORITY")
    write(inputs / "ca-certificates.crt", cert)
    # A normalized uncompressed toolchain archive avoids an extra decompressor executable.
    inventory = {}
    with tarfile.open(inputs / "go-toolchain.tar", "x", format=tarfile.USTAR_FORMAT) as output:
        for name in sorted(members):
            mode, raw = members[name]
            relative = name.removeprefix("usr/local/go/")
            entry = tarfile.TarInfo(relative)
            entry.mode, entry.uid, entry.gid, entry.mtime = mode, 0, 0, 946684800
            if raw is None:
                entry.type = tarfile.DIRTYPE
                output.addfile(entry)
            else:
                entry.size = len(raw)
                output.addfile(entry, io.BytesIO(raw))
                inventory[relative] = {"sha256": digest(raw), "bytes": len(raw), "mode": mode}
    # Only JSON metadata templates, never prebuilt application/layer content, enter inputs.
    with tarfile.open(FROZEN / "image-run1.tar") as image:
        index_raw = image.extractfile("index.json").read()
        index = json.loads(index_raw)
        manifest_raw = image.extractfile("blobs/sha256/" + index["manifests"][0]["digest"].split(":")[1]).read()
        manifest = json.loads(manifest_raw)
        config = image.extractfile("blobs/sha256/" + manifest["config"]["digest"].split(":")[1]).read()
        for name, raw in (("config-template.json", config), ("manifest-template.json", manifest_raw),
                          ("index-template.json", index_raw)):
            write(inputs / name, raw)
    write(inputs / "toolchain-members.json", (json.dumps(inventory, sort_keys=True, separators=(",", ":")) + "\n").encode())
    write(inputs / "private-reader.py", (PRIOR / "private_reader.py").read_bytes())
    entries = {}
    for path in sorted(inputs.iterdir()):
        raw = path.read_bytes()
        entries[path.name] = {"bytes": len(raw), "sha256": digest(raw)}
    qualification = json.loads((FROZEN / "LOCAL_IMAGE_QUALIFICATION.json").read_text())
    source = {}
    with tarfile.open(inputs / "source.tar") as archive:
        for member in archive:
            raw = archive.extractfile(member).read()
            if "sha256:" + digest(raw) != qualification["sourceFileHashes"][member.name]:
                raise RuntimeError("SOURCE_MEMBER_AUTHORITY")
            source[member.name] = {"sha256": digest(raw), "bytes": len(raw), "mode": member.mode}
    value = {"inputs": entries, "sourceMembers": source, "compilerManifest": authority["digest"],
             "runtimeCertificateSource": "EXACT_CA_FILE_FROM_PINNED_COMPILER_LAYERS",
             "runtimeBaseDependency": "STAGED_IMMUTABLE_INPUT",
             "metadataTemplates": "SERIALIZATION_CONTRACT_ONLY_NOT_FROZEN_OUTPUT_LAYERS_OR_BINARY",
             "frozenManifest": index["manifests"][0]["digest"],
             "expectedBinarySha256": "5a1ab8fdd71a8db76220de0d8867eea6c5a1fedd2889cfe9092f3e6f98d9f7b0",
             "localTransport": "MANIFEST_DESCRIPTOR_SHA_VALIDATION_FIXTURE_NOT_NETWORK_PROOF"}
    write(inputs / "binding.json", (json.dumps(value, indent=2) + "\n").encode())
    print(json.dumps({"frozenInputs": len(entries), "toolchainFiles": len(inventory),
                      "toolchainBytes": entries["go-toolchain.tar"]["bytes"]}, indent=2))


if __name__ == "__main__":
    main()
